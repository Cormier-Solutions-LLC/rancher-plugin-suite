<script setup lang="ts">
import { contextMatches } from '../data/namespace-context';
import DataGrid from './DataGrid.vue';
import PageSummary from './PageSummary.vue';
import BulkActions from './BulkActions.vue';
import ResourceLink from './ResourceLink.vue';
import OwnershipLink from './OwnershipLink.vue';
import { queueChange } from '../data/pending-rollouts';
import CreateButton from './CreateButton.vue';
import RefreshButton from './RefreshButton.vue';
import PageActions from './PageActions.vue';
import { displaySettings } from '../data/display-settings';
import InventoryFilters from './InventoryFilters.vue';

import { computed, nextTick, reactive, ref, watch } from 'vue';

import { portConfigurations, configurationVersions, rememberPortConfiguration, transportOf, type PortConfiguration, type PortInputRow, type PortMode } from '../data/port-presets';

import { parsePortInput } from '../config/port-input';

import { publications, reviewReconfiguration, reconfigurePublications } from '../data/publications';

import { attachmentsFor, serviceReferencesFor } from '../data/observed-attachments';

import { inventoryDatasets } from '../data/inventory';
const inventory = inventoryDatasets['publication-snapshot.json'];

import SnapshotGate from './SnapshotGate.vue';
const emit = defineEmits<{ navigate: [section: string] }>();

import { rescanPortConfigurations } from '../data/port-presets';
import { useFormGuard } from '../data/form-guard';
import ActionIcon from './ActionIcon.vue';
import { configurationInNamespace } from '../config/configuration-scope';
import { matchesConfiguration } from '../config/configuration-search';
import { affectedRouteManifests } from '../config/manifest-backup';
import { connectionDrafts } from '../data/connection-edits';

const search = ref('');
const checked=ref<string[]>([]);const allChecked=computed({get:()=>shown.value.length>0&&shown.value.every(c=>checked.value.includes(c.id)),set:(value:boolean)=>checked.value=value?shown.value.map(c=>c.id):[]});
function queueDeletes(ids:string[]){for(const config of portConfigurations.filter(c=>ids.includes(c.id)))queueChange({id:`delete:configuration:${config.id}`,category:'Delete Port Configuration',name:config.name,namespace:config.namespace||'',resources:[],configuration:{operation:'Delete',target:config,dependentPublications:publications.filter(p=>p.configurationIds.includes(config.id)).map(p=>`${p.namespace}/${p.name}`)}});}

const namespaceFilter = ref('__all__');
const groupByNamespace = ref(false);
const shown = computed(() => portConfigurations.filter(config => contextMatches(config.namespace,true) && (namespaceFilter.value === '__all__' || configurationInNamespace(config, namespaceFilter.value === '__global__' ? '' : namespaceFilter.value)) && matchesConfiguration(config, search.value)));
const namespaceOptions = computed(() => [...new Set(portConfigurations.map(config => config.namespace).filter(Boolean))].sort());
const groups = computed(() => {
  if (!groupByNamespace.value) return [{ namespace: '', configurations: shown.value }];
  const scopes = [...new Set(shown.value.map(config => config.namespace || ''))].sort((a, b) => a === '' ? -1 : b === '' ? 1 : a.localeCompare(b));
  return scopes.map(namespace => ({ namespace, configurations: shown.value.filter(config => (config.namespace || '') === namespace) }));
});

const editing = ref(false);
const editor = ref<HTMLFormElement | null>(null);

const previousId = ref('');

const error = ref('');

const form = reactive<PortConfiguration>({ id: '', name: '', source: 'Local draft', ports: [] });

const rows = ref<PortInputRow[]>([]);

const expandedId = ref('');
function toggleDetails(id: string) { expandedId.value = expandedId.value === id ? '' : id; }
const rescanMessage = ref('');
function rescan() { const result = rescanPortConfigurations(); rescanMessage.value = `Rescanned ${result.services} Services in the inspection snapshot; added ${result.added} configuration${result.added === 1 ? '' : 's'}. Existing edits were preserved. Live cluster discovery is not connected in this preview.`; }

