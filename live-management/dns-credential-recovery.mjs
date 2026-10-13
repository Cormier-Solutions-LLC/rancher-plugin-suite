import {randomUUID,createHash} from 'node:crypto';
import {readFile,open,rename,unlink,statfs,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {dnsCredentialReferences} from './dns-credentials.mjs';
import {verifySavedBridgeToken} from './dns-bridge-token.mjs';
import {encodeBackup,decodeBackup,passwordStrength} from '../dns-manager-dev/pkg/dns-manager/snapshot-feature/config/backup-zip.mjs';
const validId=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id||'');
const fail=(message,status=409)=>Object.assign(new Error(message),{status,code:'CREDENTIAL_RECOVERY_BLOCKED'});
const marker='dns-manager.cormierconsulting.io/credential-recovery';
const equalValues=(a,b)=>JSON.stringify(Object.entries(a||{}).sort())===JSON.stringify(Object.entries(b||{}).sort());
const refFor=name=>{const ref=dnsCredentialReferences.find(r=>r.name===name);if(!ref)throw fail('Only installed DNS credential identities can be restored.',400);return ref;};
function savedCredential(secret,ref,account){
 if(secret?.apiVersion!=='v1'||secret.kind!=='Secret'||secret.type!==ref.type||secret.metadata?.namespace!==ref.namespace||secret.metadata?.name!==ref.name||!secret.data||secret.stringData||Object.keys(secret.data).sort().join('|')!==ref.keys.slice().sort().join('|')||Object.values(secret.data).some(v=>typeof v!=='string'||!v||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v)))throw fail('The encrypted backup has incomplete or incompatible credential values.',422);
 if(ref.serviceAccountName&&(account?.kind!=='ServiceAccount'||account.metadata?.name!==ref.serviceAccountName||account.metadata?.namespace!==ref.namespace||!account.metadata.uid||account.metadata.deletionTimestamp||secret.metadata.annotations?.['kubernetes.io/service-account.name']!==ref.serviceAccountName||secret.metadata.annotations?.['kubernetes.io/service-account.uid']!==account.metadata.uid||Buffer.from(secret.data.namespace,'base64').toString()!==ref.namespace))throw fail('The saved bridge credential belongs to another or unavailable service account.');
 return {apiVersion:'v1',kind:'Secret',type:ref.type,metadata:{name:ref.name,namespace:ref.namespace,...(ref.serviceAccountName?{annotations:Object.fromEntries(['kubernetes.io/service-account.name','kubernetes.io/service-account.uid'].map(k=>[k,secret.metadata.annotations[k]]))}:{})},data:structuredClone(secret.data)};
}
async function syncDirectory(directory){if(process.platform==='win32')return;const handle=await open(directory,'r');try{await handle.sync();}finally{await handle.close();}}
async function atomic(path,bytes){const temporary=path+'.'+randomUUID()+'.tmp',handle=await open(temporary,'wx',0o600);try{try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}await rename(temporary,path);await syncDirectory(join(path,'..'));}catch(e){await unlink(temporary).catch(()=>{});throw e;}}
// A single snapshot-server process owns this store. Its per-transaction queue
// serializes calls; every external mutation is preceded by a durable intent.
export function dnsCredentialRecovery({directory,loadSnapshot,coordinator,quotaBytes=Infinity}){
 const tails=new Map();
 const paths=id=>{if(!validId(id))throw fail('Invalid credential recovery reference.',400);return {receipt:join(directory,'recovery-'+id+'.json'),archive:join(directory,'recovery-'+id+'.zip')};};
 const save=receipt=>atomic(paths(receipt.id).receipt,Buffer.from(JSON.stringify(receipt)));
 const leasePath=join(directory,'credential-recovery-active.json');
 async function acquire(id){
  try{const handle=await open(leasePath,'wx',0o600);try{await handle.writeFile(JSON.stringify({id}));await handle.sync();}finally{await handle.close();}await syncDirectory(directory);}
  catch(e){if(e.code!=='EEXIST')throw e;let owner;try{owner=JSON.parse(await readFile(leasePath,'utf8'));}catch{throw fail('An incomplete credential recovery lease requires reconciliation.');}if(owner.id!==id)throw fail('Another credential recovery must finish before dependent systems can be changed.');}
 }
 async function release(id){let owner;try{owner=JSON.parse(await readFile(leasePath,'utf8'));}catch(e){if(e.code==='ENOENT')return;throw e;}if(owner.id!==id)throw fail('The credential recovery lease belongs to another transaction.');await unlink(leasePath);await syncDirectory(directory);}
 const serialize=(id,work)=>{const before=tails.get(id)||Promise.resolve(),after=before.catch(()=>{}).then(work);tails.set(id,after);return after.finally(()=>{if(tails.get(id)===after)tails.delete(id);});};
 const read=async(id,userId)=>{const receipt=JSON.parse(await readFile(paths(id).receipt,'utf8'));if(receipt.userId!==userId)throw fail('Credential recovery belongs to another Rancher user.',403);return receipt;};
 const selected=names=>{if(!Array.isArray(names)||!names.length||names.length>2||new Set(names).size!==names.length)throw fail('Choose distinct installed DNS credentials.',400);return names.map(refFor).map(r=>r.name).sort();};
 const key=password=>{if(typeof password!=='string'||!passwordStrength(password).acceptable)throw fail('Credential recovery requires a strong encrypted-backup password.',400);};
 async function current(session,names){const result=[];for(const name of names){try{const secret=await session.readSecret(name);if(!secret.metadata?.uid||!secret.metadata.resourceVersion||secret.metadata.deletionTimestamp)throw fail('The current credential identity is unavailable.');result.push(secret);}catch(e){if(e.status!==404)throw e;result.push(null);}}return result;}
 async function unpack(receipt,password){key(password);const bytes=await readFile(paths(receipt.id).archive);if(createHash('sha256').update(bytes).digest('hex')!==receipt.archiveDigest)throw fail('The encrypted recovery archive changed.',422);let document;try{document=await decodeBackup(bytes,password);}catch{throw fail('Unlock the original encrypted recovery backup again.',422);}const payload=document.current?.credentialRecovery;if(payload?.id!==receipt.id||payload.userId!==receipt.userId||payload.snapshotId!==receipt.snapshotId||JSON.stringify(payload.names)!==JSON.stringify(receipt.names))throw fail('The encrypted recovery identity differs.',422);return payload;}
 async function authorized(receipt,session){await session.authorize(receipt.names,{allowCreate:receipt.items.some(item=>item.create)});}
 async function verifyBaseline(receipt,payload,session){
  const live=await current(session,receipt.names);
  for(let i=0;i<live.length;i++){const before=payload.before[i],actual=live[i];if(!before&&!actual)continue;if(!before||!actual||before.metadata.uid!==actual.metadata.uid||before.metadata.resourceVersion!==actual.metadata.resourceVersion||!equalValues(before.data,actual.data))throw fail('Credentials changed after review. Prepare a fresh recovery transaction.');}
  if(payload.account){const account=await session.readBridgeAccount();if(account.metadata?.uid!==payload.account.metadata.uid||account.metadata.deletionTimestamp)throw fail('The bridge service account changed after review.');verifySavedBridgeToken(payload.target.find(s=>s.metadata.name==='dns-windows-bridge-credential'),{serviceAccount:account,jwks:await session.readSigningKeys()});}
  return live;
 }
 async function verifyApplied(receipt,payload,session){
  const live=await current(session,receipt.names);
  for(let i=0;i<live.length;i++){const actual=live[i],step=receipt.steps.find(s=>s.id==='secret/'+receipt.names[i]),expectedUid=receipt.items[i].changed?step?.uid:payload.before[i]?.metadata.uid;
   if(!actual||actual.metadata.uid!==expectedUid||actual.type!==payload.target[i].type||!equalValues(actual.data,payload.target[i].data)||receipt.items[i].changed&&actual.metadata.annotations?.[marker]!==receipt.id+'/'+receipt.names[i])throw fail('Current credential readback differs from the recovery receipt.');
  }
  if(payload.account){const account=await session.readBridgeAccount();if(account.metadata?.uid!==payload.account.metadata.uid||account.metadata.deletionTimestamp)throw fail('The bridge service account changed during recovery.');verifySavedBridgeToken(payload.target.find(s=>s.metadata.name==='dns-windows-bridge-credential'),{serviceAccount:account,jwks:await session.readSigningKeys()});}
 }
 async function verifyProgress(receipt,payload,session){
  const live=await current(session,receipt.names);
  for(let i=0;i<live.length;i++){
   const step=receipt.steps.find(s=>s.id==='secret/'+receipt.names[i]),actual=live[i],before=payload.before[i];
   if(step){if(step.status!=='Confirmed'||!actual||actual.metadata.uid!==step.uid||actual.type!==payload.target[i].type||actual.metadata.annotations?.[marker]!==receipt.id+'/'+receipt.names[i]||!equalValues(actual.data,payload.target[i].data))throw fail('A previous credential mutation has an unresolved or changed outcome.');}
   else if(before||actual){if(!before||!actual||before.metadata.uid!==actual.metadata.uid||before.metadata.resourceVersion!==actual.metadata.resourceVersion||before.type!==actual.type||!equalValues(before.data,actual.data))throw fail('An unsubmitted credential changed during recovery.');}
  }
  if(payload.account){const account=await session.readBridgeAccount();if(account.metadata?.uid!==payload.account.metadata.uid||account.metadata.deletionTimestamp)throw fail('The bridge service account changed during recovery.');verifySavedBridgeToken(payload.target.find(s=>s.metadata.name==='dns-windows-bridge-credential'),{serviceAccount:account,jwks:await session.readSigningKeys()});}
 }
 function replacement(before,target,id,name){return {...structuredClone(before||target),type:target.type,data:structuredClone(target.data),metadata:{...structuredClone((before||target).metadata),annotations:{...((before||target).metadata.annotations||{}),...(target.metadata.annotations||{}),[marker]:id+'/'+name}}};}
 const publicReceipt=receipt=>structuredClone(receipt);
 return {
  prepare({id,userId,snapshotId,names,password,session}){return serialize(id,async()=>{
   paths(id);key(password);names=selected(names);if(!/^user-[a-z0-9-]+$/.test(userId||'')||!validId(snapshotId))throw fail('A Rancher user and encrypted snapshot reference are required.',400);
   await session.authorize(names);
   let prior;try{prior=await read(id,userId);}catch(e){if(e.code!=='ENOENT')throw e;}
   if(prior){if(prior.snapshotId!==snapshotId||JSON.stringify(prior.names)!==JSON.stringify(names))throw fail('This recovery request ID belongs to another selection.');await unpack(prior,password);return publicReceipt(prior);}
   const source=await loadSnapshot(snapshotId,password);if(!source.encrypted||source.snapshot?.id!==snapshotId)throw fail('Use an encrypted server backup containing the selected credentials.',422);
   const account=names.includes('dns-windows-bridge-credential')?await session.readBridgeAccount():null;
   const target=names.map(name=>{const matches=(source.snapshot.current?.routeManifests||[]).filter(s=>s.kind==='Secret'&&s.metadata?.name===name&&s.metadata.namespace===refFor(name).namespace);if(matches.length!==1)throw fail('The selected credential backup is missing or ambiguous.',422);return savedCredential(matches[0],refFor(name),account);});
   if(account){if(!session.readSigningKeys)throw fail('Trusted cluster signing keys are unavailable.',503);verifySavedBridgeToken(target.find(s=>s.metadata.name==='dns-windows-bridge-credential'),{serviceAccount:account,jwks:await session.readSigningKeys()});}
   const before=await current(session,names),items=names.map((name,i)=>({name,create:!before[i],changed:!before[i]||before[i].type!==target[i].type||!equalValues(before[i].data,target[i].data),uid:before[i]?.metadata.uid||null,resourceVersion:before[i]?.metadata.resourceVersion||null,status:'Pending'}));
   if(items.some(item=>item.create))await session.authorize(names,{allowCreate:true});
   const payload={id,userId,snapshotId,names,before,target,account},receipt={id,userId,snapshotId,names,status:'Prepared',createdAt:new Date().toISOString(),finishedAt:null,items,steps:[],error:''};
   for(let i=0;i<items.length;i++){if(!items[i].changed)continue;const desired=replacement(before[i],target[i],id,names[i]);if(before[i])await session.replaceSecret(desired);else await session.createSecret(desired);}
   const bytes=await encodeBackup({schemaVersion:1,id,createdAt:receipt.createdAt,current:{credentialRecovery:payload}},password);await decodeBackup(bytes,password);
   const space=await statfs(directory),used=(await Promise.all((await readdir(directory)).map(name=>stat(join(directory,name))))).reduce((sum,s)=>sum+(s.isFile()?s.size:0),0),quota=typeof quotaBytes==='function'?await quotaBytes():quotaBytes;if(bytes.length+Buffer.byteLength(JSON.stringify(receipt))+4096>Math.min(space.bavail*space.bsize,quota-used))throw fail('Credential recovery storage quota is exhausted.',507);
   receipt.archiveDigest=createHash('sha256').update(bytes).digest('hex');await atomic(paths(id).archive,bytes);await save(receipt);return publicReceipt(receipt);
  });},
  status({id,userId,session}){return serialize(id,async()=>{const receipt=await read(id,userId);await authorized(receipt,session);return publicReceipt(receipt);});},
  apply({id,userId,password,session}){return serialize(id,async()=>{
   const receipt=await read(id,userId);await authorized(receipt,session);const payload=await unpack(receipt,password);
   if(receipt.status==='Applied'){await release(id);return publicReceipt(receipt);}
   if(!['Prepared','ReadyToContinue'].includes(receipt.status))throw fail('Reconcile the original credential recovery before continuing.');
   if(!coordinator?.prepare||!coordinator?.verify||!coordinator?.commit)throw fail('Credential dependency recovery is unavailable; nothing was applied.',503);
   await acquire(id);
   try{if(receipt.status==='Prepared')await verifyBaseline(receipt,payload,session);else await verifyProgress(receipt,payload,session);}catch(e){if(receipt.status==='Prepared')await release(id);throw e;}
   receipt.status='Applying';await save(receipt);
   try{
    let dependency=receipt.steps.find(s=>s.id==='dependencies');
    if(!dependency){dependency={id:'dependencies',status:'Intent'};receipt.steps.push(dependency);await save(receipt);
     await coordinator.prepare({id,items:receipt.items,before:payload.before,target:payload.target,session});dependency.status='Confirmed';await save(receipt);}
    if(dependency.status!=='Confirmed')throw fail('Dependency preparation requires reconciliation.');
    for(let i=0;i<receipt.items.length;i++){
     const item=receipt.items[i];if(!item.changed){item.status='Unchanged';await save(receipt);continue;}
     if(receipt.steps.some(s=>s.id==='secret/'+item.name&&s.status==='Confirmed'))continue;
     const step={id:'secret/'+item.name,status:'Intent'};receipt.steps.push(step);await save(receipt);
     const desired=replacement(payload.before[i],payload.target[i],id,item.name);
     const accepted=item.create?await session.createSecret(desired,{dryRun:false}):await session.replaceSecret(desired,{dryRun:false});
     const observed=await session.readSecret(item.name);
     if(observed.metadata?.uid!==accepted.metadata?.uid||observed.metadata?.annotations?.[marker]!==id+'/'+item.name||!equalValues(observed.data,payload.target[i].data))throw fail('Credential write requires reconciliation; readback differs.');
     step.status='Confirmed';step.uid=observed.metadata.uid;step.resourceVersion=observed.metadata.resourceVersion;item.status='SecretConfirmed';await save(receipt);
    }
    let activation=receipt.steps.find(s=>s.id==='activation');
    if(activation&&activation.status!=='ReadyToContinue')throw fail('Dependency activation requires reconciliation.');
    if(!activation){activation={id:'activation',status:'Intent'};receipt.steps.push(activation);}else{activation.status='Intent';}
    await save(receipt);await coordinator.commit({id,items:receipt.items,before:payload.before,target:payload.target,session});activation.status='Confirmed';receipt.status='AwaitingDependencies';await save(receipt);
    const evidence=await coordinator.verify({id,items:receipt.items,target:payload.target,session});if(evidence?.confirmed!==true)throw fail('Credentials are saved; dependent systems still require confirmation.');await verifyApplied(receipt,payload,session);
    receipt.status='Applied';receipt.finishedAt=new Date().toISOString();receipt.dependencyConfirmed=true;for(const item of receipt.items)item.status='Applied';await save(receipt);
   }catch(e){receipt.status='Interrupted';receipt.error='Credential recovery is incomplete. Reconcile this original operation; no mutation is automatically replayed.';await save(receipt);throw Object.assign(fail(receipt.error,e.status||503),{receipt:publicReceipt(receipt)});}
   await release(id);return publicReceipt(receipt);
  });},
  reconcile({id,userId,password,session}){return serialize(id,async()=>{
   const receipt=await read(id,userId);await authorized(receipt,session);const payload=await unpack(receipt,password);
   if(receipt.status==='Prepared')return publicReceipt(receipt);
   if(receipt.status==='Applied'){await release(id);return publicReceipt(receipt);}
   await acquire(id);
   // Readback can confirm an accepted submission. Absence or a different
   // writer never proves permission to repeat a possibly accepted mutation.
   for(const step of receipt.steps.filter(s=>s.id.startsWith('secret/')&&s.status==='Intent')){const i=receipt.names.indexOf(step.id.slice(7));let observed;try{observed=await session.readSecret(receipt.names[i]);}catch{continue;}
    if(observed.metadata?.uid&&observed.type===payload.target[i].type&&observed.metadata?.annotations?.[marker]===id+'/'+receipt.names[i]&&equalValues(observed.data,payload.target[i].data)&&(!payload.before[i]||observed.metadata.uid===payload.before[i].metadata.uid)){step.status='Confirmed';step.uid=observed.metadata.uid;step.resourceVersion=observed.metadata.resourceVersion;receipt.items[i].status='SecretConfirmed';}}
   if(coordinator?.reconcile){const evidence=await coordinator.reconcile({id,steps:receipt.steps,items:receipt.items,before:payload.before,target:payload.target,session});if(evidence?.confirmed===true&&receipt.items.every(i=>!i.changed||i.status==='SecretConfirmed')&&receipt.steps.some(s=>s.id==='activation')){await verifyApplied(receipt,payload,session);receipt.steps.find(s=>s.id==='activation').status='Confirmed';receipt.status='Applied';receipt.finishedAt=new Date().toISOString();receipt.dependencyConfirmed=true;for(const item of receipt.items)item.status='Applied';receipt.error='';}
    else if(evidence?.prepared===true&&!receipt.steps.some(s=>s.id==='activation')){
     const dependency=receipt.steps.find(s=>s.id==='dependencies');if(dependency){dependency.status='Confirmed';await save(receipt);}
     if(dependency&&receipt.steps.every(s=>s.status==='Confirmed')){await verifyProgress(receipt,payload,session);receipt.status='ReadyToContinue';receipt.error='';}
    }
    else if(evidence?.activationReady===true){
     // Only the coordinator can attest that every uncertain component intent
     // has been resolved and its commit resumes pending work without replay.
     const activation=receipt.steps.find(s=>s.id==='activation');
     if(activation&&receipt.steps.filter(s=>s!==activation).every(s=>s.status==='Confirmed')&&receipt.items.every(i=>!i.changed||i.status==='SecretConfirmed')){
      await verifyProgress(receipt,payload,session);activation.status='ReadyToContinue';receipt.status='ReadyToContinue';receipt.error='';
     }
    }
   }
   await save(receipt);if(receipt.status==='Applied')await release(id);return publicReceipt(receipt);
  });}
 };
}
