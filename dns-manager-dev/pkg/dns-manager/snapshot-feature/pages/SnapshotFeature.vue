<script setup lang="ts">
import { ref,watch } from 'vue';
import Coverage from './SnapshotCoverage.vue';
import History from './RolloutHistory.vue';
import MergeSnapshots from './MergeSnapshots.vue';


import { configureSnapshotAdapter,captureScheduleSource } from '../data/snapshot-schedule';
import { mergeRequested } from '../data/merge-session';
const props=defineProps<{capture:()=>any;restore:(change:any)=>void;matches:(namespace?:string)=>boolean;view?:string}>();
configureSnapshotAdapter(props);const emit=defineEmits(['navigate']);
const merging=ref(false);
watch(mergeRequested,()=>{merging.value=true});
</script>
<template><div class="dm-snapshot-feature"><Coverage v-if="view==='coverage'" @navigate="emit('navigate',$event)"/><MergeSnapshots v-else-if="merging" @navigate="merging=false"/><History v-else/></div></template>
<style>
.dm-snapshot-feature{height:100%;min-height:0;display:flex;flex-direction:column;--body-text:var(--dm-text);--box-bg:var(--dm-panel);--input-bg:var(--dm-bg);--border:var(--dm-line);--muted:var(--dm-muted)}
.dm-snapshot-feature .history{padding-top:0;border-top:0;margin-top:0}
.dm-snapshot-feature .snapshot-capture{flex:0 0 auto;max-height:45%;overflow:auto;margin-bottom:16px}
.dm-snapshot-feature .schedule-panels{max-height:50%;margin-top:14px;overflow:auto}
.dm-snapshot-feature button{min-height:40px;padding:10px 14px;font:inherit}
.dm-snapshot-feature .snapshot-summary{align-self:end;font-size:12px;margin-bottom:8px;color:var(--dm-muted)}
#dm-snapshot-actions .page-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#dm-snapshot-actions button{min-height:40px;padding:10px 14px;border:1px solid var(--dm-line);border-radius:5px;background:var(--primary,#2f68df);color:white;font:inherit}
.dm-snapshot-feature .bulk-review,.dm-snapshot-feature .restoration{background:var(--dm-panel)}
</style>
