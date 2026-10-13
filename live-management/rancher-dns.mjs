import { createRancherDataSource } from '../preview-data/data-source.mjs';
import { dnsOperations } from './dns-operations.mjs';
import { currentZoneOrder,navigationProposal,validateNavigationBackup } from './dns-navigation.mjs';
import {validateDnsSourceTestResult} from './dns-source-test-result.mjs';
import {dnsSourceClient} from './dns-source-client.mjs';
import {validateDnsSourceBindings,validateDnsSourceCatalog,sourceCatalogFingerprint,prepareDnsSourceOperations} from './dns-source-catalog.mjs';
export function createLiveDnsSource(cluster,request=fetch,userId){
 const prefix=`/k8s/clusters/${encodeURIComponent(cluster)}`;
 let state={},revision,inventory,navigation,sourceJournal={version:1,operations:[]};
 let saveTail=Promise.resolve();
 if(!/^[a-z0-9-]+$/.test(userId||''))throw new Error('Current Rancher user identity is unavailable.');
 const stateName=`dns-manager-state-${userId}`;
 const statePath=`/api/v1/namespaces/cattle-ui-plugin-system/configmaps/${stateName}`;
 async function call(path,init={}){
  const response=await request(prefix+path,{credentials:'same-origin',...init});
  if(!response.ok)throw Object.assign(new Error(`DNS management read/write failed: Kubernetes ${response.status}`),{status:response.status});
  return response.json();
 }
 const sourceApi='/api/v1/namespaces/manager-system/services/http:dns-manager-snapshots:8080/proxy/api/sources/';
 async function sourceContext({signal}={}){
  if(!inventory?.sourceCatalog)throw new Error('The installed source catalog is unavailable.');
  const [catalog,bindings]=await Promise.all([call('/api/v1/namespaces/dns-system/configmaps/dns-manager-sources',{signal}),call('/api/v1/namespaces/dns-system/configmaps/dns-manager-source-bindings',{signal})]);
  for(const [object,name,uid,key] of [[catalog,'dns-manager-sources',inventory.sourceCatalog.uid,'sources.json'],[bindings,'dns-manager-source-bindings',inventory.sourceCatalog.bindingUid,'bindings.json']])if(object.apiVersion!=='v1'||object.kind!=='ConfigMap'||object.metadata?.name!==name||object.metadata.namespace!=='dns-system'||object.metadata.uid!==uid||!object.metadata.resourceVersion||object.metadata.deletionTimestamp||typeof object.data?.[key]!=='string'||Object.keys(object.data).length!==1||Object.keys(object.binaryData||{}).length)throw new Error('Registered source identities changed. Refresh before reviewing source changes.');
  if(bindings.immutable!==true)throw new Error('Registered source bridge declarations are mutable.');
  const text=bindings.data['bindings.json'],hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(v=>v.toString(16).padStart(2,'0')).join('');
  if(hash!==inventory.sourceCatalog.bindingDigest)throw new Error('Registered source bridge declarations changed.');
  return {catalogUid:catalog.metadata.uid,bindingUid:bindings.metadata.uid,bindingDigest:hash,userId,registry:validateDnsSourceBindings(JSON.parse(text)),catalog:validateDnsSourceCatalog(JSON.parse(catalog.data['sources.json']),JSON.parse(text))};
 }
 async function sourceJournalRead(){await saveTail;let object;try{object=await call(statePath);}catch(error){if(error.status!==404)throw error;return{version:1,operations:[]};}sourceJournal=JSON.parse(object.data['source-operations.json']||'{"version":1,"operations":[]}');return structuredClone(sourceJournal);}
 function sourceJournalWrite(value){const pending=saveTail.then(async()=>{const object=await call(statePath);if(object.metadata.resourceVersion!==revision)throw new Error('Source operation references changed in another session. Refresh before continuing.');if(new TextEncoder().encode(JSON.stringify(value)).length>500*1024)throw new Error('Source operation history is full.');object.data['source-operations.json']=JSON.stringify(value);await call(statePath+'?dryRun=All',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(object)});let saved;try{saved=await call(statePath,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(object)});}catch{const observed=await call(statePath);if(observed.metadata.uid!==object.metadata.uid||observed.data['source-operations.json']!==object.data['source-operations.json'])throw new Error('Source journal write is unconfirmed. No source action was submitted.');saved=observed;}revision=saved.metadata.resourceVersion;sourceJournal=structuredClone(value);});saveTail=pending.catch(()=>{});return pending;}
 const sources=dnsSourceClient({userId,getContext:sourceContext,readJournal:sourceJournalRead,writeJournal:sourceJournalWrite,beforeApply:async(reference)=>{await saveTail;const object=await call(statePath),saved=JSON.parse(object.data['state.json']);for(const change of reference.changes){const matches=(saved.drafts||[]).filter(draft=>draft.id===change.id);if(matches.length!==1||JSON.stringify(matches[0].sourceChange)!==JSON.stringify(change))throw new Error('The saved source proposals changed after preparation. Review their original status before continuing.');}},request:async(action,input)=>{const path=action==='backup'||action==='prepare'?action:encodeURIComponent(input.id)+'/'+action;const response=await request(prefix+sourceApi+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(action==='prepare'?input:{})});return {status:response.status,body:await response.json()};}});
 function completedSourceDraft(draft,receipt,registry){const operation=receipt.operations.find(op=>op.draftId===draft.id);if(!operation||draft.kind!=='source'||!draft.sourceChange)return false;try{return JSON.stringify(prepareDnsSourceOperations([draft.sourceChange],{version:1,revision:0,sources:operation.before?[operation.before]:[]},registry).operations[0])===JSON.stringify(operation);}catch{return false;}}
 function finishSourceState(receipt){const pending=saveTail.then(async()=>{const object=await call(statePath),saved=JSON.parse(object.data['state.json']),context=await sourceContext();const remaining=(saved.drafts||[]).filter(draft=>!completedSourceDraft(draft,receipt,context.registry));if(remaining.length===(saved.drafts||[]).length){revision=object.metadata.resourceVersion;state=saved;return;}saved.drafts=remaining;object.data['state.json']=JSON.stringify(saved);let confirmed;try{confirmed=await call(statePath,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(object)});}catch{confirmed=await call(statePath);if(confirmed.metadata.uid!==object.metadata.uid||confirmed.data['state.json']!==object.data['state.json'])throw Object.assign(new Error('The source operation completed; removal of its unchanged proposals is unconfirmed. Read the original status before continuing.'),{receipt,operationId:receipt.id});}revision=confirmed.metadata.resourceVersion;state=JSON.parse(confirmed.data['state.json']);});saveTail=pending.catch(()=>{});return pending;}
 async function confirmNavigation(cm,id){
  cm=structuredClone(cm);
  const value=JSON.parse(cm.data['navigation.json']||'null'),job=value?.processes?.find(p=>p.id===id);
  if(job?.status==='Applied'&&job.receipts?.every(r=>r.readBack))return {cm,receipt:job};
  if(job?.status!=='Running'||job.requestedBy!==userId||job.managerStateUid!==cm.metadata.uid||job.navigationRevision!==value.revision||JSON.stringify(job.operations[0].order)!==JSON.stringify(value.order)||JSON.stringify(JSON.parse(cm.data['state.json']).order)!==JSON.stringify(value.order))throw new Error('Navigation requires reconciliation; its reviewed identity or order differs.');
  const completed={...job,status:'Applied',finishedAt:new Date().toISOString(),receipts:job.receipts.map(r=>({...r,readBack:true}))};
  value.processes=value.processes.map(p=>p.id===id?completed:p);cm.data['navigation.json']=JSON.stringify(value);
  const savedState=JSON.parse(cm.data['state.json']);savedState.drafts=(savedState.drafts||[]).filter(d=>!job.draftIds.includes(d.id));cm.data['state.json']=JSON.stringify(savedState);
  try{await call(statePath,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(cm)});}catch(error){
   // Confirm only the same accepted receipt. Never repeat the order write or
   // assume an interrupted confirmation succeeded.
   const observed=await call(statePath),n=JSON.parse(observed.data['navigation.json']||'null'),saved=n?.processes?.find(p=>p.id===id);
   if(observed.metadata.uid!==cm.metadata.uid||saved?.status!=='Applied'||!saved.receipts.every(r=>r.readBack))throw Object.assign(new Error('Navigation order is persisted but its completion receipt is pending. Refresh Running Processes to reconcile it.'),{jobId:id});
   return {cm:observed,receipt:saved};
  }
  const observed=await call(statePath),saved=JSON.parse(observed.data['navigation.json']).processes.find(p=>p.id===id);
  if(observed.metadata.uid!==cm.metadata.uid||saved?.status!=='Applied'||!saved.receipts.every(r=>r.readBack))throw Object.assign(new Error('Navigation completion readback differs; refresh Running Processes.'),{jobId:id});
  return {cm:observed,receipt:saved};
 }
 return createRancherDataSource({pluginId:'dns-manager',
  async sourceAction({action,...input}){if(action==='backup')return sources.backup();if(action==='prepare')return sources.prepare(input);const receipt=await sources.action({...input,action});if(receipt.status==='Applied')await finishSourceState(receipt);return receipt;},
  async testConnection(settings,{signal}={}){
   const after=Date.now();
   const result=await call('/api/v1/namespaces/manager-system/services/http:dns-manager-snapshots:8080/proxy/api/sources/test-connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(settings),signal});
   return validateDnsSourceTestResult(result,settings,{after});
  },
  async read({signal}){
   const cm=await call('/api/v1/namespaces/dns-system/configmaps/dns-manager-observations',{signal});
   inventory=JSON.parse(cm.data['inventory.json']);
   if(!Array.isArray(inventory.zones)||!inventory.observedAt)throw new Error('DNS controller inventory is not initialized.');
   if(Date.now()-Date.parse(inventory.observedAt)>120000)throw new Error('DNS observations are stale. Check the DNS reconciliation service.');
   const primary=JSON.parse((await call('/api/v1/namespaces/dns-system/configmaps/dns-windows-observations',{signal})).data['inventory.json']);
   if(primary.managementReachable&&Date.now()-Date.parse(primary.observedAt)<120000){
    inventory.records=primary.records;
    inventory.zones=primary.zones.map(z=>({...inventory.zones.find(observed=>observed.name===z.name),...z,replication:inventory.replicas.every(r=>r.reachable&&r.zones?.some(s=>s.zone===z.name&&!s.expired&&String(s.serial)===z.serial))?'Synced':'Catching up'}));
    inventory.source.managementReachable=true;inventory.source.managementObservedAt=primary.observedAt;inventory.inventorySource='Windows management bridge';
   }else inventory.source.managementReachable=false;
   await saveTail;
   try{let saved=await call(statePath,{signal});const pending=JSON.parse(saved.data['navigation.json']||'null')?.processes?.filter(p=>p.status==='Running');if(pending?.length===1){try{saved=(await confirmNavigation(saved,pending[0].id)).cm;}catch{ /* Retain the durable pending operation; inventory remains readable. */ }}state=JSON.parse(saved.data['state.json']);navigation=JSON.parse(saved.data['navigation.json']||'null');revision=saved.metadata.resourceVersion;}catch(e){if(e.status!==404)throw e;state={};navigation=undefined;revision=undefined;}
   inventory.navigation={stateName,order:currentZoneOrder(navigation?.order??state.order,inventory.zones),revision:navigation?.revision||0};state.order=[...inventory.navigation.order];
   inventory.processes=JSON.parse((await call('/api/v1/namespaces/dns-system/configmaps/dns-windows-queue',{signal})).data['jobs.json']);
   inventory.processes.push(...(navigation?.processes||[]));
   if(inventory.sourceCatalog){try{const context=await sourceContext({signal});if(sourceCatalogFingerprint(context.catalog)!==inventory.sourceCatalog.fingerprint)throw new Error('Source catalog activation is pending. Refresh before editing.');inventory.sourceManagement={ready:true,...context};inventory.processes.push(...await sources.processes());}catch(error){inventory.sourceManagement={ready:false,error:error.message};}}
   return {schemaVersion:1,pluginId:'dns-manager',revision:cm.metadata.resourceVersion,updatedAt:inventory.observedAt,source:{kind:'rancher',label:inventory.inventorySource==='Windows management bridge'?'Live Windows DNS inventory':'Live transferred DNS inventory'},data:{inventory,state}};
  },
  saveState(next){
   const pending=saveTail.then(async()=>{
    const cm=revision?await call(statePath):{apiVersion:'v1',kind:'ConfigMap',metadata:{name:stateName,namespace:'cattle-ui-plugin-system'},data:{}};
    if(revision&&cm.metadata.resourceVersion!==revision)throw new Error('DNS manager state changed in another session; refresh before saving.');
    const applied=JSON.parse(cm.data['navigation.json']||'null');
    if(applied)next={...next,order:currentZoneOrder(applied.order,inventory.zones),drafts:(next.drafts||[]).filter(d=>!applied.processes?.some(p=>p.status==='Applied'&&p.draftIds.includes(d.id)))};
    cm.data['state.json']=JSON.stringify(next);
    const saved=await call(revision?statePath:'/api/v1/namespaces/cattle-ui-plugin-system/configmaps',{method:revision?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cm)});
    revision=saved.metadata.resourceVersion;state=next;
   });saveTail=pending.catch(()=>{});return pending;
  },
  async stageChanges({changes,snapshotId}) {
   if(!snapshotId)throw new Error('Save a durable pre-change snapshot before applying.');
   if(changes.some(c=>c.kind==='order'||c.kind==='restore'&&c.configuration?.kind==='DnsNavigation')){
    if(!inventory?.source?.managementReachable)throw new Error('Fresh DNS inventory is required before applying navigation.');
    const remaining=changes.filter(c=>c.kind!=='order'&&!(c.kind==='restore'&&c.configuration?.kind==='DnsNavigation'));
    if(remaining.length&&dnsOperations(remaining,inventory,{allowEmpty:true}).operations.length)throw new Error('Review navigation separately from DNS record and zone mutations. Nothing was applied.');
    await saveTail;
    const current=await call(statePath),previous=JSON.parse(current.data['navigation.json']||'null'),savedState=JSON.parse(current.data['state.json']);
    const order=currentZoneOrder(previous?.order??savedState.order,inventory.zones),proposal=navigationProposal(changes,order,inventory.zones);
    const repeated=previous?.processes?.find(p=>p.draftIds.some(id=>proposal.draftIds.includes(id)));
    if(repeated)throw Object.assign(new Error('This navigation proposal already has a durable receipt. Refresh before attempting it again.'),{receipt:repeated});
    const backup=await call('/api/v1/namespaces/manager-system/services/http:dns-manager-snapshots:8080/proxy/api/snapshots/'+encodeURIComponent(snapshotId));
    validateNavigationBackup(backup,order,stateName);
    if(previous?.processes?.some(p=>p.status==='Running'))throw new Error('A navigation operation requires reconciliation in Running Processes before another change can be applied.');
    const receipt={id:crypto.randomUUID(),kind:'Navigation',status:'Running',managerStateUid:current.metadata.uid,navigationRevision:(previous?.revision||0)+1,requestedBy:userId,createdAt:new Date().toISOString(),finishedAt:null,snapshotId,draftIds:proposal.draftIds,operations:[{operation:'SaveNavigation',name:'Zone Navigation',order:proposal.order}],receipts:[{operation:'SaveNavigation',order:proposal.order,readBack:false,unchanged:proposal.unchanged}],error:''};
    const next={version:1,revision:(previous?.revision||0)+1,order:proposal.order,processes:[...(previous?.processes||[]),receipt]};
    if(new TextEncoder().encode(JSON.stringify(next)).length>500*1024)throw new Error('Navigation history is full. Archive its receipts before applying another change.');
    current.data['navigation.json']=JSON.stringify(next);current.data['state.json']=JSON.stringify({...savedState,order:proposal.order});
    await call(statePath+'?dryRun=All',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(current)});
    let applied;
    try{applied=await call(statePath,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(current)});}catch(error){
     try{const observed=await call(statePath),n=JSON.parse(observed.data['navigation.json']||'null');if(n?.processes.some(p=>p.id===receipt.id)&&JSON.stringify(n.order)===JSON.stringify(next.order))applied=observed;}catch{}
     if(!applied)throw Object.assign(new Error('Navigation submission was not confirmed. Refresh Running Processes before retrying; no write was replayed.'),{jobId:receipt.id});
    }
    let observed;try{observed=await call(statePath);}catch{throw Object.assign(new Error('Navigation was accepted but readback is unavailable. Refresh Running Processes to reconcile the original operation.'),{jobId:receipt.id,receipt});}const confirmed=JSON.parse(observed.data['navigation.json']||'null');
    if(observed.metadata.uid!==current.metadata.uid||!confirmed?.processes.some(p=>p.id===receipt.id)||JSON.stringify(confirmed.order)!==JSON.stringify(next.order))throw Object.assign(new Error('Navigation readback differs; reconcile its durable receipt before retrying.'),{receipt});
    const completion=await confirmNavigation(observed,receipt.id);
    revision=completion.cm.metadata.resourceVersion;state=JSON.parse(completion.cm.data['state.json']);navigation=JSON.parse(completion.cm.data['navigation.json']);inventory.navigation={stateName,order:navigation.order,revision:navigation.revision};return completion.receipt;
   }
   const {operations,serials}=dnsOperations(changes,inventory);
   const path='/api/v1/namespaces/dns-system/configmaps/dns-windows-queue';
   const job={id:crypto.randomUUID(),createdAt:new Date().toISOString(),requestedBy:userId,status:'Queued',snapshotId,draftIds:changes.map(c=>c.id),operations,serials,receipts:[],startedAt:null,finishedAt:null,error:''};
   const cm=await call(path),jobs=JSON.parse(cm.data['jobs.json']);
   if(jobs.filter(j=>['Queued','Running'].includes(j.status)).length>=20)throw new Error('The DNS operation queue is busy.');
   const unresolved=jobs.find(j=>j.requestedBy===userId&&['Queued','Running','Interrupted','PartialFailure'].includes(j.status)&&j.draftIds?.some(id=>job.draftIds.includes(id)));
   if(unresolved)throw new Error(`DNS job ${unresolved.id} requires reconciliation in Running Processes before these proposals can be submitted again.`);
   // Preserve active operations regardless of age. Reject a full queue instead of losing receipts.
   cm.data['jobs.json']=JSON.stringify([...jobs.filter(j=>['Queued','Running','Interrupted','PartialFailure'].includes(j.status)||Date.now()-Date.parse(j.createdAt)<7*86400000),job]);
   if(new TextEncoder().encode(cm.data['jobs.json']).length>750*1024)throw new Error('DNS operation history is full. Archive completed receipts before accepting more operations.');
   try{await call(path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(cm)});}catch(error){
    // An interrupted response does not prove rejection. Check the original job ID; never replay the write.
    let accepted;try{accepted=JSON.parse((await call(path)).data['jobs.json']).some(j=>j.id===job.id);}catch{}
    if(!accepted)throw Object.assign(new Error(`DNS job ${job.id} submission was not confirmed. Refresh Running Processes before retrying. ${error.message}`),{jobId:job.id});
   }
   const deadline=Date.now()+180000;
   while(Date.now()<deadline){
    const result=JSON.parse((await call(path)).data['jobs.json']).find(j=>j.id===job.id);
    if(result?.status==='Applied'){
     const zoneReceipts=result.receipts.filter(r=>r.operation?.endsWith('Zone'));
     if(!zoneReceipts.length)return result;
     const observed=JSON.parse((await call('/api/v1/namespaces/dns-system/configmaps/dns-manager-observations')).data['inventory.json']);
     if(Date.now()-Date.parse(observed.observedAt)<120000){
      for(const receipt of zoneReceipts){const reports=observed.zoneLifecycle?.filter(r=>r.zone===receipt.zone&&r.ownerId===receipt.ownerId)||[];const failed=reports.find(r=>r.status==='NeedsReview');if(failed)throw Object.assign(new Error(`Windows applied the zone change; replica ${failed.replica} requires reconciliation: ${failed.error}`),{receipt:result});}
      const parents=Object.fromEntries(zoneReceipts.filter(r=>r.parentZone).map(r=>[r.parentZone,r.parentSerial]));
      if(zoneReceipts.every(receipt=>[0,1,2].every(replica=>observed.zoneLifecycle?.some(r=>r.replica===replica&&r.zone===receipt.zone&&r.ownerId===receipt.ownerId&&r.readBack&&r.status===(receipt.operation==='DeleteZone'?'Absent':'Present')))&&(receipt.operation==='DeleteZone'||observed.zones.some(z=>z.name===receipt.zone&&z.ownerId===receipt.ownerId&&z.replication==='Synced')))&&Object.entries(parents).every(([name,serial])=>observed.zones.some(z=>z.name===name&&z.serial===serial&&z.replication==='Synced')))return {...result,replicationVerified:true};
     }
    }
    if(['Rejected','PartialFailure','Interrupted'].includes(result?.status))throw Object.assign(new Error(result.error||'DNS operation failed; refresh inventory before retrying.'),{receipt:result});await new Promise(r=>setTimeout(r,1000));
   }
   throw new Error(`DNS job ${job.id} is still pending. Check Running Processes before retrying; no job was resubmitted.`);
  }
 });
}