const localAttachments = (id: string) => publications.filter(publication => publication.configurationIds.includes(id));

function changeTransport(row: PortInputRow, event: Event) { row.mode = (event.target as HTMLSelectElement).value as PortMode; row.action = undefined; row.targetLabel = undefined; }

function changeAction(row: PortInputRow, event: Event) { row.action = ((event.target as HTMLSelectElement).value || undefined) as PortInputRow['action']; row.targetLabel = undefined; }

function targetRows(row: PortInputRow) { return rows.value.filter(target => target !== row && !!target.label && !target.action && (target.mode === 'UDP') === (row.mode === 'UDP') && (row.action !== 'redirect' || target.mode === 'HTTPS')); }

const reviewId = ref('');

const reviewName = computed(() => portConfigurations.find(config => config.id === reviewId.value)?.name || '');

const review = computed(() => reviewReconfiguration(reviewId.value));

const observed = computed(() => attachmentsFor(reviewId.value));

const pending = computed(() => review.value.filter(change => change.changed));

const reviewMessage = ref('');

const confirmed = ref(false);

const snapshotReady = ref(false);

const snapshotGate = ref<InstanceType<typeof SnapshotGate> | null>(null);

const snapshotData = computed(() => {

  const targets = new Set([...serviceReferencesFor(reviewId.value).map(service => `${service.namespace}/${service.name}`), ...observed.value.flatMap(route => route.bindings.map(binding => `${binding.namespace}/${binding.service}`)), ...review.value.map(change => `${change.publication.namespace}/${change.publication.service}`)]);

  return {

    configurationName: reviewName.value,
    configuration: portConfigurations.find(config => config.id === reviewId.value),
    previousConfigurationVersions: configurationVersions[reviewId.value] || [],

    observedRoutes: observed.value.map(route => ({ name: route.name, namespace: route.namespace, kind: route.kind, owner: route.owner, bindings: route.bindings })),
    routeManifests: affectedRouteManifests(observed.value.map(route => `${route.kind}/${route.namespace}/${route.name}`)),
    editedConnections: connectionDrafts.filter(draft => observed.value.some(route => draft.sourceId === `${route.kind}/${route.namespace}/${route.name}`)),

    observedServiceReferences: inventory.services.filter(service => targets.has(`${service.namespace}/${service.name}`)),

    localPublications: review.value.map(change => JSON.parse(JSON.stringify(change.publication))),
    relatedConfigurations: portConfigurations.filter(config => contextMatches(config.namespace,true) && config.id !== reviewId.value && review.value.some(change => change.publication.configurationIds.includes(config.id)))

  };

});

const snapshotScope = computed(() => JSON.stringify(snapshotData.value));

function updateSnapshotReady(value: boolean) { snapshotReady.value = value; if (!value) confirmed.value = false; }

watch(() => JSON.stringify(review.value.map(change => ({ name: change.publication.name, namespace: change.publication.namespace, before: change.before, after: change.after, error: change.error, changed: change.changed }))), () => { confirmed.value = false; });

function openReview(id: string) { reviewId.value = id; reviewMessage.value = ''; confirmed.value = false; }

function reconfigure() {

  if (!confirmed.value) return;

  if (!snapshotGate.value?.checkNow()) { snapshotReady.value = false; confirmed.value = false; reviewMessage.value = 'A snapshot covering these services must be created or recorded within the last 24 hours before reconfiguration.'; return; }

  try { const count = reconfigurePublications(reviewId.value); reviewMessage.value = `Updated ${count} local publication${count === 1 ? '' : 's'}. No cluster changes were applied.`; }

  catch (cause) { reviewMessage.value = cause instanceof Error ? cause.message : 'Check the changes.'; }

}

const usageCount = (id: string) => publications.filter(publication => publication.configurationIds.includes(id)).length;

