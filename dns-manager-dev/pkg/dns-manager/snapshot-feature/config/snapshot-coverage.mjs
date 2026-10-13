import { snapshotManifests } from './manifest-yaml.mjs';
import { secretReferences } from './snapshot-secrets.mjs';
import { normalizeDnsConfiguration } from './dns-record-order.mjs';
function canonical(value) { if (Array.isArray(value)) return value.map(canonical); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key,canonical(value[key])])); return value; }
export const resourceCoverageId = resource => `resource/${resource.apiVersion}/${resource.kind}/${resource.metadata?.namespace || ''}/${resource.metadata?.name || ''}`;
export function coverageEntries(current = {}) {
 const entries = new Map(); const add = (id,value) => entries.set(id, {id,value:JSON.stringify(canonical(value))});
 for (const resource of snapshotManifests(current)) add(resourceCoverageId(resource), { apiVersion:resource.apiVersion, kind:resource.kind, metadata:{name:resource.metadata?.name,namespace:resource.metadata?.namespace || '',annotations:resource.metadata?.annotations || {}},spec:resource.spec,...(resource.kind==='Secret'?{type:resource.type,data:resource.data,stringData:resource.stringData}:{}) });
 for (const config of [current.configuration,...(current.relatedConfigurations || [])].filter(Boolean)) add(`configuration/${config.id}`,normalizeDnsConfiguration(config));
 for (const service of current.observedServiceReferences || []) add(`service/${service.namespace || ''}/${service.name}`,service);
 for (const profile of current.issuerProfiles || []) add(`issuer-profile/${profile.name}`,profile);
 for (const [type,drafts] of [['publication',current.localPublications || []],['connection',current.editedConnections || []]]) for (const draft of drafts) add(`draft/${type}/${draft.namespace || ''}/${draft.name}`,draft);
 for(const proposal of current.pendingChanges || []) add(`proposal/${proposal.id}`,proposal);
 // A reference alone is not a restorable credential backup. Keep it in the
 // expected coverage but never publish it as a saved, complete fingerprint.
 for (const reference of [...secretReferences(snapshotManifests(current),current.snapshotScope?.issuerSecretNamespace || 'cert-manager'),...(current.credentialReferences||[])]) {
  const id = `resource/v1/Secret/${reference.namespace}/${reference.name}`;
  if (!entries.has(id)) entries.set(id,{id,value:JSON.stringify({missingSecret:true}),incomplete:true});
 }
 return [...entries.values()];
}
export function assessCoverage(expected, snapshots, now = Date.now()) {
 const recent = snapshots.filter(record => { const age = now-Date.parse(record.createdAt); return age >= 0 && age < 7*86400000; });
 const saved = new Set(recent.flatMap(record => (record.coverage || []).filter(entry => !entry.createdAt || now-Date.parse(entry.createdAt)>=0 && now-Date.parse(entry.createdAt)<7*86400000).map(entry => `${entry.id}:${entry.digest}`)));
 const isSecret = entry => entry.id.startsWith('resource/v1/Secret/');
 const secretPresence = new Set(snapshots.filter(record => Date.parse(record.createdAt)<=now).flatMap(record => (record.coverage||[]).filter(entry=>isSecret(entry)&&entry.capturedValues).map(entry=>entry.id)));
 const covered = expected.filter(entry => isSecret(entry) ? secretPresence.has(entry.id) : saved.has(`${entry.id}:${entry.digest}`)).length;
 const latest = [...snapshots].filter(record => Date.parse(record.createdAt) <= now).sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
 return { tone: !recent.length ? 'error' : expected.length && covered === expected.length ? 'success' : 'warning', covered,total:expected.length,date:latest?.createdAt, label: !recent.length ? 'Snapshot Missing Or Outdated' : expected.length && covered === expected.length ? 'Snapshot Ready' : 'Snapshot Coverage Partial' };
}
export function uncoveredEntries(expected, snapshots, now = Date.now()) {
 const eligible = snapshots.filter(record => { const age=now-Date.parse(record.createdAt); return age>=0 && age<7*86400000; });
 const saved = new Set(eligible.flatMap(record => (record.coverage || []).filter(entry => !entry.createdAt || now-Date.parse(entry.createdAt)>=0 && now-Date.parse(entry.createdAt)<7*86400000).map(entry => `${entry.id}:${entry.digest}`)));
 const isSecret = entry => entry.id.startsWith('resource/v1/Secret/');
 const secretPresence = new Set(snapshots.filter(record => Date.parse(record.createdAt)<=now).flatMap(record => (record.coverage||[]).filter(entry=>isSecret(entry)&&entry.capturedValues).map(entry=>entry.id)));
 return expected.filter(entry=>isSecret(entry)?!secretPresence.has(entry.id):!saved.has(`${entry.id}:${entry.digest}`)).map(entry=>{
  const latest=[...snapshots].filter(record=>Date.parse(record.createdAt)<=now && record.coverage?.some(item=>item.id===entry.id)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
  const prior=latest?.coverage.find(item=>item.id===entry.id);
  const outdated=latest && (now-Date.parse(latest.createdAt)>=7*86400000 || prior?.createdAt && now-Date.parse(prior.createdAt)>=7*86400000);
  return {...entry, status:isSecret(entry)?'Missing':!latest?'Missing':outdated?'Outdated':'Changed',snapshotId:latest?.id,snapshotDate:latest?.createdAt};
 });
}
