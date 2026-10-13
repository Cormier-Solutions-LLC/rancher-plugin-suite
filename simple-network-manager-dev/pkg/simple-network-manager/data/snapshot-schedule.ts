
import {managerFetch} from '../../../../live-management/manager-api.mjs';
const fetch=(url:string, options?:RequestInit)=>managerFetch('network-manager',url,options);
import {withoutSecretValues} from '../config/backup-zip.mjs';
import {manualSnapshotRequest} from '../config/manual-snapshot-request.mjs';
import { inventoryDatasets } from './inventory';
const dependencies = inventoryDatasets['dependency-resources-snapshot.json'];
import { capturedSecrets, secretCaptureStatus, captureRelevantSecrets } from './snapshot-secrets';
import { ref } from 'vue';
import { liveRolloutSource } from './running-processes';
import { portConfigurations } from './port-presets';
import { publications } from './publications';
import { connectionDrafts } from './connection-edits';
import { pendingChanges } from './pending-rollouts';
import { issuerProfiles } from './workspace';
import { observedAttachments } from './observed-attachments';
const routeInventory = inventoryDatasets['route-resources-snapshot.json'];
const certificateInventory = inventoryDatasets['certificate-resources-snapshot.json'];
const services = inventoryDatasets['publication-snapshot.json'];
export const scheduleState = ref<any>(null);
export function captureScheduleSource(namespace = '') {
  const inScope = (value: { namespace?: string }) => !namespace || !value.namespace || value.namespace === namespace;
  const configs = portConfigurations.filter(inScope);
  const resources = [...capturedSecrets.value, ...routeInventory.resources, ...certificateInventory.resources, ...dependencies.resources, ...issuerProfiles.flatMap(profile => profile.manifest ? [profile.manifest as any] : [])].filter(resource => inScope(resource.metadata || {}));
  return JSON.parse(JSON.stringify({ configuration: configs[0], relatedConfigurations: configs.slice(1), localPublications: publications.filter(inScope), editedConnections: connectionDrafts.filter(inScope), observedRoutes: observedAttachments.filter(inScope), observedServiceReferences: services.services.filter(inScope), routeManifests: resources, issuerProfiles: issuerProfiles.filter(profile => inScope((profile.manifest as any)?.metadata || {})), pendingChanges: pendingChanges.filter(inScope), secretBackup: { complete:secretCaptureStatus.value.complete, missing:secretCaptureStatus.value.missing }, snapshotScope: { label: namespace ? `Namespace: ${namespace} + Global Configurations` : 'All Known Routing Configuration', namespace, source: liveRolloutSource.value ? 'Authenticated Kubernetes inventory and saved manager configuration' : 'Inspection snapshot and saved preview configuration; not a fresh live-cluster capture' } }));
}
export async function loadSchedule(signal?: AbortSignal) {
  const response = await fetch('/api/snapshot-schedule', {signal});
  if (!response.ok) throw new Error('Snapshot scheduling is unavailable in this host.');
  const state = await response.json(); signal?.throwIfAborted();
  scheduleState.value = state; return state;
}
export async function saveSchedule(input: object) {
  const response = await fetch('/api/snapshot-schedule', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, ...((input as any).current ? {current:withoutSecretValues((input as any).current)} : {}) }) });
  if (!response.ok) {const problem=await response.json().catch(()=>({}));throw new Error(problem.error||'The schedule could not be saved. Check interval and hosting storage.');}
  scheduleState.value = await response.json(); return scheduleState.value;
}
export async function runSchedule(namespace: string,password='',includeSecrets=false) {
  const current=includeSecrets?await captureRelevantSecrets(captureScheduleSource(namespace)):captureScheduleSource(namespace);
  const request=manualSnapshotRequest(current,{password,includeSecrets});
  const response = await fetch(request.path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request.body) });
  if (!response.ok) {const problem=await response.json().catch(()=>({}));throw new Error(problem.error||'The snapshot could not be saved.');}
  await loadSchedule(); return response.json();
}
export async function syncScheduleSource() {
  if (!scheduleState.value?.enabled) return;
  const response = await fetch('/api/snapshot-source', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: withoutSecretValues(captureScheduleSource(scheduleState.value.scope?.namespace || '')) }) });
  if (!response.ok) throw new Error('Latest configuration could not be synchronized for automatic backups.');
  scheduleState.value = await response.json();
}

export const snapshotStorage = ref<any>(null);
export const storageError = ref('');
export async function refreshSnapshotStorage(signal?: AbortSignal) {
  try { const response=await fetch('/api/snapshot-storage',{signal}); if(!response.ok) throw new Error(); const space=await response.json(); signal?.throwIfAborted(); snapshotStorage.value=space; storageError.value=''; }
  catch (error) { if(signal?.aborted)throw error; storageError.value='Hosting Volume Space Is Unavailable'; if(signal)throw error; }
}
