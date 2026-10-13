<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
defineProps({ title: {type:String,required:true} });
const emit=defineEmits(['close']);const panel=ref();let previous;
function key(event){if(event.key==='Escape'){event.preventDefault();emit('close');}if(event.key==='Tab'){const items=[...panel.value.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')];const first=items[0],last=items.at(-1);if(!items.length){event.preventDefault();return}if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}}
onMounted(async()=>{previous=document.activeElement;await nextTick();panel.value.querySelector('button,input,select')?.focus();});
onBeforeUnmount(()=>previous?.isConnected&&previous.focus());
</script>
<template><Teleport to="body"><div class="rcui-surface rcui-overlay"><section ref="panel" class="rcui-dialog" role="dialog" aria-modal="true" :aria-label="title" @keydown="key"><header><h2>{{title}}</h2><button type="button" aria-label="Close dialog" @click="emit('close')">×</button></header><slot/><footer><slot name="actions"/></footer></section></div></Teleport></template>
