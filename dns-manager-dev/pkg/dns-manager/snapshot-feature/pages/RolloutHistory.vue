<script setup lang="ts">
import { managerApiUrl } from "../../../../../live-management/manager-api.mjs";
const snapshotUrl=(url:string)=>managerApiUrl("dns-manager",url);
import * as Vue from 'vue';import {component} from '../../../../../rancher-common-ui/client/index.mjs';const SnapshotLayout=component('SnapshotLayout',Vue);
import { contextMatches } from '../data/namespace-context';
import DataGrid from './DataGrid.vue';
import BulkActions from './BulkActions.vue';
import SnapshotOperations from './SnapshotOperations.vue';
import { formatSize } from '../config/file-size.mjs';
import { deleteSnapshots } from '../data/stored-snapshots';
import { displaySettings } from '../data/display-settings';
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';


import PageActions from './PageActions.vue';
import CreateButton from './CreateButton.vue';
import { askSnapshotOptions } from '../data/unlock-backup';
import { runSchedule } from '../data/snapshot-schedule';
const captureController=new AbortController();onBeforeUnmount(()=>captureController.abort());
const capturing=ref(false),captureMessage=ref('');
async function newSnapshot(){capturing.value=true;captureMessage.value='';let password='';try{const options=await askSnapshotOptions(false,captureController.signal);password=options.password;await runSchedule('',password,options.includeSecrets);await refreshSnapshots();captureMessage.value='Snapshot ZIP Saved.';}catch(e){captureMessage.value=e instanceof Error?e.message:'Snapshot capture failed.';}finally{password='';capturing.value=false;}}

import SnapshotGate from './SnapshotGate.vue';
import { storedSnapshots, refreshSnapshots, readSnapshot } from '../data/stored-snapshots';
import { historyContext, snapshotToReview } from '../data/history-context';
import SnapshotComparison from './SnapshotComparison.vue';
import ActionIcon from './ActionIcon.vue';
import InventoryFilters from './InventoryFilters.vue';
import SnapshotDateRange from './SnapshotDateRange.vue';
import SnapshotSchedule from './SnapshotSchedule.vue';

import { reviewStoredSnapshot, restoreStoredSnapshot } from '../config/restore-snapshot';
const props = withDefaults(defineProps<{ view?: 'snapshots' | 'rollouts'; namespaceFilter?: string; groupByNamespace?: boolean; search?: string }>(), { view: 'snapshots', namespaceFilter: '__all__', groupByNamespace: false, search: '' });