function edit(config?: PortConfiguration) { guard.leave(() => loadEditor(config)); }
function loadEditor(config?: PortConfiguration) {

  Object.assign(form, { id: '', name: '', source: 'Local draft', namespace: undefined, service: undefined }, config || {});

  form.ports = config ? config.ports.map(port => ({ ...port })) : [{ label: '', mode: 'TCP', port: 80 }];

  rows.value = config?.inputRows ? config.inputRows.map(row => ({ ...row })) : form.ports.map(port => ({ label: port.label, mode: port.mode, expression: String(port.port), action: port.action, targetLabel: port.targetLabel }));

  previousId.value = config?.id || '';

  error.value = '';

  editing.value = true;
  nextTick(() => { editor.value?.scrollIntoView({ block: 'start', behavior: 'smooth' }); editor.value?.querySelector('input')?.focus({ preventScroll: true }); });

}

function save() {

  try {

    const ports = rows.value.flatMap(row => parsePortInput(row.expression).map(port => ({ label: row.label.trim(), mode: row.mode, port, action: row.action, targetLabel: row.targetLabel })));

    if (ports.length > 1024) throw new Error('A preview configuration supports up to 1024 ports.');

    rememberPortConfiguration({ ...form, ports, inputRows: rows.value.map(row => ({ ...row })) }, previousId.value);

    editing.value = false; error.value = ''; guard.clean();

  }

  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Check the configuration.'; }

}

const guard = useFormGuard('port-configurations', () => form.name || 'Port configuration',
  () => ({ form: { ...form }, rows: rows.value.map(row => ({ ...row })), previousId: previousId.value, editing: editing.value }),
  state => { Object.assign(form, state.form); rows.value = state.rows; previousId.value = state.previousId; editing.value = state.editing; }, () => editing.value);
</script>

