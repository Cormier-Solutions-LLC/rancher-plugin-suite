import {readFile,open,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {encryptWindowsRecovery,validateWindowsRecoveryMessage} from './windows-recovery-envelope.mjs';
const requestName='dns-windows-recovery-request',receiptName='dns-windows-recovery-receipt';
const fail=(status=409)=>Object.assign(new Error('Windows recovery channel is unconfirmed. Reconcile the original request before continuing.'),{status,code:'WINDOWS_CHANNEL_UNCONFIRMED'});
const digest=value=>createHash('sha256').update(value).digest('hex');
const uuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value||'');
const terminal=new Set(['Succeeded','Interrupted','Rejected']);
const namespace='dns-system';
function requestObject(value,uid){
 if(value?.apiVersion!=='v1'||value.kind!=='Secret'||value.type!=='Opaque'||value.metadata?.name!==requestName||value.metadata.namespace!==namespace||value.metadata.uid!==uid||!value.metadata.resourceVersion||value.metadata.deletionTimestamp||value.stringData||Object.keys(value.data||{}).join('|')!=='request.jwe')throw fail();
 const encoded=value.data['request.jwe'];if(typeof encoded!=='string'||encoded.length>180000||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))throw fail();
 const bytes=Buffer.from(encoded,'base64');if(bytes.toString('base64')!==encoded)throw fail();return bytes.toString('utf8');
}
function receiptObject(value,uid){
 if(value?.apiVersion!=='v1'||value.kind!=='ConfigMap'||value.metadata?.name!==receiptName||value.metadata.namespace!==namespace||value.metadata.uid!==uid||!value.metadata.resourceVersion||value.metadata.deletionTimestamp||Object.keys(value.data||{}).join('|')!=='receipt.json'||typeof value.data['receipt.json']!=='string'||value.data['receipt.json'].length>8192)throw fail();
 if(!value.data['receipt.json'])return null;let result;try{result=JSON.parse(value.data['receipt.json']);}catch{throw fail();}
 if(Object.keys(result).sort().join('|')!==['version','id','requestId','userId','clusterUid','accountUid','action','envelopeDigest','status','transactionStatus'].sort().join('|')||result.version!==1||!uuid(result.id)||!uuid(result.requestId)||!uuid(result.clusterUid)||!uuid(result.accountUid)||!/^user-[a-z0-9-]+$/.test(result.userId||'')||!['prepare','commit','reconcile','status'].includes(result.action)||!/^[a-f0-9]{64}$/.test(result.envelopeDigest||'')||!terminal.has(result.status)||!['Prepared','Applied','Interrupted','Unavailable'].includes(result.transactionStatus))throw fail();return result;
}
function matching(receipt,record){return receipt&&receipt.envelopeDigest===digest(record.envelope)&&['id','requestId','userId','clusterUid','accountUid','action'].every(k=>receipt[k]===record.message[k]);}
async function atomic(path,bytes){const temporary=path+'.'+randomUUID()+'.tmp',file=await open(temporary,'wx',0o600);try{try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}await rename(temporary,path);if(process.platform!=='win32'){const dir=await open(join(path,'..'),'r');try{await dir.sync();}finally{await dir.close();}}}finally{await unlink(temporary).catch(()=>{});}}
// One snapshot-server process owns this store. The parent transaction owns
// dependency sequencing and its durable global lease. This layer never retries
// a potentially accepted queue write; it only reads back the original envelope.
export function windowsRecoveryChannel({directory,client,recipient,clusterUid,accountUid,requestUid,receiptUid,now=()=>Math.floor(Date.now()/1000)}){
 if(!uuid(clusterUid)||!uuid(accountUid)||!requestUid||!receiptUid)throw fail(503);
 let tail=Promise.resolve();const serialize=work=>{const after=tail.catch(()=>{}).then(work);tail=after;return after;};
 const path=id=>{if(!uuid(id))throw fail(400);return join(directory,'windows-channel-'+id+'.json');};
 const save=record=>atomic(path(record.message.requestId),JSON.stringify(record));
 const load=async(requestId,userId)=>{const record=JSON.parse(await readFile(path(requestId),'utf8'));if(record.message?.userId!==userId)throw fail(403);if(record.message.requestId!==requestId||record.message.clusterUid!==clusterUid||record.message.accountUid!==accountUid||record.requestUid!==requestUid||record.receiptUid!==receiptUid||!['Prepared','Intent','Published','Acknowledged'].includes(record.status)||typeof record.envelope!=='string'||digest(record.envelope)!==record.envelopeDigest)throw fail();return record;};
 const publicRecord=record=>({message:structuredClone(record.message),status:record.status,...(record.receipt?{receipt:structuredClone(record.receipt)}:{})});
 async function authorize(session,userId){if(typeof session?.authorizeWindowsRecoveryChannel!=='function')throw fail(403);const evidence=await session.authorizeWindowsRecoveryChannel();if(evidence?.userId!==userId)throw fail(403);}
 async function observed(record){const queue=await client.readRequest(),envelope=requestObject(queue,requestUid),receipt=receiptObject(await client.readReceipt(),receiptUid);return {queue,envelope,receipt};}
 return {
  prepare({message,session}){return serialize(async()=>{
   validateWindowsRecoveryMessage(message,{now:now()});if(message.clusterUid!==clusterUid||message.accountUid!==accountUid)throw fail(403);await authorize(session,message.userId);
   const inputDigest=digest(JSON.stringify(message));let prior;try{prior=await load(message.requestId,message.userId);}catch(e){if(e.code!=='ENOENT')throw e;}
   if(prior){if(prior.inputDigest!==inputDigest)throw fail();return publicRecord(prior);}
   const envelope=encryptWindowsRecovery(message,recipient,{now:now()}),metadata=structuredClone(message);delete metadata.target;
   const record={message:metadata,inputDigest,envelope,envelopeDigest:digest(envelope),requestUid,receiptUid,status:'Prepared'};await save(record);return publicRecord(record);
  });},
  publish({requestId,userId,session}){return serialize(async()=>{
   await authorize(session,userId);const record=await load(requestId,userId);if(record.status!=='Prepared')throw fail();if(record.message.expiresAt<=now()||record.message.issuedAt>now()+30)throw fail();
   const {queue,envelope,receipt}=await observed(record);
   if(envelope&&(!receipt||receipt.envelopeDigest!==digest(envelope)||!terminal.has(receipt.status)))throw fail();
   record.status='Intent';await save(record);
   try{await client.replaceRequest({...queue,data:{'request.jwe':Buffer.from(record.envelope,'utf8').toString('base64')}});}catch{throw fail(503);}
   const accepted=requestObject(await client.readRequest(),requestUid);if(accepted!==record.envelope)throw fail(503);record.status='Published';await save(record);return publicRecord(record);
  });},
  reconcile({requestId,userId,session}){return serialize(async()=>{
   await authorize(session,userId);const record=await load(requestId,userId),{envelope,receipt}=await observed(record);
   if(matching(receipt,record)&&record.status!=='Prepared'){record.status='Acknowledged';record.receipt=receipt;await save(record);}
   else if(record.status==='Intent'&&envelope===record.envelope){record.status='Published';await save(record);}
   return publicRecord(record);
  });}
 };
}

// The supplied transport must use its mounted backend identity and strict TLS.
// Fixed paths and methods prevent this capability from becoming a generic proxy.
export function windowsRecoveryQueueClient(request){
 const base='/api/v1/namespaces/dns-system/';
 async function call(path,method='GET',body){let result;try{result=await request(path,{method,...(body?{body:JSON.stringify(body)}:{})});}catch{throw fail(503);}if(![200,201].includes(result.status))throw fail(result.status);return result.body;}
 return {readRequest:()=>call(base+'secrets/'+requestName),readReceipt:()=>call(base+'configmaps/'+receiptName),replaceRequest:object=>call(base+'secrets/'+requestName,'PUT',object)};
}
