import {readFile,open,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {dnsEngineRecovery} from './dns-engine-recovery.mjs';
import {confirmedControllerCredentials} from './dns-controller-credential-proof.mjs';
const engineName='dns-manager-engine-admin',bridgeName='dns-windows-bridge-credential';
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v||'');
const fail=()=>Object.assign(new Error('Credential dependencies require reconciliation of the original restore operation.'),{status:503,code:'RECOVERY_DEPENDENCIES_UNCONFIRMED'});
const values=s=>JSON.stringify({type:s?.type,data:Object.entries(s?.data||{}).sort()});
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
async function atomic(path,value){const temporary=path+'.'+randomUUID()+'.tmp',handle=await open(temporary,'wx',0o600);try{try{await handle.writeFile(JSON.stringify(value));await handle.sync();}finally{await handle.close();}await rename(temporary,path);if(process.platform!=='win32'){const dir=await open(join(path,'..'),'r');try{await dir.sync();}finally{await dir.close();}}}finally{await unlink(temporary).catch(()=>{});}}
// The parent owns the global lease, encrypted values, reviewed Secret CAS and
// caller capabilities. This coordinator records component intents only. A lost
// component response is read back by its original recovery ID before continuation.
export function dnsRecoveryCoordinator({directory,engineApi,windows,readController,now=()=>Date.now(),waitMs=45000,pause=ms=>new Promise(r=>setTimeout(r,ms))}){
 if(!Number.isInteger(waitMs)||waitMs<0||waitMs>60000)throw fail();const tails=new Map();
 const path=id=>{if(!uuid(id))throw fail();return join(directory,'dependency-recovery-'+id+'.json');};
 const save=record=>atomic(path(record.id),record);
 const serial=(id,work)=>{const prior=tails.get(id)||Promise.resolve(),next=prior.catch(()=>{}).then(work);tails.set(id,next);return next.finally(()=>{if(tails.get(id)===next)tails.delete(id);});};
 function selection(input){
  if(!uuid(input.id)||!/^user-[a-z0-9-]+$/.test(input.session?.userId||'')||!Array.isArray(input.items)||!input.items.length||input.items.length>2||!Array.isArray(input.target)||input.target.length!==input.items.length)throw fail();
  const names=input.items.map(i=>i.name);if(new Set(names).size!==names.length||names.some((n,i)=>![engineName,bridgeName].includes(n)||input.target[i]?.metadata?.name!==n||input.target[i]?.metadata?.namespace!=='dns-system'))throw fail();
  if(input.before!==undefined&&(!Array.isArray(input.before)||input.before.length!==names.length||input.before.some((s,i)=>s&&(s.metadata?.name!==names[i]||s.metadata?.namespace!=='dns-system'))))throw fail();return names;
 }
 async function load(input,{create=false}={}){
  const names=selection(input),fingerprint=digest(input.target);let record;
  try{record=JSON.parse(await readFile(path(input.id),'utf8'));}catch(e){if(e.code!=='ENOENT'||!create)throw e;if(!Array.isArray(input.before))throw fail();record={id:input.id,userId:input.session.userId,names,targetDigest:fingerprint,beforeDigest:digest(input.before),status:'Preparing',activationAfter:null,components:names.map(name=>({name,preparation:'NotStarted',activation:'NotStarted'}))};await save(record);}
  if(record.id!==input.id||record.userId!==input.session.userId||JSON.stringify(record.names)!==JSON.stringify(names)||record.targetDigest!==fingerprint||input.before!==undefined&&record.beforeDigest!==digest(input.before)||!Array.isArray(record.components)||record.components.length!==names.length||record.components.some((c,i)=>c.name!==names[i]||!['NotStarted','Intent','Confirmed'].includes(c.preparation)||!['NotStarted','Intent','Confirmed','ReadyToContinue'].includes(c.activation)))throw fail();return record;
 }
 const child=(input,name)=>{const i=input.items.findIndex(item=>item.name===name);return {id:input.id,session:input.session,target:input.target[i],...(input.before?{before:input.before[i]}:{})};};
 async function controller(record,input,{wait=false}={}){
  if(!record.activationAfter||!readController)return {confirmed:false};const deadline=now()+(wait?waitMs:0),target=child(input,engineName).target;
  do{
   // A mounted-password witness is accepted only alongside the caller's current
   // target Secret. Cached controller sessions are excluded by its fresh proof.
   try{const actual=await input.session.readSecret(engineName),observation=await readController();if(actual?.kind==='Secret'&&actual.metadata?.name===engineName&&actual.metadata.namespace==='dns-system'&&!actual.metadata.deletionTimestamp&&values(actual)===values(target)&&confirmedControllerCredentials(observation,{after:record.activationAfter,now:now()}))return {confirmed:true};}catch{}
   if(now()>=deadline)return {confirmed:false};await pause(Math.min(1000,deadline-now()));
  }while(true);
 }
 const engines=(record,input,{wait=false}={})=>dnsEngineRecovery({directory,api:engineApi,confirmController:()=>controller(record,input,{wait})});
 function component(record,name){return record.components.find(c=>c.name===name);}
 async function prepareComponent(record,input,name){
  const part=component(record,name);if(!part)return;if(part.preparation==='Confirmed')return;if(part.preparation!=='NotStarted')throw fail();
  part.preparation='Intent';await save(record);const request=child(input,name);
  if(name===engineName)await engines(record,input).prepare(request);else{if(!windows)throw fail();await windows.prepare(request);}
  part.preparation='Confirmed';await save(record);
 }
 async function prepared(record,input,name){return name===engineName?(await engines(record,input).verifyPrepared(child(input,name))).prepared===true:(await windows.reconcile(child(input,name))).prepared===true;}
 async function verified(record,input,name){return name===engineName?(await engines(record,input).verify(child(input,name))).confirmed===true:(await windows.verify(child(input,name))).confirmed===true;}
 return {
  prepare(input){return serial(input.id,async()=>{const record=await load(input,{create:true});if(record.activationAfter)throw fail();for(const name of [engineName,bridgeName])await prepareComponent(record,input,name);record.status='Prepared';await save(record);return {prepared:true};});},
  commit(input){return serial(input.id,async()=>{
   const record=await load(input);if(record.components.some(c=>c.preparation!=='Confirmed'))throw fail();
   if(record.status==='Applied'){for(const name of record.names)if(!await verified(record,input,name))throw fail();return {confirmed:true};}
   if(!['Prepared','ReadyToContinue'].includes(record.status)||record.components.some(c=>c.activation==='Intent'))throw fail();
   // Establish the proof cutoff durably before any engine or Windows activation.
   if(!record.activationAfter){record.activationAfter=new Date(now()).toISOString();await save(record);}record.status='Activating';await save(record);
   try{for(const name of [engineName,bridgeName]){const part=component(record,name);if(!part)continue;if(part.activation==='Confirmed'){if(!await verified(record,input,name))throw fail();continue;}
     part.activation='Intent';await save(record);if(name===engineName)await engines(record,input,{wait:true}).commit(child(input,name));else await windows.commit(child(input,name));part.activation='Confirmed';await save(record);
    }record.status='Applied';await save(record);return {confirmed:true};
   }catch{record.status='Interrupted';await save(record);throw fail();}
  });},
  reconcile(input){return serial(input.id,async()=>{
   const record=await load(input);let allPrepared=true,allApplied=!!record.activationAfter,canContinue=true;
   for(const name of [engineName,bridgeName]){const part=component(record,name);if(!part)continue;
    if(part.preparation==='NotStarted'){await prepareComponent(record,input,name);}
    else if(part.preparation==='Intent'){
     // Engine preparation only authenticates and records progress; it changes
     // no external credential. Windows reconciliation resolves its original RPC.
     if(name===engineName)await engines(record,input).prepare(child(input,name));else if((await windows.reconcile(child(input,name))).prepared!==true)throw fail();part.preparation='Confirmed';await save(record);
    }
    if(!record.activationAfter){allPrepared=await prepared(record,input,name)&&allPrepared;continue;}
    if(part.activation==='Intent'||part.activation==='ReadyToContinue'){
     const evidence=name===engineName?await engines(record,input).reconcile(child(input,name)):await windows.reconcile(child(input,name));
     const applied=name===engineName?evidence.status==='Applied':evidence.confirmed===true;
     const ready=name===engineName?evidence.status==='ReadyToContinue':evidence.activationReady===true;
     if(applied)part.activation='Confirmed';else if(ready)part.activation='ReadyToContinue';else canContinue=false;await save(record);
    }
    if(part.activation==='Confirmed'){const confirmed=await verified(record,input,name);allApplied=confirmed&&allApplied;canContinue=confirmed&&canContinue;}
    else{allApplied=false;canContinue=part.activation!=='Intent'&&await prepared(record,input,name)&&canContinue;}
   }
   if(!record.activationAfter){record.status=allPrepared?'Prepared':'Interrupted';await save(record);return {prepared:allPrepared,confirmed:false,activationReady:false};}
   record.status=allApplied?'Applied':canContinue?'ReadyToContinue':'Interrupted';await save(record);return {prepared:false,confirmed:allApplied,activationReady:!allApplied&&canContinue};
  });},
  verify(input){return serial(input.id,async()=>{const record=await load(input);if(record.status!=='Applied'||record.components.some(c=>c.activation!=='Confirmed'))return {confirmed:false};for(const name of record.names)if(!await verified(record,input,name))return {confirmed:false};return {confirmed:true};});}
 };
}
