import {readFile,open,rename,unlink}from'node:fs/promises';import{join}from'node:path';import{createHash,randomUUID}from'node:crypto';
const fail=(status=503)=>Object.assign(new Error('Windows credential recovery is unconfirmed. Reconcile the original request before continuing.'),{status,code:'WINDOWS_RECOVERY_UNCONFIRMED'});
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v||'');
// The target is constructed from the parent's reviewed installed Secret. HTTP
// inputs cannot supply a host, context, identity, CA override or executable.
export function windowsBridgeConfiguration(secret,accountUid){
 try{
  if(!uuid(accountUid)||secret?.apiVersion!=='v1'||secret.kind!=='Secret'||secret.type!=='kubernetes.io/service-account-token'||secret.metadata?.name!=='dns-windows-bridge-credential'||secret.metadata.namespace!=='dns-system'||secret.metadata.annotations?.['kubernetes.io/service-account.name']!=='dns-windows-bridge'||secret.metadata.annotations?.['kubernetes.io/service-account.uid']!==accountUid||Object.keys(secret.data||{}).sort().join('|')!=='ca.crt|namespace|token')throw fail();
  for(const value of Object.values(secret.data)){if(typeof value!=='string'||!value||Buffer.from(value,'base64').toString('base64')!==value)throw fail();}
  const token=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(secret.data.token,'base64'));if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)||Buffer.from(secret.data.namespace,'base64').toString()!=='dns-system')throw fail();
  const configuration=JSON.stringify({apiVersion:'v1',kind:'Config',clusters:[{name:'cluster',cluster:{server:'https://10.99.15.50:6443','tls-server-name':'kubernetes.cormierconsulting.io','certificate-authority-data':secret.data['ca.crt']}}],users:[{name:'bridge',user:{token}}],contexts:[{name:'bridge',context:{cluster:'cluster',user:'bridge',namespace:'dns-system'}}],'current-context':'bridge'});
  if(Buffer.byteLength(configuration)>60000)throw fail();return configuration;
 }catch{throw fail(422);}
}
async function atomic(path,value){const temporary=path+'.'+randomUUID()+'.tmp',handle=await open(temporary,'wx',0o600);try{try{await handle.writeFile(JSON.stringify(value));await handle.sync();}finally{await handle.close();}await rename(temporary,path);if(process.platform!=='win32'){const dir=await open(join(path,'..'),'r');try{await dir.sync();}finally{await dir.close();}}}finally{await unlink(temporary).catch(()=>{});}}
// Parent owns the global credential lease and encrypted before/target archive.
// Each RPC records its original request before staging. Lost publications are
// resolved only by the channel's durable readback, never by a new mutation ID.
export function windowsCredentialRecovery({directory,channel,clusterUid,accountUid,now=()=>Math.floor(Date.now()/1000),waitMs=20000,pause=ms=>new Promise(r=>setTimeout(r,ms))}){
 if(!uuid(clusterUid)||!uuid(accountUid)||!Number.isInteger(waitMs)||waitMs<0||waitMs>60000)throw fail();const tails=new Map();
 const path=id=>{if(!uuid(id))throw fail(400);return join(directory,'windows-recovery-'+id+'.json');};
 const save=receipt=>atomic(path(receipt.id),receipt);
 const serial=(id,work)=>{const prior=tails.get(id)||Promise.resolve(),next=prior.catch(()=>{}).then(work);tails.set(id,next);return next.finally(()=>{if(tails.get(id)===next)tails.delete(id);});};
 async function owner(input,create=false){
  if(!uuid(input.id)||!/^user-[a-z0-9-]+$/.test(input.session?.userId||''))throw fail(403);
  try{if((await input.session.authorizeWindowsRecoveryChannel()).userId!==input.session.userId)throw fail(403);}catch{throw fail(403);}
  let record;try{record=JSON.parse(await readFile(path(input.id),'utf8'));}catch(e){if(e.code!=='ENOENT'||!create)throw e;record={id:input.id,userId:input.session.userId,clusterUid,accountUid,requests:[],commitReady:false};}
  if(record.userId!==input.session.userId||record.id!==input.id||record.clusterUid!==clusterUid||record.accountUid!==accountUid||!Array.isArray(record.requests))throw fail(403);
  const configuration=windowsBridgeConfiguration(input.target,accountUid),fingerprint=createHash('sha256').update(configuration).digest('hex');if(record.targetDigest&&record.targetDigest!==fingerprint)throw fail(409);
  if(create){record.targetDigest=fingerprint;await save(record);}else if(record.targetDigest!==fingerprint)throw fail(409);
  return record;
 }
 function request(record,action){const issuedAt=now();const item={requestId:randomUUID(),action,issuedAt,expiresAt:issuedAt+300,staged:false};record.requests.push(item);return item;}
 async function observe(record,item,input){
  const reference={requestId:item.requestId,userId:record.userId,session:input.session};let seen;
  try{seen=await channel.reconcile(reference);}catch(e){if(e.code!=='ENOENT'||item.staged)throw fail();}
  if(!seen){
   if(item.expiresAt<=now()){item.discarded=true;await save(record);return {status:'NeverPublished'};}
   const message={version:1,id:record.id,requestId:item.requestId,userId:record.userId,clusterUid,accountUid,action:item.action,issuedAt:item.issuedAt,expiresAt:item.expiresAt,...(item.action==='prepare'?{target:{configuration:windowsBridgeConfiguration(input.target,accountUid)}}:{})};
   try{seen=await channel.prepare({message,session:input.session});}catch{throw fail();}item.staged=true;await save(record);
  }
  if(!item.staged){item.staged=true;await save(record);}
  if(seen.status==='Prepared'){
   if(item.expiresAt<=now()){item.discarded=true;await save(record);return {status:'NeverPublished'};}
   try{seen=await channel.publish(reference);}catch{throw fail();}
  }
  const deadline=Date.now()+waitMs;
  while(seen.status!=='Acknowledged'){
   try{seen=await channel.reconcile(reference);}catch{throw fail();}
   if(seen.status==='Acknowledged')break;if(Date.now()>=deadline)throw fail();await pause(Math.min(1000,deadline-Date.now()));
  }
  const ack=seen.receipt;
  if(!ack||ack.id!==record.id||ack.requestId!==item.requestId||ack.userId!==record.userId||ack.action!==item.action||ack.clusterUid!==clusterUid||ack.accountUid!==accountUid||!['Succeeded','Interrupted','Rejected'].includes(ack.status)||!['Prepared','Applied','Interrupted','Unavailable'].includes(ack.transactionStatus))throw fail();
  item.receipt=structuredClone(ack);await save(record);return {status:'Acknowledged',receipt:ack};
 }
 async function run(record,action,input,{fresh=false}={}){
  let item=record.requests.filter(r=>r.action===action&&!r.discarded).at(-1);
  // A health check must execute a new status request. If its predecessor is
  // pending, first resolve that original request; never abandon its intent.
  if(fresh&&item){const prior=await observe(record,item,input);if(prior.status==='NeverPublished'||prior.status==='Acknowledged')item=undefined;else throw fail();}
  for(let attempt=0;attempt<2;attempt++){
   if(!item){item=request(record,action);await save(record);}
   const result=await observe(record,item,input);
   if(result.status==='NeverPublished'||result.receipt?.status==='Rejected'&&result.receipt.transactionStatus==='Unavailable'){item.discarded=true;await save(record);item=undefined;continue;}
   return result.receipt;
  }
  throw fail();
 }
 const publicReceipt=ack=>({status:ack.transactionStatus,acknowledged:ack.status==='Succeeded',requestId:ack.requestId});
 return {
  prepare(input){return serial(input.id,async()=>{const record=await owner(input,true),ack=await run(record,'prepare',input);if(ack.status!=='Succeeded'||ack.transactionStatus!=='Prepared')throw fail();return publicReceipt(ack);});},
  commit(input){return serial(input.id,async()=>{const record=await owner(input);if(!record.requests.some(r=>r.action==='prepare'&&r.receipt?.status==='Succeeded'&&r.receipt.transactionStatus==='Prepared'))throw fail();let item=record.requests.filter(r=>r.action==='commit'&&!r.discarded).at(-1);if(item?.receipt?.status==='Interrupted'){if(!record.commitReady)throw fail();item.discarded=true;record.commitReady=false;await save(record);}const ack=await run(record,'commit',input);if(ack.status!=='Succeeded'||ack.transactionStatus!=='Applied')throw fail();record.commitReady=false;await save(record);return publicReceipt(ack);});},
  reconcile(input){return serial(input.id,async()=>{const record=await owner(input);
   // Resolve all earlier prepare/commit publications before a new readback.
   for(const item of record.requests.filter(r=>!r.discarded&&!r.receipt&&['prepare','commit'].includes(r.action))){const result=await observe(record,item,input);if(result.status==='NeverPublished'){item.discarded=true;await save(record);}}
   const hasCommit=record.requests.some(r=>r.action==='commit');let ack=await run(record,'status',input,{fresh:true});
   // Prepared status confirms the local lease without requiring a target
   // Secret that the parent has intentionally not replaced yet.
   if(hasCommit&&!(ack.status==='Succeeded'&&['Prepared','Applied'].includes(ack.transactionStatus)))ack=await run(record,'reconcile',input,{fresh:true});
   record.commitReady=hasCommit&&ack.status==='Succeeded'&&ack.transactionStatus==='Prepared';await save(record);return {...publicReceipt(ack),prepared:ack.status==='Succeeded'&&['Prepared','Applied'].includes(ack.transactionStatus),activationReady:record.commitReady,confirmed:ack.status==='Succeeded'&&ack.transactionStatus==='Applied'};
  });},
  verify(input){return serial(input.id,async()=>{const record=await owner(input),ack=await run(record,'status',input,{fresh:true});return {confirmed:ack.status==='Succeeded'&&ack.transactionStatus==='Applied',requestId:ack.requestId};});}
 };
}
