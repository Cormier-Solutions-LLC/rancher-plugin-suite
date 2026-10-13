<script setup lang="ts">
import { managerApiUrl } from "../../../../live-management/manager-api.mjs";
const snapshotUrl=(url:string)=>managerApiUrl("network-manager",url);
import * as Vue from 'vue';import {component} from '../../../../rancher-common-ui/client/index.mjs';const SnapshotLayout=component('SnapshotLayout',Vue);
import { contextMatches } from '../data/namespace-context';
import DataGrid from './DataGrid.vue';
import PageSummary from './PageSummary.vue';
import BulkActions from './BulkActions.vue';
import SnapshotOperations from './SnapshotOperations.vue';
import { formatSize } from '../config/file-size.mjs';
import { deleteSnapshots } from '../data/stored-snapshots';
import { displaySettings } from '../data/display-settings';
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import PageActions from './PageActions.vue';
import CreateButton from './CreateButton.vue';
import {askSnapshotOptions} from '../data/unlock-backup';
import {runSchedule} from '../data/snapshot-schedule';
const captureController=new AbortController();onBeforeUnmount(()=>captureController.abort());
const capturing=ref(false),captureMessage=ref('');
async function newSnapshot(){capturing.value=true;captureMessage.value='';let password='';try{const options=await askSnapshotOptions(false,captureController.signal);password=options.password;await runSchedule('',password,options.includeSecrets);await refreshSnapshots();captureMessage.value='Snapshot ZIP Saved.';}catch(e){captureMessage.value=e instanceof Error?e.message:'Snapshot capture failed.';}finally{password='';capturing.value=false;}}
import { configurationRollouts, reviewRollback, rollbackConfiguration, publications } from '../data/publications';
import { portConfigurations } from '../data/port-presets';
import SnapshotGate from './SnapshotGate.vue';
import { storedSnapshots, refreshSnapshots, readSnapshot } from '../data/stored-snapshots';
import { historyContext, snapshotToReview } from '../data/history-context';
import SnapshotComparison from './SnapshotComparison.vue';
import ActionIcon from './ActionIcon.vue';
import InventoryFilters from './InventoryFilters.vue';
import SnapshotDateRange from './SnapshotDateRange.vue';
import SnapshotSchedule from './SnapshotSchedule.vue';
import { rolloutExamples } from '../data/rollout-examples';
import { reviewStoredSnapshot, restoreStoredSnapshot } from '../config/restore-snapshot';
const props = withDefaults(defineProps<{ view?: 'snapshots' | 'rollouts'; namespaceFilter?: string; groupByNamespace?: boolean; search?: string }>(), { view: 'snapshots', namespaceFilter: '__all__', groupByNamespace: false, search: '' });

