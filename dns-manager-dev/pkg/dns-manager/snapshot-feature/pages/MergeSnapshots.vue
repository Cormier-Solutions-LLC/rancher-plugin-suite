<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import SnapshotUnlock from './SnapshotUnlock.vue';
import {askSnapshotOptions,askBackupPassword} from '../data/unlock-backup';
import {containsSecretValues} from '../config/backup-zip.mjs';
import PageSummary from './PageSummary.vue';
import PageActions from './PageActions.vue';
import ActionIcon from './ActionIcon.vue';
import DataGrid from './DataGrid.vue';
import { mergeSourceIds } from '../data/merge-session';
import { historyContext } from '../data/history-context';
import { readSnapshot, mergeOrderedSnapshots, deleteSnapshots, refreshSnapshots, storedSnapshots } from '../data/stored-snapshots';
import { captureScheduleSource } from '../data/snapshot-schedule';
import { snapshotItems } from '../config/snapshot-items.mjs';
import { mergeInPriorityOrder, compareMergedConfiguration } from '../config/snapshot-merge.mjs';
import { captureRelevantSecrets } from '../data/snapshot-secrets';
import { mergeSelectionGroups, planMergeSelection } from '../config/merge-selection.mjs';
import { coverageEntries } from '../config/snapshot-coverage.mjs';
import { editorDirty, registerEditorSave, rememberFormDraft, activeFormDraft, formDrafts } from '../data/editor-session';

const unlockRecords=ref<any[]>([]), unlocking=ref(true), skipped=ref<any[]>([]);
let sessionPasswords:Record<string,string>={}, mergedPassword='';
const controller=new AbortController();
let savedDraft:any;
const emit = defineEmits<{ navigate: [section: string] }>();
const groups = computed(() => mergeSelectionGroups(allItems.value, items.value.map((item:any)=>item.id)));
const labels = computed(() => ['Override Priority', ...groups.value.map((group:any) => group.label), 'Review Differences', 'Final Summary']);
const reviewStep = computed(() => groups.value.length + 1);
const finalStep = computed(() => reviewStep.value + 1);
const activeGroup = computed(() => groups.value[step.value - 1]);
const sources = ref<any[]>([]), selectedIds = ref<string[]>([]), step = ref(0), reached = ref(0);
const busy = ref(true), error = ref(''), confirmed = ref(false), removeSources = ref(false);
const draggedId = ref(''), dropTarget = ref(''), search = ref(''), current = ref<any>(captureScheduleSource());
const merged = ref<any>(null), removed = ref(false), loading = ref(true);
const flattened = computed(() => sources.value.length >= 2 ? mergeInPriorityOrder(sources.value) : null);
const allItems = computed(() => flattened.value ? snapshotItems(flattened.value.flattened) : []);
const flattenedComparison = computed(() => flattened.value ? compareMergedConfiguration(current.value, flattened.value.flattened) : []);
const matchingIds = computed(() => flattenedComparison.value.filter((item:any) => item.status === 'Unchanged').map((item:any) => item.id));
const items = computed(() => allItems.value.filter((item:any) => flattenedComparison.value.some((row:any) => row.id === item.id && ['Added','Changed'].includes(row.status))));
const selectionPlan = computed(() => flattened.value ? planMergeSelection(current.value, flattened.value.flattened, selectedIds.value) : { includedIds:[], preservedSecrets:[] });
const includedIds = computed(() => selectionPlan.value.includedIds);
const groupItems = computed(() => items.value.filter((item:any) => activeGroup.value?.ids.includes(item.id)));
const visibleItems = computed(() => groupItems.value.filter((item:any) => `${item.name} ${item.type === 'resource' ? item.value.kind : item.type} ${item.namespace}`.toLowerCase().includes(search.value.toLowerCase())));
const result = computed(() => includedIds.value.length && sources.value.length >= 2 ? mergeInPriorityOrder(sources.value, includedIds.value, selectionPlan.value.preservedSecrets) : null);
const changes = computed(() => result.value ? compareMergedConfiguration(current.value, result.value.current).filter((item:any) => ['Added','Changed'].includes(item.status)) : []);
const selectedAll = computed({ get: () => groupItems.value.length > 0 && groupItems.value.every((item:any) => selectedIds.value.includes(item.id)), set: (value:boolean) => { const ids = new Set(groupItems.value.map((item:any) => item.id)); selectedIds.value = [...selectedIds.value.filter(id => !ids.has(id)), ...(value ? [...ids] : [])] as string[]; } });
const isSecret = (item:any) => item.type === 'resource' && item.value.kind === 'Secret';
const currentSecret = (id:string) => snapshotItems(current.value).find((item:any) => item.id === id);
const sourceBaseline = ref('');
function leaveBrowser(event:BeforeUnloadEvent) { if (editorDirty.value) { event.preventDefault(); event.returnValue = ''; } }
const validSelection = computed(() => !!result.value?.items.length && !result.value?.missing.length);
const canRemove = computed(() => !!result.value && result.value.omitted === 0);
const sourceTitle = (source:any) => source.scope?.label || source.current.snapshotScope?.label || source.name || 'Configuration Snapshot';
const show = (value:any) => value === undefined ? 'Not Configured' : JSON.stringify(value, null, 2);

