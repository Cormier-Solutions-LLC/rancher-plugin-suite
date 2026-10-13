<script setup>
import { ref, inject } from 'vue';
import Modal from './Modal.vue';
defineProps({text:{type:String,required:true},label:{type:String,default:'Help'},topic:String});
const emit=defineEmits(['open-help']);const open=ref(false);
const help=inject('rancher.common-ui.help',undefined);
function openHelp(topic){if(help)help(topic);else emit('open-help',topic);open.value=false;}
</script>
<template><span class="help-tip"><button type="button" class="help-button" :aria-label="label" :aria-expanded="open" @click="open=true">?</button><Modal v-if="open" :title="label" @close="open=false"><p>{{text}}</p><template #actions><button type="button" @click="open=false">Close</button><button type="button" @click="openHelp(topic)">Open Help</button></template></Modal></span></template>
