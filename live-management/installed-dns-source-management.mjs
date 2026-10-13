import {join} from 'node:path';import {readFile,readdir,lstat} from 'node:fs/promises';
import {readDnsSourceBindings,clusterSourceRegistryRequest} from './dns-source-bootstrap.mjs';import {sourceTransactionStore} from './dns-source-transaction-store.mjs';import {dnsSourceTransactions} from './dns-source-transactions.mjs';import {readDnsSourceDependencies} from './dns-source-dependencies.mjs';import {verifyRegisteredDnsSource} from './dns-source-connection.mjs';import {validateSourceCatalogBackup} from './dns-source-backup.mjs';import {confirmedSourceActivation} from './dns-source-activation.mjs';import {validateDnsSourceCatalog,sourceCatalogFingerprint} from './dns-source-catalog.mjs';
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v||'');
const fail=()=>Object.assign(new Error('Installed source management dependencies are unavailable or changed.'),{status:503,code:'SOURCE_RUNTIME_UNCONFIRMED'});
export function installedDnsSourceManagement({snapshotRoot,loadSnapshot,volumeUsedBytes,serializeVolumeWrite=work=>work(),quotaBytes=Number(process.env.SNAPSHOT_STORAGE_LIMIT_BYTES)||Infinity,pins={catalogUid:process.env.DNS_SOURCE_CATALOG_UID,bindingUid:process.env.DNS_SOURCE_BINDINGS_UID,bindingDigest:process.env.DNS_SOURCE_BINDINGS_SHA256,controllerUid:process.env.DNS_SOURCE_CONTROLLER_UID},request=clusterSourceRegistryRequest(),query,transfer,now=Date.now,activationWaitMs=60000,poll=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const directory=typeof snapshotRoot==='string'?join(snapshotRoot,'source-operations'):null;let transactions,initializing;
 const readBindings=()=>readDnsSourceBindings({expectedUid:pins.bindingUid,expectedDigest:pins.bindingDigest,request});
 async function usage(){let total=0;for(const name of await readdir(directory)){const info=await lstat(join(directory,name));if(!info.isFile()||info.isSymbolicLink())throw fail();total+=info.size;}return total;}
 async function initialize(){
  const storage=await sourceTransactionStore(directory,{quotaBytes:async()=>{const [all,own]=await Promise.all([volumeUsedBytes(),usage()]);if(!Number.isFinite(all)||all<own)throw fail();return Math.max(0,quotaBytes-(all-own));}});
  const store={get:storage.get,put:value=>serializeVolumeWrite(()=>storage.put(value)),acquire:id=>serializeVolumeWrite(()=>storage.acquire(id)),release:storage.release};
  transactions=dnsSourceTransactions({store,readBindings,
   readDependencies:options=>readDnsSourceDependencies({...options,pins,now:now()}),
   validateBackup:async(id,{session,catalog,catalogUid,bindingUid,bindingDigest})=>{if(catalogUid!==pins.catalogUid||bindingUid!==pins.bindingUid||bindingDigest!==pins.bindingDigest)throw fail();const [snapshot,raw]=await Promise.all([loadSnapshot(id),readFile(join(snapshotRoot,id+'.meta.json'),'utf8')]),index=JSON.parse(raw);if(index.id!==id||index.encrypted!==false||index.archiveFormat!=='zip'||snapshot.id!==id)throw Object.assign(fail(),{status:422});validateSourceCatalogBackup(snapshot,catalog,(await readBindings()).document,{...pins,userId:session.userId},{now:now()});},
   verifyConnection:(source,options)=>verifyRegisteredDnsSource(source,{...options,query,transfer,now}),
   confirmActivation:async(value,{session,registry})=>{
    const deadline=now()+activationWaitMs;for(;;){const object=await session.readController();if(object.metadata.uid!==pins.controllerUid)throw fail();let inventory;try{inventory=JSON.parse(object.data['inventory.json']);}catch{throw fail();}
     if(confirmedSourceActivation(inventory,value,{now:now()})){const latest=await session.readCatalog();if(latest.metadata.uid!==pins.catalogUid||latest.metadata.annotations?.['dns-manager.cormierconsulting.io/source-operation']!==value.id||sourceCatalogFingerprint(validateDnsSourceCatalog(JSON.parse(latest.data['sources.json']),registry))!==sourceCatalogFingerprint(value.next))throw fail();return{confirmed:true};}
     if(now()>=deadline)return{confirmed:false};await poll(Math.min(1000,deadline-now()));
    }
   }
  });return transactions;
 }
 return async()=>{
  if(!directory||typeof loadSnapshot!=='function'||typeof volumeUsedBytes!=='function'||typeof serializeVolumeWrite!=='function'||!['catalogUid','bindingUid','controllerUid'].every(k=>uuid(pins[k]))||!/^[a-f0-9]{64}$/.test(pins.bindingDigest||'')||!(quotaBytes>0)||!Number.isInteger(activationWaitMs)||activationWaitMs<0||activationWaitMs>60000)throw fail();
  const installed=await readBindings();if(!transactions){if(!initializing)initializing=initialize().catch(error=>{initializing=null;throw error;});await initializing;}
  return {registry:installed.document,...pins,transactions};
 };
}