onMounted(async () => {
  window.addEventListener('beforeunload', leaveBrowser);
  registerEditorSave(() => rememberFormDraft('merge-snapshots', 'Snapshot Merge', { ids:(unlocking.value?unlockRecords.value:sources.value).map(source => source.id), selectedIds:selectedIds.value, step:step.value, removeSources:removeSources.value }));
  try {
    const draft = formDrafts.value.find(item => item.id === activeFormDraft.value && item.page === 'merge-snapshots')?.state;
    const ids = draft?.ids || mergeSourceIds.value;
    if (ids.length < 2) throw new Error('Select at least two snapshots on the Snapshots page to start a merge.');
    await refreshSnapshots(); savedDraft=draft;
    unlockRecords.value=ids.map((id:string)=>{const record=storedSnapshots.value.find(item=>item.id===id);if(!record)throw new Error('A selected snapshot no longer exists. Return to Snapshots and refresh.');return record;});
    return;
  } catch (e) { error.value = e instanceof Error ? e.message : 'Could not load snapshots.'; }
  finally { await nextTick(); loading.value = false; busy.value = false; editorDirty.value = false; }
});
async function acceptUnlocked(payload:any) {
 loading.value=true;busy.value=true;error.value='';
 try {
 sources.value=payload.sources;sessionPasswords=payload.passwords;skipped.value=payload.excluded;
     try {current.value = await captureRelevantSecrets(captureScheduleSource(), allItems.value.filter(isSecret).map((item:any)=>item.value));} catch {current.value=captureScheduleSource();}
    sourceBaseline.value = JSON.stringify(coverageEntries(captureScheduleSource()));
    selectedIds.value = savedDraft?.selectedIds || items.value.filter((item:any) => !isSecret(item)).map((item:any) => item.id);
    step.value = savedDraft?.step || 0; reached.value = step.value;
    removeSources.value = savedDraft?.removeSources || false;

 unlocking.value=false;
 }catch(e){error.value=e instanceof Error?e.message:'Could not prepare merge.';sessionPasswords={};}
 finally{await nextTick();loading.value=false;busy.value=false;editorDirty.value=false;}
}
onBeforeUnmount(() => { controller.abort(); sessionPasswords={}; mergedPassword=''; window.removeEventListener('beforeunload', leaveBrowser); registerEditorSave(null); editorDirty.value = false; });
watch([sources, selectedIds], () => {
  if (loading.value || merged.value) return;
  editorDirty.value = true; confirmed.value = false;
  if (!canRemove.value) removeSources.value = false;
}, { deep:true });
watch(step, async () => { await nextTick(); document.querySelector('.merge-stepper .active')?.scrollIntoView({block:'nearest',inline:'center'}); });
watch(removeSources, () => { if (!loading.value && !merged.value) editorDirty.value = true; });
function move(id:string, index:number) {
  const from = sources.value.findIndex(source => source.id === id);
  if (from < 0 || index < 0 || index >= sources.value.length || from === index) return;
  const ordered = [...sources.value]; const [source] = ordered.splice(from, 1); ordered.splice(index, 0, source);
  sources.value = ordered; reached.value = 0; step.value = 0;
}
function pointerStart(event:PointerEvent, id:string) {
  if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
  draggedId.value = id; dropTarget.value = id;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function pointerMove(event:PointerEvent) {
  if (!draggedId.value) return;
  const target = document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-snapshot-id]') as HTMLElement | null;
  if (target) dropTarget.value = target.dataset.snapshotId || '';
}
function pointerEnd() {
  const index = sources.value.findIndex(source => source.id === dropTarget.value);
  if (index >= 0) move(draggedId.value,index);
  draggedId.value = ''; dropTarget.value = '';
}
function go(index:number) {
  if (busy.value || index > reached.value || index >= reviewStep.value && !validSelection.value) return;
  step.value = index;
  search.value = ''; if (index === reviewStep.value) confirmed.value = false;
}
function next() {
  if (step.value === reviewStep.value - 1 && !validSelection.value) return;
  reached.value = Math.max(reached.value, step.value + 1); go(step.value + 1);
}
async function finish() {
  if (!confirmed.value || !validSelection.value || busy.value || merged.value) return;
  let refreshed;try{refreshed=await captureRelevantSecrets(captureScheduleSource(), allItems.value.filter(isSecret).map((item:any)=>item.value));}catch{refreshed=captureScheduleSource();}
  if (JSON.stringify(coverageEntries(captureScheduleSource())) !== sourceBaseline.value) { error.value = 'Current configuration changed. Review each item type again before merging.'; confirmed.value = false; step.value = 1; reached.value = 1; current.value = refreshed; sourceBaseline.value = JSON.stringify(coverageEntries(captureScheduleSource())); return; }
  busy.value = true; error.value = '';
  try {
    if(containsSecretValues(result.value.current)){const options=await askSnapshotOptions(true,controller.signal);mergedPassword=options.password;}
    merged.value = await mergeOrderedSnapshots(sources.value.map(source => source.id), includedIds.value, selectionPlan.value.preservedSecrets,sessionPasswords,mergedPassword);
    editorDirty.value = false;
    formDrafts.value = formDrafts.value.filter(draft => draft.id !== activeFormDraft.value); activeFormDraft.value = '';
    if (removeSources.value) await removeOriginals(); else {sessionPasswords={};mergedPassword='';}
  } catch (e) { error.value = e instanceof Error ? e.message : 'Merge failed. Originals are preserved.'; }
  finally { busy.value = false; if(merged.value){sessionPasswords={};mergedPassword='';} }
}
async function removeOriginals() {
  try { await deleteSnapshots(sources.value.map(source => source.id), merged.value.id, true, sessionPasswords,mergedPassword); removed.value = true; sessionPasswords={}; mergedPassword=''; }
  catch (e) { error.value = `Merged snapshot saved. Original snapshots were retained: ${e instanceof Error ? e.message : 'cleanup failed'}`; }
}
async function retryCleanup() { busy.value = true; try{if(containsSecretValues(merged.value.current))mergedPassword=await askBackupPassword();await removeOriginals();}catch(e){error.value=e instanceof Error?e.message:'Cleanup cancelled.';}finally{busy.value=false;mergedPassword='';sessionPasswords={};} }
function openMerged() { historyContext.value = { snapshotId:merged.value.id, routeId:'', name:'Merged Snapshot', namespace:'', service:'' }; emit('navigate','history'); }
</script>

