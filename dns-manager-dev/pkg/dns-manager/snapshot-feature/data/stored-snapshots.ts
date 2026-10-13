
import {managerFetch} from '../../../../../live-management/manager-api.mjs';
const fetch=(url:string, options?:RequestInit)=>managerFetch('dns-manager',url,options);
import { ref } from 'vue';
import { askBackupPassword } from './unlock-backup';
export interface SnapshotRecord { archiveFormat?:string; encrypted?:boolean; sizeBytes?: number; jsonBytes?: number; yamlBytes?: number; coverage?: { id: string; digest: string }[]; id: string; createdAt: string; name: string; publications: number; services: number; routeIds: string[]; manifests: number; namespaces?: string[]; generation?: 'Manual' | 'Automatic'; scope?: { label: string; namespace?: string }; sourceUpdatedAt?: string }
export const storedSnapshots = ref<SnapshotRecord[]>([]);
export async function refreshSnapshots() {
  const response = await fetch('/api/snapshots');
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Snapshot storage is unavailable. Start the optional local backup service or use a downloaded ZIP.');
  storedSnapshots.value = (await response.json()).snapshots.sort((a:SnapshotRecord,b:SnapshotRecord) => Date.parse(b.createdAt)-Date.parse(a.createdAt));
}
export async function readSnapshot(id: string, {interactive=true}: {interactive?:boolean} = {}) {
  const response = await fetch(`/api/snapshots/${encodeURIComponent(id)}`);
  if (response.status === 422) {
    if(!interactive)throw new Error('Encrypted saved version requires explicit unlock from Snapshots.');
    let password = await askBackupPassword();
    try {
      const unlocked = await fetch(`/api/snapshots/${encodeURIComponent(id)}/unlock`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password}) });
      if (!unlocked.ok) throw new Error('Backup could not be unlocked. Check its password.');
      return unlocked.json();
    } finally { password = ''; }
  }
  if (!response.ok) throw new Error('The saved snapshot could not be read.');
  return response.json();
}
export async function storeSnapshot(current: object, scopeKey: string, password = '') {
  const response = await fetch('/api/snapshots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current, scopeKey, password,includeSecrets:!!(current as any).secretBackup?.requested }) });
  if (!response.ok) throw new Error('Snapshot was not saved. Check the hosting server and persistent storage, or choose download only.');
  const snapshot = await response.json();
  // A successful write remains successful if the subsequent listing fails.
  try { await refreshSnapshots(); } catch { /* History can retry the listing. */ }
  return snapshot;
}

export async function deleteSnapshots(ids:string[],backupId:string,merged=false,passwords:Record<string,string>={},backupPassword=''){const response=await fetch('/api/snapshots/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,backupId,merged,passwords,backupPassword})});if(!response.ok)throw new Error((await response.json()).error||'Could not delete snapshots.');await refreshSnapshots();}
export async function mergeStoredSnapshots(ids:string[],authorityId:string){const response=await fetch('/api/snapshots/merge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,authorityId})});if(!response.ok)throw new Error((await response.json()).error||'Could not merge snapshots.');const saved=await response.json();await refreshSnapshots();return saved;}

export async function mergeOrderedSnapshots(priorityOrder: string[], selectedIds: string[], preservedSecrets: object[] = [], passwords: Record<string,string> = {}, password = '') {
  const response = await fetch('/api/snapshots/merge', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ids:priorityOrder, priorityOrder, selectedIds, preservedSecrets, passwords, password}) });
  if (!response.ok) throw new Error((await response.json()).error || 'Could not merge snapshots.');
  const saved = await response.json();
  try { await refreshSnapshots(); } catch { /* The durable save succeeded; listing can retry. */ }
  return saved;
}

export async function unlockSnapshot(id:string, password:string) {
  const response = await fetch(`/api/snapshots/${encodeURIComponent(id)}/unlock`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
  if (!response.ok) throw new Error(response.status===422?'Incorrect password. This snapshot will not be processed.':'Snapshot could not be verified. It will not be processed.');
  return response.json();
}
