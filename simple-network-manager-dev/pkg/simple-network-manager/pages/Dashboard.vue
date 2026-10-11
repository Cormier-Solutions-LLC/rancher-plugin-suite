<script setup lang="ts">
import DataGrid from './DataGrid.vue';
import '../styles/scrollbars.css';
import '../styles/actions.css';
import PageSummary from './PageSummary.vue';
import ResourceLink from './ResourceLink.vue';
import OwnershipLink from './OwnershipLink.vue';
import RunningProcesses from './RunningProcesses.vue';
import { connectNamespaceContext,contextMatches } from '../data/namespace-context';
import { clusterId,nativeRancher } from '../data/resource-links';
import RefreshButton from './RefreshButton.vue';
import CreateButton from './CreateButton.vue';
import ActionIcon from './ActionIcon.vue';
import { routeBackupStatus, routeSnapshots, updateCoverageClock } from '../data/snapshot-coverage';
import SnapshotBanner from './SnapshotBanner.vue';
import DisplaySettings from './DisplaySettings.vue';
import Help from './Help.vue';
import { activeHelpPage, helpRequest } from '../data/help-context';
import { displaySettings } from '../data/display-settings';
import { refreshSnapshots } from '../data/stored-snapshots';
import { loadSchedule, syncScheduleSource } from '../data/snapshot-schedule';
import { pendingChanges } from '../data/pending-rollouts';
import { formatCountdown } from '../config/refresh-countdown';
import { refreshSeconds, refreshRevision, refreshMessage, refreshing, refreshPage } from '../data/page-refresh';
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { activeEditorDraft, editorDrafts, activeFormDraft, formDrafts, editorDirty, requestEditorLeave } from '../data/editor-session';
import LeaveEditorDialog from './LeaveEditorDialog.vue';
import { diagnosticRows, diagnosticClock, diagnosticLookback, diagnosticSeverity, updateDiagnosticClock } from '../data/diagnostic-logs';
import { editingConnection, lastViewedConnection, connectionDrafts } from '../data/connection-edits';
import { historyContext } from '../data/history-context';
import { routeName } from '../navigation';
import { routes } from '../data/snapshot';
import Settings from './Settings.vue';
import InventoryFilters from './InventoryFilters.vue';
import { observedAttachments } from '../data/observed-attachments';
import { inventoryDatasets } from '../data/inventory';
const serviceInventory = inventoryDatasets['publication-snapshot.json'];
const networkInventory = inventoryDatasets['network-address-snapshot.json'];
const routeResources = inventoryDatasets['route-resources-snapshot.json'];
import { routeDomains, domainServices, webAddress, formatAddress } from '../config/domain-details';
const listenerInventory = inventoryDatasets['listener-snapshot.json'];
import PublishService from './PublishService.vue';
import CertificateLifecycle from './CertificateLifecycle.vue';
import PortPresets from './PortPresets.vue';
import RolloutHistory from './RolloutHistory.vue';
import MergeSnapshots from './MergeSnapshots.vue';
import SnapshotCoverage from './SnapshotCoverage.vue';
import { connectSnapshotSecrets } from '../data/snapshot-secrets';
import { mergeRequested } from '../data/merge-session';
import PendingRollouts from './PendingRollouts.vue';
import { pendingCount } from '../data/pending-rollouts';
import { certificateStatus } from '../config/certificate-status';
import Diagnostics from './Diagnostics.vue';
const certificateInventory = inventoryDatasets['certificate-snapshot.json'];
import { publications, type SavedPublication } from '../data/publications';
import { portConfigurations } from '../data/port-presets';
import { updateNetworkInventory } from '../data/inventory';
import { connectNetworkState } from '../../../../preview-data/network-state';

onMounted(() => { loadSchedule().catch(() => {}); refreshSnapshots().catch(() => {}); });
watch(pendingChanges, () => { syncScheduleSource().catch(() => {}); }, { deep: true });
const props = withDefaults(defineProps<{ section?: string; clusterName?: string; dataSource?: any }>(), { section: 'overview', clusterName: 'local' });
let dataConnection: { stop: () => void } | undefined;
onMounted(async () => {
  if (!props.dataSource) return;
  const document = props.dataSource.document || await props.dataSource.reload();
  updateNetworkInventory(document.data.inventory);
  dataConnection = connectNetworkState(props.dataSource);
});
onBeforeUnmount(() => dataConnection?.stop());
const emit = defineEmits<{ navigate: [section: string] }>();
const instance = getCurrentInstance();
const hostStore=(instance?.proxy as any)?.$store;connectNamespaceContext(hostStore);connectSnapshotSecrets(hostStore);nativeRancher.value=!!hostStore;clusterId.value=props.clusterName;
const countdownSeconds = ref(refreshSeconds.value);
let refreshDeadline = 0;
let refreshTimer: ReturnType<typeof setInterval> | undefined;
const diagnosticTimer = setInterval(updateDiagnosticClock, 1000);
onBeforeUnmount(() => clearInterval(diagnosticTimer));
async function refreshCurrentView() {
  if (props.dataSource) updateNetworkInventory((await props.dataSource.reload()).data.inventory);
  updateCoverageClock();
  refreshDeadline = refreshSeconds.value > 0 ? Date.now() + refreshSeconds.value * 1000 : 0;
  countdownSeconds.value = refreshSeconds.value;
  await refreshPage(props.section);
}
watch(refreshSeconds, seconds => {
  if (refreshTimer) clearInterval(refreshTimer);
  countdownSeconds.value = seconds;
  refreshDeadline = seconds > 0 ? Date.now() + seconds * 1000 : 0;
  refreshTimer = seconds > 0 ? setInterval(() => {
    const remaining = Math.max(0, Math.ceil((refreshDeadline - Date.now()) / 1000));
    countdownSeconds.value = remaining;
    if (remaining === 0) void refreshCurrentView();
  }, 1000) : undefined;
}, { immediate: true });
onBeforeUnmount(() => { if (refreshTimer) clearInterval(refreshTimer); });

