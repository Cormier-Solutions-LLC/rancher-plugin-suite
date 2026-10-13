import { ref } from 'vue';
import { refreshSnapshotStorage } from './snapshot-schedule';
import { boundedRead } from '../config/bounded-read.mjs';
import { refreshSnapshots } from './stored-snapshots';
import { loadSchedule } from './snapshot-schedule';
import { refreshDemoLogs } from './diagnostic-logs';
export const refreshSeconds = ref(900);
export const refreshRevision = ref(0);
export const refreshMessage = ref('');
export const refreshing = ref(false);
export const refreshOverlay = ref(false);
export const refreshFailed = ref(false);
export const retryAt = ref(0);
let current: AbortController | undefined;
export function cancelRefresh() { current?.abort(); retryAt.value = 0; }
// Refresh data only. Never reload the document, remount an editor, or replace form state.
export async function refreshPage(section: string, inventoryRead?: (signal: AbortSignal) => Promise<void>, mode: 'cache' | 'manual' = 'cache') {
  if (refreshing.value) return;
  const controller = current = new AbortController();
  refreshing.value = true; retryAt.value = 0;
  const delay = setTimeout(() => { if (!controller.signal.aborted) refreshOverlay.value = true; }, 300);
  let snapshotFailure = false;
  try {
    await boundedRead(async (signal: AbortSignal) => {
      const results = await Promise.allSettled([refreshSnapshots(signal), refreshSnapshotStorage(signal), loadSchedule(signal), inventoryRead?.(signal)]);
      signal.throwIfAborted();
      snapshotFailure=results.slice(0,3).some(r=>r.status==='rejected');
      if (inventoryRead) { if (results[3].status === 'rejected') throw results[3].reason; }
      else { const failed = results.find(r => r.status === 'rejected'); if (failed?.status === 'rejected') throw failed.reason; refreshDemoLogs(); }
    }, {signal:controller.signal});
    refreshFailed.value = false;
    if (section === 'history') { refreshMessage.value = 'Saved snapshots refreshed.'; }
    else if (section === 'diagnostics') { refreshMessage.value = inventoryRead ? 'Kubernetes events refreshed.' : 'Demo logs refreshed.'; }
    else refreshMessage.value = inventoryRead
      ? snapshotFailure
        ? `${mode === 'manual' ? 'Network cache refreshed immediately' : 'Current view refreshed from the network cache'}; a snapshot service request failed.`
        : mode === 'manual' ? 'Network cache and current view refreshed immediately.' : 'Current view refreshed from the 15-minute network cache.'
      : 'View checked. Cluster inventory is a static preview snapshot.';
    refreshRevision.value++;
  } catch (cause) {
    if (controller.signal.aborted) return;
    refreshFailed.value = true;
    refreshMessage.value = `${cause instanceof Error ? cause.message : 'Read failed.'} Existing data and edits are retained.`;
    retryAt.value = Date.now() + (typeof navigator !== 'undefined' && navigator.onLine === false ? 5000 : 60000);
  }
  finally { clearTimeout(delay); refreshOverlay.value = false; refreshing.value = false; if (current === controller) current = undefined; }
}