<template>
  <PageSummary :count="sources.length" label="Source Snapshots" help="Order snapshots by override priority, select configuration items, review differences against the current configuration, then confirm the merge. Original capture dates are preserved."/>
  <PageActions><button type="button" class="header-action" :disabled="busy" @click="emit('navigate','history')"><ActionIcon icon="history"/>Back To Snapshots</button></PageActions>
  <p v-if="error&&unlocking" class="error" role="alert">{{error}}</p>
  <SnapshotUnlock v-if="unlocking&&unlockRecords.length" :records="unlockRecords" @continue="acceptUnlocked"/>
  <p v-if="!unlocking&&skipped.length" class="error" role="alert">Snapshots Not Processed: {{skipped.map(item=>`${item.name} (${item.id}): ${item.reason}`).join('; ')}}</p>
  <div v-if="!unlocking" class="merge-workflow">
    <nav class="merge-stepper" aria-label="Snapshot Merge Steps"><ol :style="{gridTemplateColumns:`repeat(${labels.length},minmax(105px,1fr))`}"><li v-for="(label,index) in labels" :key="label" :class="{active:index===step,complete:index<step}"><button type="button" :aria-current="index===step?'step':undefined" :disabled="busy||!!merged||index>reached||(index>=reviewStep&&!validSelection)" @click="go(index)"><span class="step-number">{{ index<step?'✓':index+1 }}</span><span>{{ label }}</span></button></li></ol></nav>
    <div class="merge-content" :aria-busy="busy">
      <p v-if="loading" role="status">Loading Source Snapshots…</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <section v-if="merged" aria-label="Merge Complete"><h2>Merge Complete</h2><p role="status">Merged snapshot saved with {{ result?.items.length }} configuration items. {{ removed ? 'Original snapshots removed.' : 'Original snapshots retained.' }}</p><p>The merged snapshot is available for selective restoration. Current configuration has not been overwritten.</p><button type="button" @click="openMerged">View Merged Snapshot</button><button v-if="removeSources&&!removed" type="button" :disabled="busy" @click="retryCleanup">Retry Removing Originals</button></section>
      <template v-else-if="!loading&&sources.length>=2">
        <section v-if="step===0" aria-label="Override Priority"><h2>Order Snapshots By Override Priority</h2><p>Drag snapshots into order. The top snapshot has the highest priority and wins when the same item exists in more than one snapshot. Use the arrow buttons or Alt + Up/Down as an alternative.</p><ol class="priority-list"><li v-for="(source,index) in sources" :key="source.id" tabindex="0" :data-snapshot-id="source.id" :class="{dragging:draggedId===source.id,target:dropTarget===source.id}" :aria-label="`Priority ${index+1}: ${sourceTitle(source)}`" @pointerdown="pointerStart($event,source.id)" @pointermove="pointerMove" @pointerup="pointerEnd" @pointercancel="draggedId='';dropTarget=''" @keydown.alt.up.prevent="move(source.id,index-1)" @keydown.alt.down.prevent="move(source.id,index+1)"><span class="drag-handle" aria-hidden="true">⠿</span><span class="priority-number">{{ index+1 }}</span><div class="source-name"><strong>{{ sourceTitle(source) }}</strong><small>{{ new Date(source.createdAt).toLocaleString() }} · {{ snapshotItems(source.current).length }} Items · {{ source.id }}</small></div><span v-if="index===0" class="priority-badge">Highest Priority</span><span class="order-buttons"><button type="button" :disabled="index===0" :aria-label="`Move Snapshot ${index+1} Up`" @click="move(source.id,index-1)">↑</button><button type="button" :disabled="index===sources.length-1" :aria-label="`Move Snapshot ${index+1} Down`" @click="move(source.id,index+1)">↓</button></span></li></ol></section>
        <section v-else-if="activeGroup" aria-label="Select Merge Items"><h2>{{ activeGroup.label }}</h2><p>Choose added or changed {{ activeGroup.label.toLowerCase() }} to include in the merged snapshot. All {{ matchingIds.length }} matching items are retained automatically and hidden from this list. Required dependencies are included automatically.</p><p v-if="activeGroup.key==='secrets'">Unchecked Secrets keep current credentials when readable. If current credentials are unavailable, the saved version is retained in the backup without applying it. Check a Secret only to choose its snapshot version. Secret values are hidden.</p><p v-if="activeGroup.key==='secrets'&&current.secretBackup?.missing?.length" role="status">Current Secret Values Unavailable: {{ current.secretBackup.missing.join(', ') }}. This preview cannot capture credentials that were absent from the inspection.</p><div class="item-selection"><label><input v-model="selectedAll" type="checkbox">{{ activeGroup.key==='secrets' ? 'Use Snapshot Versions For All Changed Secrets' : 'Include All Changed Items' }}</label><label class="item-search">Find An Item<input v-model="search" type="search" placeholder="Name, type, or namespace…"></label><span>{{ selectedIds.filter(id=>groupItems.some((item:any)=>item.id===id)).length }} / {{ groupItems.length }} Changes Selected</span></div><DataGrid><thead><tr><th class="selection-cell"></th><th>Item</th><th>Type</th><th>Namespace</th><th>Winning Source</th></tr></thead><tbody><tr v-for="item in visibleItems" :key="item.id"><td class="selection-cell"><input v-model="selectedIds" type="checkbox" :value="item.id" :aria-label="`Include ${item.id}`"></td><td>{{ item.name }}<small v-if="isSecret(item)" class="secret-choice">{{ selectedIds.includes(item.id) ? 'Use Snapshot Version' : currentSecret(item.id) ? 'Keep Current Credentials' : 'Keep Saved Version — Current Unavailable' }}</small></td><td>{{ item.type==='resource'?item.value.kind:item.type }}</td><td>{{ item.namespace || 'Global' }}</td><td>{{ sources.find(source=>source.id===flattened?.current.itemSources[item.id]?.snapshotId)?.createdAt ? new Date(sources.find(source=>source.id===flattened?.current.itemSources[item.id]?.snapshotId).createdAt).toLocaleString() : '—' }}</td></tr><tr v-if="!visibleItems.length"><td colspan="5">No Results Available</td></tr></tbody></DataGrid><p v-if="result?.added.length">Required Dependencies Included: {{ result.added.map((item:any)=>item.name).join(', ') }}</p><p v-if="result?.missing.length" class="error" role="alert">Missing Required Dependencies: {{ result.missing.join(', ') }}. Choose snapshots that contain them or deselect the affected item.</p></section>
        <section v-else-if="step===reviewStep" aria-label="Review Merge Differences"><h2>Review Differences Against Current Configuration</h2><p>{{ changes.length }} added or changed items after flattening the selected snapshots. Matching items are ignored. Current-only items are left untouched.</p><p v-if="!changes.length" class="success" role="status">No Configuration Differences. The selected items match the current configuration.</p><details v-for="(change,index) in changes" :key="change.id" :open="index===0"><summary>{{ change.name }} · {{ change.type }} · {{ change.namespace || 'Global' }} <span class="difference-badge">{{ change.status }}</span></summary><div class="side-by-side"><article><h3>Current Configuration</h3><pre>{{ show(change.current) }}</pre></article><article><h3>Merged Configuration</h3><pre>{{ show(change.merged) }}</pre></article></div></details></section>
        <section v-else aria-label="Final Merge Summary"><h2>Final Summary</h2><p v-if="result?.current.secretBackup?.missing?.length" class="error" role="status">Incomplete Credential Backup — Secret Values Not Captured: {{ result.current.secretBackup.missing.join(', ') }}. The merged files retain all available configuration; unavailable values cannot be reconstructed.</p><dl><dt>Source Snapshots</dt><dd>{{ sources.length }}</dd><dt>Included Items</dt><dd>{{ result?.items.length }}</dd><dt>Required Dependencies Added</dt><dd>{{ result?.added.length }}</dd><dt>Added Configuration Items</dt><dd>{{ changes.filter((item:any)=>item.status==='Added').length }}</dd><dt>Changed Configuration Items</dt><dd>{{ changes.filter((item:any)=>item.status==='Changed').length }}</dd><dt>Matching Items Retained</dt><dd>{{ matchingIds.length }}</dd><dt>Items Excluded</dt><dd>{{ result?.omitted }}</dd><dt>Output</dt><dd>One Merged Snapshot With JSON Index And YAML Recovery File</dd></dl><h3>Override Priority — Highest First</h3><ol><li v-for="source in sources" :key="source.id">{{ sourceTitle(source) }} · {{ new Date(source.createdAt).toLocaleString() }}</li></ol><p>Merging saves a backup. Restore and Apply remain separate actions. Secret choices are included in the backup; merging never updates live credentials. Original capture dates remain attached to unchanged items.</p><label class="confirmation"><input v-model="confirmed" type="checkbox">I Confirm The Selected Items And Override Priority</label><label class="confirmation"><input v-model="removeSources" type="checkbox" :disabled="!canRemove">Remove These Snapshots When Merged</label><p v-if="!canRemove">Original snapshots must be retained because the merged snapshot excludes items. Include all items to enable removal.</p><p v-else-if="removeSources">The {{ sources.length }} source snapshots will be removed only after the merged snapshot has been saved successfully.</p></section>
      </template>
    </div>
    <footer v-if="!merged" class="merge-footer"><button type="button" class="secondary" :disabled="busy" @click="emit('navigate','history')">Cancel</button><span></span><button v-if="step>0" type="button" class="secondary" :disabled="busy" @click="go(step-1)">Back</button><button v-if="step<finalStep" type="button" :disabled="busy||sources.length<2||(step===reviewStep-1&&!validSelection)" @click="next">Next</button><button v-else type="button" :disabled="busy||!confirmed||!validSelection" @click="finish"><ActionIcon icon="merge"/>{{ busy?'Merging…':'Merge Snapshots' }}</button></footer>
  </div>
