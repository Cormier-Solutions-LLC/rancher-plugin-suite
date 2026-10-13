<script setup lang="ts">
import { ref, nextTick } from 'vue';
import CalendarDateInput from './CalendarDateInput.vue';
import Modal from './Modal.vue';
const props=defineProps<{from:string;to:string;timed:boolean}>();
const emit=defineEmits(['update:from','update:to','update:timed']);const open=ref(false),end=ref();
function start(value:string){emit('update:from',value);nextTick(()=>end.value?.openCalendar());}
function setTimed(event:Event){const on=(event.target as HTMLInputElement).checked;emit('update:timed',on);emit('update:from',on&&props.from?`${props.from.slice(0,10)}T00:00`:props.from.slice(0,10));emit('update:to',on&&props.to?`${props.to.slice(0,10)}T23:59`:props.to.slice(0,10));}
</script>
<template><div class="date-range"><span>Date Range</span><button type="button" class="date-field" :aria-expanded="open" @click="open=true">{{from||to?`${from||'Start'} → ${to||'End'}`:'All Dates'}}</button><Modal v-if="open" title="Snapshot Date Range" @close="open=false"><div class="rcui-date-fields"><label>From<CalendarDateInput name="From" :model-value="from" :timed="timed" @update:model-value="start"/></label><label>To<CalendarDateInput ref="end" name="To" :model-value="to" :timed="timed" @update:model-value="emit('update:to',$event)"/></label></div><label class="rcui-check"><input type="checkbox" :checked="timed" @change="setTimed">Include Times</label><p v-if="from&&to&&from>to" role="alert">Choose an end date at or after the start date.</p><template #actions><button type="button" @click="emit('update:from','');emit('update:to','')">Clear Range</button><button type="button" @click="open=false">Done</button></template></Modal></div></template>
