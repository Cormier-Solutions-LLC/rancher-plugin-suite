<script setup lang="ts">
import { displaySettings } from '../pkg/simple-network-manager/data/display-settings';
import { ref } from 'vue';
import { requestEditorLeave, activeEditorDraft, activeFormDraft, formDrafts } from '../pkg/simple-network-manager/data/editor-session';
import { editingConnection } from '../pkg/simple-network-manager/data/connection-edits';
import Dashboard from '../pkg/simple-network-manager/pages/Dashboard.vue';
import { ROOT_PAGES } from '../pkg/simple-network-manager/navigation';
import { navigationCounts } from '../pkg/simple-network-manager/data/navigation-counts';
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
  <div class="preview-shell">
    <aside>
      <div class="cluster">◈ &nbsp; local <span v-if="displaySettings.previewMode">Layout preview</span></div>
      <div class="existing">Cluster</div><div class="existing">Workloads</div><div class="existing">Apps</div><div class="existing">Service Discovery</div><div class="existing">Storage</div><div class="existing">Policy</div><div class="existing">Monitoring</div><div class="existing">Compliance</div>
      <details :open="managerOpen"><summary @click.prevent="managerOpen = true; navigate('overview')">Network Manager</summary><nav aria-label="Network Manager"><button v-for="page in ROOT_PAGES" :key="page.name" :class="{ active: section === page.name }" :aria-current="section === page.name ? 'page' : undefined" @click="navigate(page.name)">{{ page.label }}<span v-if="navigationCounts[page.name] !== undefined" class="pending-badge" :class="page.name === 'diagnostics' ? diagnosticCounts.tone : ''" :title="page.name === 'diagnostics' ? `Demo Managed-Resource Logs · Last 24 Hours · Active Namespace Scope · ${diagnosticCounts.warnings} Warnings · ${diagnosticCounts.errors} Errors` : undefined" :aria-label="page.name === 'diagnostics' ? `${diagnosticCounts.total} Demo Managed-Resource Log Incidents · Last 24 Hours · Active Namespace Scope · ${diagnosticCounts.warnings} Warnings · ${diagnosticCounts.errors} Errors` : `${navigationCounts[page.name]} ${page.name === 'pending-rollouts' ? 'pending changes' : 'items'}`">{{ navigationCounts[page.name] }}</span></button></nav></details>
      <div class="existing">Longhorn</div><div class="existing">More Resources</div>
      <footer v-if="displaySettings.previewMode">Standalone design preview.<br>Not connected to Rancher.</footer>
    </aside>
    <div class="content"><Dashboard :section="section" cluster-name="local" @navigate="navigate($event)" /></div>
  </div>
</template>
<style>
* { box-sizing: border-box; } body { margin: 0; background: #1b222c; color: #dce3ed; font-family: 'Segoe UI', Arial, sans-serif; }.preview-shell { display: grid; grid-template-columns: 240px 1fr; height: 100dvh; overflow: hidden; } aside { overflow-y: auto; background: #242b35; border-right: 1px solid #384352; padding: 20px 12px; } .cluster { font-weight: 600; padding: 6px 10px 24px; border-bottom: 1px solid #384352; margin-bottom: 16px; } .cluster span { display: block; margin: 10px 0 0 25px; font-size: 10px; color: #95a9bf; font-weight: 400; }.existing { padding: 11px 14px; color: #a5b1c3; font-size: 13px; } summary { padding: 15px 8px; cursor: pointer; font-size: 13px; color: #c6e1ff; } details { border-top: 1px solid #384352; border-bottom: 1px solid #384352; margin: 8px 0; } nav button { display: block; text-align: left; background: transparent; color: #b6c6d9; border: 0; width: 100%; padding: 11px 18px; border-radius: 4px; cursor: pointer; font: inherit; font-size: 12px; } nav button.active { background: #25466a; color: #f0f6ff; } button:focus-visible, summary:focus-visible { outline: 2px solid #73b5ff; } footer { font-size: 11px; padding: 24px 12px; color: #8a9eb5; line-height: 1.7; }.content { padding: 30px; min-width: 0; min-height: 0; overflow: hidden; height: 100%; } @media(max-width: 950px) { .preview-shell { grid-template-columns: 200px 1fr; }.content { padding: 20px; } } @media(max-width: 600px) { .preview-shell { display: block; height: auto; min-height: 100dvh; overflow: visible; } .existing, footer { display: none; } aside { border-right: 0; }.cluster { padding-bottom: 10px; }.content { padding: 15px; height: auto; } }
</style>

<style>
.settings-nav { border: 0; margin: 4px 0; }.settings-nav > summary { padding: 11px 18px; }.settings-nav button { padding-left: 30px; }
</style>

<style>nav .pending-badge { float: right; min-width: 20px; text-align: center; border-radius: 10px; background: #30455c; padding: 1px 5px; color: #c6e1ff; }</style>

<style>nav .pending-badge.warning{background:#493a23;color:#edbb69}nav .pending-badge.error{background:#4c282e;color:#ffb3ad}</style>
