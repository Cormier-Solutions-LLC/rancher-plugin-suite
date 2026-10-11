import { ref } from 'vue';
import { refreshSnapshotStorage } from './snapshot-schedule';
import { refreshSnapshots } from './stored-snapshots';
import { loadSchedule } from './snapshot-schedule';
import { refreshDemoLogs } from './diagnostic-logs';
export const refreshSeconds = ref(300);
export const refreshRevision = ref(0);
export const refreshMessage = ref('');
export const refreshing = ref(false);
// Refresh data only. Never reload the document, remount an editor, or replace form state.
export async function refreshPage(section: string) {
  if (refreshing.value) return;
  refreshing.value = true;
  try {
    await refreshSnapshots();
    await refreshSnapshotStorage();
    await loadSchedule();
    refreshDemoLogs();
    if (section === 'history') { refreshMessage.value = 'Saved snapshots refreshed.'; }
    else if (section === 'diagnostics') { refreshMessage.value = 'Demo logs refreshed.'; }
    else refreshMessage.value = 'View checked. Cluster inventory is a static preview snapshot.';
    refreshRevision.value++;
  } catch (cause) { refreshMessage.value = cause instanceof Error ? cause.message : 'Refresh failed. Existing data and edits are retained.'; }
  finally { refreshing.value = false; }
}