const historySearch = ref('');
const checked = ref<string[]>([]);
const allChecked=computed({get:()=>visibleSnapshots.value.length>0&&visibleSnapshots.value.every(r=>checked.value.includes(r.id)),set:(value:boolean)=>checked.value=value?visibleSnapshots.value.map(r=>r.id):[]});
const dateFrom = ref(''); const dateTo = ref(''); const dateTimed = ref(false);
const dateRangeValid = computed(() => !dateFrom.value || !dateTo.value || Date.parse(dateFrom.value) <= Date.parse(dateTo.value));
const inDateRange = (date: string) => {
  if (!dateRangeValid.value) return false;
  const time = Date.parse(date);
  const start = dateFrom.value ? new Date(dateTimed.value ? dateFrom.value : `${dateFrom.value}T00:00`).getTime() : -Infinity;
  const end = dateTo.value ? new Date(dateTimed.value ? dateTo.value : `${dateTo.value}T23:59:59.999`).getTime() : Infinity;
  return time >= start && time <= end;
};
const historyNamespace = ref('__all__');
const historyGrouped = ref(false);
const snapshotNamespaces = (record: typeof storedSnapshots.value[number]) => record.namespaces?.length ? record.namespaces : [...new Set(record.routeIds?.map(id => id.split('/')[1]).filter(Boolean) || [])].length ? [...new Set(record.routeIds.map(id => id.split('/')[1]).filter(Boolean))] : [''];
const historyNamespaces = computed(() => [...new Set(storedSnapshots.value.flatMap(snapshotNamespaces))].filter(Boolean).sort());
const storageError = ref('');
const loaded = ref<any>(null);
const storedMessage = ref('');
const storedReady = ref(false);
const storedConfirmed = ref(false);
const storedGate = ref<InstanceType<typeof SnapshotGate> | null>(null);
const loading = ref(false);
const storedReview = computed(() => {
  if (!loaded.value) return null;
  try { return { ...reviewStoredSnapshot(loaded.value), error: '' }; }
  catch (cause) { return { error: cause instanceof Error ? cause.message : 'Snapshot cannot be restored.', configurations: [], drafts: [], routeDrafts: [], current: {} }; }
});
const storedScope = computed(() => JSON.stringify(storedReview.value?.current));
const visibleSnapshots = computed(() => storedSnapshots.value.filter(record => snapshotNamespaces(record).some(ns => contextMatches(ns)) && inDateRange(record.createdAt) && (!historyContext.value || (historyContext.value.snapshotId ? record.id === historyContext.value.snapshotId : record.routeIds?.includes(historyContext.value.routeId))) && `${record.generation || 'Manual'} ${record.scope?.label || record.name} ${record.name} ${snapshotNamespaces(record).join(' ')} ${record.routeIds.join(' ')}`.toLowerCase().includes(historySearch.value.toLowerCase()) && (historyNamespace.value === '__all__' || snapshotNamespaces(record).includes(historyNamespace.value === '__global__' ? '' : historyNamespace.value))));
watch(visibleSnapshots,()=>{checked.value=checked.value.filter(id=>visibleSnapshots.value.some(r=>r.id===id));});
const snapshotGroups = computed(() => historyGrouped.value ? [...new Set(visibleSnapshots.value.flatMap(snapshotNamespaces))].filter(namespace => historyNamespace.value === '__all__' || namespace === (historyNamespace.value === '__global__' ? '' : historyNamespace.value)).sort().map(namespace => ({ namespace, records: visibleSnapshots.value.filter(record => snapshotNamespaces(record).includes(namespace)) })) : [{ namespace: '', records: visibleSnapshots.value }]);
async function refresh() {
  storageError.value = ''; loading.value = true;
  try { await refreshSnapshots(); } catch (cause) { storageError.value = cause instanceof Error ? cause.message : 'Could not list snapshots.'; }
  finally { loading.value = false; }
}
onMounted(() => { if (props.view === 'snapshots') refresh(); });
watch(() => props.view, view => { loaded.value = null; if (view === 'snapshots') refresh(); });
watch(snapshotToReview, snapshot => {
  if (!snapshot) return;
  storedMessage.value = ''; storedReady.value = false; storedConfirmed.value = false;
  loaded.value = JSON.parse(JSON.stringify(snapshot)); snapshotToReview.value = null;
}, { immediate: true });
async function openStored(id: string) {
  storageError.value = ''; storedMessage.value = ''; storedReady.value = false; storedConfirmed.value = false; loaded.value = null;
  try { loaded.value = await readSnapshot(id); } catch (cause) { storageError.value = cause instanceof Error ? cause.message : 'Could not read snapshot.'; }
}
function storedGateReady(value: boolean) { storedReady.value = value; if (!value) storedConfirmed.value = false; }
function restoreSaved() {
  if (!storedConfirmed.value || !storedGate.value?.checkNow() || !loaded.value) return;
  try {
    const count = restoreStoredSnapshot(loaded.value, storedScope.value);
    storedMessage.value = `Restored saved configuration and ${count} local publication${count === 1 ? '' : 's'}. No cluster resources were changed.`;
    loaded.value = null;
  } catch (cause) { storedMessage.value = cause instanceof Error ? cause.message : 'Restoration failed.'; }
}
</script>
<template>
  <SnapshotLayout class="history" :class="{ 'snapshot-history': view === 'snapshots' }">
    <template v-if="view === 'snapshots'">
