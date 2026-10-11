import { resourceCoverageId } from './snapshot-coverage.mjs';
import { snapshotManifests } from './manifest-yaml.mjs';
const copy=value=>JSON.parse(JSON.stringify(value));
export function snapshotItems(current={}){const items=[];const add=(id,type,value,name,namespace='')=>items.push({id,type,value:copy(value),name,namespace});
 for(const config of [current.configuration,...(current.relatedConfigurations||[])].filter(Boolean))add(`configuration/${config.id}`,'configuration',config,config.name,config.namespace);
 for(const resource of snapshotManifests(current))add(resourceCoverageId(resource),'resource',resource,resource.metadata.name,resource.metadata.namespace);
 for(const profile of current.issuerProfiles||[])add(`issuer-profile/${profile.name}`,'issuer',profile,profile.name,profile.manifest?.metadata?.namespace);
 for(const service of current.observedServiceReferences||[])add(`service/${service.namespace||''}/${service.name}`,'service',service,service.name,service.namespace);
 for(const [type,list]of [['publication',current.localPublications||[]],['connection',current.editedConnections||[]]])for(const draft of list)add(`draft/${type}/${draft.namespace}/${draft.name}`,type,draft,draft.name,draft.namespace);
 for(const proposal of current.pendingChanges||[])add(`proposal/${proposal.id}`,'proposal',proposal,proposal.name,proposal.namespace);
 return [...new Map(items.map(item=>[item.id,item])).values()];}