<template>

  <section class="port-presets" aria-labelledby="port-presets-title">

    <div class="heading"><PageSummary :count="shown.length" label="Configurations" help="Reusable port bundles define inbound ports, transport, application behavior, and forwarding. Rescan discovers unmatched service ports while preserving edited configurations."/><BulkActions :items="shown" v-model:selected="checked" :execute="queueDeletes"/><div class="heading-actions"><PageActions><RefreshButton label="Rescan" @refresh="rescan" /></PageActions><PageActions><CreateButton label="Create New Configuration" @create="edit()" /></PageActions></div></div>
    <p v-if="rescanMessage" role="status">{{ rescanMessage }}</p>



    <InventoryFilters v-model:search="search" v-model:namespace="namespaceFilter" v-model:grouped="groupByNamespace" :namespaces="namespaceOptions" search-label="Find A Port Configuration" placeholder="Name, namespace, service, or port (e.g. 443)…" />

    <form ref="editor" v-if="editing" @submit.prevent="save"><h3>{{ previousId ? 'Edit port configuration' : 'New port configuration' }}</h3><div class="configuration-fields"><label><span class="field-label">Configuration name</span><input v-model.trim="form.name" required maxlength="120"></label><label><span class="field-label">Namespace scope</span><select v-model="form.namespace" :disabled="!!previousId"><option :value="undefined">Global</option><option v-for="namespace in inventory.namespaces" :key="namespace">{{ namespace }}</option></select><small>{{ previousId ? 'Existing configurations keep their scope.' : 'Global is available in every namespace.' }}</small></label></div>

      <div v-for="(row, index) in rows" :key="index" class="fields"><label><span class="field-label">Port label</span><input v-model.trim="row.label" :aria-label="`Port label ${index + 1}`"></label><label><span class="field-label">Routing mode</span><select :value="row.mode === 'UDP' ? 'UDP' : 'TCP'" @change="changeTransport(row, $event)" :aria-label="`Routing mode ${index + 1}`"><option>TCP</option><option>UDP</option></select></label><label v-if="row.mode !== 'UDP'"><span class="field-label">Application behavior</span><select v-model="row.mode" :aria-label="`Application behavior ${index + 1}`"><option value="TCP">TCP forwarding</option><option value="HTTP">HTTP</option><option value="HTTPS">HTTPS</option><option value="TLS">TLS termination</option></select></label><label><span class="field-label">Ports or ranges</span><input v-model.trim="row.expression" :aria-label="`Ports or ranges ${index + 1}`" placeholder="445, 8000-8010" required></label><label><span class="field-label">Port action</span><select :value="row.action || ''" @change="changeAction(row, $event)" :aria-label="`Port action ${index + 1}`"><option value="">Use own backend mapping</option><option value="forward">Forward to port label</option><option v-if="row.mode === 'HTTP'" value="redirect">Redirect to HTTPS label</option></select></label><label v-if="row.action"><span class="field-label">Destination port label</span><select v-model="row.targetLabel" :aria-label="`Destination port label ${index + 1}`" required><option value="" disabled>Select destination label…</option><option v-for="target in targetRows(row)" :key="target.label" :value="target.label">{{ target.label }} · {{ target.expression }}</option></select></label><button type="button" class="edit remove" @click="rows.splice(index, 1)" :aria-label="`Remove port row ${index + 1}`">Remove</button></div>

      <button type="button" class="edit" @click="rows.push({ label: '', mode: 'TCP', expression: '' })">Add another port row</button><p>Enter comma-separated ports or inclusive ranges, such as 80,443,8000-8010. Routing mode is TCP or UDP. Under TCP, choose web or TLS behavior separately. Forward uses the destination label’s backend mapping. HTTP-to-HTTPS redirect tells the browser to reconnect securely; forwarding alone does not add TLS. Targets must have a unique label and one port, not a range. <span v-if="displaySettings.previewMode">No service ports or listeners are changed by this preview.</span></p><p v-if="error" class="error" role="alert">{{ error }}</p><div class="actions"><button type="submit">Save port configuration</button><button type="button" class="edit" @click="guard.leave(() => { editing = false; })">Cancel</button></div></form>
    <div class="table-wrap"><DataGrid><thead><tr><th class="selection-cell"><input v-model="allChecked" type="checkbox" aria-label="Select All Port Configurations"></th><th>Configuration</th><th>Namespace</th><th>Ports</th><th>Source</th><th class="attachment-count">Services / routes / drafts</th><th class="actions-column">Actions</th></tr></thead><tbody><template v-for="group in groups" :key="group.namespace"><tr v-if="groupByNamespace" class="namespace-group"><th colspan="7">{{ group.namespace || 'Global' }} <small>{{ group.configurations.length }} configurations</small></th></tr><template v-for="config in group.configurations" :key="config.id"><tr class="configuration-row" @click="toggleDetails(config.id)"><td class="selection-cell" @click.stop><input v-model="checked" :value="config.id" type="checkbox" :aria-label="`Select ${config.name}`"></td><td><button type="button" class="configuration-name" :aria-expanded="expandedId === config.id" :aria-label="`Open details for ${config.name}`" @click.stop="toggleDetails(config.id)">{{ config.name }}</button></td><td><ResourceLink kind="Namespace" :name="config.namespace || ''" :label="config.namespace || 'Global'"/></td><td>{{ config.ports.map(port => `${port.label}: ${port.port}/${transportOf(port)}`).join(', ') }}</td><td>{{ config.source }}</td><td class="attachment-count">{{ serviceReferencesFor(config.id).length }} services · {{ attachmentsFor(config.id).length }} routes · {{ usageCount(config.id) }} drafts</td><td class="row-actions"><button class="edit icon-action" title="Show / hide attachment details" type="button" @click.stop="toggleDetails(config.id)" :aria-expanded="expandedId === config.id" :aria-label="`Details for ${config.name}`"><ActionIcon icon="details" /></button><button class="edit icon-action" title="Edit port configuration" type="button" @click.stop="edit(config)" :aria-label="`Edit ${config.name} configuration`"><ActionIcon icon="edit" /></button><button class="edit icon-action" title="Review reconfiguration" type="button" @click.stop="openReview(config.id)" :aria-label="`Reconfigure ${config.name} publications`"><ActionIcon icon="reconfigure" /></button></td></tr><tr v-if="expandedId === config.id" class="attachment-detail"><td colspan="7"><h3>{{ config.name }} · read-only attachments</h3><p v-if="displaySettings.previewMode">Observed associations come from the cluster inspection. Local drafts explicitly reference this configuration.</p><details><summary>Observed service references · {{ serviceReferencesFor(config.id).length }}</summary><DataGrid v-if="serviceReferencesFor(config.id).length"><thead><tr><th>Namespace / Service</th><th>Service ports</th></tr></thead><tbody><tr v-for="service in serviceReferencesFor(config.id)" :key="`${service.namespace}/${service.name}`"><td><ResourceLink kind="Service" :name="service.name" :namespace="service.namespace" :label="`${service.namespace}/${service.name}`"/></td><td>{{ service.ports.map(port => `${port.name || 'Unnamed'}: ${port.port}/${port.protocol}`).join(', ') }}</td></tr></tbody></DataGrid><p v-else>No inspected Service references.</p><p>A Service reference does not imply that an inbound route exists.</p></details><details><summary>Observed routes · {{ attachmentsFor(config.id).length }}</summary><DataGrid v-if="attachmentsFor(config.id).length"><thead><tr><th>Route</th><th>Kind</th><th>Destination / port</th><th>Listener</th><th>Ownership</th></tr></thead><tbody><tr v-for="route in attachmentsFor(config.id)" :key="`${route.kind}/${route.namespace}/${route.name}`"><td><ResourceLink :kind="route.kind" :name="route.name" :namespace="route.namespace" :label="`${route.namespace} / ${route.name}`"/></td><td>{{ route.kind }}</td><td>{{ route.bindings.map(binding => `${binding.namespace}/${binding.service}:${binding.backendPort}`).filter((value, index, all) => all.indexOf(value) === index).join(', ') }}</td><td>{{ [...new Set(route.bindings.map(binding => `${binding.entryPoint} (${binding.mode})`))].join(', ') }}</td><td><OwnershipLink :kind="route.kind" :name="route.name" :namespace="route.namespace" :label="route.owner"/></td></tr></tbody></DataGrid><p v-else>No observed attachments.</p></details><details><summary>Local drafts · {{ localAttachments(config.id).length }}</summary><DataGrid v-if="localAttachments(config.id).length"><thead><tr><th>Publication</th><th>Destination</th><th>Ports</th></tr></thead><tbody><tr v-for="draft in localAttachments(config.id)" :key="`${draft.namespace}/${draft.name}`"><td>{{ draft.namespace }} / {{ draft.name }}</td><td>{{ draft.service }}</td><td>{{ draft.mappings.map(port => `${port.label}: ${port.port}`).join(', ') }}</td></tr></tbody></DataGrid><p v-else>No attached local drafts.</p></details></td></tr></template></template></tbody></DataGrid></div>

    <section v-if="reviewId" class="review" aria-live="polite">

      <h3>Reconfigure {{ reviewName }}</h3><p v-if="displaySettings.previewMode">Observed service references: {{ serviceReferencesFor(reviewId).map(service => `${service.namespace}/${service.name}`).join(', ') || 'None' }}. Existing Services are read-only in this preview.</p>

      <p v-if="displaySettings.previewMode">Edit changes the reusable configuration. Reconfigure shows matching observed routes and previews updates to local publications that explicitly reference it.</p>

      <details class="observed-details"><summary>Observed route attachments · {{ observed.length }}</summary>

      <p v-if="displaySettings.previewMode">Matches are inferred from the inspected listener and backend ports. A route can match more than one configuration. These are snapshot associations; live cluster updates are not enabled.</p>

      <div class="attachment-list"><DataGrid v-if="observed.length"><thead><tr><th>Route</th><th>Kind</th><th>Destination / port</th><th>Listener</th><th>Ownership</th></tr></thead><tbody><tr v-for="route in observed" :key="`${route.kind}/${route.namespace}/${route.name}`"><td><ResourceLink :kind="route.kind" :name="route.name" :namespace="route.namespace" :label="`${route.namespace} / ${route.name}`"/></td><td>{{ route.kind }}</td><td>{{ route.bindings.map(binding => `${binding.namespace}/${binding.service}:${binding.backendPort}`).filter((value, index, all) => all.indexOf(value) === index).join(', ') }}</td><td>{{ [...new Set(route.bindings.map(binding => `${binding.entryPoint} (${binding.mode})`))].join(', ') }}</td><td><OwnershipLink :kind="route.kind" :name="route.name" :namespace="route.namespace" :label="route.owner"/></td></tr></tbody></DataGrid><p v-else>No inspected route matches this configuration’s original port mappings.</p></div>

      </details>
      <h4>Local publication changes · {{ review.length }} attached</h4>

      <p v-if="!review.length">No local drafts are attached yet. Generate a publication to try a reconfiguration. Observed routes above are listed for review and remain unchanged.</p>

      <DataGrid v-else><thead><tr><th>Publication</th><th>Current ports</th><th>Proposed ports</th><th>Status</th></tr></thead><tbody><tr v-for="change in review" :key="`${change.publication.namespace}/${change.publication.name}`"><td>{{ change.publication.namespace }} / {{ change.publication.name }}</td><td>{{ change.before }}</td><td>{{ change.after }}</td><td>{{ change.error || (change.changed ? 'Ready to update local draft' : 'Up to date') }}</td></tr></tbody></DataGrid>

      <details v-if="pending.length"><summary>Review affected draft resources</summary><div v-for="change in pending" :key="`${change.publication.namespace}/${change.publication.name}`"><h4>{{ change.publication.namespace }} / {{ change.publication.name }}</h4><pre>{{ JSON.stringify({ current: change.publication.resources, proposed: change.resources }, null, 2) }}</pre></div></details>

      <SnapshotGate ref="snapshotGate" :scope-key="snapshotScope" :data="snapshotData" @ready="updateSnapshotReady" @history="emit('navigate', 'history')" />

      <label v-if="pending.length" class="confirmation"><input v-model="confirmed" type="checkbox" :disabled="!snapshotReady || pending.some(change => change.error)">I confirm these changes to the listed local publications.</label>

      <p v-if="reviewMessage">{{ reviewMessage }}</p><div class="actions"><button type="button" :disabled="!snapshotReady || !confirmed || !pending.length || pending.some(change => change.error)" @click="reconfigure">{{ pending.length ? `Update ${pending.length} local ${pending.length === 1 ? 'publication' : 'publications'}` : 'No draft updates pending' }}</button><button type="button" class="edit" @click="reviewId = ''">Close review</button></div>

      <p>Every proposed draft is validated before any local update. Other configuration versions stay unchanged. Live rollout still needs verified dependencies, ownership and concurrent-change checks, listener conflict checks and per-route results.</p>

    </section>



    <p v-if="displaySettings.previewMode">Unmatched observed service ports have been imported as editable Detected configurations. Their TCP/UDP transport is preserved; application behavior is not guessed. This previews first-install discovery. Live discovery and persistence are still to be connected.</p>


  </section>

