<script setup lang="ts">
import * as Vue from 'vue';
import { component } from '../../rancher-common-ui/client/index.mjs';
const Shell=component('Shell',Vue);
import NamespaceSelector from './NamespaceSelector.vue';
import { displaySettings } from '../pkg/simple-network-manager/data/display-settings';
import { ref } from 'vue';
import { requestEditorLeave, activeEditorDraft, activeFormDraft, formDrafts } from '../pkg/simple-network-manager/data/editor-session';
import { editingConnection } from '../pkg/simple-network-manager/data/connection-edits';
import Dashboard from '../pkg/simple-network-manager/pages/Dashboard.vue';
import { ROOT_PAGES } from '../pkg/simple-network-manager/navigation';
import { navigationCounts, navigationTones } from '../pkg/simple-network-manager/data/navigation-counts';
import { diagnosticCounts } from '../pkg/simple-network-manager/data/diagnostic-logs';
const section = ref('overview');
const managerOpen = ref(true);
function navigate(target: string) { requestEditorLeave(() => {
  if (section.value === 'publish-service' && target !== 'publish-service') { editingConnection.value = ''; activeEditorDraft.value = ''; }
  if (formDrafts.value.find(draft => draft.id === activeFormDraft.value)?.page === section.value && target !== section.value) activeFormDraft.value = '';
  section.value = target;
}); }
</script>
<template>
  <Shell title="Network Manager" cluster-name="local"><template #context><NamespaceSelector/></template>
    <template #navigation>
      <div class="cluster">◈ &nbsp; local <span v-if="displaySettings.previewMode">Layout preview</span></div>
      <div class="existing">Cluster</div><div class="existing">Workloads</div><div class="existing">Apps</div><div class="existing">Service Discovery</div><div class="existing">Storage</div><div class="existing">Policy</div><div class="existing">Monitoring</div><div class="existing">Compliance</div>
      <section class="manager-navigation"><div class="manager-menu-heading"><button type="button" @click="managerOpen = true; navigate('overview')">Network Manager</button><button type="button" :aria-label="managerOpen ? 'Collapse Network Manager' : 'Expand Network Manager'" :aria-expanded="managerOpen" @click="managerOpen = !managerOpen">{{managerOpen ? '⌄' : '›'}}</button></div><nav v-if="managerOpen" aria-label="Network Manager"><template v-for="page in ROOT_PAGES" :key="page.name"><div v-if="page.name==='pending-rollouts'" class="rcui-nav-divider" role="separator"/><button :class="{ active: section === page.name }" :aria-current="section === page.name ? 'page' : undefined" @click="navigate(page.name)">{{ page.label }}<span v-if="navigationCounts[page.name] !== undefined" class="pending-badge" :class="navigationTones[page.name]" :title="page.name === 'diagnostics' ? `Demo Managed-Resource Logs · Last 24 Hours · Active Namespace Scope · ${diagnosticCounts.warnings} Warnings · ${diagnosticCounts.errors} Errors` : undefined" :aria-label="page.name === 'diagnostics' ? `${diagnosticCounts.total} Demo Managed-Resource Log Incidents · Last 24 Hours · Active Namespace Scope · ${diagnosticCounts.warnings} Warnings · ${diagnosticCounts.errors} Errors` : `${navigationCounts[page.name]} ${page.name === 'pending-rollouts' ? 'pending changes' : 'items'}`">{{ navigationCounts[page.name] }}</span></button><div v-if="page.name==='overview'" class="rcui-nav-divider" role="separator"/></template></nav></section>
      <div class="existing">Longhorn</div><div class="existing">More Resources</div>
      <footer v-if="displaySettings.previewMode">Standalone design preview.<br>Not connected to Rancher.</footer>
    </template>
    <div class="content"><Dashboard :section="section" cluster-name="local" @navigate="navigate($event)" /></div>
  </Shell>
</template>










<style>.rcui-main>.content{display:flex;flex-direction:column;flex:1;min-height:0}.rcui-main>.content>.manager-common-root{flex:1}body{margin:0;color-scheme:light dark} .manager-navigation{border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:8px 0}</style>