</template>

<style scoped>
.merge-workflow{display:flex;flex-direction:column;height:100%;min-height:0;font-size:13px}.merge-stepper{overflow-x:auto;flex-shrink:0;padding:4px 0 22px;border-bottom:1px solid var(--border,#384352)}.merge-stepper ol{display:grid;padding:0;margin:0;list-style:none}.merge-stepper li{position:relative}.merge-stepper li:not(:last-child):after{content:'';position:absolute;top:18px;left:calc(50% + 23px);right:calc(-50% + 23px);height:2px;background:#455363}.merge-stepper li.complete:after{background:#619bd9}.merge-stepper button{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:9px;width:100%;padding:0;background:transparent;color:#a5b1c3;border:0;font-size:12px}.step-number{display:grid;place-items:center;width:36px;height:36px;border:2px solid #455363;border-radius:50%;background:#242c38;color:#b6c6d9;font-size:16px}.active button{color:#a9d2ff}.active .step-number,.complete .step-number{border-color:#619bd9;background:#25466a;color:white}.merge-content{flex:1;min-height:0;overflow:auto;padding:20px 2px}.merge-content h2{font-size:17px;margin:0 0 12px}.merge-content h3{font-size:13px;margin:18px 0 10px}.merge-content p{line-height:1.6;color:#a5b1c3;margin:12px 0}.priority-list{padding:0;list-style:none;margin:20px 0}.priority-list>li{touch-action:none;user-select:none;display:flex;align-items:center;gap:12px;padding:16px 12px;border:1px solid #455363;border-radius:5px;margin-bottom:10px;background:#1c2430;cursor:grab}.priority-list>li.dragging{opacity:.45}.priority-list>li.target{border-color:#73b5ff;box-shadow:0 -3px #73b5ff}.priority-list>li:focus-visible{outline:2px solid #73b5ff}.drag-handle{touch-action:none;user-select:none;font-size:25px;color:#9aaec6}.priority-number{font-variant-numeric:tabular-nums;color:#a9d2ff}.source-name{flex:1;min-width:0}.source-name small{display:block;color:#9aaec6;margin-top:8px;font-size:11px;overflow-wrap:anywhere}.priority-badge,.difference-badge{border-radius:4px;padding:5px 8px;background:#25466a;color:#a9d2ff;font-size:11px;white-space:nowrap}.order-buttons{display:flex;gap:5px}.order-buttons button{width:30px;height:30px;padding:0;background:transparent;border:1px solid #455363;color:#a9d2ff;font-size:18px}.item-selection{display:flex;align-items:center;gap:16px;margin:18px 0}.item-selection label,.confirmation{display:flex;align-items:center;gap:8px}.item-search{margin-left:auto}.item-search input{background:#1c2430;border:1px solid #455363;color:inherit;padding:8px;border-radius:5px;min-width:0}.item-selection span{white-space:nowrap}.secret-choice{display:block;color:#a5b1c3;margin-top:5px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:12px 8px;border-bottom:1px solid #384352;font-size:12px}details{margin:12px 0;border:1px solid #455363;border-radius:5px}summary{display:flex;align-items:center;gap:10px;padding:12px;color:#a9d2ff;cursor:pointer}.side-by-side{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding:0 12px 12px}.side-by-side h3{margin:12px 0}pre{max-height:320px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:#1c2430;border:1px solid #384352;border-radius:4px;padding:12px;font-size:11px;line-height:1.6;margin:0}dl{display:grid;grid-template-columns:minmax(180px,1fr) minmax(0,2fr);gap:14px;max-width:700px;margin:20px 0}dt{color:#a5b1c3}dd{margin:0}.confirmation{margin:18px 0}.merge-footer{display:flex;align-items:center;gap:10px;padding-top:16px;border-top:1px solid #384352;flex-shrink:0}.merge-footer>span{flex:1}button{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:5px;background:#326fb4;color:white;padding:10px 14px;font:inherit;cursor:pointer}.secondary{background:transparent;border:1px solid #619bd9}button:disabled{opacity:.5;cursor:not-allowed}button:focus-visible{outline:2px solid #73b5ff;outline-offset:2px}.merge-content .error{color:#ffb3ad}.merge-content .success{color:#9cd9bc}@media(max-width:700px){.priority-badge{display:none}.item-selection{flex-wrap:wrap}.item-search{margin-left:0;flex:1}.side-by-side{grid-template-columns:1fr}.merge-stepper button{font-size:10px}dl{grid-template-columns:1fr 1fr}}
</style>
