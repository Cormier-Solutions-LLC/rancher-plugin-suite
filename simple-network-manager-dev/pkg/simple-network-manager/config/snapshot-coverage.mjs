import { snapshotManifests } from './manifest-yaml.mjs';
import { secretReferences } from './snapshot-secrets.mjs';
import {issuerProfileKey} from '../../../../live-management/issuer-profile-identity.mjs';
// Keep existing ClusterIssuer coverage compatible with prior snapshots.
export const issuerProfileCoverageId=profile=>`issuer-profile/${profile.manifest?.kind==='Issuer'?issuerProfileKey(profile):profile.name}`;
function canonical(value) { if (Array.isArray(value)) return value.map(canonical); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key,canonical(value[key])])); return value; }
export const resourceCoverageId = resource => `resource/${resource.apiVersion}/${resource.kind}/${resource.metadata?.namespace || ''}/${resource.metadata?.name || ''}`;
export function coverageEntries(current = {}) {
 const entries = new Map(); const add = (id,value) => entries.set(id, {id,value:JSON.stringify(canonical(value))});
 for (const resource of snapshotManifests(current)) { add(resourceCoverageId(resource), { apiVersion:resource.apiVersion, kind:resource.kind, metadata:{name:resource.metadata?.name,namespace:resource.metadata?.namespace || '',labels:resource.metadata?.labels || {},annotations:resource.metadata?.annotations || {}},spec:resource.spec,...(resource.kind==='Secret'?{type:resource.type,data:resource.data,stringData:resource.stringData}:{}) }); if(resource.kind==='Secret' && !resource.data && !resource.stringData) entries.get(resourceCoverageId(resource)).incomplete=true; }
 for (const config of [current.configuration,...(current.relatedConfigurations || [])].filter(Boolean)) add(`configuration/${config.id}`,config);
 for (const service of current.observedServiceReferences || []) add(`service/${service.namespace || ''}/${service.name}`,service);
 for (const profile of current.issuerProfiles || []) add(issuerProfileCoverageId(profile),profile);
 for (const [type,drafts] of [['publication',current.localPublications || []],['connection',current.editedConnections || []]]) for (const draft of drafts) add(`draft/${type}/${draft.namespace || ''}/${draft.name}`,draft);
 for(const proposal of current.pendingChanges || []) add(`proposal/${proposal.id}`,proposal);
 // A reference alone is not a restorable credential backup. Keep it in the
 // expected coverage but never publish it as a saved, complete fingerprint.
 for (const reference of secretReferences(snapshotManifests(current),current.snapshotScope?.issuerSecretNamespace || 'cert-manager')) {
  const id = `resource/v1/Secret/${reference.namespace}/${reference.name}`;
  if (!entries.has(id)) entries.set(id,{id,value:JSON.stringify({missingSecret:true}),incomplete:true});
 }
 return [...entries.values()];
}
function savedCoverage(snapshots, now) {
 const past=snapshots.filter(record=>Number.isFinite(Date.parse(record.createdAt)) && Date.parse(record.createdAt)<=now);
 const recent=past.filter(record=>now-Date.parse(record.createdAt)<7*86400000);
 const fingerprints=new Set(recent.flatMap(record=>(record.coverage||[]).filter(entry=>!entry.createdAt || Number.isFinite(Date.parse(entry.createdAt)) && now-Date.parse(entry.createdAt)>=0 && now-Date.parse(entry.createdAt)<7*86400000).map(entry=>`${entry.id}:${entry.digest}`)));
 const secrets=new Set(past.flatMap(record=>(record.coverage||[]).filter(entry=>entry.id.startsWith('resource/v1/Secret/') && (entry.capturedValues===true || !!entry.digest) && (!entry.createdAt || Number.isFinite(Date.parse(entry.createdAt)) && Date.parse(entry.createdAt)<=now)).map(entry=>entry.id)));
 return {past,recent,matches:entry=>entry.id.startsWith('resource/v1/Secret/')?secrets.has(entry.id):fingerprints.has(`${entry.id}:${entry.digest}`)};
}
export function assessCoverage(expected, snapshots, now=Date.now()) {
 const saved=savedCoverage(snapshots,now),covered=expected.filter(saved.matches).length;
 const latest=[...saved.past].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
 const full=expected.length>0 && covered===expected.length;
 const tone=full?'success':!saved.recent.length?'error':'warning';
 return {tone,covered,total:expected.length,date:latest?.createdAt,label:full?'Snapshot Ready':tone==='error'?'Snapshot Missing Or Outdated':'Snapshot Coverage Partial'};
}
export function uncoveredEntries(expected,snapshots,now=Date.now()) {
 const saved=savedCoverage(snapshots,now);
 return expected.filter(entry=>!saved.matches(entry)).map(entry=>{
  const latest=[...saved.past].filter(record=>record.coverage?.some(item=>item.id===entry.id)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
  const prior=latest?.coverage.find(item=>item.id===entry.id);
  const outdated=latest && (now-Date.parse(latest.createdAt)>=7*86400000 || prior?.createdAt && now-Date.parse(prior.createdAt)>=7*86400000);
  return {...entry,status:!latest?'Missing':outdated?'Outdated':'Changed',snapshotId:latest?.id,snapshotDate:latest?.createdAt};
 });
}
