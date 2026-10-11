<script setup lang="ts">
import DataGrid from './DataGrid.vue';
import { computed } from 'vue';
import { redactSecrets } from '../config/snapshot-secrets.mjs';
import { compareSnapshotStates } from '../config/snapshot-diff';
const props = defineProps<{ current: any; saved: any }>();
const diff = computed(() => compareSnapshotStates(props.current, props.saved));
const show = (value: any) => value === undefined ? 'Not present' : JSON.stringify(redactSecrets(value), null, 2);
</script>
<template>
  <section class="snapshot-comparison" aria-label="Snapshot comparison">
    <h4>Current configuration compared with snapshot</h4>
    <p v-if="diff.matches" role="status">All services, configurations and manifests listed in this review are covered by this snapshot. No differences detected.</p>
    <template v-else><p>{{ diff.changes.length }} differences detected. Selecting this snapshot does not overwrite anything. Restoring a snapshot can add or change saved items; items only in the current configuration need separate review and are not automatically deleted.</p><DataGrid><thead><tr><th>Item</th><th>Difference</th></tr></thead><tbody><tr v-for="item in diff.changes" :key="item.name"><td>{{ item.name }}</td><td>{{ item.status }}</td></tr></tbody></DataGrid></template>
    <details v-for="(item, index) in diff.matches ? diff.items : diff.changes" :key="item.name" :open="!diff.matches && index === 0"><summary>{{ item.name }} · {{ item.status }}</summary><div class="side-by-side"><div><h5>Current configuration</h5><pre>{{ show(item.current) }}</pre></div><div><h5>Saved snapshot</h5><pre>{{ show(item.saved) }}</pre></div></div></details>
  </section>
</template>
<style scoped>
.snapshot-comparison { margin-top:20px; }h4 { font-size:14px; }p,table { font-size:12px; line-height:1.6; }table { border-collapse:collapse; width:100%; }th,td { text-align:left; padding:10px; border-bottom:1px solid var(--border,#384352); }details { margin-top:12px; border:1px solid var(--border,#384352); border-radius:5px; }summary { padding:12px; color:#a9d2ff; cursor:pointer; font-size:12px; }.side-by-side { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:14px; padding:12px; }h5 { margin:0 0 10px; font-size:12px; }pre { margin:0; padding:12px; max-height:320px; overflow:auto; font-size:11px; line-height:1.6; background:var(--input-bg,#1c2430); border:1px solid var(--border,#384352); border-radius:5px; }@media(max-width:650px) { .side-by-side { grid-template-columns:1fr; } }
</style>
