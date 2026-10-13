import {dnsSourceAddress,dnsSourceDomain} from './dns-source-settings.mjs';
const fail=(message,code='SOURCE_CATALOG_REJECTED')=>Object.assign(new Error(message),{code,status:409});
const slug=value=>typeof value==='string'&&/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value)&&!['constructor','prototype'].includes(value);
const uuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value||'');
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>keys.includes(k));
const text=(value,size)=>typeof value==='string'&&value.trim()&&value.length<=size&&!/[\x00-\x1f\x7f]/.test(value);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function validateDnsSourceBindings(document){
 if(!exact(document,['version','bindings'])||document.version!==1||!Array.isArray(document.bindings)||!document.bindings.length||document.bindings.length>32)throw fail('Installed source bindings are unavailable.','SOURCE_BINDINGS_UNAVAILABLE');
 const ids=new Set(),agents=new Set();const bindings=document.bindings.map(value=>{
  if(!exact(value,['id','host','address','credential','namespace','observationName','observationUid','queueName','queueUid','accountUid','sourceDigest','writable'])||!slug(value.id)||!slug(value.namespace)||!slug(value.observationName)||!slug(value.queueName)||!uuid(value.observationUid)||!uuid(value.queueUid)||!uuid(value.accountUid)||!/^[a-f0-9]{64}$/.test(value.sourceDigest||'')||!text(value.credential,256)||typeof value.writable!=='boolean'||ids.has(value.id))throw fail('An installed source binding is incomplete or duplicated.','SOURCE_BINDINGS_UNAVAILABLE');
  let host,address;try{host=dnsSourceDomain(value.host);address=dnsSourceAddress(value.address);}catch{throw fail('An installed source endpoint is invalid.','SOURCE_BINDINGS_UNAVAILABLE');}
  const agent=`${value.namespace}/${value.observationName}/${value.queueName}`;if(agents.has(agent))throw fail('Distinct source bindings must identify distinct bridge channels.','SOURCE_BINDINGS_UNAVAILABLE');ids.add(value.id);agents.add(agent);
  return {...value,host,address,credential:value.credential.trim()};
 });return {version:1,bindings};
}
function source(value,bindings){
 if(!exact(value,['id','name','type','host','address','credential','bindingId','revision'])||!slug(value.id)||!text(value.name,128)||value.type!=='Windows Domain Controller'||!text(value.credential,256)||!slug(value.bindingId)||!Number.isSafeInteger(value.revision)||value.revision<1)throw fail('A source configuration is incomplete or incompatible.');
 let host,address;try{host=dnsSourceDomain(value.host);address=dnsSourceAddress(value.address);}catch{throw fail('Use a valid controller hostname and literal private DNS address.');}
 const binding=bindings.find(b=>b.id===value.bindingId);if(!binding||binding.host!==host||binding.address!==address||binding.credential!==value.credential.trim())throw fail('The entered source requires a matching registered Windows bridge.','SOURCE_BINDING_UNAVAILABLE');
 return {id:value.id,name:value.name.trim(),type:value.type,host,address,credential:value.credential.trim(),bindingId:value.bindingId,revision:value.revision};
}
export function validateDnsSourceCatalog(document,registry){
 const bindings=validateDnsSourceBindings(registry).bindings;
 if(!exact(document,['version','revision','sources'])||document.version!==1||!Number.isSafeInteger(document.revision)||document.revision<0||!Array.isArray(document.sources)||document.sources.length>32)throw fail('Source configuration is unavailable or incompatible.');
 const sources=document.sources.map(value=>source(value,bindings)),ids=new Set(),names=new Set(),owners=new Set();for(const value of sources){const name=value.name.toLowerCase();if(ids.has(value.id)||names.has(name)||owners.has(value.bindingId))throw fail('Source IDs, names and registered bridge bindings must be distinct.');ids.add(value.id);names.add(name);owners.add(value.bindingId);}
 return {version:1,revision:document.revision,sources};
}
export const sourceQualifiedZoneId=(sourceId,zone)=>{if(!slug(sourceId))throw fail('Invalid zone source identity.');return `source/${sourceId}/zone/${dnsSourceDomain(zone,{allowUnderscore:true})}`;};
export function sourceCatalogFingerprint(catalog){return JSON.stringify({version:catalog.version,revision:catalog.revision,sources:catalog.sources});}
// Editable source settings refer to separately installed, immutable bridge
// identities. Neither a source draft nor a backup can introduce an API path,
// account, queue, host credential, TLS override or executable configuration.
export function prepareDnsSourceOperations(changes,catalog,registry,{dependencies=[]}={}){
 const current=validateDnsSourceCatalog(catalog,registry);if(!Array.isArray(changes)||!changes.length||changes.length>32||!Array.isArray(dependencies))throw fail('Choose one to thirty-two source changes.');
 const next=structuredClone(current),operations=[],targets=new Set(),drafts=new Set();const bindingList=validateDnsSourceBindings(registry).bindings;
 for(const change of changes){
  if(!exact(change,['id','operation','sourceId','value','expected'])||!uuid(change.id)||!['Create','Update','Delete','Restore'].includes(change.operation)||!slug(change.sourceId)||drafts.has(change.id)||targets.has(change.sourceId))throw fail('Each reviewed draft and source target must be distinct.');drafts.add(change.id);targets.add(change.sourceId);
  const index=next.sources.findIndex(s=>s.id===change.sourceId),before=next.sources[index],creation=change.operation==='Create'||change.operation==='Restore'&&!before;
  if(creation){if(before||change.expected!==null)throw fail('The proposed source already exists or its expected absence changed.');}
  else if(!before||!same(source(change.expected,bindingList),before))throw fail('The reviewed source changed. Refresh and review again.','SOURCE_REVIEW_STALE');
  const active=dependencies.filter(d=>d?.sourceId===change.sourceId&&['PublishedZone','QueuedOperation','RunningOperation','PendingProposal'].includes(d.kind));
  if(change.operation==='Delete'){
   if(change.value!==null)throw fail('Source deletion cannot supply replacement settings.');if(active.length)throw fail('This source still has published zones or pending operations. Review those dependencies before removing it.','SOURCE_IN_USE');next.sources.splice(index,1);operations.push({operation:'DeleteSource',sourceId:before.id,bindingId:before.bindingId,name:before.name,before,after:null,draftId:change.id});continue;
  }
  if(!exact(change.value,['id','name','type','host','address','credential','bindingId'])||change.value.id!==change.sourceId)throw fail('Source settings must match the reviewed target identity.');
  const after=source({...change.value,revision:creation?1:before.revision+1},bindingList);
  if(before&&before.bindingId!==after.bindingId&&active.length)throw fail('Move published zones and pending operations before changing a source bridge binding.','SOURCE_IN_USE');
  if(next.sources.some(s=>s.id!==after.id&&(s.name.toLowerCase()===after.name.toLowerCase()||s.bindingId===after.bindingId)))throw fail('Another source already uses that name or registered bridge.');
  if(creation)next.sources.push(after);else next.sources[index]=after;
  operations.push({operation:creation?'CreateSource':'UpdateSource',sourceId:after.id,bindingId:after.bindingId,name:after.name,before:before||null,after,draftId:change.id});
 }
 next.revision=current.revision+1;validateDnsSourceCatalog(next,registry);return {before:current,next,operations,draftIds:[...drafts]};
}
export function verifyDnsSourceOperations(operations,catalog,registry){const current=validateDnsSourceCatalog(catalog,registry);for(const op of operations){const actual=current.sources.find(s=>s.id===op.sourceId);if(op.operation==='DeleteSource'?actual!==undefined:!same(actual,op.after))throw fail('Source configuration readback differs from the original operation.','SOURCE_READBACK_UNCONFIRMED');}return true;}
export function sourceDependencies({zones=[],processes=[],proposals=[]}={}){
 const dependencies=[];for(const z of zones)if(z.sourceId&&z.published===true)dependencies.push({kind:'PublishedZone',sourceId:z.sourceId,name:z.name});
 for(const p of processes)if(['Queued','Running','Interrupted','PartialFailure'].includes(p.status))for(const id of new Set([p.sourceId,...(p.operations||[]).map(o=>o.sourceId)].filter(Boolean)))dependencies.push({kind:p.status==='Queued'?'QueuedOperation':'RunningOperation',sourceId:id,id:p.id});
 for(const p of proposals)if(p.sourceId)dependencies.push({kind:'PendingProposal',sourceId:p.sourceId,id:p.id});return dependencies;
}
