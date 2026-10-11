<script setup lang="ts">
import { contextMatches } from '../data/namespace-context';
import DataGrid from './DataGrid.vue';
import PageSummary from './PageSummary.vue';
import BulkActions from './BulkActions.vue';
import ResourceLink from './ResourceLink.vue';
import CreateButton from './CreateButton.vue';
import PageActions from './PageActions.vue';
import { displaySettings } from '../data/display-settings';
import InventoryFilters from './InventoryFilters.vue';
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { buildIssuer, type IssuerSettings } from '../config/issuer';
import { queueChange } from '../data/pending-rollouts';
import { issuerProfiles, rememberIssuer, credentialReferences, accountReferences, addCredentialReference, addCredentialKey, validateSecretName } from '../data/workspace';
import { useFormGuard } from '../data/form-guard';
import { existingIssuerSettings } from '../data/issuer-snapshot';
const settings = reactive<IssuerSettings>({ ...existingIssuerSettings });
const selectedProfile = ref('');
const search = ref('');
const checked=ref<string[]>([]);const allChecked=computed({get:()=>shownProfiles.value.length>0&&shownProfiles.value.every(p=>checked.value.includes(p.name)),set:(value:boolean)=>checked.value=value?shownProfiles.value.map(p=>p.name):[]});
function queueDeletes(ids:string[]){for(const profile of issuerProfiles.filter(p=>ids.includes(p.name)))queueChange({id:`delete:issuer:${profile.name}`,category:'Delete Issuer',name:profile.name,namespace:profileNamespace(profile),resources:profile.manifest?[profile.manifest]:[],configuration:{operation:'Delete',secretPreserved:true}});}
const namespaceFilter = ref('__all__');
const groupByNamespace = ref(false);
const profileNamespace = (profile: typeof issuerProfiles[number]) => {
  const resource = profile.manifest as { kind?: string; metadata?: { namespace?: string } } | undefined;
  return resource?.kind === 'Issuer' ? resource.metadata?.namespace || '' : '';
};
const namespaceOptions = computed(() => [...new Set(issuerProfiles.map(profileNamespace))].filter(Boolean).sort());
const shownProfiles = computed(() => issuerProfiles.filter(profile => {
  const namespace = profileNamespace(profile);
  return contextMatches(namespace) && (namespaceFilter.value === '__all__' || !namespace || namespace === namespaceFilter.value) && `${profile.name} ${namespace || 'Global'} ${profile.environment} ${profile.challenge} ${profile.settings?.zone || ''}`.toLowerCase().includes(search.value.toLowerCase());
}));
const profileGroups = computed(() => groupByNamespace.value ? [...new Set(shownProfiles.value.map(profileNamespace))].sort().map(namespace => ({ namespace, profiles: shownProfiles.value.filter(profile => profileNamespace(profile) === namespace) })) : [{ namespace: '', profiles: shownProfiles.value }]);
const editorVisible = ref(false);
const creating = ref(false);
const referenceEditor = ref<'secret' | 'key' | 'account' | ''>('');
const referenceDraft = reactive({ name: '', key: 'token' });
const referenceError = ref('');
const referenceNameInput = ref<HTMLInputElement | null>(null);
const referenceKeyInput = ref<HTMLInputElement | null>(null);
const credentialKeys = computed(() => credentialReferences.find(item => item.name === settings.secretName)?.keys || []);
function chooseIssuer(event: Event) {
  const select = event.target as HTMLSelectElement;
  const chosen = select.value; select.value = selectedProfile.value;
  if (chosen === '__add__') newIssuer();
  else selectProfile(chosen);
}
function chooseReference(kind: 'secret' | 'key' | 'account', event: Event) {
  const select = event.target as HTMLSelectElement;
  const field = kind === 'secret' ? 'secretName' : kind === 'key' ? 'secretKey' : 'accountSecretName';
  if (select.value === '__add__') {
    select.value = settings[field] || '';
    referenceEditor.value = kind;
    referenceDraft.name = kind === 'key' ? settings.secretName : '';
    referenceDraft.key = kind === 'key' ? '' : 'token';
    referenceError.value = '';
    nextTick(() => (kind === 'key' ? referenceKeyInput.value : referenceNameInput.value)?.focus());
  }
  else {
    settings[field] = select.value;
    if (kind === 'secret') settings.secretKey = credentialKeys.value[0] || '';
  }
}
function saveReference() {
  try {
    if (referenceEditor.value === 'secret') {
      addCredentialReference(referenceDraft.name, referenceDraft.key);
      settings.secretName = referenceDraft.name;
      settings.secretKey = referenceDraft.key;
    }
    else if (referenceEditor.value === 'key') {
      addCredentialKey(referenceDraft.name, referenceDraft.key);
      settings.secretKey = referenceDraft.key;
    }
    else if (referenceEditor.value === 'account') {
      validateSecretName(referenceDraft.name);
      if (!accountReferences.includes(referenceDraft.name)) accountReferences.push(referenceDraft.name);
      settings.accountSecretName = referenceDraft.name;
      queueChange({ id: `account-reference:${referenceDraft.name}`, category: 'ACME Account Reference', name: referenceDraft.name, namespace: 'cert-manager', resources: [], configuration: { name: referenceDraft.name, namespace: 'cert-manager', credentialValueRequired: true } });
    }
    referenceEditor.value = '';
  }
  catch (cause) { referenceError.value = cause instanceof Error ? cause.message : 'Check the reference and try again.'; }
}
function loadProfile() {
  const profile = issuerProfiles.find(item => item.name === selectedProfile.value);
  if (profile?.settings) {
    editorVisible.value = true;
    creating.value = false;
    Object.assign(settings, profile.settings);
  }
}
function selectProfile(name: string) { guard.leave(() => { selectedProfile.value = name; loadProfile(); }); }
function newIssuer() { guard.leave(resetIssuer); }
function resetIssuer() {
  editorVisible.value = true;
  creating.value = true;
  selectedProfile.value = '';
  const baseName = 'simple-network-manager-staging';
  let name = baseName;
  let suffix = 2;
  while (issuerProfiles.some(profile => profile.name === name)) name = `${baseName}-${suffix++}`;
  Object.assign(settings, existingIssuerSettings, { name, environment: 'staging', accountSecretName: '' });
  referenceEditor.value = '';
}
const manifest = ref('');
const error = ref('');
const download = computed(() => manifest.value ? `data:application/json;charset=utf-8,${encodeURIComponent(manifest.value)}` : '');
watch(settings, () => { manifest.value = ''; error.value = ''; });
watch(() => settings.environment, (value, old) => {
  if (settings.name === `simple-network-manager-${old}`) settings.name = `simple-network-manager-${value}`;
});
function generate() {
  try {
    if (creating.value && issuerProfiles.some(profile => profile.name === settings.name)) throw new Error('That issuer profile already exists. Choose a different name or select the existing profile to edit it.');
    const resource = buildIssuer(settings);
    rememberIssuer({ name: settings.name, environment: settings.environment, challenge: settings.challenge, source: 'Local draft', manifest: resource, settings: { ...settings } });
    selectedProfile.value = settings.name;
    creating.value = false;
    manifest.value = JSON.stringify(resource, null, 2);
    error.value = ''; guard.clean();
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Check the settings and try again.'; }
}
const guard = useFormGuard('issuer-profiles', () => settings.name || 'Issuer profile',
  () => ({ settings: { ...settings }, selectedProfile: selectedProfile.value, creating: creating.value, editorVisible: editorVisible.value, referenceEditor: referenceEditor.value, referenceDraft: { ...referenceDraft } }),
  state => { Object.assign(settings, state.settings); selectedProfile.value = state.selectedProfile; creating.value = state.creating; editorVisible.value = state.editorVisible; referenceEditor.value = state.referenceEditor; Object.assign(referenceDraft, state.referenceDraft); }, () => editorVisible.value);
</script>
<template>
  <section class="settings">
    <div class="issuer-profiles"><PageSummary :count="shownProfiles.length" label="Profiles" help="Issuer profiles configure certificate validation and reuse credential Secret references. Select a profile to edit it; saved changes wait in Pending Rollouts."/><BulkActions :items="shownProfiles.map(p=>({id:p.name,name:p.name,namespace:profileNamespace(p)}))" v-model:selected="checked" :execute="queueDeletes"/><InventoryFilters v-model:search="search" v-model:namespace="namespaceFilter" v-model:grouped="groupByNamespace" :namespaces="namespaceOptions" search-label="Find An Issuer Profile" placeholder="Name, namespace, domain, or environment…" /><DataGrid><thead><tr><th class="selection-cell"><input v-model="allChecked" type="checkbox" aria-label="Select All Issuer Profiles"></th><th>Issuer</th><th>Namespace</th><th>Environment</th><th>Validation</th><th>Source</th></tr></thead><tbody><template v-for="group in profileGroups" :key="group.namespace"><tr v-if="groupByNamespace" class="namespace-group"><th colspan="6">{{ group.namespace || 'Global' }}</th></tr><tr v-for="profile in group.profiles" :key="profile.name" :class="{ selected: selectedProfile === profile.name }" @click="selectProfile(profile.name)"><td class="selection-cell" @click.stop><input v-model="checked" :value="profile.name" type="checkbox" :aria-label="`Select ${profile.name}`"></td><td><button type="button" class="profile-name" @click.stop="selectProfile(profile.name)" :aria-pressed="selectedProfile === profile.name">{{ profile.name }}</button></td><td><ResourceLink kind="Namespace" :name="profileNamespace(profile)" :label="profileNamespace(profile) || 'Global'"/></td><td>{{ profile.environment }}</td><td>{{ profile.challenge === 'dns01' ? 'DNS challenge' : 'HTTP challenge' }}</td><td>{{ profile.source }}</td></tr></template></tbody></DataGrid></div>
    <div class="profile-controls"><PageActions><CreateButton label="Create New Issuer" @create="newIssuer" /></PageActions><button v-if="editorVisible" type="button" class="secondary" @click="guard.leave(() => { editorVisible = false; selectedProfile = ''; referenceEditor = ''; })">Close issuer setup</button></div>
    <section v-if="editorVisible" class="issuer-editor">
    <div class="settings-intro"><h2>Let’s Encrypt setup</h2><p>Configure certificate issuance through cert-manager. Generate a draft to review before making cluster changes.</p></div>
    <p class="hint">Prefilled from the cluster inspection. Secret dropdowns show references already used by issuers; secret values are never included. The live integration will discover available references under your Rancher permissions.</p>
    <section v-if="referenceEditor" class="reference-editor" aria-labelledby="reference-title">
      <h3 id="reference-title">{{ referenceEditor === 'secret' ? 'New credential Secret draft' : referenceEditor === 'key' ? 'Add a key to the selected Secret' : 'New ACME account Secret name' }}</h3>
      <form @submit.prevent="saveReference">
        <div class="fields">
          <label><span class="field-label">Secret namespace</span><input value="cert-manager" readonly></label>
          <label><span class="field-label">Secret name</span><input ref="referenceNameInput" v-model.trim="referenceDraft.name" :readonly="referenceEditor === 'key'" required></label>
          <label v-if="referenceEditor !== 'account'"><span class="field-label">New key name</span><input ref="referenceKeyInput" v-model.trim="referenceDraft.key" required></label>
        </div>
        <p v-if="referenceEditor === 'account'">cert-manager will generate this issuer’s account private key automatically. No private key entry is needed.</p>
        <p v-else-if="displaySettings.previewMode">Preview only: add the Secret name and key to the selectors. Credential values will be entered securely when applying to the cluster; this preview does not collect them or create a Kubernetes Secret.</p>
        <p v-if="referenceError" class="error" role="alert">{{ referenceError }}</p>
        <div class="actions"><button type="submit" class="primary">{{ referenceEditor === 'account' ? 'Use account Secret name' : 'Add local draft' }}</button><button type="button" class="secondary" @click="referenceEditor = ''">Cancel</button></div>
      </form>
    </section>
    <form @submit.prevent="generate">
      <div class="form-section"><h3>ACME account</h3>
        <div class="fields">
          <label><span class="field-label">Account email</span><input v-model.trim="settings.email" type="email" placeholder="admin@example.com" required autocomplete="off"></label>
          <label><span class="field-label">Let’s Encrypt environment</span><select v-model="settings.environment"><option value="staging">Staging — test certificates</option><option value="production">Production — trusted certificates</option></select></label>
          <label v-if="!creating"><span class="field-label">ClusterIssuer name</span><select :value="selectedProfile" @change="chooseIssuer"><option v-for="profile in issuerProfiles" :key="profile.name" :value="profile.name">{{ profile.name }}</option><option value="__add__">+ Add issuer profile…</option></select></label>
          <label v-else><span class="field-label">New ClusterIssuer name</span><input v-model.trim="settings.name" required></label>
          <label><span class="field-label">Validation method</span><select v-model="settings.challenge"><option value="dns01">DNS challenge — GoDaddy webhook</option><option value="http01">HTTP challenge — Traefik ingress</option></select></label>
          <label><span class="field-label">Account key Secret</span><select :value="settings.accountSecretName" @change="chooseReference('account', $event)"><option value="">Create automatically for this issuer</option><option v-for="name in accountReferences" :key="name" :value="name">{{ name }}</option><option value="__add__">+ Add account Secret name…</option></select></label>
          <label v-if="settings.challenge === 'http01'"><span class="field-label">Base domains</span><textarea v-model.trim="settings.zone" placeholder="example.com, example.net" rows="3" required /><small>Comma-separated or one per line. These supply the connection editor’s domain choices.</small></label>
        </div>
        <p class="hint">Staging certificates are for testing and will not be trusted by browsers. cert-manager creates the account key; this form does not collect a private key.</p>
      </div>
      <div v-if="settings.challenge === 'dns01'" class="form-section"><h3>GoDaddy DNS validation</h3>
        <div class="fields">
          <label><span class="field-label">Base domains / DNS zones</span><textarea v-model.trim="settings.zone" placeholder="example.com, example.net" rows="3" required /><small>Enter one or more base domains, separated by commas or new lines. These supply the connection editor’s domain dropdown.</small></label>
          <label><span class="field-label">Existing credential Secret</span><select :value="settings.secretName" @change="chooseReference('secret', $event)" required><option v-for="secret in credentialReferences" :key="secret.name" :value="secret.name">{{ secret.name }}{{ secret.source.startsWith('Local') ? ' (draft)' : '' }}</option><option value="__add__">+ Add credential Secret…</option></select></label>
          <label><span class="field-label">Credential Secret key</span><select :value="settings.secretKey" @change="chooseReference('key', $event)" required><option v-for="name in credentialKeys" :key="name" :value="name">{{ name }} (key name only)</option><option value="__add__">+ Add key…</option></select></label>
          <label><span class="field-label">GoDaddy API environment</span><select v-model="settings.providerProduction"><option :value="true">Production DNS API</option><option :value="false">Test DNS API</option></select></label>
        </div>
        <p class="hint">Use an existing Kubernetes Secret in cert-manager’s cluster resource namespace, commonly cert-manager. Enter the Secret reference, not the API token. The installed GoDaddy webhook is required.</p>
        <details><summary>Webhook configuration</summary><div class="fields advanced"><label><span class="field-label">Webhook group name</span><input v-model.trim="settings.groupName" required></label><label><span class="field-label">Solver name</span><input v-model.trim="settings.solverName" required></label></div><p class="hint">These defaults match the webhook observed in your cluster. The GoDaddy API environment is independent of Let’s Encrypt staging or production.</p></details>
      </div>
      <div v-else class="form-section"><h3>HTTP validation</h3><div class="fields"><label><span class="field-label">Ingress class</span><input v-model.trim="settings.ingressClass" required></label></div><p class="hint">The requested domain must resolve to this ingress, and its HTTP challenge path must be reachable from the internet on port 80. HTTP validation does not issue wildcard certificates.</p></div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="actions"><button type="submit" class="primary">Generate configuration draft</button><span>Draft only · nothing is saved or applied to the cluster</span></div>
    </form>
    <div v-if="manifest" class="generated" aria-live="polite"><div class="generated-heading"><h3>ClusterIssuer configuration</h3><a :href="download" :download="`${settings.name}.json`">Download draft</a></div><p>Review this manifest and verify the credential reference and webhook installation. A ready issuer handles issuance and renewal, but each route still needs a certificate request and TLS secret reference. Automatic route setup is planned for the live integration.</p><pre><code>{{ manifest }}</code></pre></div>
    </section>
  </section>
</template>
<style scoped>
.list-heading { display:flex; justify-content:space-between; align-items:center; gap:16px; }.list-heading span { color:#a9d2ff; font-size:13px; }
.settings { background: var(--box-bg, #242c38); border: 1px solid var(--border, #384352); border-radius: 7px; padding: 26px; }.settings-intro h2 { margin: 0; font-size: 21px; }p { color: var(--muted, #a5b1c3); font-size: 13px; line-height: 1.6; }.form-section { border-top: 1px solid var(--border, #384352); padding-top: 16px; margin-top: 18px; }h3 { font-size: 15px; margin: 0 0 20px; }.fields { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 980px; }label { display: flex; flex-direction: column; gap: 8px; color: var(--body-text, #dce3ed); font-size: 12px; }input, select, textarea { width: 100%; padding: 12px; border: 1px solid var(--border, #384352); border-radius: 5px; background: var(--input-bg, #1c2430); color: var(--body-text, #dce3ed); font: inherit; }.hint { font-size: 12px; margin-top: 16px; max-width: 980px; }summary { cursor: pointer; color: #91c3fc; font-size: 12px; }.advanced { margin-top: 16px; }.actions { display: flex; align-items: center; flex-wrap: wrap; gap: 18px; margin-top: 24px; }.actions span { color: var(--muted, #a5b1c3); font-size: 12px; }.primary { border: 0; border-radius: 5px; padding: 12px 18px; background: #326fb4; color: white; font: inherit; cursor: pointer; }input:focus-visible, select:focus-visible, textarea:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid #73b5ff; outline-offset: 3px; }.error { color: #ffb3ad; }.generated { margin-top: 26px; border-top: 1px solid var(--border, #384352); padding-top: 24px; }.generated-heading { display: flex; justify-content: space-between; gap: 20px; }.generated-heading a { color: #91c3fc; font-size: 13px; }pre { background: var(--input-bg, #1c2430); color: var(--body-text, #dce3ed); border-radius: 6px; padding: 20px; overflow: auto; font-size: 12px; line-height: 1.7; }@media(max-width: 760px) { .fields { grid-template-columns: 1fr; }.settings { padding: 18px; } }
</style>
<style scoped>
.list-heading { display:flex; justify-content:space-between; align-items:center; gap:16px; }.list-heading span { color:#a9d2ff; font-size:13px; }
.profile-controls { display: flex; align-items: end; gap: 12px; margin-top: 12px; }.profile-controls label { flex: 1; }
.issuer-editor { margin-top: 18px; }
.reference-editor { margin-top: 24px; padding: 24px; border: 1px solid #619bd9; border-radius: 6px; background: var(--input-bg, #1c2430); }.secondary { border: 1px solid var(--border, #384352); background: transparent; color: var(--body-text, #dce3ed); padding: 11px 18px; border-radius: 5px; cursor: pointer; }input[readonly] { opacity: .75; }
.issuer-profiles tbody tr { cursor: pointer; }.issuer-profiles tbody tr.selected { background: #1b344d; }.profile-name { background: transparent; border: 0; color: #91c3fc; padding: 0; font: inherit; cursor: pointer; }
.issuer-profiles { margin-bottom: 0; padding-bottom: 0; overflow-x: auto; }.issuer-profiles h2 { margin: 0; font-size: 21px; }table { width: 100%; border-collapse: collapse; }th, td { font-size: 12px; text-align: left; padding: 14px 8px; border-bottom: 1px solid var(--border, #384352); }
</style>

<style scoped>
.list-heading { display:flex; justify-content:space-between; align-items:center; gap:16px; }.list-heading span { color:#a9d2ff; font-size:13px; }.namespace-group th { background: var(--input-bg, #1c2430); color: #91c3fc; }</style>
