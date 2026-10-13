<script setup>
import * as Vue from 'vue';
import {component} from '../../../../../rancher-common-ui/client/index.mjs';
import {evaluateCoverage} from '../data/coverage.mjs';
import {captureScheduleSource} from '../data/snapshot-schedule';
import {storedSnapshots,refreshSnapshots,readSnapshot} from '../data/stored-snapshots';
import {snapshotItems} from '../config/snapshot-items.mjs';
import {mergeSelectionGroups} from '../config/merge-selection.mjs';
import {redactSecrets} from '../config/snapshot-secrets.mjs';
const CoverageView=component('CoverageView',Vue);const emit=defineEmits(['navigate']);
const sections=Vue.ref([]),loading=Vue.ref(true),error=Vue.ref('');let revision=0;
const format=value=>value===undefined?'No Captured Configuration':JSON.stringify(redactSecrets(value),null,2);
async function load(){const token=++revision;loading.value=true;error.value='';try{const current=captureScheduleSource();const result=await evaluateCoverage(current,storedSnapshots.value);if(token!==revision)return;const ids=[...new Set(result.gaps.map(g=>g.snapshotId).filter(Boolean))];const saved=await Promise.allSettled(ids.map(id=>readSnapshot(id,{interactive:false})));if(token!==revision)return;const versions=saved.filter(s=>s.status==='fulfilled').map(s=>s.value);if(saved.some(s=>s.status==='rejected'))error.value='Some comparisons are unavailable. Encrypted saved versions can be unlocked from Snapshots; configuration coverage remains visible.';const items=new Map(snapshotItems(current).map(item=>[item.id,item]));const rows=result.gaps.map(gap=>{const item=items.get(gap.id)||{id:gap.id,name:gap.id.split('/').at(-1),type:'resource',value:{kind:'Secret'}};const before=versions.find(s=>s.id===gap.snapshotId);const savedItem=before?snapshotItems(before.current).find(i=>i.id===gap.id):undefined;return {...item,...gap,beforeText:format(savedItem?.value),afterText:format(items.get(gap.id)?.value),missingSecret:item.value?.kind==='Secret'&&!items.get(gap.id)}});sections.value=mergeSelectionGroups(rows,rows.map(r=>r.id)).map(group=>({...group,rows:rows.filter(row=>group.ids.includes(row.id))}));}catch(cause){if(token===revision)error.value=cause.message||'Coverage unavailable.';}finally{if(token===revision)loading.value=false;}}
Vue.watch(storedSnapshots,load);Vue.onMounted(async()=>{try{await refreshSnapshots();}catch(cause){revision++;error.value=cause.message;loading.value=false;}});Vue.onBeforeUnmount(()=>revision++);
</script>
<template><div class="dns-coverage"><button type="button" class="dm-button" @click="emit('navigate','snapshots')">Back To Snapshots</button><p v-if="!loading&&error&&!sections.length" role="alert">{{error}}</p><CoverageView v-else :sections="sections" :loading="loading" :error="error"/></div></template>
