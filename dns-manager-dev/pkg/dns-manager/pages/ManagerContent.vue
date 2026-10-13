<script setup>

import * as Vue from 'vue';

import { component } from '../../../../rancher-common-ui/client/index.mjs';

const Breadcrumb=component('Breadcrumb',Vue);const Shell=component('Shell',Vue);const Heading=component('Heading',Vue);

import { onMounted, onBeforeUnmount, watch, ref, getCurrentInstance } from 'vue';

import { mountDnsManager } from '../ui/dns-manager.js';

import { routeFor } from '../navigation.js';
import { configureManagerApi } from '../../../../live-management/manager-api.mjs';

import { displaySettings } from '../snapshot-feature/data/display-settings';

const props = defineProps({

  previewShell: { type: Boolean, default: false },

  clusterName: { type: String, default: 'kubcontroller' },

  section: { type: String, default: 'overview' },

  readObservations: { type: Function, default: undefined },

  previewStorage: { type: Object, default: undefined },

  dataSource: { type: Object, default: undefined }

});

const emit = defineEmits(['navigate']);

defineOptions({ beforeRouteLeave(to, from, next) { const guard=this.$.exposed?.requestRouteLeave; guard ? guard(next) : next(); } });

let controller;

defineExpose({ requestRouteLeave: next => controller ? controller.requestRouteLeave(next) : next() });

const hostStore = getCurrentInstance()?.proxy?.$store;
if(hostStore)configureManagerApi('dns-manager',props.clusterName);

const hostRouter = getCurrentInstance()?.proxy?.$router;

const managerRoot = ref(null);

onMounted(async () => {

  const document = props.dataSource && (props.dataSource.document || await props.dataSource.reload());

  controller = mountDnsManager(managerRoot.value, {

    section: props.section,

    preview: props.previewShell,

    dataSourceKind: props.dataSource?.kind,

    rancherOrigin: props.previewShell ? undefined : window.location.origin,

    inventory: document?.data.inventory,

    storage: props.dataSource ? { load: () => props.dataSource.loadState(), save: state => props.dataSource.saveState(state) } : props.previewShell ? props.previewStorage : undefined,

    clusterName: props.clusterName,

    readObservations: props.readObservations,
    applyChanges: props.dataSource?.capabilities.stageChanges ? changes=>props.dataSource.stageChanges(changes) : undefined,
    testSourceConnection: props.dataSource?.capabilities.testConnection ? (settings,options)=>props.dataSource.testConnection(settings,options) : undefined,
    sourceAction: props.dataSource?.capabilities.sourceManagement ? input=>props.dataSource.sourceAction(input) : undefined,

    store: hostStore,

    onNavigate: next => {

      emit('navigate', next);

      if (!props.previewShell && hostRouter) hostRouter.push(routeFor(next,props.clusterName));

    }

  });

});

watch(() => props.section, next => controller?.navigate(next));

onBeforeUnmount(() => controller?.destroy());

</script>



<template>

<div id="dns-manager-interface" ref="managerRoot" :class="{ 'dm-standalone': previewShell }" :aria-label="previewShell ? 'DNS Manager interface preview' : 'DNS Manager interface'">

  <Shell title="DNS Manager" :cluster-name="clusterName" :preview="previewShell"><template #context><span id="dm-global-namespaces" aria-label="Global namespace filter"></span><span v-if="displaySettings.previewMode" class="dm-preview">Design Preview · Sample Data</span></template><template #navigation><div class="dm-context">kubcontroller <span>10.99.15.50</span></div><div class="dm-native"><i data-lucide="layers" aria-hidden="true"></i> Workloads</div><div class="dm-native"><i data-lucide="shield-check" aria-hidden="true"></i> Compliance</div><div class="dm-native"><i data-lucide="route" aria-hidden="true"></i> Network Manager</div><button class="dm-group cursor-interaction" data-action="nav" data-page="overview"><i data-lucide="globe" aria-hidden="true"></i> DNS Manager <i data-lucide="chevron-down" aria-hidden="true"></i></button><nav id="dm-navigation" aria-label="DNS Manager pages"></nav><div class="dm-sidebar-foot">DNS Manager<br><span>Technitium · 3 planned instances</span></div></template>

    <main class="dm-main"><Heading class="dm-heading"><template #breadcrumb><Breadcrumb><template #manager><button class="dm-link" data-action="nav" data-page="overview">DNS Manager</button></template><template #current><span id="dm-crumb" aria-current="page">Overview</span></template></Breadcrumb></template><template #title><div class="dm-title-row"><h1 id="dm-title">Overview</h1><button class="dm-inline-help" data-action="help-context" aria-label="Page help"><i data-lucide="circle-help" aria-hidden="true"></i></button></div></template><template #subtitle><p id="dm-subtitle">DNS service, source replication, and lookup policy.</p></template><template #actions><div class="dm-actions"><div id="dm-snapshot-actions"></div><div id="dm-actions" class="dm-actions"></div></div></template></Heading><div id="dm-status"></div><div id="dm-content" class="dm-content"></div><div id="dm-notice" class="dm-notice" aria-live="polite"></div></main>

  </Shell><div id="dm-modal"></div><div id="dm-request-state"></div>

</div>

</template>






<style>
/* Keep semantic banner text above the inherited Rancher button color. */
#dns-manager-interface .rcui-banner { color: light-dark(#885b05, #f4cb71); }
#dns-manager-interface .rcui-banner.success { color: light-dark(#167345, #b5e4cc); }
#dns-manager-interface .rcui-banner.error { color: light-dark(#ad3232, #f09696); }
#dns-manager-interface .rcui-banner.info { color: var(--rcui-text); }
</style>
