import {rancherSessionHeaders,rancherRecoveryRequest} from './rancher-recovery-session.mjs';
import {createRancherDnsSourceSession} from './rancher-dns-source-session.mjs';
import {sourceCatalogCapture} from './dns-source-backup.mjs';import {validateDnsSourceCatalog,prepareDnsSourceOperations} from './dns-source-catalog.mjs';
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v||'');
const fail=status=>Object.assign(new Error('The source management request is unavailable or unauthorized.'),{status});
function receipt(value,userId,registry){
 if(!uuid(value?.id)||!uuid(value.snapshotId)||value.userId!==userId||!['Prepared','Applying','AwaitingActivation','Interrupted','Applied'].includes(value.status)||!Number.isFinite(Date.parse(value.createdAt))||!Array.isArray(value.draftIds)||value.draftIds.some(id=>!uuid(id))||!Array.isArray(value.operations)||!value.operations.length||value.operations.length>32)throw fail(503);
 const operations=value.operations.map(op=>{if(!['CreateSource','UpdateSource','DeleteSource'].includes(op.operation)||!uuid(op.draftId)||!value.draftIds.includes(op.draftId))throw fail(503);for(const source of [op.before,op.after].filter(Boolean))try{validateDnsSourceCatalog({version:1,revision:0,sources:[source]},registry);}catch{throw fail(503);}const identity=op.after||op.before;if(!identity||identity.id!==op.sourceId||identity.bindingId!==op.bindingId||identity.name!==op.name)throw fail(503);return {operation:op.operation,sourceId:op.sourceId,bindingId:op.bindingId,name:op.name,before:op.before||null,after:op.after||null,draftId:op.draftId};});
 if(value.status==='Applied'&&!Number.isFinite(Date.parse(value.finishedAt)))throw fail(503);
 return {id:value.id,userId,snapshotId:value.snapshotId,status:value.status,createdAt:value.createdAt,finishedAt:value.finishedAt||null,draftIds:[...value.draftIds],operations,error:['Interrupted','AwaitingActivation'].includes(value.status)?'Source activation is incomplete. Reconcile the original operation without resubmitting it.':''};
}
// getContext/saveBackup are installed server adapters. HTTP inputs cannot select
// registry pins, API paths, users, service accounts, controller or bridge IDs.
export function rancherDnsSourceManagement({getContext,saveBackup,request=rancherRecoveryRequest}={}){
 return async({path,method,headers,input})=>{
  let context,userId;
  try{
   const backup=path==='/api/sources/backup',prepare=path==='/api/sources/prepare',match=/^\/api\/sources\/([0-9a-f-]+)\/(status|apply|reconcile)$/.exec(path);if(!backup&&!prepare&&!match)return{status:404,body:{error:'Source action not found.'}};
   if(method!=='POST')throw fail(405);if(!input||typeof input!=='object'||Array.isArray(input))throw fail(400);
   const allowed=prepare?['id','snapshotId','changes']:[];if(Object.keys(input).some(key=>!allowed.includes(key)))throw fail(400);const id=prepare?input.id:match?.[1];if(!backup&&(!uuid(id)||prepare&&(!uuid(input.snapshotId)||!Array.isArray(input.changes)||!input.changes.length||input.changes.length>32)))throw fail(400);
   const forwarded=rancherSessionHeaders(headers),identity=await request('/apis/authentication.k8s.io/v1/selfsubjectreviews',{method:'POST',headers:forwarded,body:JSON.stringify({apiVersion:'authentication.k8s.io/v1',kind:'SelfSubjectReview'})});if(![200,201].includes(identity.status))throw fail([401,403].includes(identity.status)?identity.status:503);userId=identity.body?.status?.userInfo?.username;if(identity.body?.apiVersion!=='authentication.k8s.io/v1'||identity.body.kind!=='SelfSubjectReview'||!/^user-[a-z0-9-]+$/.test(userId||''))throw fail(403);
   if(typeof getContext!=='function')throw fail(503);context=await getContext();const session=createRancherDnsSourceSession(headers,userId,context.registry,request,{catalogUid:context.catalogUid,bindingUid:context.bindingUid,controllerUid:context.controllerUid});await session.authorize({write:!backup});
   if(backup){if(typeof saveBackup!=='function')throw fail(503);const current=sourceCatalogCapture(await session.readCatalog(),context.registry,{catalogUid:context.catalogUid,bindingUid:context.bindingUid,bindingDigest:context.bindingDigest,userId});const snapshot=await saveBackup(current);if(!uuid(snapshot?.id))throw fail(503);return{status:201,body:{snapshot:{id:snapshot.id,createdAt:snapshot.createdAt,encrypted:false,kind:'DnsSourceCatalog'}}};}
   const action=prepare?'prepare':match[2];if(typeof context.transactions?.[action]!=='function')throw fail(503);
   // Validate shape and registered settings without consuming live state or
   // defeating idempotent preparation of an already completed original ID.
   if(prepare)prepareDnsSourceOperations(input.changes,{version:1,revision:0,sources:input.changes.map(c=>c?.expected).filter(Boolean)},context.registry);
   const result=await context.transactions[action]({...input,id,userId,session});return{status:prepare?201:200,body:{receipt:receipt(result,userId,context.registry)}};
  }catch(error){const status=[400,401,403,404,405,409,422,503,507].includes(error.status)?error.status:error.code==='ENOENT'?404:503,messages={400:'Choose a source proposal and its current server backup.',401:'Sign in to Rancher again.',403:'Source management requires your Rancher permissions for the selected catalog and bridge.',404:'The original source operation or backup was not found.',405:'Use POST for source management.',409:'Refresh or reconcile the original source operation before continuing.',422:'The source backup is unavailable or incompatible.',503:'Source management is unconfirmed. Reconcile the original operation before retrying.',507:'Source operation storage quota is exhausted.'};let original;try{if(context&&userId&&error.receipt)original=receipt(error.receipt,userId,context.registry);}catch{}return{status,body:{error:messages[status],...(original?{receipt:original}:{})}};}
 };
}
