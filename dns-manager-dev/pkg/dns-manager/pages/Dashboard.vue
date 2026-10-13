<script setup>
import * as Vue from 'vue';
import { dependencyGate } from '../../../../rancher-common-ui/client/index.mjs';
import ManagerContent from './ManagerContent.vue';
import {createLiveDnsSource} from '../../../../live-management/rancher-dns.mjs';

const props=defineProps({ previewShell:Boolean,clusterName:{default:'kubcontroller'},section:{default:'overview'},readObservations:Function,previewStorage:Object,dataSource:Object });const emit=defineEmits(['navigate']);
const Gate=dependencyGate(Vue);const content=Vue.ref();
const store=Vue.getCurrentInstance()?.proxy?.$store;
const source=Vue.shallowRef(props.dataSource),ready=Vue.ref(!store||!!props.dataSource),failure=Vue.ref('');
async function load(){try{if(!source.value){const user=store.getters['auth/user'];source.value=createLiveDnsSource(props.clusterName,fetch,user?.id||user?.metadata?.name);}await source.value.reload();ready.value=true;}catch(e){failure.value=e.message;}}
Vue.onMounted(()=>{if(store&&!props.dataSource)load();});
function openHelp(){document.querySelector('#dns-manager-interface [aria-label="Page help"]')?.click();}
function requestRouteLeave(next) { content.value?.requestRouteLeave(next) || (!content.value && next()); }
defineExpose({requestRouteLeave});
defineOptions({beforeRouteLeave(to,from,next){this.$.exposed.requestRouteLeave(next);}});
</script>
<template><Gate class="manager-common-root" @help="openHelp"><div v-if="!ready" role="status"><h2>DNS Manager</h2><p>{{failure||'Loading live DNS observations…'}}</p><button v-if="failure" @click="failure='';load()">Retry Live Inventory</button></div><ManagerContent v-else ref="content" v-bind="props" :data-source="source" :read-observations="source ? (options)=>source.reload(options).then(d=>d.data.inventory) : props.readObservations" @navigate="emit('navigate',$event)"/></Gate></template>
