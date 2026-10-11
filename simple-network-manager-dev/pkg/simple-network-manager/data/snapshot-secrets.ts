import { ref } from 'vue';
import { snapshotManifests } from '../config/manifest-yaml.mjs';
import { secretReferences } from '../config/snapshot-secrets.mjs';
export const capturedSecrets = ref<any[]>([]);
export const secretCaptureStatus = ref<any>({complete:false,missing:[]});
let store:any;
export function connectSnapshotSecrets(hostStore:any) { store = hostStore; }
export async function captureRelevantSecrets(current:any, additionalSecrets:any[] = []) {
  const requested = [...secretReferences(snapshotManifests(current),current.snapshotScope?.issuerSecretNamespace || 'cert-manager'), ...additionalSecrets.filter(resource => resource.kind === 'Secret' && resource.metadata?.name && resource.metadata?.namespace).map(resource => ({name:resource.metadata.name,namespace:resource.metadata.namespace}))];
  const refs = [...new Map(requested.map(reference => [`${reference.namespace}/${reference.name}`,reference])).values()];
  const resources = [...(current.routeManifests || [])];
  const missing:string[] = [];
  for (const reference of refs) {
    const existing = resources.findIndex(resource => resource.kind === 'Secret' && resource.metadata.name === reference.name && resource.metadata.namespace === reference.namespace);
    if (!store && existing >= 0 && (resources[existing].data!==undefined || resources[existing].stringData!==undefined)) continue;
    if (!store) { missing.push(`${reference.namespace}/${reference.name}`); continue; }
    try {
      const secret = await store.dispatch('cluster/find', {type:'secret',id:`${reference.namespace}/${reference.name}`,force:true});
      if (!secret?.data && !secret?.stringData) throw new Error('Secret values unavailable');
      if (existing >= 0) resources.splice(existing,1);
      resources.push({apiVersion:'v1',kind:'Secret',metadata:{name:reference.name,namespace:reference.namespace,...(secret.metadata?.labels?{labels:JSON.parse(JSON.stringify(secret.metadata.labels))}:{}),...(secret.metadata?.annotations?{annotations:JSON.parse(JSON.stringify(secret.metadata.annotations))}:{})},type:secret._type || secret.type || 'Opaque',data:JSON.parse(JSON.stringify(secret.data || {})),...(secret.stringData?{stringData:JSON.parse(JSON.stringify(secret.stringData))}:{})});
    } catch { if (existing >= 0) resources.splice(existing,1); missing.push(`${reference.namespace}/${reference.name}`); }
  }
  const secrets = resources.filter(resource=>resource.kind==='Secret');
  capturedSecrets.value = secrets;
  secretCaptureStatus.value = {complete:missing.length===0,missing,capturedAt:new Date().toISOString()};
  return { ...current, routeManifests:resources, secretBackup:secretCaptureStatus.value };
}
