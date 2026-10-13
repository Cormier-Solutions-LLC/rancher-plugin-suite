import {isDeepStrictEqual} from 'node:util';import {validateDnsSourceCatalog,sourceCatalogFingerprint,sourceDependencies,prepareDnsSourceOperations} from './dns-source-catalog.mjs';
const fail=()=>Object.assign(new Error('Current source ownership, queue or pending proposals could not be confirmed.'),{status:409,code:'SOURCE_DEPENDENCIES_UNCONFIRMED'});
const fresh=(at,now)=>Number.isFinite(Date.parse(at))&&now-Date.parse(at)<120000&&Date.parse(at)<=now+5000;
// Reads are supplied by the authenticated caller session, never pod identity.
// Only the exact selected proposal of this caller is excluded from deletion
// dependencies. Another user's proposal or a changed draft remains a blocker.
export async function readDnsSourceDependencies({session,catalog,registry,pins,changes=[],now=Date.now()}={}){
 try{
  catalog=validateDnsSourceCatalog(catalog,registry);if(!session?.readController||!session.readSourceProposals||!session.readQueue||!session.readCatalog||!Array.isArray(changes))throw fail();
  const object=await session.readController(),observation=JSON.parse(object.data['inventory.json']),proof=observation.sourceCatalog;
  if(object.metadata.uid!==pins.controllerUid||!fresh(observation.observedAt,now)||proof?.uid!==pins.catalogUid||proof.bindingUid!==pins.bindingUid||proof.bindingDigest!==pins.bindingDigest||proof.revision!==catalog.revision||proof.fingerprint!==sourceCatalogFingerprint(catalog)||!Array.isArray(observation.zones)||!Array.isArray(observation.sources)||observation.sources.length!==catalog.sources.length||catalog.sources.some(s=>!observation.sources.some(o=>o.id===s.id&&o.bindingId===s.bindingId&&o.revision===s.revision)))throw fail();
  const known=new Set(catalog.sources.map(s=>s.id));if(observation.zones.some(z=>typeof z.published!=='boolean'||z.published&&(!known.has(z.sourceId)||!z.name)))throw fail();
  const processes=[];for(const binding of registry.bindings){const queue=await session.readQueue(binding.id);if(queue.metadata.uid!==binding.queueUid)throw fail();const jobs=JSON.parse(queue.data['jobs.json']);if(!Array.isArray(jobs)||jobs.length>1000)throw fail();const owner=catalog.sources.find(s=>s.bindingId===binding.id);
   for(const job of jobs.filter(j=>['Queued','Running','Interrupted','PartialFailure'].includes(j.status))){if(!owner||job.sourceId&&job.sourceId!==owner.id||(job.operations||[]).some(op=>op.sourceId&&op.sourceId!==owner.id))throw fail();processes.push({...job,sourceId:owner.id});}
  }
  const proposals=[];for(const state of await session.readSourceProposals()){
   if(!/^user-[a-z0-9-]+$/.test(state.ownerId||'')||!Array.isArray(state.drafts))throw fail();
   for(const draft of state.drafts){
    const change=draft.sourceChange;if(change){if(draft.kind!=='source'||draft.id!==change.id)throw fail();prepareDnsSourceOperations([change],{version:1,revision:0,sources:change.expected?[change.expected]:[]},registry);if(state.ownerId===session.userId&&changes.some(selected=>isDeepStrictEqual(selected,change)))continue;const targets=new Set([change.sourceId]);for(const bindingId of [change.expected?.bindingId,change.value?.bindingId].filter(Boolean)){const owner=catalog.sources.find(source=>source.bindingId===bindingId);if(owner)targets.add(owner.id);}for(const sourceId of targets)proposals.push({id:draft.id,sourceId});}
    else if(draft.sourceId){if(!known.has(draft.sourceId))throw fail();proposals.push({id:draft.id,sourceId:draft.sourceId});}
    else if(draft.kind==='source'||draft.kind==='delete'&&(draft.zone==='sources'||draft.name==='sources')||draft.kind==='restore'&&draft.configuration?.kind==='DnsSource'){
     // Legacy unqualified proposals cannot silently lose their dependency
     // when native source editing gains distinct source identities.
     if(!catalog.sources.length)throw fail();for(const source of catalog.sources)proposals.push({id:draft.id,sourceId:source.id});
    }else if(['record','zone','order','delete'].includes(draft.kind)||draft.kind==='restore'&&['DnsZone','DnsNavigation'].includes(draft.configuration?.kind)){if(!known.has(observation.source?.id))throw fail();proposals.push({id:draft.id,sourceId:observation.source.id});}
   }
  }
  const latest=await session.readCatalog();if(latest.metadata.uid!==pins.catalogUid||sourceCatalogFingerprint(validateDnsSourceCatalog(JSON.parse(latest.data['sources.json']),registry))!==sourceCatalogFingerprint(catalog)||proof.operationId!==(latest.metadata.annotations?.['dns-manager.cormierconsulting.io/source-operation']||null))throw fail();
  return {confirmed:true,items:sourceDependencies({zones:observation.zones,processes,proposals})};
 }catch(error){if(error.status===403||error.status===401)throw error;throw fail();}
}
