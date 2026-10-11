<script setup lang="ts">
import { contextMatches } from '../data/namespace-context';
import DataGrid from './DataGrid.vue';
import PageSummary from './PageSummary.vue';
import BulkActions from './BulkActions.vue';
import ResourceLink from './ResourceLink.vue';
import { inventoryDatasets } from '../data/inventory';
const certificateResources = inventoryDatasets['certificate-resources-snapshot.json'];
import { pendingChanges } from '../data/pending-rollouts';
import CreateButton from './CreateButton.vue';
import PageActions from './PageActions.vue';
import { displaySettings } from '../data/display-settings';
import InventoryFilters from './InventoryFilters.vue';
import { computed, reactive, ref, watch } from 'vue';
import { queueChange } from '../data/pending-rollouts';
const inventory = inventoryDatasets['certificate-snapshot.json'];
import { routes } from '../data/snapshot';
const serviceInventory = inventoryDatasets['publication-snapshot.json'];
import { issuerProfiles } from '../data/workspace';
import { issuerDomains } from '../config/issuer-domains';
import { buildHostnames } from '../config/domains';
import { buildNewCertificate, suggestTlsSecretName } from '../config/new-certificate';
import { manifestYaml } from '../config/manifest-yaml.mjs';
import { useFormGuard } from '../data/form-guard';
import ActionIcon from './ActionIcon.vue';
const props = defineProps<{ namespaces: string[]; search: string }>();
const creating = ref(false);
const groupByNamespace = ref(false);
const search = ref('');
const issuerFilter=ref('');const stateFilter=ref('');const checked=ref<string[]>([]);
const allChecked=computed({get:()=>certificates.value.length>0&&certificates.value.every(c=>checked.value.includes(key(c))),set:(value:boolean)=>checked.value=value?certificates.value.map(key):[]});
function queueDeletes(ids:string[]){for(const certificate of certificates.value.filter(c=>ids.includes(key(c)))){const resource=certificateResources.resources.find(r=>r.metadata.name===certificate.name&&r.metadata.namespace===certificate.namespace);queueChange({id:`delete:certificate:${key(certificate)}`,category:'Delete Certificate',name:certificate.name,namespace:certificate.namespace,resources:resource?[resource]:[],configuration:{operation:'Delete',secretPreserved:true}});}}
const namespaceFilter = ref('__all__');
const namespaceOptions = computed(() => [...new Set(inventory.certificates.map(certificate => certificate.namespace))].sort());
const createError = ref('');
const certificateDraft = ref<any>(null);
const form = reactive({ name: '', namespace: '', secretName: '', issuer: issuerProfiles[0]?.name || '', baseDomain: '', subdomains: '' });
const secretNameEdited = ref(false);
watch(() => [form.name, form.namespace], () => { if (!secretNameEdited.value) form.secretName = suggestTlsSecretName(form.name, form.namespace); }, { flush: 'sync' });
const zones = computed(() => issuerDomains(issuerProfiles.find(profile => profile.name === form.issuer)));
watch(zones, value => { if (!value.includes(form.baseDomain)) form.baseDomain = value[0] || ''; }, { flush: 'sync' });
const certificateYaml = computed(() => certificateDraft.value ? manifestYaml({ routeManifests: [certificateDraft.value] }) : '');
const certificateDownload = computed(() => `data:application/yaml;charset=utf-8,${encodeURIComponent(certificateYaml.value)}`);
function newCertificate() { guard.leave(resetCertificate); }
function resetCertificate() {
  secretNameEdited.value = false;
  Object.assign(form, { name: '', namespace: namespaceFilter.value.startsWith('__') ? '' : namespaceFilter.value, secretName: '', issuer: issuerProfiles[0]?.name || '', baseDomain: zones.value[0] || '', subdomains: '' });
  certificateDraft.value = null; createError.value = ''; creating.value = true; selected.value = null;
}
function prepareCertificate() {
  try {
    if (!serviceInventory.namespaces.includes(form.namespace) || !issuerProfiles.some(profile => profile.name === form.issuer)) throw new Error('Select an available namespace and issuer profile.');
    if (inventory.certificates.some(certificate => certificate.namespace === form.namespace && (certificate.name === form.name || certificate.secretName === form.secretName))) throw new Error('This certificate name or TLS Secret is already in use. Choose new names or reissue the existing certificate.');
    certificateDraft.value = buildNewCertificate({ ...form, hosts: buildHostnames(form.baseDomain, form.subdomains) }); createError.value = '';
    queueChange({ id: `certificate:${form.namespace}/${form.name}`, category: 'New Certificate', name: form.name, namespace: form.namespace, resources: [certificateDraft.value] }); guard.clean();
  } catch (cause) { createError.value = cause instanceof Error ? cause.message : 'Check certificate settings.'; }
}
watch(form, () => { certificateDraft.value = null; createError.value = ''; }, { deep: true });
const certificates = computed(() => inventory.certificates.filter(certificate => contextMatches(certificate.namespace) && (!issuerFilter.value||certificate.issuer===issuerFilter.value)&&(!stateFilter.value||(certificate.ready==='True'?'Ready':'Pending')===stateFilter.value)&& (namespaceFilter.value === '__all__' || certificate.namespace === namespaceFilter.value) && `${certificate.name} ${certificate.secretName} ${certificate.issuer} ${certificate.hosts.join(' ')}`.toLowerCase().includes(search.value.toLowerCase())));
watch(certificates,()=>{checked.value=checked.value.filter(id=>certificates.value.some(c=>key(c)===id));});
const groups = computed(() => groupByNamespace.value ? [...new Set(certificates.value.map(certificate => certificate.namespace))].sort().map(namespace => ({ namespace, certificates: certificates.value.filter(certificate => certificate.namespace === namespace) })) : [{ namespace: '', certificates: certificates.value }]);
type Certificate = typeof inventory.certificates[number];
const selected = ref<Certificate | null>(null);
const confirmed = ref(false);
const requests = ref<Record<string, string>>({});
const key = (certificate: Certificate) => `${certificate.namespace}/${certificate.name}`;
const affected = computed(() => routes.filter(route => route.namespace === selected.value?.namespace && route.certificate === selected.value?.secretName));
function open(certificate: Certificate) { guard.leave(() => { selected.value = certificate; confirmed.value = false; creating.value = false; }); }
function request() {
  if (!selected.value || !confirmed.value) return;
  const certificate = selected.value;
  requests.value[key(certificate)] = JSON.stringify({ operation: 'RequestCertificateRenewal', execution: 'Preview only; not submitted to cert-manager', certificate: { name: certificate.name, namespace: certificate.namespace }, issuer: { name: certificate.issuer, kind: certificate.issuerKind }, dnsNames: certificate.hosts, secretName: certificate.secretName, observedRevision: certificate.revision, requestedAt: new Date().toISOString() }, null, 2);
  queueChange({ id: `renewal:${key(certificate)}`, category: 'Certificate Reissue', name: certificate.name, namespace: certificate.namespace, resources: [], configuration: JSON.parse(requests.value[key(certificate)]) }); guard.clean();
}
const download = computed(() => selected.value ? `data:application/json;charset=utf-8,${encodeURIComponent(requests.value[key(selected.value)] || '')}` : '');
const guard = useFormGuard('certificates', () => creating.value ? form.name || 'New certificate' : `Reissue ${selected.value?.name || 'certificate'}`,
  () => ({ form: { ...form }, creating: creating.value, secretNameEdited: secretNameEdited.value, selected: selected.value ? key(selected.value) : '', confirmed: confirmed.value }),
  state => { secretNameEdited.value = true; Object.assign(form, state.form); secretNameEdited.value = state.secretNameEdited; creating.value = state.creating; selected.value = inventory.certificates.find(certificate => key(certificate) === state.selected) || null; confirmed.value = state.confirmed; }, () => creating.value || !!selected.value);
