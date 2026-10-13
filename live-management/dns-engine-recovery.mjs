import {readFile,open,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const fail=()=>Object.assign(new Error('DNS engine recovery is incomplete. Reconcile its original operation before continuing.'),{code:'ENGINE_RECOVERY_UNCONFIRMED',status:503});
const validateId=id=>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id||''))throw fail();};
function password(secret){if(!secret)return null;const encoded=secret.data?.['admin-password'];if(secret.kind!=='Secret'||secret.type!=='Opaque'||secret.metadata?.namespace!=='dns-system'||secret.metadata.name!=='dns-manager-engine-admin'||Object.keys(secret.data||{}).join('|')!=='admin-password'||typeof encoded!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))throw fail();let value;try{value=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(encoded,'base64'));}catch{throw fail();}if(!value||value.length>4096)throw fail();return value;}
async function syncDirectory(directory){if(process.platform==='win32')return;const handle=await open(directory,'r');try{await handle.sync();}finally{await handle.close();}}
// The parent encrypted credential transaction owns the active recovery lease,
// before/target values and caller authorization. This store holds progress only.
export function dnsEngineRecovery({directory,api,confirmController}){
 const path=id=>{validateId(id);return join(directory,'engine-recovery-'+id+'.json');};
 const load=async id=>JSON.parse(await readFile(path(id),'utf8'));
 async function save(receipt){const temporary=path(receipt.id)+'.'+randomUUID()+'.tmp',handle=await open(temporary,'wx',0o600);try{try{await handle.writeFile(JSON.stringify(receipt));await handle.sync();}finally{await handle.close();}await rename(temporary,path(receipt.id));await syncDirectory(directory);}catch(e){await unlink(temporary).catch(()=>{});throw e;}}
 async function credentials({before,target}){const restored=password(target),previous=password(before);if(!restored)throw fail();return {restored,previous};}
 async function verifyAll(restored){for(const replica of [0,1,2])await api.verifyPassword(replica,restored);}
 return {
  async verifyPrepared(input){
   const receipt=await load(input.id),{restored,previous}=await credentials(input);
   if(!['Prepared','ReadyToContinue','Applied'].includes(receipt.status)||receipt.replicas.some(r=>!['Pending','Confirmed','Unchanged'].includes(r.status)))return {prepared:false};
   for(const item of receipt.replicas){if(item.status==='Pending'){if(!previous)throw fail();await api.verifyPassword(item.replica,previous);}else await api.verifyPassword(item.replica,restored);}
   return {prepared:true};
  },
  async prepare(input){
   const {id}=input;validateId(id);let prior;try{prior=await load(id);}catch(e){if(e.code!=='ENOENT')throw e;}if(prior)return prior;
   const {restored,previous}=await credentials(input),replicas=[];
   // Authenticate all three before any engine can be changed.
   for(const replica of [0,1,2]){
    if(previous&&previous!==restored){try{await api.verifyPassword(replica,previous);replicas.push({replica,status:'Pending'});continue;}catch(e){if(e.code!=='ENGINE_AUTH_REJECTED')throw fail();}}
    await api.verifyPassword(replica,restored);replicas.push({replica,status:'Unchanged'});
   }
   const receipt={id,status:'Prepared',createdAt:new Date().toISOString(),replicas,controllerConfirmed:false};await save(receipt);return structuredClone(receipt);
  },
  async commit(input){
   const {id}=input,receipt=await load(id),{restored,previous}=await credentials(input);
   if(!confirmController)throw fail();
   if(receipt.status==='Applied'){await verifyAll(restored);if((await confirmController({id,target:input.target}))?.confirmed!==true)throw fail();return structuredClone(receipt);}
   if(!['Prepared','ReadyToContinue'].includes(receipt.status))throw fail();
   for(const item of receipt.replicas){if(item.status==='Pending'){if(!previous)throw fail();await api.verifyPassword(item.replica,previous);}else if(['Confirmed','Unchanged'].includes(item.status))await api.verifyPassword(item.replica,restored);else throw fail();}
   receipt.status='Committing';await save(receipt);
   try{
    for(const item of receipt.replicas){if(item.status!=='Pending')continue;item.status='Intent';await save(receipt);await api.changePassword(item.replica,previous,restored);item.status='Confirmed';await save(receipt);}
    await verifyAll(restored);receipt.status='AwaitingController';await save(receipt);
    if((await confirmController({id,target:input.target}))?.confirmed!==true)throw fail();
    receipt.controllerConfirmed=true;receipt.status='Applied';receipt.finishedAt=new Date().toISOString();await save(receipt);return structuredClone(receipt);
   }catch{receipt.status='Interrupted';await save(receipt);throw fail();}
  },
  async reconcile(input){
   const {id}=input,receipt=await load(id),{restored}=await credentials(input);
   // Login readback can confirm the desired state, but a failed probe cannot
   // establish that an uncertain password change is safe to repeat.
   for(const item of receipt.replicas.filter(r=>r.status==='Intent')){try{await api.verifyPassword(item.replica,restored);item.status='Confirmed';}catch{}}
   if(receipt.replicas.every(r=>['Confirmed','Unchanged'].includes(r.status))){await verifyAll(restored);if(confirmController&&(await confirmController({id,target:input.target}))?.confirmed===true){receipt.status='Applied';receipt.controllerConfirmed=true;receipt.finishedAt=new Date().toISOString();}else{receipt.status='ReadyToContinue';receipt.controllerConfirmed=false;}}
   else if(!receipt.replicas.some(r=>r.status==='Intent'))receipt.status='ReadyToContinue';
   await save(receipt);return structuredClone(receipt);
  },
  async verify(input){const receipt=await load(input.id),{restored}=await credentials(input);await verifyAll(restored);return {confirmed:receipt.status==='Applied'&&!!confirmController&&(await confirmController({id:input.id,target:input.target}))?.confirmed===true};}
 };
}