</template>

<style scoped>
.list-count { margin-left:auto; color:#a9d2ff; font-size:13px; }

.port-presets { margin-top: 32px; padding-top: 26px; border-top: 1px solid var(--border, #384352); }.heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; }h2 { margin: 0; font-size: 21px; }h3 { margin: 0 0 18px; font-size: 15px; }p { font-size: 12px; color: var(--muted, #a5b1c3); line-height: 1.7; }.table-wrap {  overflow-x: auto; margin-top: 18px; }table { border-collapse: collapse; width: 100%; }th, td { text-align: left; padding: 12px 8px; border-bottom: 1px solid var(--border, #384352); font-size: 12px; }.fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin: 20px 0; }.remove { align-self: end; }form { padding: 20px; margin-top: 20px; background: var(--input-bg, #1c2430); border-radius: 6px; }label { display: flex; flex-direction: column; gap: 8px; font-size: 12px; }input, select { background: var(--box-bg, #242c38); border: 1px solid var(--border, #384352); border-radius: 5px; color: inherit; padding: 12px; font: inherit; width: 100%; }button { background: #326fb4; color: white; border: 0; padding: 10px 16px; border-radius: 5px; font: inherit; cursor: pointer; }.edit { background: transparent; color: #91c3fc; }.actions { display: flex; gap: 12px; margin-top: 20px; }.error { color: #ffb3ad; }input:focus-visible, select:focus-visible, button:focus-visible { outline: 2px solid #73b5ff; outline-offset: 3px; }@media(max-width: 760px) { .fields { grid-template-columns: 1fr; } }

</style>

<style scoped>
.list-count { margin-left:auto; color:#a9d2ff; font-size:13px; }

.review { padding: 22px; margin-top: 24px; background: var(--input-bg, #1c2430); border: 1px solid #619bd9; border-radius: 6px; overflow-x: auto; }.confirmation { flex-direction: row; align-items: center; margin-top: 22px; }.confirmation input { width: auto; }button:disabled { opacity: .55; cursor: not-allowed; }

.attachment-list {  overflow-x: auto; }h4 { margin: 24px 0 14px; font-size: 14px; }summary { margin-top: 20px; cursor: pointer; color: #91c3fc; font-size: 12px; }pre {  overflow-x: auto; font-size: 11px; line-height: 1.6; background: var(--box-bg, #242c38); padding: 18px; border-radius: 5px; }

</style>



<style scoped>
.list-count { margin-left:auto; color:#a9d2ff; font-size:13px; }

.attachment-detail > td { background: var(--input-bg, #1c2430); padding: 20px; }.attachment-detail table { min-width: 720px; }.table-wrap:has(.attachment-detail) {  }

</style>


<style scoped>
.list-count { margin-left:auto; color:#a9d2ff; font-size:13px; }
.icon-action { display: inline-grid; place-items: center; width: 36px; height: 36px; padding: 8px; margin-right: 4px; border: 1px solid transparent; }.icon-action:hover, .icon-action[aria-expanded="true"] { background: #1b344d; border-color: #619bd9; }.observed-details { margin-top: 20px; }
</style>

<style scoped>
.list-count { margin-left:auto; color:#a9d2ff; font-size:13px; }
.attachment-count { white-space: nowrap; }.icon-action { white-space: nowrap; }
</style>

<style scoped>
.list-count { margin-left:auto; color:#a9d2ff; font-size:13px; }
.row-actions { white-space: nowrap; min-width: 136px; }.heading-actions { display: flex; flex-wrap: nowrap; align-items: center; gap: 12px; }
</style>

<style scoped>
.list-count { margin-left:auto; color:#a9d2ff; font-size:13px; }
.configuration-row { cursor: pointer; }.configuration-row:hover { background: #1b344d; }.configuration-name { background: transparent; color: inherit; border: 0; padding: 0; font: inherit; text-align: left; cursor: pointer; }
</style>

<style scoped>
.list-count { margin-left:auto; color:#a9d2ff; font-size:13px; }
.attachment-detail > td > details { border: 0; margin: 0; padding: 8px 0; }
.attachment-detail > td > details + details { border-top: 1px solid var(--border, #384352); }
.attachment-detail > td > details > summary { margin: 0; padding: 12px 0; }
.attachment-detail table tbody > tr:last-child > td { border-bottom: 0; }
</style>

<style scoped>
.list-count { margin-left:auto; color:#a9d2ff; font-size:13px; }
.configuration-toolbar { display:grid; grid-template-columns:minmax(200px,1fr) 220px auto; gap:18px; align-items:end; margin-bottom:20px; }.configuration-toolbar label, .configuration-fields label { display:flex; flex-direction:column; gap:8px; font-size:12px; }.configuration-toolbar .search { margin:0; }.configuration-toolbar .group-toggle { flex-direction:row; align-items:center; align-self:center; white-space:nowrap; }.configuration-toolbar select, .configuration-fields select { width:100%; min-height:42px; padding:10px; font:inherit; color:inherit; background:var(--input-bg,#1c2430); border:1px solid var(--border,#384352); border-radius:5px; }.configuration-fields { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:20px; margin-bottom:20px; }.namespace-tag { display:inline-block; border:1px solid var(--border,#384352); background:var(--input-bg,#1c2430); padding:4px 8px; border-radius:4px; white-space:nowrap; }.namespace-group th { padding:16px 12px; background:var(--input-bg,#1c2430); text-align:left; }.namespace-group small { display:inline; margin-left:12px; font-weight:normal; }@media(max-width:800px) { .configuration-toolbar, .configuration-fields { grid-template-columns:1fr; } }
</style>