</script>
<template>
  <section class="certificate-lifecycle"><div class="certificate-heading"><PageSummary :count="certificates.length" label="Certificates" help="Certificate resources reference their TLS Secrets and issuer. Reissue prepares a renewal request; deleting a Certificate leaves its Secret intact."/><BulkActions :items="certificates.map(c=>({id:key(c),name:c.name,namespace:c.namespace}))" v-model:selected="checked" :execute="queueDeletes"/><PageActions><CreateButton label="Create New Certificate" @create="newCertificate" /></PageActions></div>
    <form v-if="creating" class="review new-certificate" @submit.prevent="prepareCertificate"><h3>Issue a new certificate</h3><p>Prepare a cert-manager Certificate using an issuer profile.<span v-if="displaySettings.previewMode"> This preview generates YAML; actual issuance needs a live cluster connection and successful domain validation.</span></p><div class="certificate-fields"><label>Certificate name<input v-model.trim="form.name" placeholder="example-site" required></label><label>Namespace<select v-model="form.namespace" required><option value="" disabled>Select namespace…</option><option v-for="namespace in serviceInventory.namespaces" :key="namespace">{{ namespace }}</option></select></label><label>TLS Secret name<input v-model.trim="form.secretName" @input="secretNameEdited = !!form.secretName" placeholder="namespace-example-site-tls" required><small>cert-manager creates this Secret. No private key is entered here.</small></label><label>Certificate issuer<select v-model="form.issuer" required><option v-for="profile in issuerProfiles" :key="profile.name">{{ profile.name }}</option></select></label><label>Base domain<select v-model="form.baseDomain" :disabled="!zones.length" required><option v-if="!zones.length" value="">Configure base domains in the issuer profile</option><option v-for="zone in zones" :key="zone">{{ zone }}</option></select></label><label>Subdomains<textarea v-model="form.subdomains" rows="3" placeholder="app, api, @"/><small>Blank requests the base domain and www. Use @ for the base domain.</small></label></div><p v-if="createError" class="error" role="alert">{{ createError }}</p><div class="actions"><button type="submit">Prepare certificate draft</button><button type="button" class="secondary" @click="guard.leave(() => { creating = false; })">Cancel</button></div><div v-if="certificateDraft" role="status"><p>Certificate draft prepared. Issuance has not been submitted.</p><a :href="certificateDownload" :download="`${form.name}-certificate.yaml`">Download Certificate YAML</a><pre>{{ certificateYaml }}</pre></div></form>
    <InventoryFilters v-model:search="search" v-model:namespace="namespaceFilter" v-model:grouped="groupByNamespace" :namespaces="namespaceOptions" search-label="Find A Certificate" placeholder="Certificate, namespace, domain, or issuer…" :extra-columns="['150px', '130px']"><template #extra><label>Issuer<select v-model="issuerFilter"><option value="">All Issuers</option><option v-for="issuer in [...new Set(inventory.certificates.map(c=>c.issuer))].sort()" :key="issuer">{{ issuer }}</option></select></label><label>State<select v-model="stateFilter"><option value="">All States</option><option>Ready</option><option>Pending</option></select></label></template></InventoryFilters><DataGrid><thead><tr><th class="selection-cell"><input v-model="allChecked" type="checkbox" aria-label="Select All Certificates"></th><th>Certificate / TLS Secret</th><th>Namespace</th><th>Issuer</th><th>State at inspection</th><th class="actions-column">Action</th></tr></thead><tbody><template v-for="group in groups" :key="group.namespace"><tr v-if="groupByNamespace" class="namespace-group"><th colspan="6">{{ group.namespace }} <small>{{ group.certificates.length }} Certificates</small></th></tr><tr v-for="certificate in group.certificates" :key="key(certificate)"><td class="selection-cell"><input v-model="checked" :value="key(certificate)" type="checkbox" :aria-label="`Select ${certificate.name}`"></td><td>{{ certificate.name }}<small>Secret Reference: <ResourceLink kind="Secret" :name="certificate.secretName" :namespace="certificate.namespace"/></small></td><td><ResourceLink kind="Namespace" :name="certificate.namespace"/></td><td><ResourceLink :kind="certificate.issuerKind" :name="certificate.issuer" :namespace="certificate.issuerKind==='Issuer'?certificate.namespace:''"/></td><td>{{ certificate.ready === 'True' ? 'Ready' : 'Not ready' }}<small v-if="requests[key(certificate)]">Reissue draft prepared; not submitted</small></td><td class="actions-column"><button type="button" class="icon-action" title="Review certificate reissue" :aria-label="`Reissue ${certificate.name} in ${certificate.namespace}`" @click="open(certificate)"><ActionIcon icon="reconfigure" /></button></td></tr></template></tbody></DataGrid>
    <section v-if="selected" class="review"><h3>Reissue {{ selected.name }}</h3><p>{{ selected.namespace }} · {{ selected.issuerKind }} {{ selected.issuer }}</p><p>Domains: {{ selected.hosts.join(', ') }}</p><p>TLS Secret reference: {{ selected.secretName }}. Its existing certificate remains in place while cert-manager attempts renewal.</p><p v-if="affected.length">Referenced by inspected routes: {{ affected.map(route => route.name).join(', ') }}.</p><p v-if="displaySettings.previewMode">This preview generates a request for review. It does not attempt issuance or report a new certificate as ready. Live execution must trigger cert-manager renewal and watch CertificateRequest, Order, Challenge and Certificate status. Issuer and ACME validation must succeed.</p><label><input v-model="confirmed" type="checkbox" :disabled="!!requests[key(selected)]">I confirm a reissue attempt for this certificate and these domains.</label><div class="actions"><button type="button" :disabled="!confirmed || !!requests[key(selected)]" @click="request">Prepare reissue request</button><button type="button" class="text" @click="guard.leave(() => { selected = null; })">Cancel / close</button></div><div v-if="requests[key(selected)]" role="status"><p>Reissue request prepared locally. No renewal attempt was submitted.</p><a :href="download" :download="`${selected.name}-reissue-request.json`">Download reissue request</a></div></section>
  </section>