const demoRecords = rolloutExamples;
const demoSelected = ref('');
const demoReview = computed(() => demoRecords.find(record => record.id === demoSelected.value));
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
const matchesNamespace = (namespace: string | undefined) => props.namespaceFilter === '__all__' || (props.namespaceFilter === '__global__' ? !namespace : !namespace || namespace === props.namespaceFilter);
const rolloutNamespace = (record: typeof configurationRollouts[number]) => record.beforeConfiguration.namespace || '';
const visibleRollouts = computed(() => configurationRollouts.filter(record => matchesNamespace(rolloutNamespace(record)) && `${record.configurationName} ${rolloutNamespace(record)} ${record.before.map(draft => `${draft.namespace} ${draft.service}`).join(' ')}`.toLowerCase().includes(props.search.toLowerCase())));
const visibleExamples = computed(() => demoRecords.filter(record => matchesNamespace(record.namespace) && `${record.name} ${record.namespace} ${record.service} ${record.state}`.toLowerCase().includes(props.search.toLowerCase())));
const exampleGroups = computed(() => props.groupByNamespace ? [...new Set(visibleExamples.value.map(record => record.namespace))].sort().map(namespace => ({ namespace, records: visibleExamples.value.filter(record => record.namespace === namespace) })) : [{ namespace: '', records: visibleExamples.value }]);
const rolloutGroups = computed(() => props.groupByNamespace ? [...new Set(visibleRollouts.value.map(rolloutNamespace))].sort().map(namespace => ({ namespace, records: [...visibleRollouts.value].reverse().filter(record => rolloutNamespace(record) === namespace) })) : [{ namespace: '', records: [...visibleRollouts.value].reverse() }]);
watch(() => [props.namespaceFilter, props.groupByNamespace, props.search], () => { demoSelected.value = ''; selected.value = null; });
async function refresh() {
  storageError.value = ''; loading.value = true;
  try { await refreshSnapshots(); } catch (cause) { storageError.value = cause instanceof Error ? cause.message : 'Could not list snapshots.'; }
  finally { loading.value = false; }
}
onMounted(() => { if (props.view === 'snapshots') refresh(); });
watch(() => props.view, view => { selected.value = null; loaded.value = null; if (view === 'snapshots') refresh(); });
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
const selected = ref<number | null>(null);
const review = computed(() => selected.value === null ? null : reviewRollback(selected.value));
const ready = ref(false);
const confirmed = ref(false);
const message = ref('');
const snapshotGate = ref<InstanceType<typeof SnapshotGate> | null>(null);
const snapshotData = computed(() => ({ configuration: portConfigurations.find(config => config.id === review.value?.rollout?.configurationId), relatedConfigurations: portConfigurations.filter(config => config.id !== review.value?.rollout?.configurationId && review.value?.rollout?.after.some(draft => draft.configurationIds.includes(config.id))), localPublications: publications.filter(publication => review.value?.rollout?.after.some(after => after.name === publication.name && after.namespace === publication.namespace)) }));
const snapshotScope = computed(() => JSON.stringify(snapshotData.value));
function open(id: number) { selected.value = id; ready.value = false; confirmed.value = false; message.value = ''; }
function gateReady(value: boolean) { ready.value = value; if (!value) confirmed.value = false; }
function restore() {
  if (!confirmed.value || selected.value === null) return;
  if (!snapshotGate.value?.checkNow()) { ready.value = false; confirmed.value = false; message.value = 'Record or save a recent snapshot before restoring.'; return; }
  try { const count = rollbackConfiguration(selected.value); message.value = `Restored the previous configuration and ${count} local publication${count === 1 ? '' : 's'}. No cluster resources were changed.`; }
  catch (cause) { message.value = cause instanceof Error ? cause.message : 'Rollback could not be completed.'; }
}
const describe = (mappings: { mode: string; port: number; action?: string; targetLabel?: string }[]) => mappings.map(mapping => `${mapping.mode} ${mapping.port}${mapping.action ? ` → ${mapping.action} ${mapping.targetLabel}` : ''}`).join(', ');
</script>
<template>
  <SnapshotLayout class="history" :class="{ 'snapshot-history': view === 'snapshots' }">
    <template v-if="view === 'snapshots'">
    <PageActions><CreateButton label="New Snapshot" :disabled="capturing" @create="newSnapshot"/></PageActions>
    <p v-if="captureMessage" role="status">{{captureMessage}}</p>
    <InventoryFilters v-model:search="historySearch" v-model:namespace="historyNamespace" v-model:grouped="historyGrouped" :namespaces="historyNamespaces" search-label="Find A Snapshot" placeholder="Manual, automatic, scope, namespace, or route…"><template #extra><SnapshotDateRange v-model:from="dateFrom" v-model:to="dateTo" v-model:timed="dateTimed" /></template></InventoryFilters><div class="snapshot-records"><PageSummary :count="visibleSnapshots.length" label="Snapshots" help="Stored configuration backups include recovery YAML. Select items to prepare restoration drafts, merge snapshots with conflict review, or remove originals after saving a merged copy."/><BulkActions :items="visibleSnapshots.map(r=>({id:r.id,name:`${r.generation || 'Manual'} · ${r.scope?.label || r.name}`}))" v-model:selected="checked" :execute="deleteSnapshots" verb="Delete selected stored snapshot files from the hosting server after saving a recovery copy."/><p v-if="!dateRangeValid" class="error">Choose an end date at or after the start date.</p>

    <div v-if="historyContext" class="filter-note">Showing {{ historyContext.snapshotId ? 'Selected Snapshot For' : 'Records For' }} {{ historyContext.namespace }} / {{ historyContext.name }} <button type="button" class="text-button" @click="historyContext = null">Clear filter</button></div>
    
    <p v-if="storageError" class="error" role="alert">{{ storageError }}</p>

    <DataGrid :default-sort-column="3" :default-sort-descending="true"><thead><tr><th class="selection-cell"><input v-model="allChecked" type="checkbox" aria-label="Select All Snapshots"></th><th>Generation</th><th>Scope</th><th>Created</th><th data-align="right">Services / drafts</th><th data-align="right" title="Complete ZIP size; legacy indexes include associated YAML">Size</th><th class="actions-column">Actions</th></tr></thead><tbody><template v-for="group in snapshotGroups" :key="group.namespace"><tr v-if="historyGrouped" class="namespace-group"><th colspan="7">{{ group.namespace || 'Global' }}</th></tr><tr v-for="record in group.records" :key="record.id"><td class="selection-cell"><input v-model="checked" :value="record.id" type="checkbox" :aria-label="`Select ${record.generation || 'Manual'} ${record.name} snapshot`"></td><td>{{ record.generation || 'Manual' }}<small>Source: {{ new Date(record.sourceUpdatedAt || record.createdAt).toLocaleString() }}</small></td><td>{{ record.scope?.label || record.name }}<small :title="snapshotNamespaces(record).map(namespace => namespace || 'Global').join(', ')">{{ snapshotNamespaces(record).length > 3 ? `${snapshotNamespaces(record).length} Namespaces` : snapshotNamespaces(record).map(namespace => namespace || 'Global').join(', ') }}</small></td><td :data-sort="Date.parse(record.createdAt)">{{ new Date(record.createdAt).toLocaleString() }}</td><td>{{ record.services }} services · {{ record.publications }} drafts</td><td :data-sort="record.sizeBytes ?? -1" :title="record.encrypted?'Encrypted ZIP':record.archiveFormat==='zip'?'ZIP Archive':'Legacy JSON/YAML'">{{ formatSize(record.sizeBytes) }}</td><td><div class="snapshot-actions"><a class="icon-action" :href="snapshotUrl(record.archiveFormat==='zip'?`/api/snapshots/${record.id}/backup.zip`:`/api/snapshots/${record.id}`)" :download="`${record.name}-snapshot.${record.archiveFormat==='zip'?'zip':'json'}`" title="Download Snapshot" aria-label="Download Snapshot"><ActionIcon icon="details" /></a><a v-if="record.manifests&&record.archiveFormat!=='zip'" class="icon-action" :href="snapshotUrl(`/api/snapshots/${record.id}/manifests.yaml`)" download="routing-configuration-backup.yaml" title="Download routing manifests (YAML)" aria-label="Download routing manifests (YAML)"><ActionIcon icon="download" /></a><button type="button" class="icon-action" title="Review and restore snapshot" :aria-label="`Review and restore ${record.name} snapshot`" @click="openStored(record.id)"><ActionIcon icon="history" /></button></div></td></tr></template></tbody></DataGrid>
    <SnapshotOperations :snapshot="loaded" v-model:selected-ids="checked" @close="loaded=null"/><p v-if="storedMessage" role="status">{{ storedMessage }}</p></div><SnapshotSchedule />
    </template>
    <template v-else>
    
    <template v-if="!configurationRollouts.length"><p v-if="displaySettings.previewMode" class="example-note" role="note">Example records only — no session reconfigurations have been applied. These read-only examples do not change configurations, snapshots or pending counts.</p><DataGrid><thead><tr><th>Configuration</th><th>Namespace / Service</th><th>Publications</th><th>Status</th><th class="actions-column">Action</th></tr></thead><tbody><template v-for="group in exampleGroups" :key="group.namespace"><tr v-if="groupByNamespace" class="namespace-group"><th colspan="7">{{ group.namespace || 'Global' }}</th></tr><tr v-for="record in group.records" :key="record.id"><td>{{ record.name }}</td><td>{{ record.namespace }} / {{ record.service }}</td><td>{{ record.publications }}</td><td>{{ record.state }}</td><td class="actions-column"><button type="button" class="icon-action" :disabled="record.state.startsWith('Rolled')" :title="`Review example rollback for ${record.name}`" :aria-label="`Review example rollback for ${record.name}`" @click="demoSelected = demoSelected === record.id ? '' : record.id"><ActionIcon icon="history" /></button></td></tr></template></tbody></DataGrid><p v-if="!visibleExamples.length">No example records match this namespace.</p><section v-if="demoReview" class="restoration"><h3>Example Rollback Review · {{ demoReview.name }}</h3><p>Read-only demonstration. An actual rollback requires a fresh configuration snapshot and explicit confirmation.</p><DataGrid><thead><tr><th>Destination</th><th>Current Mapping</th><th>Restore Mapping</th></tr></thead><tbody><tr><td>{{ demoReview.namespace }}/{{ demoReview.service }}</td><td>{{ demoReview.after }}</td><td>{{ demoReview.before }}</td></tr></tbody></DataGrid><div class="actions"><button type="button" disabled>Restore Example (Preview Only)</button><button type="button" class="text-button" @click="demoSelected = ''">Close Example Review</button></div></section></template>
    <DataGrid v-else-if="visibleRollouts.length"><thead><tr><th>Configuration</th><th>Applied</th><th>Publications</th><th>Status</th><th class="actions-column">Action</th></tr></thead><tbody><template v-for="group in rolloutGroups" :key="group.namespace"><tr v-if="groupByNamespace" class="namespace-group"><th colspan="5">{{ group.namespace || 'Global' }}</th></tr><tr v-for="rollout in group.records" :key="rollout.id"><td>{{ rollout.configurationName }}</td><td>{{ new Date(rollout.createdAt).toLocaleString() }}</td><td>{{ rollout.before.length }}</td><td>{{ rollout.state }}</td><td class="actions-column"><button type="button" class="icon-action" title="Review rollback" :disabled="rollout.state === 'Rolled back'" :aria-label="`Review rollback for ${rollout.configurationName}`" @click="open(rollout.id)"><ActionIcon icon="history" /></button></td></tr></template></tbody></DataGrid><p v-else>No session records match this namespace.</p>
    <section v-if="review?.rollout" class="restoration"><h3>Restore {{ review.rollout.configurationName }}</h3><p>Restore the shared port configuration and every local publication changed by this rollout. Later edits block restoration.</p><DataGrid><thead><tr><th>Publication</th><th>After rollout</th><th>Restore to</th></tr></thead><tbody><tr v-for="(before, index) in review.rollout.before" :key="`${before.namespace}/${before.name}`"><td>{{ before.namespace }} / {{ before.name }}</td><td>{{ describe(review.rollout.after[index].mappings) }}</td><td>{{ describe(before.mappings) }}</td></tr></tbody></DataGrid><details><summary>Review restored manifests</summary><pre>{{ JSON.stringify({ configuration: review.rollout.beforeConfiguration, publications: review.rollout.before.map(publication => ({ name: publication.name, namespace: publication.namespace, resources: publication.resources })) }, null, 2) }}</pre></details><p v-if="review.error" class="error" role="alert">{{ review.error }}</p><SnapshotGate v-if="!review.error" ref="snapshotGate" :scope-key="snapshotScope" :data="snapshotData" @ready="gateReady" /><label v-if="!review.error" class="confirmation"><input v-model="confirmed" type="checkbox" :disabled="!ready">I confirm restoration of the listed configuration and publications.</label><p v-if="message" role="status">{{ message }}</p><div class="actions"><button type="button" :disabled="!!review.error || !ready || !confirmed" @click="restore">Restore previous configuration</button><button type="button" class="text-button" @click="selected = null">Close rollback review</button></div></section>
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

<style scoped>.snapshot-records{flex:1 0 100px;min-height:100px}</style>

<style scoped>@media(max-height:850px){.snapshot-history{overflow:auto}.snapshot-records{flex:0 0 auto;max-height:240px;min-height:100px}}</style>