function navigate(section: string) {
  requestEditorLeave(() => {
    if (props.section === 'publish-service' && section !== 'publish-service') { editingConnection.value = ''; activeEditorDraft.value = ''; }
    if (formDrafts.value.find(draft => draft.id === activeFormDraft.value)?.page === props.section && section !== props.section) activeFormDraft.value = '';
    emit('navigate', section);
    const router = (instance?.proxy as any)?.$router;
    if (router) router.push({ name: routeName(section), params: { cluster: props.clusterName } });
  });
}
watch(mergeRequested, () => navigate('merge-snapshots'));
watch(helpRequest, () => navigate('help'));
watch(() => props.section, section => { activeHelpPage.value=section; },{immediate:true});
function editSelected() { if (!selected.value) return; activeEditorDraft.value = ''; editingConnection.value = selected.value.id; lastViewedConnection.value = selected.value.id; navigate('publish-service'); }
function finishEdit() { navigate('overview'); }
function newConnection() { activeEditorDraft.value = ''; editingConnection.value = ''; navigate('publish-service'); }
function resumeEditorDraft(id: string) { const draft = editorDrafts.value.find(draft => draft.id === id); if (!draft) return; activeEditorDraft.value = id; editingConnection.value = draft.editId; navigate('publish-service'); }
function resumeFormDraft(id: string) { const draft = formDrafts.value.find(item => item.id === id); if (!draft) return; activeFormDraft.value = id; navigate(draft.page); }
const nativeRouter = (instance?.proxy as any)?.$router;
const removeRouteGuard = nativeRouter?.beforeEach((to: any) => {
  if (!editorDirty.value) return true;
  requestEditorLeave(() => nativeRouter.push(to.fullPath)); return false;
});
onBeforeUnmount(() => removeRouteGuard?.());
function openRouteSnapshot(id: string) { if (!selected.value) return; historyContext.value = { snapshotId:id, routeId:selected.value.id, name:selected.value.name, namespace:selected.value.namespace,service:selected.value.service }; navigate('history'); }
function connectionHistory() {
  if (!selected.value) return;
  const binding = selectedBindings.value[0];
  historyContext.value = { routeId: selected.value.id, name: selected.value.name, namespace: binding?.namespace || selected.value.namespace, service: binding?.service || '' };
  navigate('history');
}
const search = ref('');
const namespace = ref<string[]>([]);
const protocol = ref<string[]>([]);
const configurations = ref<string[]>([]);
const selectedId = ref(lastViewedConnection.value || routes[0].id);
watch(selectedId, value => { lastViewedConnection.value = value; });
const namespaces = computed(() => [...new Set([...(props.section === 'certificates' ? certificateInventory.certificates : routes).map(resource => resource.namespace), ...publications.map(publication => publication.namespace)])].sort());
const publicationMappings = (publication: SavedPublication) => publication.mappings.filter(mapping => !protocol.value.length || protocol.value.includes(mapping.mode === 'TLS' ? 'TCP' : mapping.mode));
const visiblePublications = computed(() => publications.filter(publication => (!namespace.value.length || namespace.value.includes(publication.namespace)) && publicationMappings(publication).length > 0 && (!configurations.value.length || publication.configurationIds.some(id => configurations.value.includes(id))) && `${publication.name} ${publication.service} ${publication.namespace} ${publication.hosts.join(' ')}`.toLowerCase().includes(search.value.toLowerCase())));
const filtered = computed(() => routes.filter(route => {
  return contextMatches(route.namespace) && (!namespace.value.length || namespace.value.includes(route.namespace)) &&
    (!protocol.value.length || protocol.value.includes(route.protocol)) &&
    (!configurations.value.length || observedAttachments.some(attachment => `${attachment.kind}/${attachment.namespace}/${attachment.name}` === route.id && attachment.configurationIds.some(id => configurations.value.includes(id)))) &&
    `${route.name} ${route.match} ${route.service} ${route.namespace}`.toLowerCase().includes(search.value.toLowerCase());
}));
const selected = computed(() => filtered.value.find(route => route.id === selectedId.value) || filtered.value[0]);
const selectedBindings = computed(() => observedAttachments.find(route => `${route.kind}/${route.namespace}/${route.name}` === selected.value?.id)?.bindings || []);
const portDetails = computed(() => selectedBindings.value.map(binding => {
  const transport = binding.mode === 'UDP' ? 'UDP' : 'TCP';
  const listener = listenerInventory.entryPoints.find(item => item.name === binding.entryPoint && item.protocol === transport);
  const service = serviceInventory.services.find(item => item.name === binding.service && item.namespace === binding.namespace);
  const network = networkInventory.services.find(item => item.name === binding.service && item.namespace === binding.namespace);
  const backend = network?.ports.find(item => item.protocol === transport && (item.name === binding.backendPort || String(item.port) === binding.backendPort)) || service?.ports.find(item => item.protocol === transport && (item.name === binding.backendPort || String(item.port) === binding.backendPort));
  const resource: any = routeResources.resources.find(item => `${item.kind}/${item.metadata.namespace}/${item.metadata.name}` === selected.value?.id);
  const configured: any = resource?.spec.routes?.flatMap((rule: any) => rule.services || []).find((item: any) => item.name === binding.service && (item.namespace || resource.metadata.namespace) === binding.namespace && String(item.port) === binding.backendPort);
  const web = ['HTTP', 'HTTPS'].includes(binding.mode);
  const scheme = web ? (configured?.scheme === 'https' || (backend as any)?.appProtocol === 'https' ? 'https' : 'http') : null;
  const clusterAddresses = (backend?.port ? network?.clusterIPs || [] : []).map(ip => ({ address: formatAddress(ip, backend!.port), href: webAddress(ip, scheme, backend!.port) }));
  const endpoints = networkInventory.endpoints.filter(item => item.namespace === binding.namespace && item.service === binding.service).flatMap(item => item.ports.filter(port => port.port && port.protocol === transport && (port.name === backend?.name || !port.name && !backend?.name)).flatMap(port => item.addresses.map(ip => ({ address: formatAddress(ip, port.port!), href: webAddress(ip, scheme, port.port!), ready: item.ready }))));
  return { ...binding, transport, inboundPort: listener?.port, servicePort: backend?.port, targetPort: (backend as any)?.targetPort, clusterAddresses, endpoints, externalName: network?.externalName }; 
}));
const tlsStatus = (route: typeof routes[number]) => certificateStatus(route, routeResources.resources.find(item => `${item.kind}/${item.metadata.namespace}/${item.metadata.name}` === route.id));
const selectedResource = computed(() => routeResources.resources.find(item => `${item.kind}/${item.metadata.namespace}/${item.metadata.name}` === selected.value?.id));
const domainDetails = computed(() => routeDomains(selectedResource.value).map(domain => {
  const refs = domainServices(selectedResource.value, domain);
  const bindings = portDetails.value.filter(binding => refs.some((ref: any) => ref.name === binding.service && ref.namespace === binding.namespace && String(ref.port) === binding.backendPort));
  const unique = bindings.filter((binding, index, all) => all.findIndex(item => item.namespace === binding.namespace && item.service === binding.service && item.backendPort === binding.backendPort && item.entryPoint === binding.entryPoint) === index);
  return { domain, href: webAddress(domain, selected.value?.protocol === 'HTTPS' ? 'https' : selected.value?.protocol === 'HTTP' ? 'http' : null, unique[0]?.inboundPort), bindings: unique };
}));
const destinationPorts = computed(() => serviceInventory.services.filter(service => selectedBindings.value.some(binding => binding.namespace === service.namespace && binding.service === service.name)).flatMap(service => service.ports.map(port => ({ ...port, service: `${service.namespace}/${service.name}` }))));
const lastHourErrors = computed(() => diagnosticRows.value.filter(row => contextMatches(row.namespace) && row.severity === 'ERROR' && row.time >= diagnosticClock.value - 3600000 && row.time <= diagnosticClock.value).length);
function openErrors() { diagnosticSeverity.value = 'ERROR'; diagnosticLookback.value = 1; navigate('diagnostics'); }
const pending = computed(() => filtered.value.filter(route => route.tls === 'Issuance pending').length);
const certificates = computed(() => filtered.value.filter(route => route.certificate !== 'None'));
const titles: Record<string, string> = { overview: 'Routing Overview', 'issuer-profiles': 'TLS Issuer Profiles', 'port-configurations': 'Port Configurations', history: 'Snapshots', 'merge-snapshots': 'Merge Snapshots', 'snapshot-coverage':'Snapshot Coverage', 'pending-rollouts': 'Pending Rollouts', 'running-processes':'Running Processes', certificates: 'TLS & Certificates', diagnostics: 'Diagnostics', settings: 'Settings', help:'Help' };
const title = computed(() => props.section === 'publish-service' ? 'Connection editor' : titles[props.section] || 'Routing overview');
const showInventory = computed(() => props.section === 'overview');
const configurationNames = (ids: string[]) => ids.map(id => portConfigurations.find(config => config.id === id)?.name || 'Removed configuration').join(', ');
const publicationDownload = (resources: object[]) => `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ apiVersion: 'v1', kind: 'List', items: resources }, null, 2))}`;
watch(() => props.section, () => { protocol.value = []; namespace.value = []; configurations.value = []; search.value = ''; });
</script>

