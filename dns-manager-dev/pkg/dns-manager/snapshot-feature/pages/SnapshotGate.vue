<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { snapshotRequirementMet, validateExistingSnapshot, validateSnapshotIndex } from '../config/snapshot-gate';
import { storeSnapshot, storedSnapshots, refreshSnapshots, readSnapshot } from '../data/stored-snapshots';
import { captureRelevantSecrets } from '../data/snapshot-secrets';
import { manifestYaml } from '../config/manifest-yaml.mjs';
import SnapshotComparison from './SnapshotComparison.vue';
import { encodeBackup, decodeBackup, withoutSecretValues } from '../config/backup-zip.mjs';
import { askBackupPassword, askSnapshotOptions } from '../data/unlock-backup';
import { snapshotToReview, historyContext } from '../data/history-context';
const props = defineProps<{ scopeKey: string; data: object }>();
const emit = defineEmits<{ (event: 'ready', value: boolean): void; (event: 'history'): void }>();
const choice = ref('');
const existingTime = ref('');
const existingReference = ref('');
const existingScope = ref('');
const loadingExisting = ref(false);
const selectedSnapshot = ref<any>(null);
let existingRequest = 0;
const coversServices = ref(false);
const createdTime = ref(0);
const capturedScope = ref('');
const snapshot = ref('');
const downloadStarted = ref(false);
const savedCopy = ref(false);
const saveOnHost = ref(true);
const downloadCopy = ref(false);
const storedId = ref('');
const saving = ref(false);
const error = ref('');
const includeSecrets = ref(false), backupUrl = ref('');
let backupPassword = '';
const captureController = new AbortController();
function clearDownload() { if (backupUrl.value) URL.revokeObjectURL(backupUrl.value); backupUrl.value = ''; }
const now = ref(Date.now());
const gateId = `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => { timer = setInterval(() => { now.value = Date.now(); }, 30000); refreshSnapshots().catch(() => { /* Upload and new download copies remain available. */ }); });
onUnmounted(() => { captureController.abort(); backupPassword = ''; if (timer) clearInterval(timer); clearDownload(); });
const download = computed(() => `data:application/json;charset=utf-8,${encodeURIComponent(snapshot.value)}`);
const yamlDownload = computed(() => `data:application/yaml;charset=utf-8,${encodeURIComponent(snapshot.value ? manifestYaml(JSON.parse(snapshot.value).current) : '')}`);
const requirement = computed(() => choice.value === 'yes'
  ? { createdAt: Date.parse(existingTime.value), scopeMatches: !!existingReference.value && existingScope.value === props.scopeKey && !loadingExisting.value, acknowledged: coversServices.value }
  : { createdAt: createdTime.value, scopeMatches: capturedScope.value === props.scopeKey && (!!storedId.value || downloadStarted.value), acknowledged: !!storedId.value || savedCopy.value });
const ready = computed(() => snapshotRequirementMet(requirement.value, now.value));
watch(ready, value => emit('ready', value), { immediate: true });
watch(() => props.scopeKey, () => {
  choice.value = ''; existingTime.value = ''; existingReference.value = ''; coversServices.value = false;
  existingScope.value = ''; existingRequest++; loadingExisting.value = false;
  selectedSnapshot.value = null;
  createdTime.value = 0; capturedScope.value = ''; snapshot.value = ''; downloadStarted.value = false; savedCopy.value = false;
  storedId.value = ''; error.value = '';
  emit('ready', false);
});
async function chooseExisting(id: string) {
  const request = ++existingRequest; const scope = props.scopeKey;
  existingTime.value = ''; existingScope.value = ''; coversServices.value = false; error.value = ''; selectedSnapshot.value = null;
  if (!id || id === '__upload__') { loadingExisting.value = false; return; }
  loadingExisting.value = true;
  try {
    const saved = await readSnapshot(id);
    if (request !== existingRequest || scope !== props.scopeKey) return;
    validateSnapshotIndex(saved);
    selectedSnapshot.value = saved;
    validateExistingSnapshot(saved, props.data);
    existingTime.value = saved.createdAt; existingScope.value = scope; coversServices.value = true;
  } catch (cause) { if (request === existingRequest) error.value = cause instanceof Error ? cause.message : 'The snapshot could not be verified.'; }
  finally { if (request === existingRequest) loadingExisting.value = false; }
}
async function uploadSnapshot(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  const request = ++existingRequest; const scope = props.scopeKey;
  existingTime.value = ''; existingScope.value = ''; coversServices.value = false; error.value = ''; selectedSnapshot.value = null; loadingExisting.value = true;
  try {
    if (!file || file.size > 8 * 1024 * 1024) throw new Error('Choose a backup ZIP smaller than 8 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    let saved;
    try { saved = await decodeBackup(bytes); }
    catch (error) {
      if (!(error instanceof Error) || !error.message.includes('requires its password')) throw error;
      let password = await askBackupPassword();
      try { saved = await decodeBackup(bytes, password); } finally { password = ''; }
    }
    if (request !== existingRequest || scope !== props.scopeKey) return;
    validateSnapshotIndex(saved);
    selectedSnapshot.value = saved;
    validateExistingSnapshot(saved, props.data);
    existingTime.value = saved.createdAt; existingScope.value = scope; coversServices.value = true;
  } catch (cause) { if (request === existingRequest) error.value = cause instanceof SyntaxError ? 'Upload the JSON snapshot index. YAML alone cannot verify the snapshotâ€™s age and coverage.' : cause instanceof Error ? cause.message : 'The uploaded snapshot could not be verified.'; }
  finally { if (request === existingRequest) loadingExisting.value = false; }
}
function reviewRestoration() { if (!selectedSnapshot.value) return; snapshotToReview.value = selectedSnapshot.value; historyContext.value = null; emit('history'); }
async function createSnapshot() {
  if (saving.value || !saveOnHost.value && !downloadCopy.value) return;
  choice.value = 'no';
  const scope = props.scopeKey;
  let current = JSON.parse(JSON.stringify(props.data));
  error.value = ''; storedId.value = ''; snapshot.value = ''; createdTime.value = 0;
  downloadStarted.value = false; savedCopy.value = false;
  saving.value = true;
  try {
    const options = await askSnapshotOptions(false, captureController.signal);
    includeSecrets.value = options.includeSecrets; backupPassword = options.password;
    current = includeSecrets.value ? await captureRelevantSecrets(current) : withoutSecretValues(current);
    if (includeSecrets.value && current.secretBackup?.missing?.length) throw new Error('Secret capture is incomplete: '+current.secretBackup.missing.join(', '));
    if (includeSecrets.value && !backupPassword) throw new Error('Confirm a strong backup password before capture.');
    const result = saveOnHost.value ? await storeSnapshot(current, scope, backupPassword) : { format: 'DNS Manager configuration snapshot', schemaVersion: 1, createdAt: new Date().toISOString(), scopeKey: scope, includesSecretValues: current.routeManifests?.some((resource:any)=>resource.kind==='Secret'&&(resource.data!==undefined||resource.stringData!==undefined)) || false, includesApplicationData: false, current };
    if (props.scopeKey !== scope) { error.value = 'The review changed during capture. Create a snapshot for the updated review.'; return; }
    now.value = Date.now(); createdTime.value = Date.parse(result.createdAt); capturedScope.value = scope;
    const bytes = await encodeBackup(result, backupPassword);
    await decodeBackup(bytes, backupPassword);
    clearDownload(); backupUrl.value = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
    // Display only capture metadata; decrypted Secret payloads are never rendered here.
    snapshot.value = JSON.stringify({id:result.id,current:{secretBackup:result.current.secretBackup}}); storedId.value = result.id || '';
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Snapshot could not be saved.'; }
  finally { saving.value = false; backupPassword = ''; includeSecrets.value = false; }
}
function checkNow() { now.value = Date.now(); return snapshotRequirementMet(requirement.value, now.value); }
defineExpose({ checkNow, snapshotId: () => storedId.value || (choice.value === 'yes' && existingReference.value !== '__upload__' ? existingReference.value : '') });
</script>
<template>
  <section class="snapshot-gate" :aria-labelledby="gateId">
    <h4 :id="gateId">Snapshot required before configuration changes</h4>
    <fieldset><legend>Have you created a snapshot of every affected service in the last 24 hours?</legend><label class="inline"><input v-model="choice" type="radio" value="yes" :name="gateId">Yes â€” use an existing snapshot</label><label class="inline"><input v-model="choice" type="radio" value="no" :name="gateId">No â€” create a configuration snapshot now</label></fieldset>
    <div v-if="choice === 'yes'" class="existing">
      <div class="fields"><label>Existing snapshot<select v-model="existingReference" @change="chooseExisting(existingReference)"><option value="">Select a stored snapshotâ€¦</option><option v-for="record in storedSnapshots" :key="record.id" :value="record.id">{{ record.generation || 'Manual' }} Â· {{ record.scope?.label || record.name }} Â· {{ new Date(record.createdAt).toLocaleString() }} Â· {{ record.services }} services</option><option value="__upload__">Upload a backup ZIPâ€¦</option></select></label><label v-if="existingReference === '__upload__'">Upload backup ZIP<input type="file" accept=".zip,application/zip" @change="uploadSnapshot"></label></div>
      <p v-if="loadingExisting" role="status">Verifying snapshot age and configuration coverageâ€¦</p>
      <p v-if="selectedSnapshot">Created: {{ new Date(selectedSnapshot.createdAt).toLocaleString() }}. Creation time is read from the snapshot.</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <SnapshotComparison v-if="selectedSnapshot" :current="data" :saved="selectedSnapshot.current" />
      <button v-if="selectedSnapshot" type="button" @click="reviewRestoration">Review this snapshot for restoration</button>
      <p>The ZIP contains the dated index, DNS configuration, and recovery manifests. Encrypted backups require their password. A different snapshot can be reviewed for restoration in Snapshots, with a fresh backup and explicit overwrite confirmation.</p>
    </div>
    <div v-if="choice === 'no'"><p>Capture the saved DNS source, zone records, and applied priority separately from proposals. Preview captures are labeled sample data. Include Secrets is optional; it encrypts the entire recovery payload with AES-256. Unavailable credential reads block Secret capture. Volume and application data are excluded.</p><label class="inline"><input v-model="saveOnHost" type="checkbox" :disabled="saving">Save on the hosting server for Snapshots and rollback (recommended)</label><label class="inline"><input v-model="downloadCopy" type="checkbox" :disabled="saving">Also prepare a download copy</label><p>Server copies use dedicated persistent storage, separate from rotating logs. Include that volume in your backup policy.</p><button type="button" :disabled="saving || !saveOnHost && !downloadCopy" @click="createSnapshot">{{ saving ? 'Saving snapshotâ€¦' : snapshot ? 'Create a fresh configuration snapshot' : 'Create configuration snapshot' }}</button><p v-if="error" class="error" role="alert">{{ error }}</p><div v-if="snapshot" class="created"><p>{{ storedId ? 'Snapshot saved on the hosting server and available in Snapshots.' : 'Download this snapshot and confirm that you saved it before continuing.' }}</p><p v-if="JSON.parse(snapshot).current.secretBackup?.missing?.length" class="error">Secret Values Not Captured: {{ JSON.parse(snapshot).current.secretBackup.missing.join(', ') }}</p><a v-if="downloadCopy || !storedId" :href="backupUrl" download="dns-manager-backup.zip" @click="downloadStarted = true">Download Backup ZIP</a><label v-if="!storedId" class="inline"><input v-model="savedCopy" type="checkbox" :disabled="!downloadStarted">I saved the snapshot outside this preview.</label></div></div>
    <p class="status" role="status">{{ ready ? 'Snapshot requirement satisfied. Review and confirm the changes below.' : 'Reconfiguration is blocked until a recent snapshot is recorded or created and saved.' }}</p>
  </section>
</template>
<style scoped>
.snapshot-gate { margin-top: 26px; border: 1px solid #619bd9; border-radius: 6px; padding: 20px; background: var(--box-bg, #242c38); }h4 { font-size: 15px; margin: 0 0 18px; }fieldset { margin: 0; padding: 16px; border: 1px solid var(--border, #384352); border-radius: 5px; }legend, label { font-size: 12px; }label { display: flex; flex-direction: column; gap: 8px; }.inline { flex-direction: row; align-items: center; margin: 14px 0; }.inline input, select { width: auto; }input, select { width: 100%; padding: 11px; background: var(--input-bg, #1c2430); color: inherit; border: 1px solid var(--border, #384352); border-radius: 5px; font: inherit; }.fields { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 18px; }.wide { grid-column: 1/-1; }p { font-size: 12px; line-height: 1.7; color: var(--muted, #a5b1c3); }button { border: 0; border-radius: 5px; background: #326fb4; color: white; padding: 11px 16px; cursor: pointer; font: inherit; }a { color: #91c3fc; font-size: 12px; }.error { color: #ffb3ad; }.status { margin-bottom: 0; }.created { margin-top: 18px; }input:focus-visible, select:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid #73b5ff; outline-offset: 3px; }@media(max-width: 760px) { .fields { grid-template-columns: 1fr; } }
</style>

<style scoped>.yaml-link { display: inline-block; margin-left: 16px; }</style>