export function itemsToCurrent(items,original={}){const configs=items.filter(i=>i.type==='configuration').map(i=>i.value);return {...original,configuration:configs[0],relatedConfigurations:configs.slice(1),routeManifests:items.filter(i=>i.type==='resource').map(i=>i.value),issuerProfiles:items.filter(i=>i.type==='issuer').map(i=>i.value),observedServiceReferences:items.filter(i=>i.type==='service').map(i=>i.value),localPublications:items.filter(i=>i.type==='publication').map(i=>i.value),editedConnections:items.filter(i=>i.type==='connection').map(i=>i.value),pendingChanges:items.filter(i=>i.type==='proposal').map(i=>i.value)};}
export function selectSnapshotItems(current, selected) {
 const items = snapshotItems(current), ids = new Set(selected), missing = new Set();
 const requireResource = (kind, name, namespace = '') => {
  if (!name) return;
  const found = items.find(i => i.type === 'resource' && i.value.kind === kind && i.name === name && (i.namespace || '') === namespace);
  if (found) ids.add(found.id); else missing.add(`${kind}/${namespace}/${name}`);
 };
 let previous = -1;
 while (previous !== ids.size) {
  previous = ids.size;
  for (const item of items.filter(i => ids.has(i.id))) {
   if (item.type === 'publication') {
    for (const id of item.value.configurationIds || []) ids.add(`configuration/${id}`);
   }
   if (['publication','connection','proposal'].includes(item.type)) {
    for (const resource of item.value.resources || []) {
     const found = items.find(i => i.type === 'resource' && i.id === resourceCoverageId(resource));
     if (found) ids.add(found.id);
    }
   }
   if (item.type === 'issuer' && item.value.manifest) requireResource(item.value.manifest.kind, item.value.manifest.metadata.name, item.value.manifest.metadata.namespace || '');
   if (item.type === 'service') requireResource('Service', item.name, item.namespace || '');
   if (item.type !== 'resource') continue;
   const resource = item.value, spec = resource.spec || {}, ns = item.namespace || '';
   for (const rule of spec.rules || []) for (const path of rule.http?.paths || []) if (path.backend?.service) requireResource('Service', path.backend.service.name, ns);
   const referenceService = ref => requireResource(ref.kind || 'Service', ref.name, ref.namespace || ns);
   for (const rule of spec.routes || []) {
    for (const ref of rule.services || []) referenceService(ref);
    for (const ref of rule.middlewares || []) requireResource(resource.kind === 'IngressRouteTCP' ? 'MiddlewareTCP' : 'Middleware', ref.name, ref.namespace || ns);
   }
   for (const ref of spec.weighted?.services || spec.mirroring?.mirrors || []) referenceService(ref);
   if (spec.mirroring?.name) referenceService(spec.mirroring);
   if (spec.ingressClassName) requireResource('IngressClass', spec.ingressClassName);
   if (spec.tls?.options?.name && spec.tls.options.name !== 'default') requireResource('TLSOption', spec.tls.options.name, spec.tls.options.namespace || ns);
   if (spec.tls?.store?.name && spec.tls.store.name !== 'default') requireResource('TLSStore', spec.tls.store.name, spec.tls.store.namespace || ns);
   const secrets = Array.isArray(spec.tls) ? spec.tls.map(t=>t.secretName) : [spec.tls?.secretName];
   for (const certificate of items.filter(i=>i.type==='resource' && i.value.kind==='Certificate' && (i.namespace || '')===ns && secrets.includes(i.value.spec?.secretName))) ids.add(certificate.id);
   if (resource.kind === 'Certificate') {
    const issuer = spec.issuerRef || {};
    requireResource(issuer.kind || 'Issuer', issuer.name, issuer.kind === 'ClusterIssuer' ? '' : ns);
   }
   if (['Issuer','ClusterIssuer'].includes(resource.kind)) for (const profile of items.filter(i=>i.type==='issuer' && i.value.manifest?.kind===resource.kind && i.name===item.name && (i.namespace || '')===ns)) ids.add(profile.id);
  }
 }
 const picked = items.filter(i=>ids.has(i.id));
 return {items:picked, added:picked.filter(i=>!selected.includes(i.id)), missing:[...missing], current:itemsToCurrent(picked,{snapshotScope:{label:'Selected Restoration Configuration'}})};
}
export function mergeSnapshots(snapshots,authorityId){if(snapshots.length<2||!snapshots.some(s=>s.id===authorityId))throw new Error('Select at least two snapshots and an authoritative source.');const ordered=[...snapshots.filter(s=>s.id!==authorityId).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)),snapshots.find(s=>s.id===authorityId)];const items=new Map(),sources={};const duplicates=new Set();for(const snapshot of ordered){for(const item of snapshotItems(snapshot.current)){if(items.has(item.id))duplicates.add(item.id);items.set(item.id,item);sources[item.id]={snapshotId:snapshot.id,createdAt:snapshot.current?.itemSources?.[item.id]?.createdAt||snapshot.createdAt};}}
 return {current:itemsToCurrent([...items.values()],{snapshotScope:{label:'Merged Configuration Snapshots'},itemSources:sources,mergedFrom:snapshots.map(s=>s.id),authoritativeSnapshot:authorityId,observedRoutes:[...new Map(snapshots.flatMap(s=>s.current.observedRoutes||[]).map(r=>[`${r.kind}/${r.namespace}/${r.name}`,r])).values()]}),duplicates:[...duplicates],sources};}
export function cleanupCandidates(records,{retention,unit},now=Date.now()){if(!Number.isInteger(retention)||retention<1)throw new Error('Retention must be a positive integer.');let cutoff=new Date(now);if(unit==='months'){const day=cutoff.getUTCDate();cutoff.setUTCDate(1);cutoff.setUTCMonth(cutoff.getUTCMonth()-retention);const end=new Date(Date.UTC(cutoff.getUTCFullYear(),cutoff.getUTCMonth()+1,0)).getUTCDate();cutoff.setUTCDate(Math.min(day,end));}else cutoff=new Date(now-retention*({minutes:60000,hours:3600000,days:86400000,weeks:604800000}[unit]||0));const protect=new Set(),known=new Set();for(const record of [...records].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))){const ids=(record.coverage||[]).map(e=>e.id);const scope=record.scope?.namespace||record.scope?.label||record.name;if(!known.has(`scope:${scope}`)||ids.some(id=>!known.has(id)))protect.add(record.id);known.add(`scope:${scope}`);ids.forEach(id=>known.add(id));}return records.filter(record=>Date.parse(record.createdAt)<cutoff.getTime()&&!protect.has(record.id));}
