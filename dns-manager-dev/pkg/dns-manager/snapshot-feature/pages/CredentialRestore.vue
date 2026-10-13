<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue';
import {managerApiUrl,managerFetch} from '../../../../../live-management/manager-api.mjs';
import {credentialNames,credentialRestoreClient} from '../data/credential-restore.mjs';
import {askBackupPassword} from '../data/unlock-backup';
const props=defineProps<{snapshot:any;items:any[];missing?:string[]}>();const emit=defineEmits<{locked:[value:boolean]}>();
const transaction=ref<any>(null),busy=ref(false),confirmed=ref(false),error=ref('');const lifetime=new AbortController();onBeforeUnmount(()=>lifetime.abort());
const supported=(i:any)=>i.type==='resource'&&i.value.kind==='Secret'&&i.namespace==='dns-system'&&credentialNames.includes(i.name);
const hasSecrets=computed(()=>props.items.some(i=>i.type==='resource'&&i.value.kind==='Secret'));
const selectable=computed(()=>props.items.length>0&&props.items.every(supported)&&!props.missing?.length);
const originalHere=computed(()=>transaction.value?.snapshotId===props.snapshot.id);
const canReview=computed(()=>selectable.value&&(!transaction.value||transaction.value.status==='Applied'||originalHere.value&&['ReviewUnconfirmed','ReviewNotFound'].includes(transaction.value.status)));
const canApply=computed(()=>originalHere.value&&['Prepared','ReadyToContinue'].includes(transaction.value?.status));
let client:any;
try{client=credentialRestoreClient({storage:localStorage,key:`dns-manager.credential-restore.v1.${managerApiUrl('dns-manager','/api/credential-recovery')}`,request:(path:string,init:RequestInit)=>managerFetch('dns-manager',path,init),onProgress:(value:any)=>{transaction.value=value;confirmed.value=false;}});transaction.value=client.read();}catch{error.value='The original credential restore reference could not be read. Restore is blocked until it can be recovered.';}
watch([transaction,busy],()=>emit('locked',busy.value||!!transaction.value&&!['Applied','ReviewUnconfirmed','ReviewNotFound'].includes(transaction.value.status)),{immediate:true});
watch(()=>props.items,()=>{confirmed.value=false;});
async function run(action:'prepare'|'apply'|'status'|'reconcile'){
 if(busy.value||!client||action==='prepare'&&!canReview.value||action==='apply'&&(!canApply.value||!confirmed.value))return;
 busy.value=true;error.value='';let password='';try{
  if(action!=='status')password=await askBackupPassword(lifetime.signal);
  if(action==='prepare')await client.review({snapshotId:props.snapshot.id,names:props.items.map(i=>i.name),password});else await client.action(action,password,transaction.value);
 }catch(e){error.value=e instanceof Error?e.message:'Credential restore is unconfirmed. Check the original operation.';}finally{password='';busy.value=false;}
}
</script>
<template><section v-if="hasSecrets||transaction||error" class="credential-restore" aria-label="DNS Credential Restore">
 <h4>Restore DNS Credentials</h4><p v-if="hasSecrets&&!selectable" role="alert">Select the installed DNS credentials separately from configuration items. Configuration drafts remain unchanged.</p>
 <p v-if="error" role="alert">{{error}}</p><p v-if="busy" role="status">Waiting for the original credential restore operation. Keep its reference if you leave this page.</p>
 <button v-if="canReview" type="button" :disabled="busy" @click="run('prepare')">{{transaction&&transaction.status!=='Applied'?'Retry Original Credential Review':'Review Selected Credentials'}}</button>
 <template v-if="transaction"><p>Operation: <code>{{transaction.id}}</code></p><p v-if="!originalHere">This original operation belongs to another snapshot. Reopen that snapshot to continue it.</p><p role="status">Credential Restore: {{transaction.status}}</p>
  <ul><li v-for="item in transaction.items" :key="item.name">{{item.name}} — {{item.create?'Create Missing Credential':item.changed?'Restore Saved Credential':'Unchanged'}}; {{item.status}}</li></ul>
  <p v-if="transaction.status==='Applied'&&transaction.dependencyConfirmed" role="status">Selected credentials and their dependent DNS services are confirmed.</p>
  <template v-if="canApply"><label><input v-model="confirmed" type="checkbox" :disabled="busy">Confirm Reviewed Credential Restore</label><button type="button" :disabled="busy||!confirmed" @click="run('apply')">{{transaction.status==='ReadyToContinue'?'Continue Original Credential Restore':'Apply Reviewed Credentials'}}</button></template>
  <button v-if="transaction.status!=='Applied'" type="button" :disabled="busy" @click="run('status')">Check Original Restore Status</button><button v-if="originalHere&&!['Prepared','Applied','ReviewUnconfirmed','ReviewNotFound'].includes(transaction.status)" type="button" :disabled="busy" @click="run('reconcile')">Reconcile Original Credential Restore</button>
 </template>
 </section></template>
<style scoped>.credential-restore{border:1px solid var(--border,#384352);padding:16px;margin-top:16px}h4{margin:0 0 12px}p,li,label{font-size:12px;line-height:1.7}code{overflow-wrap:anywhere}label{display:flex;gap:8px;margin:12px 0}button{font:inherit;font-size:12px;padding:10px 14px;border:0;border-radius:5px;background:#326fb4;color:white;cursor:pointer;margin:8px 8px 0 0}button:disabled{opacity:.5;cursor:not-allowed}[role=alert]{color:var(--error,#ffb3ad)}</style>
