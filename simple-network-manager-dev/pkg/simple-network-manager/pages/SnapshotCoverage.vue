<script setup lang="ts">
import * as Vue from 'vue';import {component} from '../../../../rancher-common-ui/client/index.mjs';const CoverageView=component('CoverageView',Vue);
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
 const results=await Promise.allSettled(ids?ids.split(',').map(id=>readSnapshot(id,{interactive:false})):[]);
 if(token!==revision)return;
 saved.value=results.filter(result=>result.status==='fulfilled').map((result:any)=>result.value);
 if(results.some(result=>result.status==='rejected'))error.value='Some comparisons are unavailable. Encrypted saved versions can be unlocked from Snapshots; configuration coverage remains visible.';
 loading.value=false;
},{immediate:true});
const currentItems=computed(()=>new Map(snapshotItems(captureScheduleSource()).map((item:any)=>[item.id,item])));
const rows=computed(()=>coverageGaps.value.map((gap:any)=>{
 const item:any=currentItems.value.get(gap.id) || {id:gap.id,type:'resource',name:gap.id.split('/').at(-1),namespace:gap.id.split('/').at(-2),value:{kind:'Secret'}};
 const source=saved.value.find(snapshot=>snapshot.id===gap.snapshotId);
 const before=source?snapshotItems(source.current).find((value:any)=>value.id===gap.id)?.value:undefined;
 return {...item,...gap,before,after:currentItems.value.get(gap.id)?.value};
}));
const sections=computed(()=>mergeSelectionGroups(rows.value,rows.value.map(row=>row.id)).map((group:any)=>({...group,rows:rows.value.filter(row=>group.ids.includes(row.id)).map(row=>({...row,beforeText:show(row.before),afterText:show(row.after),missingSecret:row.value?.kind==='Secret'&&!row.after}))})));
const show=(value:any)=>value===undefined?'No Captured Configuration':JSON.stringify(redactSecrets(value),null,2);
</script>
<template>
 <PageSummary :count="rows.length" label="Uncovered Items" tone="warning" help="Only items without a matching configuration backup from the last seven days are shown. Sections compare current configuration with the latest applicable saved version. Missing Secret values are never treated as complete coverage."/>
 <PageActions><button type="button" class="header-action" @click="emit('navigate','history')"><ActionIcon icon="history"/>Back To Snapshots</button></PageActions>
 <CoverageView :sections="sections" :loading="loading" :error="error"/>
</template>