<template>
  <main class="snm" :data-refresh-revision="refreshRevision">
    <LeaveEditorDialog />
    <header class="snm-heading">
      <p class="eyebrow"><button type="button" class="manager-breadcrumb" @click="navigate('overview')">Network Manager</button><span> · {{ clusterName }} / {{ title }}</span></p>
      <div class="primary-title-row"><h1>{{ title }}<span id="snm-page-help"></span></h1>
      <div class="header-actions"><div id="snm-page-actions"></div><CreateButton v-if="section === 'overview'" label="Create New Connection" @create="newConnection" /><label class="refresh-control">Refresh Every<select v-model.number="refreshSeconds" aria-label="Refresh Every" title="Refresh data in place; forms are retained. Cluster inventory is static in this preview."><option :value="0">Off</option><option :value="30">30 Seconds</option><option :value="60">1 Minute</option><option :value="300">5 Minutes</option><option :value="900">15 Minutes</option><option :value="3600">1 Hour</option></select><output class="refresh-countdown" aria-label="Next Refresh" aria-live="off" :title="refreshSeconds ? 'Minutes:Seconds Until Next Refresh' : 'Automatic Refresh Is Off'">{{ formatCountdown(countdownSeconds) }}</output></label><div id="snm-refresh-action"></div><RefreshButton icon-only :busy="refreshing" :title="refreshMessage || 'Refresh Current View Without Losing Edits'" @refresh="refreshCurrentView" /><div id="snm-page-count"></div><span v-if="displaySettings.previewMode" class="preview-badge">Design preview</span></div></div>
    </header>
    <PageSummary v-if="section==='overview'" :count="filtered.length" label="Routes" help="Select a route to inspect domains, inbound listeners, destination mappings, certificates, and matching configuration snapshots."/><SnapshotBanner v-if="displaySettings.snapshotBanner || displaySettings.previewMode && displaySettings.inspectionInfo" @navigate="navigate" />
    <div class="stats" v-if="section === 'overview'">
      <article><span>Routes shown</span><strong>{{ filtered.length }}</strong></article>
      <article class="diagnostic-stat"><button type="button" @click="openErrors"><span>Errors detected in last hour</span><strong>{{ lastHourErrors }}</strong><small>Demo logs · open Diagnostics</small></button></article>
      <article class="diagnostic-stat"><button type="button" @click="navigate('certificates')"><span>Referenced Certificates</span><strong>{{ certificates.length }}</strong></button></article>
      <article class="attention diagnostic-stat"><button type="button" @click="navigate('pending-rollouts')"><span>Pending Rollouts</span><strong>{{ pendingCount }}</strong><small>Open Pending Rollout Details</small></button></article>
    </div>
    <div id="snm-inventory-filters"></div>
    <InventoryFilters v-if="showInventory" v-model:search="search" v-model:namespace-selection="namespace" v-model:protocol-selection="protocol" v-model:service-port-selection="configurations" :namespaces="namespaces" search-label="Find A Route" placeholder="Service, namespace, or route name…" multi-namespace :show-grouping="false" show-protocols :protocol-options="['HTTP', 'HTTPS', 'TCP', 'UDP'].map(name => ({ value: name, label: name }))" show-service-ports :service-port-options="portConfigurations.map(config => ({ value: config.id, label: `${config.name} · ${config.ports.map(port => port.port).join(', ')}` }))" />
    <div class="page-body" :class="{ 'overview-body': section === 'overview' }">
    <Settings v-if="section === 'issuer-profiles'" />
    <PublishService v-else-if="section === 'publish-service'" :edit-id="editingConnection" @cancel="finishEdit" @saved="finishEdit" />
    <section v-else-if="section === 'port-configurations'" class="panel configuration-page"><PortPresets @navigate="navigate" /></section>
    <section v-else-if="section === 'merge-snapshots'" class="panel merge-page"><MergeSnapshots @navigate="navigate" /></section>
    <section v-else-if="section === 'snapshot-coverage'" class="panel"><SnapshotCoverage @navigate="navigate" /></section>
    <section v-else-if="section === 'history'" class="panel history-page"><RolloutHistory /></section>
    <section v-else-if="section === 'pending-rollouts'" class="panel history-page"><PendingRollouts /></section>
    <section v-else-if="section === 'running-processes'" class="panel"><RunningProcesses /></section>
    <section v-else-if="section === 'certificates'" class="panel certificate-panel">
      <CertificateLifecycle :namespaces="namespace" :search="search" />
    </section>
    <section v-else-if="section === 'settings'" class="panel"><DisplaySettings /></section>
    <section v-else-if="section === 'help'" class="panel"><Help @navigate="navigate" /></section>
    <section v-else-if="section === 'diagnostics'" class="panel diagnostic-panel">
      <Diagnostics />
    </section>
    <div v-else class="workspace">
      <section class="panel route-list"><h2>Routes</h2>
        <div class="route-items" tabindex="0" aria-label="Scrollable routes">
        <div role="button" tabindex="0" v-for="route in filtered" :key="route.id" class="route-card" :class="{ active: selected?.id === route.id }" @click="selectedId = route.id" :aria-pressed="selected?.id === route.id" @keydown.enter="selectedId=route.id">
          <div class="route-top"><strong>{{ route.name }}</strong><span class="protocol">{{ route.protocol }}</span></div>
          <p>{{ route.match }}</p><div class="route-namespace"><ResourceLink kind="Namespace" :name="route.namespace"/></div><div class="route-bottom"><span class="route-statuses"><span v-if="tlsStatus(route).label !== 'Not Applicable'" class="certificate-state" :class="tlsStatus(route).tone">{{ tlsStatus(route).label }}</span><span class="certificate-state" :class="routeBackupStatus(route).tone">{{ routeBackupStatus(route).label }}</span></span></div>
        </div>
        <p v-if="!filtered.length" class="empty">No routes match these filters.</p>
        </div>
      </section>
      <section class="panel detail">
        <template v-if="selected">
        <div class="detail-heading"><div><h2>{{ selected.name }}</h2></div><div class="connection-actions"><span class="certificate-state" :class="routeBackupStatus(selected).tone">{{ routeBackupStatus(selected).label }}</span><span v-if="tlsStatus(selected).label !== 'Not Applicable'" class="certificate-state" :class="tlsStatus(selected).tone">{{ tlsStatus(selected).label }}</span><span class="protocol">{{ selected.kind }}</span><button type="button" class="icon-action" title="Configuration Snapshots" aria-label="Configuration Snapshots" @click="connectionHistory"><ActionIcon icon="history" /></button><button type="button" class="icon-action" title="Edit connection" aria-label="Edit connection" @click="editSelected"><ActionIcon icon="edit" /></button></div></div>
        <div class="flow" aria-label="Configured traffic path">
          <article><h3 class="step">Incoming Traffic</h3><strong>{{ selected.protocol }}</strong><p>{{ selected.match }}</p></article><span class="arrow">→</span>
          <article><h3 class="step">Traefik Listener</h3><strong>{{ selected.entrypoint }}</strong><p>Shared load balancer</p></article><span class="arrow">→</span>
          
          <article><h3 class="step">Destination Service</h3><strong>{{ selected.service }}</strong><p>{{ selected.port }}</p><div class="forward-address" v-for="(binding, index) in portDetails.filter((value, index, all) => all.findIndex(item => item.service === value.service && item.namespace === value.namespace && item.backendPort === value.backendPort) === index)" :key="index"><span v-for="address in binding.clusterAddresses" :key="address.address"><a v-if="address.href" :href="address.href" target="_blank" rel="noopener noreferrer">{{ address.address }}</a><span v-else>{{ address.address }}</span></span><small v-if="binding.targetPort">Target port: {{ binding.targetPort }}</small></div></article>
          <span class="arrow context-gap" aria-hidden="true"></span><article class="resource-context"><h3 class="step">Resource Context</h3><dl><dt>Namespace</dt><dd><ResourceLink kind="Namespace" :name="selected.namespace"/></dd><dt>Ownership</dt><dd><OwnershipLink :kind="selected.kind" :name="selected.name" :namespace="selected.namespace" :label="selected.owner"/></dd><dt>Changes</dt><dd>Preview only</dd></dl><p>{{ selected.note }}</p></article>
        </div>
        <p v-if="displaySettings.previewMode" class="flow-note">Configured references only. Backend endpoints and request success are not verified in this preview.</p>
        <div class="connection-details">
        <details open class="port-details domain-details" :key="`domains-${selected.id}`"><summary>Domain Details</summary>
          <div class="port-table"><DataGrid v-if="domainDetails.length"><thead><tr><th>Ingress Domain</th><th>Internal Service IP &amp; Port</th><th>Forwarded Endpoint IP &amp; Port</th></tr></thead><tbody><tr v-for="domain in domainDetails" :key="domain.domain"><td><a v-if="domain.href" :href="domain.href" target="_blank" rel="noopener noreferrer">{{ domain.domain }}</a><span v-else>{{ domain.domain }}</span></td><td><div v-for="(binding, index) in domain.bindings" :key="index" class="address-group"><small>{{ binding.namespace }}/{{ binding.service }}</small><div v-for="address in binding.clusterAddresses" :key="address.address"><a v-if="address.href" :href="address.href" target="_blank" rel="noopener noreferrer">{{ address.address }}</a><span v-else>{{ address.address }}</span></div><span v-if="!binding.clusterAddresses.length">{{ binding.externalName || 'No Service ClusterIP (headless or unavailable)' }}</span></div></td><td><div v-for="(binding, index) in domain.bindings" :key="index" class="address-group"><div v-for="address in binding.endpoints" :key="address.address"><a v-if="address.href" :href="address.href" target="_blank" rel="noopener noreferrer">{{ address.address }}</a><span v-else>{{ address.address }}</span><small v-if="address.ready === false">Not ready at inspection</small></div><span v-if="!binding.endpoints.length">No endpoint address recorded</span></div></td></tr></tbody></DataGrid><p v-else>No hostname matches are configured for this listener-based route.</p></div><p v-if="displaySettings.previewMode">Links open in a new tab. Internal addresses require access to the cluster network. TCP/SNI and UDP addresses are forwarding references, not web links. Address metadata was inspected {{ new Date(networkInventory.observedAt).toLocaleString() }}; reachability has not been tested.</p>
        </details>
        <details class="port-details" :key="selected.id"><summary>Ports &amp; Mappings</summary>
          <h3>Ports Used By This Route</h3><div class="port-table"><DataGrid><thead><tr><th>Inbound port</th><th>Transport</th><th>Traefik listener</th><th>Destination service</th><th>Service port</th><th>Internal Service IP &amp; Port</th><th>Target / Endpoint Ports</th></tr></thead><tbody><tr v-for="(binding, index) in portDetails" :key="index"><td>{{ binding.inboundPort ?? 'Not correlated' }}</td><td>{{ binding.transport }}</td><td>{{ binding.entryPoint }}</td><td>{{ binding.namespace }}/{{ binding.service }}</td><td>{{ binding.backendPort }}<small v-if="binding.servicePort">{{ binding.servicePort }}/{{ binding.transport }}</small></td><td><div v-for="address in binding.clusterAddresses" :key="address.address"><a v-if="address.href" :href="address.href" target="_blank" rel="noopener noreferrer">{{ address.address }}</a><span v-else>{{ address.address }}</span></div><span v-if="!binding.clusterAddresses.length">{{ binding.externalName || 'No ClusterIP' }}</span></td><td><div v-for="address in binding.endpoints" :key="address.address"><a v-if="address.href" :href="address.href" target="_blank" rel="noopener noreferrer">{{ address.address }}</a><span v-else>{{ address.address }}</span></div><small v-if="!binding.endpoints.length">{{ binding.targetPort || 'Not recorded' }}</small></td></tr></tbody></DataGrid><p v-if="!portDetails.length">No port mappings were correlated in this inspection.</p></div>
          <h3>All Destination Service Ports</h3><p>Ports exposed by the referenced Services. Ports listed here may not be published by this route.</p><div class="port-table"><DataGrid><thead><tr><th>Service</th><th>Port name</th><th>Port</th><th>Transport</th></tr></thead><tbody><tr v-for="port in destinationPorts" :key="`${port.service}/${port.name}/${port.port}/${port.protocol}`"><td>{{ port.service }}</td><td>{{ port.name || 'Unnamed' }}</td><td>{{ port.port }}</td><td>{{ port.protocol }}</td></tr></tbody></DataGrid><p v-if="!destinationPorts.length">No destination service port metadata is available.</p></div>
        </details>
        <details class="port-details tls-details" :key="`tls-${selected.id}`"><summary>TLS &amp; Certificate</summary>
          <article><span v-if="tlsStatus(selected).label !== 'Not Applicable'" class="certificate-state" :class="tlsStatus(selected).tone">{{ tlsStatus(selected).label }}</span><dl><dt>Secret</dt><dd><ResourceLink kind="Secret" :name="selected.certificate" :namespace="selected.namespace"/></dd><dt>Issuer</dt><dd><ResourceLink kind="ClusterIssuer" :name="selected.issuer"/></dd><dt>Issuance</dt><dd>{{ selected.issuer === 'None' ? 'Not applicable' : 'cert-manager · Let’s Encrypt · GoDaddy DNS' }}</dd></dl></article>
        </details><details class="port-details" :key="`snapshots-${selected.id}`"><summary>Snapshots</summary><span class="certificate-state" :class="routeBackupStatus(selected).tone">{{ routeBackupStatus(selected).label }}</span><div class="port-table"><DataGrid v-if="routeSnapshots(selected).length"><thead><tr><th>Generation</th><th>Scope</th><th>Created</th><th class="actions-column">Actions</th></tr></thead><tbody><tr v-for="snapshot in routeSnapshots(selected)" :key="snapshot.id" class="snapshot-link-row" @click="openRouteSnapshot(snapshot.id)"><td><button type="button" class="snapshot-name" @click.stop="openRouteSnapshot(snapshot.id)">{{ snapshot.generation || 'Manual' }}</button></td><td>{{ snapshot.scope?.label || snapshot.name }}</td><td>{{ new Date(snapshot.createdAt).toLocaleString() }}</td><td><a class="icon-action" :href="`/api/snapshots/${snapshot.id}`" title="Download Snapshot Index" aria-label="Download Snapshot Index" @click.stop><ActionIcon icon="download" /></a><button type="button" class="icon-action" title="Open Configuration Snapshots" aria-label="Open Configuration Snapshots" @click.stop="openRouteSnapshot(snapshot.id)"><ActionIcon icon="history" /></button></td></tr></tbody></DataGrid><p v-else>No saved snapshots include this route.</p></div></details>
        </div>

        <div v-if="connectionDrafts.some(draft => draft.sourceId === selected.id)" class="connection-draft" role="status"><p>An edited connection draft is saved locally. The observed route is unchanged.</p><a :href="publicationDownload(connectionDrafts.find(draft => draft.sourceId === selected.id)!.resources)" :download="`${selected.name}-edit.json`">Download edited draft</a></div>
        </template>
        <p v-else class="empty">Select a route after adjusting the filters to see its connection.</p>
    <section v-if="editorDrafts.length || formDrafts.length" class="working-drafts"><h3>Saved working drafts</h3><p>Incomplete forms saved during this browser session.</p><button v-for="draft in editorDrafts" :key="draft.id" type="button" class="edit-connection" @click="resumeEditorDraft(draft.id)">Resume {{ draft.name }}</button><button v-for="draft in formDrafts" :key="draft.id" type="button" class="edit-connection" @click="resumeFormDraft(draft.id)">Resume {{ draft.name }}</button></section>
    <section v-if="section === 'overview' && publications.length" class="panel local-publications"><h2>Local publication drafts</h2><p v-if="displaySettings.previewMode">Generated drafts retain links to their port configurations. Port Configurations → Reconfigure updates these drafts after impact review and confirmation. Reloading clears this preview state.</p><div class="publication-table"><DataGrid><thead><tr><th>Publication</th><th>Destination</th><th>Configurations</th><th>Mappings</th><th>Draft</th></tr></thead><tbody><tr v-for="publication in visiblePublications" :key="`${publication.namespace}/${publication.name}`"><td>{{ publication.namespace }} / {{ publication.name }}</td><td>{{ publication.service }}</td><td>{{ configurationNames(publication.configurationIds) }}</td><td>{{ publicationMappings(publication).map(mapping => `${mapping.mode} ${mapping.port} → ${mapping.backendPort}`).join(', ') }}</td><td><a :href="publicationDownload(publication.resources)" :download="`${publication.name}-publication.json`">Download</a></td></tr></tbody></DataGrid><p v-if="!visiblePublications.length">No local publication drafts match these filters.</p></div></section>
      </section>
    </div>

    </div>
  </main>
