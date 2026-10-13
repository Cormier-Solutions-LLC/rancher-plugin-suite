<script setup lang="ts">
import ActionIcon from './ActionIcon.vue';
import PageActions from './PageActions.vue';
import DataGrid from './DataGrid.vue';
import { displaySettings } from '../data/display-settings';
import { liveRolloutSource } from '../data/running-processes';
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { editorDirty, completeEditorDraft, activeEditorDraft, editorDrafts, registerEditorSave, rememberEditorDraft } from '../data/editor-session';
import { issuerProfiles } from '../data/workspace';
import { issuerDomains } from '../config/issuer-domains';
import { configurationInNamespace } from '../config/configuration-scope';
import { matchesConfiguration } from '../config/configuration-search';
import { resolveBackendPort } from '../config/backend-port';
import { portConfigurations, transportOf } from '../data/port-presets';
import { buildHostnames } from '../config/domains';
import { buildMultiPublication, type MultiPublication, type PortMapping } from '../config/multi-publication';
import { inventoryDatasets } from '../data/inventory';
const inventory = inventoryDatasets['publication-snapshot.json'];
const listeners = inventoryDatasets['listener-snapshot.json'];
import { rememberPublication } from '../data/publications';
import { applyPortLinks, mergePortConfigurations } from '../config/port-links';
import type { ConfigurationPort, PortConfiguration } from '../data/port-presets';
import { routeEditSource, buildRouteEdit } from '../config/edit-route';
import { saveConnectionDraft } from '../data/connection-edits';
const certificateInventory = inventoryDatasets['certificate-resources-snapshot.json'];
import { existingCertificateBindings } from '../config/existing-certificate';
import MultiFilter from './MultiFilter.vue';
const props = withDefaults(defineProps<{ editId?: string }>(), { editId: '' });
const emit = defineEmits<{ cancel: []; saved: []; review: [] }>();
const source = computed(() => props.editId ? routeEditSource(props.editId) : null);
const certificateActionLabel = computed(() => source.value?.certificate ? 'Update current certificate' : 'Generate new certificate');
const existingConfig = computed<PortConfiguration | null>(() => source.value ? { id: 'existing-connection', name: 'Existing connection ports', source: 'Observed route', ports: source.value.mappings.map(mapping => ({ label: mapping.label, port: mapping.port, mode: mapping.mode })) } : null);
const form = reactive({ name: '', namespace: '', service: '', issuer: 'letsencrypt-prod', ingressClass: inventory.ingressClasses.includes('traefik') ? 'traefik' : inventory.ingressClasses[0] || '' });
const routingKind = ref<NonNullable<MultiPublication['routingKind']>>('automatic');
const baseDomain = ref(issuerProfiles.find(profile => profile.name === form.issuer)?.settings?.zone || '');
const selectedIssuer = computed(() => issuerProfiles.find(profile => profile.name === form.issuer));
const certificateMode = ref<'issuer' | 'existing'>('issuer');
const certificateNames = ref<string[]>([]);
const availableCertificates = computed(() => certificateInventory.resources.filter(certificate => certificate.metadata.namespace === form.namespace));
const selectedCertificates = computed(() => certificateNames.value.map(name => availableCertificates.value.find(certificate => certificate.metadata.name === name)).filter((certificate): certificate is typeof certificateInventory.resources[number] => !!certificate));
const selectedCertificate = computed(() => selectedCertificates.value[selectedCertificates.value.length - 1]);
const domains = computed(() => issuerDomains(selectedIssuer.value));
watch(domains, zones => { baseDomain.value = zones.includes(baseDomain.value) ? baseDomain.value : zones[0] || ''; }, { immediate: true, flush: 'sync' });
watch(certificateNames, value => {
  if (value.includes('__new__')) { certificateNames.value = []; return; }
  certificateMode.value = value.length ? 'existing' : 'issuer';
  if (selectedCertificate.value) form.issuer = selectedCertificate.value.spec.issuerRef.name;
}, { flush: 'sync' });
const subdomains = ref('');
const nameEdited = ref(false);
const selection = ref<string[]>(['https']);
const configSearch = ref('');
const mappings = reactive<Record<string, PortMapping>>({});
const services = computed(() => inventory.services.filter(service => service.namespace === form.namespace));
const destination = computed(() => services.value.find(service => service.name === form.service));
const ports = computed(() => destination.value?.ports || []);
const suggestedName = computed(() => form.namespace && form.service ? `${form.service}-${form.namespace}`.slice(0, 63).replace(/-+$/, '') : '');
const allConfigurations = computed(() => existingConfig.value ? [existingConfig.value, ...portConfigurations] : portConfigurations);
const availableConfigurations = computed(() => allConfigurations.value.filter(config => configurationInNamespace(config, form.namespace) && matchesConfiguration(config, configSearch.value)));
const selectedConfigurations = computed(() => allConfigurations.value.filter(config => selection.value.includes(config.id)));
const combinedPorts = computed(() => {
  const merged = new Map<string, ConfigurationPort & { key: string; transport: string }>();
  selectedConfigurations.value.forEach(config => config.ports.forEach(port => {
    const key = `${port.mode}-${port.port}`;
    if (!merged.has(key)) merged.set(key, { ...port, key, transport: transportOf(port) });
  }));
  return [...merged.values()];
});
const hostPreview = computed(() => { try { return { names: buildHostnames(baseDomain.value, subdomains.value), error: '' }; } catch (cause) { return { names: [], error: cause instanceof Error ? cause.message : 'Check domain names.' }; } });
const hasTls = computed(() => combinedPorts.value.some(port => ['HTTPS', 'TLS'].includes(port.mode)));
const result = ref('');
const error = ref('');
const baseline = ref('');
const editorState = computed(() => ({ form: { ...form }, baseDomain: baseDomain.value, subdomains: subdomains.value, selection: [...selection.value], mappings: { ...mappings }, routingKind: routingKind.value, certificateMode: certificateMode.value, certificateNames: [...certificateNames.value] }));
const serializedState = computed(() => JSON.stringify(editorState.value));
watch(serializedState, value => { editorDirty.value = !!baseline.value && value !== baseline.value; }, { flush: 'sync' });
function cleanEditor() { baseline.value = serializedState.value; editorDirty.value = false; }
function unload(event: BeforeUnloadEvent) { if (editorDirty.value) { event.preventDefault(); event.returnValue = ''; } }
onMounted(() => {
  const draft = editorDrafts.value.find(draft => draft.id === activeEditorDraft.value);
  if (draft) {
    const state = draft.state; nameEdited.value = true;
    form.namespace = state.form.namespace; Object.assign(form, state.form);
    baseDomain.value = state.baseDomain; subdomains.value = state.subdomains;
    selection.value = [...state.selection]; routingKind.value = state.routingKind;
    certificateNames.value = [...(state.certificateNames || [])];
    baseDomain.value = state.baseDomain; subdomains.value = state.subdomains;
    Object.keys(mappings).forEach(key => delete mappings[key]); Object.assign(mappings, state.mappings);
  }
  cleanEditor(); registerEditorSave(() => rememberEditorDraft(form.name, props.editId, editorState.value));
  window.addEventListener('beforeunload', unload);
});
onBeforeUnmount(() => { registerEditorSave(null); editorDirty.value = false; window.removeEventListener('beforeunload', unload); });
const download = computed(() => `data:application/json;charset=utf-8,${encodeURIComponent(result.value)}`);
const compatiblePorts = (transport: string) => ports.value.filter(port => port.protocol === transport);
const compatibleListeners = (transport: string) => listeners.entryPoints.filter(listener => listener.protocol === transport);
function syncMappings(reset = false) {
  const keys = new Set(combinedPorts.value.map(port => port.key));
  Object.keys(mappings).forEach(key => { if (!keys.has(key) || reset) delete mappings[key]; });
  for (const port of combinedPorts.value) {
    if (mappings[port.key]) continue;
    const candidates = compatiblePorts(port.transport);
    const preferred = candidates.find(candidate => candidate.port === port.port) || (['HTTP', 'HTTPS'].includes(port.mode) ? candidates.find(candidate => candidate.name === 'http') || candidates.find(candidate => /^(http|webui|web)(-|$)/.test(candidate.name || '')) : undefined);
    const listener = compatibleListeners(port.transport).find(listener => listener.port === port.port);
    mappings[port.key] = { label: port.label, port: port.port, mode: port.mode, entryPoint: listener?.name || '', backendPort: preferred ? String(preferred.name || preferred.port) : '', backendScheme: preferred?.port === 443 || preferred?.name === 'https' ? 'https' : 'http' };
  }
}
watch(() => form.namespace, () => { form.service = ''; certificateNames.value = []; }, { flush: 'sync' });
watch(() => form.service, () => {
  selection.value = selection.value.filter(id => { const config = allConfigurations.value.find(config => config.id === id); return config && configurationInNamespace(config, form.namespace); });
  syncMappings(true);
}, { flush: 'sync' });
watch(combinedPorts, () => syncMappings(), { immediate: true, deep: true, flush: 'sync' });
watch(suggestedName, value => { if (!nameEdited.value) form.name = value; }, { flush: 'sync' });
watch([form, baseDomain, subdomains, selection, mappings, routingKind, certificateMode, certificateNames], () => { result.value = ''; error.value = ''; }, { deep: true });
watch(source, value => {
  if (!value) return;
  nameEdited.value = true;
  routingKind.value = value.resource.kind;
  form.namespace = value.primary.namespace;
  form.service = value.primary.service;
  form.name = value.resource.metadata.name;
  form.issuer = value.certificate?.spec.issuerRef.name || form.issuer;
  certificateNames.value = value.certificate ? [value.certificate.metadata.name] : [];
  form.ingressClass = value.resource.spec.ingressClassName || form.ingressClass;
  const base = domains.value.find(zone => value.hosts.every(host => host === zone || host.endsWith(`.${zone}`))) || value.hosts[0]?.split('.').slice(-2).join('.') || baseDomain.value;
  baseDomain.value = base;
  subdomains.value = value.hosts.map(host => host === base ? '@' : host.slice(0, -base.length - 1)).join('\n');
  selection.value = ['existing-connection'];
  for (const mapping of value.mappings) mappings[`${mapping.mode}-${mapping.port}`] = { ...mapping };
}, { immediate: true, flush: 'sync' });
function compatibleRule(kind: string) {
  if (source.value) return kind === source.value.resource.kind;
  if (kind === 'automatic') return true;
  if (kind === 'Ingress') return combinedPorts.value.length === 1 && ['HTTP', 'HTTPS'].includes(combinedPorts.value[0].mode) && !combinedPorts.value[0].action;
  return combinedPorts.value.length > 0 && combinedPorts.value.every(port => (port.mode === 'UDP' ? 'IngressRouteUDP' : ['TCP', 'TLS'].includes(port.mode) ? 'IngressRouteTCP' : 'IngressRoute') === kind);
}
watch(combinedPorts, () => { if (!source.value && !compatibleRule(routingKind.value)) routingKind.value = 'automatic'; });
function useSuggestedName() { nameEdited.value = false; form.name = suggestedName.value; }
function chooseBackend(key: string, event: Event) {
  const selected = (event.target as HTMLSelectElement).value;
  mappings[key].backendPort = selected;
  const port = ports.value.find(port => String(port.name || port.port) === selected);
  mappings[key].backendScheme = port?.port === 443 || port?.name === 'https' ? 'https' : 'http';
}
function generate(review = false) {
  try {
    mergePortConfigurations(selectedConfigurations.value.map(config => config.ports));
    if (!destination.value) throw new Error('Select a destination service in the selected namespace.');
    if (!inventory.ingressClasses.includes(form.ingressClass)) throw new Error('Select an available ingress class.');
    if (hasTls.value && certificateMode.value === 'issuer' && !issuerProfiles.some(profile => profile.name === form.issuer)) throw new Error('Select an available issuer profile.');
    const hosts = buildHostnames(baseDomain.value, subdomains.value);
    const tlsCertificates = hasTls.value && certificateMode.value === 'existing' ? existingCertificateBindings(selectedCertificates.value, form.namespace, hosts) : undefined;
    const planned = combinedPorts.value.map(port => {
      const mapping = mappings[port.key];
      const backendPort = port.action ? mapping.backendPort : resolveBackendPort(mapping.backendPort, port.port, port.transport, ports.value);
      if (!compatibleListeners(port.transport).some(listener => listener.name === mapping.entryPoint && listener.port === port.port)) throw new Error(`Select a published ${port.transport} listener for ${port.label}. Missing listeners need Traefik configuration before deployment.`);
      return { ...mapping, backendPort };
    });
    const linked = applyPortLinks(combinedPorts.value, planned);
    for (const mapping of linked.filter(mapping => mapping.action === 'redirect')) {
      const target = linked.find(target => target.label === mapping.targetLabel)!;
      if (listeners.entryPoints.find(listener => listener.name === target.entryPoint)?.port !== mapping.redirectPort) throw new Error('The HTTPS destination listener must expose the configured redirect port.');
    }
    const input = { ...form, routingKind: routingKind.value, hosts, mappings: linked, ...(tlsCertificates ? { tlsCertificates } : {}) };
    if (source.value) {
      const resources = buildRouteEdit(source.value, input);
      saveConnectionDraft({ sourceId: props.editId, name: form.name, namespace: form.namespace, resources });
      completeEditorDraft(); cleanEditor();
      emit(review ? 'review' : 'saved');
      return;
    }
    const resources = buildMultiPublication(input);
    rememberPublication(input, [...selection.value]);
    completeEditorDraft(); cleanEditor();
    result.value = JSON.stringify({ apiVersion: 'v1', kind: 'List', items: resources }, null, 2);
    error.value = '';
    if (review) emit('review');
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Check publication settings.'; }
}
</script>
<template>
  <section class="publish"><div v-if="source" class="editing-note"><p>Editing {{ source.resource.kind }} {{ source.resource.metadata.namespace }}/{{ source.resource.metadata.name }}. Existing path rules, middleware references and additional destinations are retained. Saving creates a local draft. Publishing requires a live Rancher connection.</p><p>Existing matches: {{ source.resource.kind === 'Ingress' ? source.hosts.join(', ') : source.resource.spec.routes.map((route: any) => route.match || 'Listener-based forwarding').join(' · ') }}</p><p v-if="source.bindings.some(binding => binding.service !== source.primary.service || binding.namespace !== source.primary.namespace)">Additional destinations retained: {{ source.bindings.filter(binding => binding.service !== source.primary.service || binding.namespace !== source.primary.namespace).map(binding => `${binding.namespace}/${binding.service}:${binding.backendPort}`).join(', ') }}.</p></div><p>Choose a destination, add its domains, and combine reusable port configurations.</p><p v-if="displaySettings.previewMode">Namespace, service, and listener choices come from the October 11 inspection. Drafts do not change the cluster.</p>
    <form id="connection-editor" @submit.prevent="generate()"><div class="fields">
      <label><span class="field-label">Namespace</span><select v-model="form.namespace" :disabled="!!editId" required><option value="" disabled>Select namespace…</option><option v-for="namespace in inventory.namespaces" :key="namespace" :value="namespace">{{ namespace }}</option></select></label>
      <label><span class="field-label">Destination service</span><select v-model="form.service" :disabled="!form.namespace || !services.length" required><option value="" disabled>{{ !form.namespace ? 'Select a namespace first' : !services.length ? 'No services in this snapshot namespace' : 'Select destination service…' }}</option><option v-for="service in services" :key="service.name" :value="service.name">{{ service.name }}</option></select></label>
      <label><span class="field-label">Route name</span><input v-model.trim="form.name" aria-label="Route name" @input="nameEdited = !!form.name" placeholder="Suggested after choosing a service" required><small v-if="suggestedName">Suggested: {{ suggestedName }}</small><button v-if="nameEdited && suggestedName && form.name !== suggestedName" type="button" class="text-button" @click="useSuggestedName">Use suggested name</button></label>
      <label><span class="field-label">Ingress class</span><select v-model="form.ingressClass" required><option v-for="name in inventory.ingressClasses" :key="name" :value="name">{{ name }}</option></select></label>
      <label><span class="field-label">Routing rule</span><select v-model="routingKind" :disabled="!!source"><option value="automatic" :disabled="!compatibleRule('automatic')">Automatic · use selected port behaviors</option><option v-for="kind in ['Ingress', 'IngressRoute', 'IngressRouteTCP', 'IngressRouteUDP']" :key="kind" :value="kind" :disabled="!compatibleRule(kind)">{{ kind }}</option></select><small>{{ source ? 'Editing preserves the existing route type and rules.' : 'Ingress and IngressRoute handle web requests. TCP and UDP route types forward streams or datagrams. Incompatible choices are disabled.' }}</small></label>
      <label class="wide"><span class="field-label">Base domain</span><select v-model="baseDomain" :disabled="!domains.length" required><option v-if="!domains.length" value="">Configure base domains in this TLS issuer profile…</option><option v-for="domain in domains" :key="domain" :value="domain">{{ domain }}</option></select><small>Base domains come from the selected TLS issuer profile. An existing certificate must cover every resulting hostname.</small></label>
      <div class="certificate-selector"><MultiFilter label="Existing certificates" v-model="certificateNames" :empty-text="certificateActionLabel" :options="!hasTls || !form.namespace ? [] : [{ value: '__new__', label: certificateActionLabel }, ...availableCertificates.map(certificate => ({ value: certificate.metadata.name, label: `${certificate.metadata.name} · ${certificate.spec.secretName}` }))]" /><small v-if="!form.namespace">Choose a destination namespace to list its certificates.</small><small v-for="certificate in selectedCertificates" :key="certificate.metadata.name">{{ certificate.metadata.name }}: {{ certificate.spec.dnsNames.join(', ') }} · issuer {{ certificate.spec.issuerRef.name }}</small><small v-if="selectedCertificates.length">Every hostname must be covered. Existing Certificates stay unchanged; live readiness must be verified.</small></div>
      <label><span class="field-label">Certificate issuer</span><select v-model="form.issuer" :disabled="!hasTls || !!selectedCertificate"><option v-if="selectedCertificate && !selectedIssuer" :value="form.issuer">{{ form.issuer }} · certificate issuer reference</option><option v-for="profile in issuerProfiles" :key="profile.name" :value="profile.name">{{ profile.name }} · {{ profile.source }}</option></select><small>{{ selectedCertificate ? 'Selected automatically from the existing certificate.' : !hasTls ? 'No certificate needed for the selected routing modes.' : 'Used to request a new certificate.' }}</small></label>
      <label class="wide"><span class="field-label">Subdomains</span><textarea v-model="subdomains" aria-label="Subdomains" rows="3" placeholder="app&#10;media&#10;api" /><small>One per line, or comma-separated. Leave blank to use the base domain and www. Use @ to include the base domain alongside named subdomains.</small></label>
    </div>
    <div class="host-preview" aria-live="polite"><strong>Resulting hostnames</strong><p v-if="hostPreview.error" class="error">{{ hostPreview.error }}</p><div v-else><span v-for="host in hostPreview.names" :key="host">{{ host }}</span></div></div>
    <fieldset class="configurations"><legend>Port configurations · select several</legend><p>Select predefined or custom bundles. Global configurations are shared; namespace configurations appear in their namespace. Edit bundles in Settings.</p><label><span class="field-label">Find configurations</span><input v-model="configSearch" type="search" placeholder="Name or port, e.g. HTTP or 443…"></label><div class="config-list"><label v-for="config in availableConfigurations" :key="config.id" class="config-option"><input v-model="selection" type="checkbox" :value="config.id" :aria-label="config.namespace ? `${config.name} (${config.namespace})` : config.name"><span><strong>{{ config.name }}</strong><small>{{ config.namespace || 'Global' }}</small><small>{{ config.ports.map(port => `${port.port}/${transportOf(port)}`).join(', ') }} · {{ config.source }}</small></span></label></div></fieldset>
    <section v-if="combinedPorts.length" class="mappings"><h3>Combined port mappings</h3><p>Inbound port → Traefik listener → destination service port. The listener receives traffic on the inbound port. Leave the destination port blank to use the same port; the service must expose it. HTTP encryption is separate from TCP/UDP transport.</p><div class="mapping-table"><DataGrid><thead><tr><th>Inbound port</th><th>Destination service port</th><th>Traefik listener</th><th>Backend transport</th><th>HTTP encryption</th></tr></thead><tbody><tr v-for="port in combinedPorts" :key="port.key"><td><strong>{{ port.label }}</strong><small>{{ port.mode }} · {{ port.port }}/{{ port.transport }}</small><small v-if="port.action">{{ port.action === 'redirect' ? 'Redirect to' : 'Forward using' }} {{ port.targetLabel }}</small></td><td><select :value="mappings[port.key]?.backendPort" @change="chooseBackend(port.key, $event)" :disabled="!!port.action || !compatiblePorts(port.transport).length" :aria-label="`Backend port for ${port.label}`" ><option value="">Use inbound port ({{ port.port }}/{{ port.transport }})</option><option v-for="backend in compatiblePorts(port.transport)" :key="`${backend.name}-${backend.port}`" :value="String(backend.name || backend.port)">{{ backend.name ? `${backend.name} · ` : '' }}{{ backend.port }}/{{ backend.protocol }}</option></select></td><td><select v-model="mappings[port.key].entryPoint" :aria-label="`Listener for ${port.label}`" required><option value="" disabled>Select listener for this inbound port…</option><option v-for="listener in compatibleListeners(port.transport).filter(listener => listener.port === port.port)" :key="listener.name" :value="listener.name">{{ listener.name }} · {{ listener.port }}/{{ listener.protocol }}</option></select></td><td><select :value="port.transport" :aria-label="`Backend transport for ${port.label}`" disabled><option>TCP</option><option>UDP</option></select><small>Matches the inbound transport.</small></td><td><select v-if="['HTTP', 'HTTPS'].includes(port.mode)" v-model="mappings[port.key].backendScheme" :aria-label="`HTTP encryption for ${port.label}`"><option value="http">Plain HTTP</option><option value="https">HTTPS to service</option></select><small v-else>{{ port.mode === 'TLS' ? 'TLS ends at Traefik; backend uses plaintext TCP' : `${port.transport} forwarding` }}</small></td></tr></tbody></DataGrid></div></section>
    <p>HTTP routes use hostnames. TLS TCP routes use SNI; plain TCP and UDP forward by listener and do not distinguish domains. Application DNS records must be configured separately.</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p><PageActions><button type="submit" form="connection-editor" class="header-action" :disabled="!destination || !combinedPorts.length"><ActionIcon icon="save"/>Save Draft</button><button type="button" class="header-action" :disabled="!liveRolloutSource || !destination || !combinedPorts.length" title="Review, back up, and apply this publication in Pending Rollouts" @click="generate(true)"><ActionIcon icon="apply"/>Publish</button><button type="button" class="header-action secondary" @click="emit('cancel')"><ActionIcon icon="cancel"/>Cancel</button></PageActions><p v-if="displaySettings.previewMode" class="draft-note">Preview only. Generated publications retain their configuration links for Reconfigure during this browser session. Reloading clears them. No DNS or cluster changes are applied; existing route conflicts and backend connectivity still need live validation.</p></form>
    <div v-if="result" class="generated" aria-live="polite"><div><h3>Publication configuration</h3><a :href="download" :download="`${form.name}-publication.json`">Download draft</a></div><p>The draft includes the selected HTTP, TCP, or UDP route resources. Encrypted routes use the selected existing certificates, or request one certificate from the selected issuer.</p><pre><code>{{ result }}</code></pre></div>
  </section>
</template>
<style scoped>
.publish { background: var(--box-bg, #242c38); border: 1px solid var(--border, #384352); border-radius: 7px; padding: 26px; }h2 { margin: 0; font-size: 21px; }h3 { font-size: 16px; }p, small { color: var(--muted, #a5b1c3); font-size: 12px; line-height: 1.7; }.fields { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 22px 0; max-width: 980px; }label, .certificate-selector { display: flex; flex-direction: column; gap: 8px; color: var(--body-text, #dce3ed); font-size: 12px; }input, select, textarea { width: 100%; padding: 12px; border: 1px solid var(--border, #384352); border-radius: 5px; background: var(--input-bg, #1c2430); color: var(--body-text, #dce3ed); font: inherit; }.wide { grid-column: 1 / -1; }button { border: 0; border-radius: 5px; padding: 12px 18px; background: #326fb4; color: white; font: inherit; cursor: pointer; }button.text-button { align-self: flex-start; background: transparent; color: #91c3fc; padding: 2px 0; font-size: 12px; text-align: left; }button:disabled, select:disabled { opacity: .55; cursor: not-allowed; }input:focus-visible, select:focus-visible, textarea:focus-visible, button:focus-visible { outline: 2px solid #73b5ff; outline-offset: 3px; }.error { color: #ffb3ad; }.host-preview { padding: 18px; background: var(--input-bg, #1c2430); border-radius: 6px; font-size: 12px; }.host-preview span { display: inline-block; background: #233950; color: #a9d2ff; padding: 6px 9px; margin: 12px 10px 0 0; border-radius: 5px; }fieldset { border: 1px solid var(--border, #384352); border-radius: 6px; padding: 20px; margin: 26px 0; }legend { font-size: 14px; padding: 0 8px; }.config-list { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 18px;  overflow-x: auto; }.config-option { flex-direction: row; align-items: flex-start; padding: 12px; background: var(--input-bg, #1c2430); border-radius: 5px; cursor: pointer; }.config-option input { width: auto; margin-top: 3px; }.config-option small { display: block; margin-top: 6px; }.mapping-table { overflow-x: auto; }table { width: 100%; border-collapse: collapse; font-size: 12px; }th, td { padding: 12px 8px; text-align: left; border-bottom: 1px solid var(--border, #384352); }td small { display: block; margin-top: 7px; }td select { min-width: 140px; }.generated { margin-top: 26px; border-top: 1px solid var(--border, #384352); padding-top: 24px; }.generated > div { display: flex; justify-content: space-between; gap: 20px; }.generated a { color: #91c3fc; font-size: 13px; }pre { background: var(--input-bg, #1c2430); padding: 20px; border-radius: 6px; overflow-x: auto; font-size: 12px; line-height: 1.7; }@media(max-width: 760px) { .fields, .config-list { grid-template-columns: 1fr; }.publish { padding: 18px; } }
</style>

<style scoped>
.mapping-table table { table-layout: fixed; min-width: 800px; }.mapping-table th, .mapping-table td { vertical-align: top; }.mapping-table th:first-child { width: 15%; }.mapping-table th:nth-child(2), .mapping-table th:nth-child(3) { width: 24%; }.mapping-table select { display: block; width: 100%; min-width: 0; min-height: 42px; margin: 0; }.mapping-table td > strong { display: block; min-height: 20px; }.mapping-table td small { line-height: 1.5; margin-top: 7px; }.mapping-table select:disabled { opacity: .7; }
</style>

<style scoped>
.editing-note { margin-top: 18px; padding: 12px; border-left: 3px solid #619bd9; background: var(--input-bg, #1c2430); }.cancel-edit { margin-left: 16px; }
</style>

<style scoped>
.publish-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }.publish-actions .cancel-edit { margin-left: 0; }
</style>

<style scoped>
button.secondary { background: var(--input-bg, #1c2430); border: 1px solid #619bd9; color: #c6e1ff; }
</style>
