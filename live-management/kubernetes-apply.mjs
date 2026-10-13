import { validateChangeBatch } from '../simple-network-manager-dev/pkg/simple-network-manager/config/change-batch.mjs';
import { validateRouteDependencies } from './route-dependencies.mjs';
import { validateIssuerDeletions } from './issuer-dependencies.mjs';
const types = {
  'v1/Service': ['services', true], 'v1/Secret': ['secrets', true],
  'networking.k8s.io/v1/Ingress': ['ingresses', true],
  'cert-manager.io/v1/Certificate': ['certificates', true], 'cert-manager.io/v1/Issuer': ['issuers', true], 'cert-manager.io/v1/ClusterIssuer': ['clusterissuers', false],
  ...Object.fromEntries(['IngressRoute','IngressRouteTCP','IngressRouteUDP','Middleware','ServersTransport','ServersTransportTCP'].map(kind=>[`traefik.io/v1alpha1/${kind}`,[kind.toLowerCase()+'s',true]])),
};
export function resourcePath(resource) {
  const type = types[`${resource.apiVersion}/${resource.kind}`];
  if (!type) throw new Error(`Unsupported managed resource: ${resource.apiVersion}/${resource.kind}`);
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(resource.metadata?.name || '') || type[1] && !/^[a-z0-9][a-z0-9-]*$/.test(resource.metadata.namespace || '')) throw new Error('Invalid resource identity or missing namespace.');
  const prefix = resource.apiVersion === 'v1' ? '/api/v1' : `/apis/${resource.apiVersion}`;
  return `${prefix}${type[1] ? `/namespaces/${resource.metadata.namespace}` : ''}/${type[0]}/${resource.metadata.name}`;
}
function includesExpected(actual,expected) {
  if(expected===null || typeof expected!=='object')return actual===expected;
  if(Array.isArray(expected))return Array.isArray(actual)&&expected.length===actual.length&&expected.every((v,i)=>includesExpected(actual[i],v));
  return actual && Object.entries(expected).every(([key,value])=>includesExpected(actual[key],value));
}
export async function applyResourceChanges(changes, call, observations) {
  validateChangeBatch(changes);
  await validateIssuerDeletions(changes,call);
  await validateRouteDependencies(changes,call,observations);
  const batch = [];
  for (const change of changes) {
    if (!change.resources?.length) throw new Error(`No executable Kubernetes resources in ${change.name}. This configuration requires a manager-specific operation.`);
    for (const resource of change.resources) {
      const path = resourcePath(resource); const operation = change.configuration?.operation || 'Apply';
      let current;
      try { current = await call(path); } catch (e) { if (e.status !== 404) throw e; }
      if (observations) {
        const expected=observations.get(path);
        if (!expected && current || expected && !current || expected && (expected.uid!==current.metadata.uid || expected.resourceVersion!==current.metadata.resourceVersion))
          throw new Error(`The reviewed target changed: ${resource.kind} ${resource.metadata.name}. Refresh and review again.`);
      }
      if (current && resource.metadata.uid && resource.metadata.uid !== current.metadata.uid) throw new Error(`The target was replaced: ${resource.kind} ${resource.metadata.name}`);
      if (current && resource.metadata.resourceVersion && resource.metadata.resourceVersion !== current.metadata.resourceVersion) throw new Error(`The target changed: ${resource.kind} ${resource.metadata.name}`);
      const body = JSON.parse(JSON.stringify(resource));
      body.metadata = { ...body.metadata, ...(current ? { resourceVersion: current.metadata.resourceVersion } : {}) };
      delete body.status; delete body.metadata.managedFields;
      const init = operation === 'Delete'
        ? { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiVersion: 'v1', kind: 'DeleteOptions', preconditions: { uid: current?.metadata.uid, resourceVersion: current?.metadata.resourceVersion }, ...(['Certificate','Issuer','ClusterIssuer'].includes(resource.kind) ? {propagationPolicy:'Orphan'} : {}) }) }
        : { method: 'PATCH', headers: { 'Content-Type': 'application/apply-patch+yaml' }, body: JSON.stringify(body) };
      if (operation === 'Delete' && !current) continue;
      const query = operation === 'Delete' ? '' : 'fieldManager=network-manager&force=false&';
      // DELETE decodes DeleteOptions from its JSON body. The query alone is ignored
      // by this API, so it must never be used as a supposedly harmless validation.
      const dryInit=operation==='Delete'?{...init,body:JSON.stringify({...JSON.parse(init.body),dryRun:['All']})}:init;
      await call(`${path}?${query}dryRun=All`, dryInit);
      batch.push({ path, query, init, operation, body, identity: `${resource.kind}/${resource.metadata.namespace || ''}/${resource.metadata.name}` });
    }
  }
  const applied = [];
  for (const item of batch) {
    try {
      const result = await call(item.path + (item.query ? `?${item.query.slice(0,-1)}` : ''), item.init);
      const receipt={identity:item.identity,operation:item.operation,resourceVersion:result?.metadata?.resourceVersion,readBack:false};applied.push(receipt);
      let observed;
      try{observed=await call(item.path);}catch(error){if(item.operation!=='Delete'||error.status!==404)throw error;}
      if(item.operation==='Delete') {
        if(observed && !observed.metadata?.deletionTimestamp)throw new Error(`Deletion was not observed: ${item.identity}`);
      } else {
        const desired=Object.fromEntries(['spec','data','stringData','type'].filter(k=>item.body[k]!==undefined).map(k=>[k,item.body[k]]));
        desired.metadata=Object.fromEntries(['name','namespace','labels','annotations'].filter(k=>item.body.metadata[k]!==undefined).map(k=>[k,item.body.metadata[k]]));
        // Kubernetes converts Secret stringData to data; check its encoded values.
        if(desired.stringData){desired.data={...desired.data,...Object.fromEntries(Object.entries(desired.stringData).map(([k,v])=>[k,btoa(unescape(encodeURIComponent(v)))]))};delete desired.stringData;}
        if(result?.metadata?.uid && observed?.metadata?.uid!==result.metadata.uid || !includesExpected(observed,desired))throw new Error(`Applied resource readback differs: ${item.identity}`);
      }
      receipt.readBack=true;
    }
    catch (error) { error.applied = applied; error.message = `${error.message} ${applied.length} resources were accepted before the failure; retained proposals require reconciliation against the recovery snapshot.`; throw error; }
  }
  return { applied, completedAt: new Date().toISOString() };
}