</template>
<style scoped>
.certificate-lifecycle { overflow-x: auto; }h2 { font-size: 21px; }h3 { font-size: 16px; }p, small { font-size: 12px; color: var(--muted, #a5b1c3); line-height: 1.7; }small { display: block; margin-top: 8px; }table { width: 100%; border-collapse: collapse; font-size: 12px; }th, td { padding: 14px 10px; border-bottom: 1px solid var(--border, #384352); text-align: left; }.review { margin-top: 24px; padding: 22px; border: 1px solid #619bd9; border-radius: 6px; background: var(--input-bg, #1c2430); }button { background: #326fb4; border: 0; padding: 10px 16px; border-radius: 5px; color: white; cursor: pointer; font: inherit; }button:disabled { opacity: .55; cursor: not-allowed; }.text { background: transparent; color: #91c3fc; }.actions { display: flex; gap: 12px; margin-top: 20px; }label { font-size: 12px; display: flex; align-items: center; gap: 12px; }a { color: #91c3fc; font-size: 12px; }button:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid #73b5ff; outline-offset: 3px; }
</style>

<style scoped>
.certificate-count { color:#a9d2ff; font-size:13px; }.certificate-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }.certificate-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }.certificate-fields label { display: flex; flex-direction: column; align-items: stretch; gap: 8px; }.certificate-fields input, .certificate-fields select, .certificate-fields textarea { width: 100%; min-height: 42px; padding: 12px; background: var(--box-bg, #242c38); color: inherit; border: 1px solid var(--border, #384352); border-radius: 5px; font: inherit; }.new-certificate { margin-bottom: 24px; }.secondary { background: transparent; border: 1px solid #619bd9; }pre { font-size: 12px; line-height: 1.7; overflow: auto; }.error { color: #ffb3ad; }@media(max-width: 760px) { .certificate-fields { grid-template-columns: 1fr; } }
</style>

<style scoped>.certificate-filters { margin: 22px 0; }.certificate-filters label { flex-direction: column; align-items: start; gap: 7px; color: var(--muted, #a5b1c3); }.certificate-filters select { padding: 11px; min-width: 160px; background: var(--input-bg, #1c2430); color: inherit; border: 1px solid var(--border, #384352); border-radius: 5px; font: inherit; }.namespace-group th { background: var(--input-bg, #1c2430); color: #91c3fc; }.namespace-group small { display: inline; margin-left: 10px; font-weight: normal; }</style>