<PageActions><CreateButton label="New Snapshot" :disabled="capturing" @create="newSnapshot"/></PageActions><p v-if="captureMessage" role="status">{{captureMessage}}</p>
    <InventoryFilters v-model:search="historySearch" v-model:namespace="historyNamespace" v-model:grouped="historyGrouped" :namespaces="historyNamespaces" search-label="Find A Snapshot" placeholder="Manual, automatic, scope, namespace, or route…"><template #extra><SnapshotDateRange v-model:from="dateFrom" v-model:to="dateTo" v-model:timed="dateTimed" /></template></InventoryFilters><div class="snapshot-records"><BulkActions :items="visibleSnapshots.map(r=>({id:r.id,name:`${r.generation || 'Manual'} · ${r.scope?.label || r.name}`}))" v-model:selected="checked" :execute="deleteSnapshots" verb="Delete selected stored snapshot files from the hosting server after saving a recovery copy."/><p v-if="!dateRangeValid" class="error">Choose an end date at or after the start date.</p>

    <div v-if="historyContext" class="filter-note">Showing {{ historyContext.snapshotId ? 'Selected Snapshot For' : 'Records For' }} {{ historyContext.namespace }} / {{ historyContext.name }} <button type="button" class="text-button" @click="historyContext = null">Clear filter</button></div>
    
    <p v-if="storageError" class="error" role="alert">{{ storageError }}</p>

    <DataGrid :default-sort-column="3" :default-sort-descending="true"><thead><tr><th class="selection-cell"><input v-model="allChecked" type="checkbox" aria-label="Select All Snapshots"></th><th>Generation</th><th>Scope</th><th>Created</th><th data-align="right">Configuration Items</th><th data-align="right" title="Complete ZIP file size; legacy JSON/YAML pairs show combined bytes">Size</th><th class="actions-column">Actions</th></tr></thead><tbody><template v-for="group in snapshotGroups" :key="group.namespace"><tr v-if="historyGrouped" class="namespace-group"><th colspan="7">{{ group.namespace || 'Global' }}</th></tr><tr v-for="record in group.records" :key="record.id"><td class="selection-cell"><input v-model="checked" :value="record.id" type="checkbox" :aria-label="`Select ${record.generation || 'Manual'} ${record.name} snapshot`"></td><td>{{ record.generation || 'Manual' }}<small>Source: {{ new Date(record.sourceUpdatedAt || record.createdAt).toLocaleString() }}</small></td><td>{{ record.scope?.label || record.name }}<small :title="snapshotNamespaces(record).map(namespace => namespace || 'Global').join(', ')">{{ snapshotNamespaces(record).length > 3 ? `${snapshotNamespaces(record).length} Namespaces` : snapshotNamespaces(record).map(namespace => namespace || 'Global').join(', ') }}</small></td><td :data-sort="Date.parse(record.createdAt)">{{ new Date(record.createdAt).toLocaleString() }}</td><td>{{ record.coverage?.length ?? 0 }}</td><td :data-sort="record.sizeBytes ?? -1" :title="record.archiveFormat==='zip' ? 'Complete ZIP size' : 'Legacy JSON + YAML combined size'">{{ formatSize(record.sizeBytes) }}</td><td><div class="snapshot-actions"><a v-if="record.archiveFormat==='zip'" class="icon-action" :href="snapshotUrl(`/api/snapshots/${record.id}/backup.zip`)" download="dns-manager-backup.zip" title="Download Backup ZIP" aria-label="Download Backup ZIP"><ActionIcon icon="download"/></a><a v-else class="icon-action" :href="snapshotUrl(`/api/snapshots/${record.id}`)" download="legacy-dns-backup.json" title="Download Legacy Index" aria-label="Download Legacy Index"><ActionIcon icon="details"/></a><button type="button" class="icon-action" title="Review and restore snapshot" :aria-label="`Review and restore ${record.name} snapshot`" @click="openStored(record.id)"><ActionIcon icon="history" /></button></div></td></tr></template></tbody></DataGrid>
    <SnapshotOperations :snapshot="loaded" v-model:selected-ids="checked" @close="loaded=null"/><p v-if="storedMessage" role="status">{{ storedMessage }}</p></div><SnapshotSchedule />
    </template>
  </SnapshotLayout>
</template>
<style scoped>
.history { margin-top: 28px; padding-top: 26px; border-top: 1px solid var(--border, #384352); }h2 { font-size: 21px; margin: 0; }h3 { font-size: 16px; margin-top: 0; }p { font-size: 12px; color: var(--muted, #a5b1c3); line-height: 1.7; }table { width: 100%; border-collapse: collapse; font-size: 12px; }th, td { border-bottom: 1px solid var(--border, #384352); padding: 12px 8px; text-align: left; }.restoration { padding: 22px; margin-top: 22px; background: var(--input-bg, #1c2430); border: 1px solid #619bd9; border-radius: 6px; overflow-x: auto; }button { background: #326fb4; border: 0; padding: 10px 16px; border-radius: 5px; color: white; cursor: pointer; font: inherit; }button:disabled { opacity: .55; cursor: not-allowed; }.text-button { background: transparent; color: #91c3fc; }.confirmation { display: flex; align-items: center; gap: 10px; margin-top: 20px; font-size: 12px; }.actions { display: flex; gap: 12px; margin-top: 20px; }.error { color: #ffb3ad; }summary { color: #91c3fc; font-size: 12px; cursor: pointer; margin-top: 18px; }pre { font-size: 11px; line-height: 1.6; max-height: 300px; overflow: auto; }button:focus-visible, input:focus-visible, summary:focus-visible { outline: 2px solid #73b5ff; outline-offset: 3px; }
</style>

<style scoped>
.storage-heading, .snapshot-actions { display: flex; align-items: center; gap: 14px; }.storage-heading { justify-content: space-between; margin: 24px 0 16px; }.storage-heading h3 { margin: 0; }.rollouts-title { margin-top: 32px; }.snapshot-actions a { color: #91c3fc; }.filter-note { padding: 12px; background: var(--input-bg, #1c2430); margin-top: 14px; font-size: 12px; }
</style>

<style scoped>.example-note { border-left: 3px solid #edbb69; padding: 12px; background: var(--input-bg, #1c2430); }</style>

<style scoped>.namespace-group th { background: var(--input-bg, #1c2430); color: #91c3fc; }</style>

<style scoped>.snapshot-list-heading { display:flex; justify-content:flex-end; color:#a9d2ff; font-size:13px; margin-bottom:12px; }.snapshot-history { display:flex; flex-direction:column; min-height:0; height:100%; overflow:hidden; }.snapshot-records { flex:1; min-height:0; overflow:auto; scrollbar-gutter:stable; padding-right:8px; }.snapshot-records small { display:block; color:var(--muted,#a5b1c3); font-size:10px; margin-top:6px; }.snapshot-records td { vertical-align:top; }</style>
