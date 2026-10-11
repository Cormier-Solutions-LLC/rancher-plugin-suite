<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import PageSummary from './PageSummary.vue';
import PageActions from './PageActions.vue';
import ActionIcon from './ActionIcon.vue';
import DataGrid from './DataGrid.vue';
import { coverageGaps } from '../data/snapshot-coverage';
import { readSnapshot } from '../data/stored-snapshots';
import { captureScheduleSource } from '../data/snapshot-schedule';
import { snapshotItems } from '../config/snapshot-items.mjs';
import { mergeSelectionGroups } from '../config/merge-selection.mjs';
import { redactSecrets } from '../config/snapshot-secrets.mjs';
const emit=defineEmits<{navigate:[section:string]}>();
const saved=ref<any[]>([]), loading=ref(false), error=ref(''); let revision=0;
watch(()=>[...new Set(coverageGaps.value.map((gap:any)=>gap.snapshotId).filter(Boolean))].join(','),async(ids)=>{
 const token=++revision; loading.value=true; error.value='';
 const results=await Promise.allSettled(ids?ids.split(',').map(id=>readSnapshot(id)):[]);
 if(token!==revision)return;
 saved.value=results.filter(result=>result.status==='fulfilled').map((result:any)=>result.value);
 if(results.some(result=>result.status==='rejected'))error.value='Some saved versions could not be read. Coverage gaps remain visible; refresh to retry.';
 loading.value=false;
},{immediate:true});
const currentItems=computed(()=>new Map(snapshotItems(captureScheduleSource()).map((item:any)=>[item.id,item])));
const rows=computed(()=>coverageGaps.value.map((gap:any)=>{
 const item:any=currentItems.value.get(gap.id) || {id:gap.id,type:'resource',name:gap.id.split('/').at(-1),namespace:gap.id.split('/').at(-2),value:{kind:'Secret'}};
 const source=saved.value.find(snapshot=>snapshot.id===gap.snapshotId);
 const before=source?snapshotItems(source.current).find((value:any)=>value.id===gap.id)?.value:undefined;
 return {...item,...gap,before,after:currentItems.value.get(gap.id)?.value};
}));
const sections=computed(()=>mergeSelectionGroups(rows.value,rows.value.map(row=>row.id)).map((group:any)=>({...group,rows:rows.value.filter(row=>group.ids.includes(row.id))})));
const show=(value:any)=>value===undefined?'No Captured Configuration':JSON.stringify(redactSecrets(value),null,2);
</script>
<template>
 <PageSummary :count="rows.length" label="Uncovered Items" tone="warning" help="Only items without a matching configuration backup from the last seven days are shown. Sections compare current configuration with the latest applicable saved version. Missing Secret values are never treated as complete coverage."/>
 <PageActions><button type="button" class="header-action" @click="emit('navigate','history')"><ActionIcon icon="history"/>Back To Snapshots</button></PageActions>
 <div class="coverage-review">
  <p v-if="loading" role="status">Loading Saved Versions…</p><p v-if="error" role="alert">{{error}}</p>
  <p v-if="!rows.length&&!loading" role="status">No Missing Configuration. All Known Items Have Matching Recent Snapshots.</p>
  <details v-for="(section,index) in sections" :key="section.key" :open="index===0" class="coverage-section">
   <summary>{{section.label}}<span>{{section.rows.length}}</span></summary>
   <DataGrid help="Missing means no captured version; Outdated means the latest item backup is at least seven days old; Changed means recent backup content differs. Matching items are hidden."><thead><tr><th>Item</th><th>Namespace</th><th>Coverage</th><th>Latest Applicable Snapshot</th><th>Comparison</th></tr></thead><tbody>
    <tr v-for="row in section.rows" :key="row.id"><td>{{row.name}}</td><td>{{row.namespace||'Global'}}</td><td>{{row.status}}</td><td :data-sort="row.snapshotDate?Date.parse(row.snapshotDate):0">{{row.snapshotDate?new Date(row.snapshotDate).toLocaleString():'None'}}</td><td>
     <details><summary>View Difference</summary><div class="coverage-diff"><article><h3>Current Configuration</h3><pre>{{show(row.after)}}</pre></article><article><h3>Latest Saved Version</h3><pre>{{show(row.before)}}</pre></article></div><p v-if="row.value.kind==='Secret'&&!row.after">The current Secret values were not captured. A reference alone cannot restore credentials.</p></details>
    </td></tr>
   </tbody></DataGrid>
  </details>
 </div>
</template>
<style scoped>
.coverage-review{min-height:0;font-size:13px}.coverage-section{border:1px solid #455363;border-radius:5px;margin:0 0 14px}.coverage-section>summary{display:flex;justify-content:space-between;padding:14px;color:#a9d2ff;font-weight:600}.coverage-section>summary span{font-variant-numeric:tabular-nums}summary{cursor:pointer}table{width:100%;border-collapse:collapse}td,th{padding:12px 10px;text-align:left;border-top:1px solid #384352;vertical-align:top;font-size:12px}.coverage-diff{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;min-width:320px}h3{font-size:12px;margin:12px 0}pre{font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto;padding:10px;background:#1c2430;border-radius:4px}p{color:#a5b1c3;line-height:1.6}@media(max-width:800px){.coverage-diff{grid-template-columns:1fr;min-width:200px}}
</style>
