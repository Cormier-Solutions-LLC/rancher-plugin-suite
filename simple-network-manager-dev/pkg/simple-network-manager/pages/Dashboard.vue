<script setup>
import * as Vue from 'vue';
import { dependencyGate } from '../../../../rancher-common-ui/client/index.mjs';
import ManagerContent from './ManagerContent.vue';
import {openContextHelp} from '../data/help-context';
import { requestEditorLeave } from '../data/editor-session';
import { createLiveNetworkSource } from '../../../../live-management/rancher-network.mjs';
import { updateNetworkInventory } from '../data/inventory';
import { configureManagerApi } from '../../../../live-management/manager-api.mjs';
const props=defineProps({ section: {default:'overview'},clusterName:{default:'local'},dataSource:Object });const emit=defineEmits(['navigate']);
const Gate=dependencyGate(Vue);const content=Vue.ref();
const store=Vue.getCurrentInstance()?.proxy?.$store;
if(store)configureManagerApi('network-manager',props.clusterName);
const source=Vue.shallowRef(props.dataSource);const ready=Vue.ref(!store || !!props.dataSource);const failure=Vue.ref('');
Vue.onMounted(async()=>{if(!store || props.dataSource)return;try{const user=store.getters['auth/user'];source.value=createLiveNetworkSource(props.clusterName,fetch,user?.id || user?.metadata?.name);const document=await source.value.reload({mode:'cache'});updateNetworkInventory(document.data.inventory);ready.value=true;}catch(e){failure.value=e.message;}});
function requestRouteLeave(next) { requestEditorLeave(next); }
defineExpose({requestRouteLeave});
defineOptions({beforeRouteLeave(to,from,next){this.$.exposed.requestRouteLeave(next);}});
</script>
<template><Gate class="manager-common-root" @help="openContextHelp"><div v-if="!ready" role="status"><h2>Network Manager</h2><p>{{failure || 'Loading live Kubernetes inventory…'}}</p><button v-if="failure" @click="failure='';source.reload().then(d=>{updateNetworkInventory(d.data.inventory);ready=true;}).catch(e=>failure=e.message)">Retry live inventory</button></div><ManagerContent v-else ref="content" v-bind="props" :data-source="source" @navigate="emit('navigate',$event)"/></Gate></template>
