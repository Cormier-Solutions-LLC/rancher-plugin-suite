import { createRancherDataSource } from '../preview-data/data-source.mjs';
import { projectNetwork } from './network-observations.mjs';
import { applyResourceChanges, resourcePath } from './kubernetes-apply.mjs';
import { issuerProfile,mergeIssuerReferences } from './issuer-observations.mjs';
import {issuerProfileKey} from './issuer-profile-identity.mjs';
import {prepareCertificateRenewals,submitCertificateRenewals} from './certificate-renewal.mjs';
import {validateChangeBatch} from '../simple-network-manager-dev/pkg/simple-network-manager/config/change-batch.mjs';
import {persistentManagerState} from './safe-manager-state.mjs';
import {isCatalogChange,prepareCatalogOperations,verifyCatalogOperations} from './catalog-operations.mjs';
import {validatePublishedListeners} from './listener-validation.mjs';
import {issuerCertificateReferences} from './issuer-dependencies.mjs';
export const NETWORK_CACHE_INTERVAL_MS = 15 * 60 * 1000;
const observationCaches = new WeakMap();
const clone = value => JSON.parse(JSON.stringify(value));
function requestCache(request) {
  let cache = observationCaches.get(request);
  if (!cache) { cache = new Map(); observationCaches.set(request, cache); }
  return cache;
}
const paths = {
  namespaces: '/api/v1/namespaces', services: '/api/v1/services', endpointslices: '/apis/discovery.k8s.io/v1/endpointslices',
  ingresses: '/apis/networking.k8s.io/v1/ingresses', ingressclasses: '/apis/networking.k8s.io/v1/ingressclasses',
  deployments: '/apis/apps/v1/namespaces/traefik-system/deployments', events: '/api/v1/events',
  certificates: '/apis/cert-manager.io/v1/certificates', issuers: '/apis/cert-manager.io/v1/issuers', clusterissuers: '/apis/cert-manager.io/v1/clusterissuers',
  certificaterequests:'/apis/cert-manager.io/v1/certificaterequests',orders:'/apis/acme.cert-manager.io/v1/orders',challenges:'/apis/acme.cert-manager.io/v1/challenges',
  ingressroutes: '/apis/traefik.io/v1alpha1/ingressroutes', ingressroutetcps: '/apis/traefik.io/v1alpha1/ingressroutetcps', ingressrouteudps: '/apis/traefik.io/v1alpha1/ingressrouteudps', middlewares: '/apis/traefik.io/v1alpha1/middlewares', serverstransports: '/apis/traefik.io/v1alpha1/serverstransports',
};
export function createLiveNetworkSource(cluster, request = fetch, userId, options = {}) {
  const prefix = `/k8s/clusters/${encodeURIComponent(cluster)}`;
  let state = {}, revision, stateName, observation = {}, diagnostics = [];
  let saveTail = Promise.resolve();
  let refreshPromise;
  const now = options.now || Date.now;
  const schedule = options.schedule || setTimeout;
  const cancelSchedule = options.cancelSchedule || clearTimeout;
  const cacheIntervalMs = options.cacheIntervalMs || NETWORK_CACHE_INTERVAL_MS;
  const cacheKey = `${cluster}/${userId || ''}`;
  const cache = requestCache(request);
  const statePath = () => `/api/v1/namespaces/cattle-ui-plugin-system/configmaps/${stateName}`;
  const stateResource = next => ({apiVersion:'v1',kind:'ConfigMap',metadata:{name:stateName,namespace:'cattle-ui-plugin-system',...(revision?{resourceVersion:revision}:{})},data:{'state.json':JSON.stringify(persistentManagerState({...next,managerCatalogVersion:1}))}});
  async function call(path, init = {}) {
    const response = await request(prefix + path, { credentials: 'same-origin', ...init });
    if (!response.ok) { const e = new Error(`Kubernetes ${response.status}: ${path}. Check this user's permissions and installed APIs.`); e.status = response.status; throw e; }
    return response.status === 204 ? undefined : response.json();
  }
  async function refreshObservation(signal) {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      const failures = [];
      const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => {
        try {
          const result = await call(path, { signal });
          // Kubernetes list members usually omit their own kind/apiVersion.
          return [key, (result.items || []).map(item => ({ apiVersion: result.apiVersion, kind: result.kind?.replace(/List$/, ''), ...item }))];
        }
        catch (error) { if (signal?.aborted) throw error; failures.push(`${key}: ${error.message}`); return [key, []]; }
      }));
      // Never treat denied/failed reads as deletions. Retain the prior cache.
      if (failures.length) throw new Error(failures.join('\n'));
      const entry = { observation: clone(Object.fromEntries(entries)), refreshedAt: now() };
      cache.set(cacheKey, entry);
      return entry;
    })();
    try { return await refreshPromise; }
    finally { refreshPromise = undefined; }
  }
  async function loadObservation(signal, mode) {
    const cached = cache.get(cacheKey);
    if (mode === 'cache' && cached && now() - cached.refreshedAt < cacheIntervalMs) return cached;
    return refreshObservation(signal);
  }
  const source = createRancherDataSource({ pluginId: 'network-manager',
    async read({ signal, mode }) {
      const cached = await loadObservation(signal, mode);
      observation = clone(cached.observation);
      diagnostics = observation.events.map(e => ({ time: Date.parse(e.lastTimestamp || e.eventTime || e.metadata.creationTimestamp), namespace: e.metadata.namespace, source: e.reportingComponent || e.source?.component || 'Kubernetes', severity: e.type === 'Warning' ? 'WARN' : 'INFO', message: `${e.reason}: ${e.message || ''}` }));
      if (!stateName) {
        const id = userId;
        if (!id || !/^[a-z0-9-]+$/.test(id)) throw new Error('The current Rancher user identity is unavailable.');
        stateName = `network-manager-state-${id}`;
        try { const cm = await call(statePath(), { signal }); state = JSON.parse(cm.data['state.json']); revision = cm.metadata.resourceVersion; }
        catch (e) { if (e.status !== 404) throw e; state = { portConfigurations: [], publications: [], issuerProfiles: [...observation.clusterissuers,...observation.issuers].map(issuerProfile), pendingChanges: [], credentialReferences: [], accountReferences: [], runningProcesses: [], configurationRollouts: [], connectionDrafts: [], editorDrafts: [], formDrafts: [], displaySettings: { previewMode: false } }; }
      }
      if (!state.managerCatalogVersion) {
        const templates = [
          { id:'http', name:'HTTP', ports:[{label:'HTTP',port:80,mode:'HTTP'}], source:'Predefined' },
          { id:'https', name:'HTTPS', ports:[{label:'HTTPS',port:443,mode:'HTTPS'}], source:'Predefined' },
          { id:'web', name:'Web · HTTP + HTTPS', ports:[{label:'HTTP',port:80,mode:'HTTP'},{label:'HTTPS',port:443,mode:'HTTPS'}], source:'Predefined' },
        ];
        state.portConfigurations ||= [];
        state.portConfigurations.push(...templates.filter(t=>!state.portConfigurations.some(c=>c.id===t.id)));
        state.managerCatalogVersion=1;
      }
      state.issuerProfiles ||= [];
      mergeIssuerReferences(state,observation.clusterissuers);
      for(const resource of [...observation.clusterissuers,...observation.issuers]) {
        const profile=issuerProfile(resource),existing=state.issuerProfiles.find(p=>issuerProfileKey(p)===issuerProfileKey(profile));
        if(!existing)state.issuerProfiles.push(profile);
        else if(existing.source==='Live Kubernetes observation')Object.assign(existing,profile);
      }
      const refreshedAt = new Date(cached.refreshedAt).toISOString();
      return { schemaVersion: 1, pluginId: 'network-manager', revision: revision || '0', updatedAt: refreshedAt, source: { kind: 'rancher', label: `Cached Kubernetes / ${cluster}` }, cache: { refreshedAt, refreshIntervalMs: cacheIntervalMs }, data: { inventory: projectNetwork(observation), state } };
    },
    saveState(next,{expectedRevision}={}) {
      const pending = saveTail.then(async () => {
      if(expectedRevision!==undefined&&revision!==expectedRevision)throw new Error('Manager configuration changed during Apply. Reconcile accepted resource receipts before retrying.');
      const cm = stateResource(next);
      const result = await call(revision ? statePath() : '/api/v1/namespaces/cattle-ui-plugin-system/configmaps', { method: revision ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cm) });
      revision = result.metadata.resourceVersion; state = { ...next, managerCatalogVersion:1 };
      });
      saveTail = pending.catch(() => {});
      return pending;
    },
    stageChanges: async changes => {
      validateChangeBatch(changes);
      await saveTail;
      const catalogRevision=revision,catalog=prepareCatalogOperations(changes,state,observation.namespaces.map(n=>n.metadata.name));
      for(const change of changes.filter(c=>c.configuration?.operation==='RemoveIssuerProfile')){
        try{await call(resourcePath(change.configuration.issuerProfileTarget.manifest));}catch(error){if(error.status===404)continue;throw error;}
        throw new Error('This issuer exists on Kubernetes. Refresh and review its managed deletion instead.');
      }
      // A rollout also needs to persist its proposals and receipts. Validate that
      // permission and admission before any resource dry runs or actual writes.
      const plannedState=stateResource(catalog.next);
      const validation=await call((revision?statePath():'/api/v1/namespaces/cattle-ui-plugin-system/configmaps')+'?dryRun=All',{method:revision?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(plannedState)});
      if(validation?.metadata?.name!==stateName||validation.metadata.namespace!=='cattle-ui-plugin-system'||validation.data?.['state.json']!==plannedState.data['state.json'])throw new Error('Manager state validation differs from the reviewed configuration. Refresh and review again.');
      const targets=new Map(Object.values(observation).flat().flatMap(r=>{
        try{return [[resourcePath(r),r.metadata]];}catch{return [];}
      }));
      const renewals=await prepareCertificateRenewals(changes,call,targets);
      const regular=changes.filter(c=>c.configuration?.operation!=='RequestCertificateRenewal'&&!isCatalogChange(c));
      await validatePublishedListeners(regular,call,observation);
      if(revision!==catalogRevision)throw new Error('Manager configuration changed during validation. Refresh and review again.');
      const result=regular.length?await applyResourceChanges(regular,call,targets):{applied:[],completedAt:new Date().toISOString()};
      const submitted=renewals.length?await submitCertificateRenewals(renewals,call,result.applied):result;
      if(catalog.operations.length){try{
        for(const change of changes.filter(c=>c.configuration?.operation==='Delete'&&c.configuration?.issuerProfileTarget)){
          const path=resourcePath(change.resources[0]),deadline=Date.now()+10000;
          while(true){try{await call(path);}catch(error){if(error.status===404)break;throw error;}
            if(Date.now()>=deadline)throw new Error('Issuer deletion is still pending. Its saved profile is retained; reconcile the accepted deletion receipt before removing the profile.');
            await new Promise(resolve=>setTimeout(resolve,500));
          }
        }
        await source.saveState(catalog.next,{expectedRevision:catalogRevision});const confirmed=await call(statePath());verifyCatalogOperations(catalog.operations,JSON.parse(confirmed.data['state.json']));return {...submitted,catalog:catalog.operations.map(op=>({...op,resourceVersion:confirmed.metadata.resourceVersion,readBack:true}))};}catch(error){error.applied=submitted.applied;error.message+=' Resource receipts are retained; catalog proposals require reconciliation.';throw error;}}
      return submitted;
    },
  });
  source.cachePolicy = Object.freeze({ refreshIntervalMs: cacheIntervalMs, mode: 'shared-network-inventory' });
  source.startCacheRefresh = ({ onRefresh, onError } = {}) => {
    let stopped = false;
    let timer;
    const plan = () => {
      if (stopped) return;
      const refreshedAt = cache.get(cacheKey)?.refreshedAt || now();
      const delay = Math.max(1, cacheIntervalMs - Math.max(0, now() - refreshedAt));
      timer = schedule(run, delay);
    };
    const run = async () => {
      try {
        const document = await source.reload();
        if (!stopped) await onRefresh?.(document);
      } catch (error) {
        if (!stopped) await onError?.(error);
      } finally { plan(); }
    };
    plan();
    return () => { stopped = true; if (timer !== undefined) cancelSchedule(timer); };
  };
  source.getDiagnostics = () => diagnostics;
  source.issuerReferences = resource => issuerCertificateReferences(observation.certificates||[],resource);
  source.reviewedResourceIdentity = resource => {
    const supported = ['networking.k8s.io/v1/Ingress',...['IngressRoute','IngressRouteTCP','IngressRouteUDP'].map(kind=>`traefik.io/v1alpha1/${kind}`),...['Certificate','Issuer','ClusterIssuer'].map(kind=>`cert-manager.io/v1/${kind}`)];
    if(!supported.includes(`${resource?.apiVersion}/${resource?.kind}`))return;
    const observed=Object.values(observation).flat().find(item=>item.apiVersion===resource.apiVersion&&item.kind===resource.kind&&item.metadata.namespace===resource.metadata?.namespace&&item.metadata.name===resource.metadata?.name);
    if(observed?.metadata.uid&&observed.metadata.resourceVersion)return {uid:observed.metadata.uid,resourceVersion:observed.metadata.resourceVersion};
  };
  source.reviewedRouteIdentity = resource => ['Ingress','IngressRoute','IngressRouteTCP','IngressRouteUDP'].includes(resource?.kind) ? source.reviewedResourceIdentity(resource) : undefined;
  return source;
}