</template>

<style scoped>
.snm { color: var(--body-text, #dce3ed); font-size: 14px; width: 100%; height: 100%; min-height: 0; margin: 0; display: flex; flex-direction: column; overflow: hidden; }
.snm-heading, .detail-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
h1 { font-size: 29px; margin: 8px 0; letter-spacing: -.5px; } h2 { font-size: 18px; margin: 0 0 20px; } h3 { font-size: 15px; margin: 0 0 16px; } p { line-height: 1.6; }
.eyebrow { font-size: 12px; color: #75baff; letter-spacing: .7px; margin: 0; }.snm-heading > div > p:last-child { color: var(--muted, #a5b1c3); }
#snm-page-actions, #snm-refresh-action { display:flex; align-items:center; gap:10px; }#snm-page-actions:empty, #snm-refresh-action:empty { display:none; }.snapshot-link-row { cursor:pointer; }.snapshot-name { background:transparent; border:0; font:inherit; color:#a9d2ff; padding:0; cursor:pointer; }.route-backup { margin-top:8px; display:flex; justify-content:flex-end; }.preview-badge, .protocol, .state { display: inline-block; border-radius: 5px; padding: 5px 8px; font-size: 11px; background: #233950; color: #a9d2ff; white-space: nowrap; }
.snapshot-note { padding: 12px 16px; border-left: 3px solid #5a9dec; background: var(--box-bg, #202e40); margin: 22px 0; line-height: 1.6; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }.stats article, .panel { background: var(--box-bg, #242c38); border: 1px solid var(--border, #384352); border-radius: 7px; }.stats article { padding: 17px 20px; }.stats span { display: block; color: var(--muted, #a5b1c3); font-size: 12px; }.stats strong { display: block; font-size: 28px; margin-top: 8px; }.stats .attention strong { color: #edbb69; }
.filters { display: flex; flex-wrap: wrap; gap: 16px; margin: 24px 0; } label { display: flex; flex-direction: column; gap: 7px; font-size: 12px; color: var(--muted, #a5b1c3); }.search { flex: 1; min-width: 200px; } input, select { background: var(--input-bg, #1c2430); color: var(--body-text, #dce3ed); border: 1px solid var(--border, #384352); border-radius: 5px; padding: 11px; font: inherit; } input:focus-visible, select:focus-visible, button:focus-visible { outline: 2px solid #73b5ff; outline-offset: 3px; }
.page-body { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.page-body:not(.overview-body) > * { flex: 1; min-height: 0; min-width: 0; overflow: auto; box-sizing: border-box; scrollbar-gutter: stable; }.snm > :not(.page-body) { flex-shrink: 0; }.detail { align-self: start; position: sticky; top: 0; }.workspace { display: grid; grid-template-columns: minmax(260px, 340px) minmax(0, 1fr); gap: 20px; }.panel { padding: 22px; }.route-list h2 { display: flex; justify-content: space-between; }.route-list h2 span { color: #a5b1c3; font-weight: normal; }
.route-card { display: block; width: 100%; text-align: left; border: 1px solid var(--border, #384352); border-radius: 5px; padding: 15px; margin: 10px 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }.route-card.active { border-color: #71b5ff; background: #1b344d; }.route-top, .route-bottom { display: flex; justify-content: space-between; gap: 10px; align-items: center; }.route-card p { font-size: 12px; overflow-wrap: anywhere; margin: 9px 0 14px; color: #b6c6d9; }.route-bottom { font-size: 10px; color: #9aaec6; }.amber { color: #edbb69; }
.flow { display: flex; align-items: stretch; gap: 8px; margin-top: 22px; }.flow article { position: relative; flex: 1; min-width: 0; background: var(--input-bg, #1c2430); border: 1px solid var(--border, #384352); border-top: 3px solid #65a5e9; border-radius: 5px; padding: 16px 12px; }.flow small { display: block; color: #9aaec6; margin: 18px 0 10px; }.flow strong { display: block; font-size: 12px; overflow-wrap: anywhere; }.flow p { font-size: 11px; color: #9aaec6; overflow-wrap: anywhere; }.step { color: #71b5ff; font-size: 11px; }.arrow { width: 20px; flex: 0 0 20px; text-align: center; align-self: center; color: #71b5ff; font-size: 20px; }.flow-note { font-size: 11px; color: var(--muted, #a5b1c3); margin: 14px 0 26px; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; border-top: 1px solid var(--border, #384352); padding-top: 24px; }.detail-grid p { font-size: 12px; color: var(--muted, #a5b1c3); }.state { background: #203e37; color: #9cd9bc; }.state.pending { background: #493a23; color: #edbb69; } dl { display: grid; grid-template-columns: 80px 1fr; gap: 13px; font-size: 12px; }dt { color: var(--muted, #a5b1c3); }dd { margin: 0; overflow-wrap: anywhere; }
table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 16px 10px; border-bottom: 1px solid var(--border, #384352); font-size: 12px; }.certificate-panel { overflow-x: auto; }.diagnostic-panel article { padding: 16px 0; border-bottom: 1px solid var(--border, #384352); }.empty { color: var(--muted, #a5b1c3); }
@media (max-width: 1100px) { .flow { flex-wrap: wrap; }.flow article { flex-basis: 40%; }.arrow { display: none; }.stats { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 760px) { .workspace, .detail-grid { grid-template-columns: 1fr; }.filters { flex-direction: column; }.snm-heading { flex-direction: column; }.stats { gap: 8px; }.panel { padding: 16px; } }
</style>

<style scoped>
.port-details { margin: 0 0 24px; border: 1px solid var(--border, #384352); border-radius: 5px; padding: 12px; }.port-details > summary { padding: 0; color: #a9d2ff; cursor: pointer; font-size: 12px; }.port-details h3 { margin: 20px 0 10px; }.port-details p, .port-details small { font-size: 11px; color: var(--muted, #a5b1c3); }.port-details small { display: block; margin-top: 5px; }.port-table { overflow-x: auto; }.port-table th, .port-table td { vertical-align: top; }
</style>
<style scoped>
.local-publications { margin-top: 24px; }.local-publications p { color: var(--muted, #a5b1c3); font-size: 12px; }.publication-table { overflow: auto; }table { border-collapse: collapse; width: 100%; }th, td { padding: 12px 8px; border-bottom: 1px solid var(--border, #384352); text-align: left; font-size: 12px; }a { color: #91c3fc; }
</style>

<style scoped>
.configuration-page :deep(.port-presets), .history-page :deep(.history) { margin-top: 0; padding-top: 0; border-top: 0; }
</style>

<style scoped>
.snm :deep(.fields) { align-items: start; }.snm :deep(.fields > label) { min-width: 0; }.snm :deep(.fields > label > .field-label) { min-height: 2.5em; display: flex; align-items: flex-end; line-height: 1.25; }.snm :deep(.fields > label > input:not([type=checkbox])), .snm :deep(.fields > label > select) { width: 100%; min-height: 42px; margin: 0; }.snm :deep(.fields > label > small) { line-height: 1.5; }
</style>

<style scoped>
.connection-actions > .protocol, .connection-actions > .certificate-state { font-size: 16px; }.connection-details { border: 1px solid var(--border, #384352); border-radius: 5px; overflow: hidden; }.connection-details > .port-details { margin: 0; border: 0; border-bottom: 1px solid var(--border, #384352); border-radius: 0; padding: 12px; }.connection-details > .port-details:last-child { border-bottom: 0; }
.flow h3.step { color: #71b5ff; margin: 0 0 18px; font-size: 11px; font-weight: normal; }.flow .resource-context dl { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; font-size: 11px; }.flow .resource-context dt { overflow-wrap: anywhere; }.tls-details article { padding-top: 16px; }
.overview-body { overflow: hidden; display: flex; flex-direction: column; }.overview-body .workspace { flex: 1; min-height: 0; grid-template-rows: minmax(0, 1fr); }.overview-body .route-list, .overview-body .detail { height: 100%; min-height: 0; min-width: 0; }.overview-body .route-list { display: flex; flex-direction: column; overflow: hidden; }.overview-body .route-list h2 { flex-shrink: 0; }.route-items { flex: 1; min-height: 0; overflow-y: auto; padding-right: 8px; scrollbar-gutter: stable; }.overview-body .detail { align-self: stretch; position: static; overflow: auto; }.route-items:focus-visible { outline: 2px solid #73b5ff; outline-offset: -2px; }.overview-body .local-publications { padding: 18px; }
@media(max-width: 760px) { .overview-body .workspace { grid-template-columns: minmax(200px, 35%) minmax(0, 1fr); }.overview-body .detail-grid { grid-template-columns: 1fr; }.overview-body .panel { padding: 12px; } }
@media(max-width: 600px) { .snm { height: calc(100dvh - 30px); }.snm:has(.overview-body) .snm-heading > div > p:last-child { display: none; }.snm:has(.overview-body) .snapshot-note { padding: 8px; margin: 10px 0; font-size: 11px; }.snm:has(.overview-body) .filters { flex-direction: row; gap: 8px; margin: 12px 0; }.snm:has(.overview-body) .search { flex-basis: 100%; }.snm:has(.overview-body) .filters :deep(.multi-filter) { min-width: 0; flex: 1; } }
</style>

<style scoped>
.connection-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }.edit-connection { padding: 8px 12px; background: #326fb4; color: white; border: 0; border-radius: 5px; cursor: pointer; font: inherit; font-size: 12px; }.connection-draft { margin-top: 18px; padding: 12px; border: 1px solid #619bd9; border-radius: 5px; }.connection-draft p { font-size: 12px; }
</style>

<style scoped>
.header-actions { display: flex; align-items: center; gap: 14px; }.diagnostic-stat { padding: 0 !important; }.diagnostic-stat button { padding: 17px 20px; width: 100%; height: 100%; background: transparent; color: inherit; text-align: left; border: 0; cursor: pointer; font: inherit; }.diagnostic-stat small { display: block; margin-top: 6px; color: var(--muted, #a5b1c3); font-size: 11px; }.working-drafts { margin-top: 24px; }.working-drafts button { margin-right: 12px; }
</style>

<style scoped>
.domain-details { margin-bottom: 12px; }.address-group { margin-bottom: 12px; }.address-group:last-child { margin-bottom: 0; }.address-group div, .forward-address span { display:block; margin:6px 0; }.forward-address { font-size:12px; overflow-wrap:anywhere; }.forward-address small { display:block; margin-top:8px; color:var(--muted,#a5b1c3); }.port-details a, .forward-address a { color:#a9d2ff; text-decoration:underline; }.port-details a:focus-visible, .forward-address a:focus-visible { outline:2px solid #73b5ff; outline-offset:3px; }
</style>

<style scoped>
.header-actions { flex-wrap: wrap; justify-content: flex-end; align-items: center; }.refresh-control { flex-direction: row; align-items: center; gap: 8px; white-space: nowrap; font-size: 11px; }.refresh-control select { padding: 7px 9px; min-height: 34px; }
</style>

<style scoped>
.certificate-state { display:inline-block; padding:5px 8px; border-radius:5px; font-size:10px; white-space:nowrap; background:#233950; color:#a9d2ff; }.certificate-state.ready { background:#203e37; color:#9cd9bc; }.certificate-state.pending { background:#493a23; color:#edbb69; }.certificate-state.error { background:#4c282e; color:#ffb3ad; }
</style>

<style scoped>.refresh-countdown { min-width: 5ch; font-family: ui-monospace, Consolas, monospace; font-variant-numeric: tabular-nums; color: #a9d2ff; font-size: 12px; }</style>

<style scoped>.history-page:has(.snapshot-history) { display:flex; overflow:hidden !important; }.history-page > .snapshot-history { width:100%; }</style>

<style scoped>.snm-heading{display:block;margin-bottom:14px}.page-title-row{display:flex;justify-content:space-between;align-items:center;gap:16px}.page-title-row h1{display:flex;align-items:center}.primary-title-row{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:8px}.primary-title-row h1{display:flex;align-items:center;margin:0;flex-shrink:0}.header-actions{margin-top:0;margin-left:auto;gap:10px}.eyebrow{margin-bottom:0}@media(max-width:1000px){.primary-title-row{flex-wrap:wrap}.header-actions{flex:1;min-width:0}}.route-statuses{display:flex;gap:3px;justify-content:flex-end;align-items:flex-end;flex-wrap:nowrap;width:100%;min-width:0}.route-statuses .certificate-state{white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}.route-namespace{font-size:10px;color:#9aaec6;margin-bottom:9px}.route-bottom{align-items:flex-end;justify-content:flex-end;gap:6px}.route-top strong{flex:1}.certificate-state.success{background:#203e37;color:#9cd9bc}.certificate-state.warning{background:#493a23;color:#edbb69}.route-card:focus-visible{outline:2px solid #73b5ff}.page-title-row #snm-page-count{margin-left:auto}</style>

<style scoped>.page-body > .merge-page{overflow:hidden;scrollbar-gutter:auto}</style>

<style scoped>.manager-breadcrumb{font:inherit;color:inherit;padding:0;border:0;background:transparent;cursor:pointer}.manager-breadcrumb:hover{text-decoration:underline}.manager-breadcrumb:focus-visible{outline:2px solid #73b5ff;outline-offset:3px}</style>
