<script setup lang="ts">
import DataGrid from './DataGrid.vue';
import PageSummary from './PageSummary.vue';
import { displaySettings } from '../data/display-settings';
import { computed, ref } from 'vue';
import InventoryFilters from './InventoryFilters.vue';
const search = ref('');
const namespaceFilter = ref('__all__');
import { diagnosticClock, diagnosticCounts, diagnosticLookback, diagnosticRows, diagnosticSeverity } from '../data/diagnostic-logs';
import { contextMatches } from '../data/namespace-context';
const hours = ref(diagnosticLookback.value); diagnosticLookback.value = 24;
const source = ref('');
const severity = ref(diagnosticSeverity.value); diagnosticSeverity.value = '';
const loadedAt = diagnosticClock;
const rows = diagnosticRows;
const valid = computed(() => Number.isFinite(hours.value) && hours.value >= 0.25 && hours.value <= 168);


const shown = computed(() => valid.value ? rows.value.filter(row => row.time >= loadedAt.value - hours.value * 3600000 && row.time <= loadedAt.value && contextMatches(row.namespace) && `${row.source} ${row.severity} ${row.message}`.toLowerCase().includes(search.value.toLowerCase()) && (!source.value || row.source === source.value) && (!severity.value || row.severity === severity.value)).sort((a,b) => b.time-a.time) : []);
const countDescription=computed(()=>`Demo Managed-Resource Logs · Last 24 Hours · Active Namespace Scope · ${diagnosticCounts.value.warnings} Warnings · ${diagnosticCounts.value.errors} Errors`);
</script>
<template>
  <section class="diagnostics"><InventoryFilters v-model:search="search" v-model:namespace="namespaceFilter" :namespaces="[]" :show-grouping="false" :extra-columns="['100px','160px','130px']" search-label="Find A Log Entry" placeholder="Message, source, or severity…"><template #extra><label>Lookback (hours)<input v-model.number="hours" type="number" min="0.25" max="168" step="0.25"></label><label>Log source<select v-model="source"><option value="">All routing components</option><option>Traefik</option><option>cert-manager</option></select></label><label>Severity<select v-model="severity"><option value="">All severities</option><option value="DEBUG">Debug</option><option value="INFO">Info</option><option value="WARN">Warn</option><option value="ERROR">Error</option></select></label></template></InventoryFilters><PageSummary :count="diagnosticCounts.total" :label="countDescription" :tone="diagnosticCounts.tone" help="Routing controller logs can be filtered by source, severity, and lookback. The header counts warnings and errors over the last 24 hours; preview entries are demo data."/><div v-if="displaySettings.previewMode" class="preview-note" role="note">Demo log entries only. These examples are not logs from your cluster. Live logs will need the Rancher connection and must include all relevant controller replicas.</div><p v-if="!valid" class="error" role="alert">Choose a lookback between 0.25 and 168 hours.</p><p role="status">{{ shown.length }} demo entries in the selected window.</p><div class="logs"><DataGrid><thead><tr><th>Time</th><th>Namespace</th><th>Source</th><th>Severity</th><th>Message</th></tr></thead><tbody><tr v-for="(row,index) in shown" :key="index"><td class="time" :data-sort="row.time">{{ new Date(row.time).toLocaleString() }}</td><td>{{ row.namespace }}</td><td>{{ row.source }}</td><td :class="row.severity.toLowerCase()">{{ row.severity }}</td><td>{{ row.message }}</td></tr></tbody></DataGrid></div></section>
</template>
<style scoped>
.storage-heading { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; }.storage-heading h2 { margin:0; }h2 { margin-top: 0; font-size: 21px; }h3 { font-size: 15px; }p { color: var(--muted, #a5b1c3); font-size: 12px; line-height: 1.7; }.preview-note { border-left: 3px solid #619bd9; padding: 14px; background: var(--input-bg, #1c2430); font-size: 12px; line-height: 1.7; }.controls { display: flex; align-items: end; gap: 16px; flex-wrap: wrap; margin: 0 0 20px; }label { display: flex; flex-direction: column; gap: 8px; font-size: 12px; }input, select { padding: 11px; border: 1px solid var(--border, #384352); background: var(--input-bg, #1c2430); color: inherit; border-radius: 5px; font: inherit; }button { padding: 12px 18px; border: 0; border-radius: 5px; background: #326fb4; color: white; cursor: pointer; font: inherit; }button:disabled { opacity: .55; cursor: not-allowed; }.logs { overflow-x: auto; max-height: 500px; }table { width: 100%; border-collapse: collapse; font-size: 12px; }th, td { padding: 14px 10px; border-bottom: 1px solid var(--border, #384352); text-align: left; vertical-align: top; }.time { white-space: nowrap; }.warn { color: #edbb69; }.error { color: #ffb3ad; }tbody tr:last-child td { border-bottom: 0; }button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible { outline: 2px solid #73b5ff; outline-offset: 3px; }
</style>
