import {createHash} from 'node:crypto';
import {validateDnsSourceBindings,validateDnsSourceCatalog,sourceCatalogFingerprint,sourceQualifiedZoneId} from './dns-source-catalog.mjs';
import {dnsSourceDomain,dnsUdpSoa} from './dns-source-wire.mjs';

const failure=(code='SOURCE_OBSERVATION_UNCONFIRMED')=>Object.assign(new Error('Registered source observations are unavailable or changed during verification.'),{code,status:503});
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v||'');
const fresh=(at,now)=>Number.isFinite(Date.parse(at))&&now-Date.parse(at)<120000&&Date.parse(at)<=now+5000;
const digest=value=>createHash('sha256').update(value).digest('hex');
const configPath=name=>`/api/v1/namespaces/dns-system/configmaps/${name}`;
function map(object,namespace,name,uid){
 if(object?.apiVersion!=='v1'||object.kind!=='ConfigMap'||object.metadata?.namespace!==namespace||object.metadata.name!==name||object.metadata.uid!==uid||!object.metadata.resourceVersion||object.metadata.deletionTimestamp)throw failure('SOURCE_IDENTITY_CHANGED');
 return object;
}
function documents(catalog,registry,pins){
 map(catalog,'dns-system','dns-manager-sources',pins.catalogUid);map(registry,'dns-system','dns-manager-source-bindings',pins.bindingUid);
 if(registry.immutable!==true||digest(registry.data?.['bindings.json']||'')!==pins.bindingDigest)throw failure('SOURCE_BINDINGS_CHANGED');
 let bindings,configuration;try{bindings=validateDnsSourceBindings(JSON.parse(registry.data['bindings.json']));configuration=validateDnsSourceCatalog(JSON.parse(catalog.data['sources.json']),bindings);}catch{throw failure('SOURCE_CONFIGURATION_INVALID');}
 const operationId=catalog.metadata.annotations?.['dns-manager.cormierconsulting.io/source-operation']||null;if(operationId!==null&&!uuid(operationId))throw failure('SOURCE_OPERATION_INVALID');
 return {bindings,configuration,operationId};
}
function bridgeInventory(object,binding,now){
 map(object,binding.namespace,binding.observationName,binding.observationUid);
 let inventory;try{inventory=JSON.parse(object.data['inventory.json']);}catch{throw failure();}
 if(!fresh(inventory.observedAt,now)||inventory.managementReachable!==true||inventory.credentialRecoveryGuard?.version!==1||inventory.credentialRecoveryGuard.sourceDigest!==binding.sourceDigest||dnsSourceDomain(inventory.host)!==binding.host||!Array.isArray(inventory.zones)||inventory.zones.length>1024||!inventory.records||typeof inventory.records!=='object'||Array.isArray(inventory.records))throw failure();
 const names=new Set();let recordCount=0;
 for(const zone of inventory.zones){
  const name=dnsSourceDomain(zone?.name,{allowUnderscore:true});
  if(name!==zone.name||zone.id!==name||names.has(name)||!['Forward','Reverse','AD'].includes(zone.kind)||!/^\d{1,10}$/.test(String(zone.serial))||Number(zone.serial)>4294967295||!Array.isArray(inventory.records[zone.id]))throw failure();names.add(name);
  for(const record of inventory.records[zone.id]){if(++recordCount>20000||!record||typeof record.name!=='string'||record.name.length>253||!/^\w{1,20}$/.test(record.type||'')||typeof record.value!=='string'||record.value.length>8192||!Number.isSafeInteger(record.ttl)||record.ttl<0||record.ttl>2147483647||[record.name,record.value].some(v=>/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v)))throw failure();}
 }
 if(Object.keys(inventory.records).some(name=>!names.has(name)))throw failure();
 return inventory;
}

// Runs under the installed controller's named read permissions. The immutable
// registry and catalog UIDs are pinned by deployment, never by a source draft.
// This observer performs no catalog, DNS, queue, credential or replica writes.
export function dnsSourceObserver({read,query=dnsUdpSoa,now=Date.now,pins,publishedSources=[]}={}){
 if(typeof read!=='function'||!uuid(pins?.catalogUid)||!uuid(pins?.bindingUid)||!/^[a-f0-9]{64}$/.test(pins.bindingDigest||'')||!Array.isArray(publishedSources)||new Set(publishedSources).size!==publishedSources.length)throw failure('SOURCE_OBSERVER_UNAVAILABLE');
 return async()=>{
  const [catalog,registry]=await Promise.all([read(configPath('dns-manager-sources')),read(configPath('dns-manager-source-bindings'))]);
  const initial=documents(catalog,registry,pins),sources=[],zones=[],records={},observations=new Map(),deadline=now()+20000;
  const withinDeadline=()=>{if(now()>=deadline)throw failure('SOURCE_OBSERVER_DEADLINE');};
  // Bound concurrency: at most two sources and eight DNS probes at a time;
  // the complete observation has a twenty-second deadline.
  async function observe(source){
   const binding=initial.bindings.bindings.find(b=>b.id===source.bindingId),path=`/api/v1/namespaces/${binding.namespace}/configmaps/${binding.observationName}`;
   const state={...source,managementReachable:false,dnsReachable:false,managementObservedAt:null,connectionCatalogRevision:null,writable:binding.writable,zoneCount:0};
   try{
    withinDeadline();const object=await read(path),inventory=bridgeInventory(object,binding,now());
    const serials={};for(let at=0;at<inventory.zones.length;at+=4){withinDeadline();await Promise.all(inventory.zones.slice(at,at+4).map(async zone=>{try{withinDeadline();const result=await query(binding.address,zone.name,{timeoutMs:Math.min(2000,deadline-now())});serials[zone.name]=result?.authoritative===true&&Number.isInteger(result.serial)&&result.serial===Number(zone.serial);}catch{serials[zone.name]=false;}}));}
    // DNS results are meaningful only while this same pinned management agent
    // still reports the same zone revisions after those probes.
    withinDeadline();const latest=bridgeInventory(await read(path),binding,now());
    if(JSON.stringify(latest.zones)!==JSON.stringify(inventory.zones)||JSON.stringify(latest.records)!==JSON.stringify(inventory.records))throw failure('SOURCE_CHANGED_DURING_PROBE');
    state.managementReachable=true;state.managementObservedAt=latest.observedAt;state.dnsReachable=latest.zones.length>0&&latest.zones.every(z=>serials[z.name]===true);state.zoneCount=latest.zones.length;
    if(state.dnsReachable)state.connectionCatalogRevision=initial.configuration.revision;
    observations.set(source.id,latest);
    for(const zone of latest.zones){const id=sourceQualifiedZoneId(source.id,zone.name);zones.push({...zone,id,sourceId:source.id,bindingId:binding.id,published:publishedSources.includes(source.id),dnsVerified:serials[zone.name]===true});records[id]=structuredClone(latest.records[zone.id]);}
   }catch(error){state.errorCode=['SOURCE_IDENTITY_CHANGED','SOURCE_CHANGED_DURING_PROBE'].includes(error.code)?error.code:'SOURCE_OBSERVATION_UNCONFIRMED';}
   sources.push(state);
  }
  for(let at=0;at<initial.configuration.sources.length;at+=2)await Promise.all(initial.configuration.sources.slice(at,at+2).map(observe));
  withinDeadline();const [lastCatalog,lastRegistry]=await Promise.all([read(configPath('dns-manager-sources')),read(configPath('dns-manager-source-bindings'))]),last=documents(lastCatalog,lastRegistry,pins);withinDeadline();
  if(sourceCatalogFingerprint(last.configuration)!==sourceCatalogFingerprint(initial.configuration)||last.operationId!==initial.operationId)throw failure('SOURCE_CATALOG_CHANGED_DURING_PROBE');
  sources.sort((a,b)=>initial.configuration.sources.findIndex(s=>s.id===a.id)-initial.configuration.sources.findIndex(s=>s.id===b.id));zones.sort((a,b)=>a.id.localeCompare(b.id));
  return {observedAt:new Date(now()).toISOString(),sourceCatalog:{uid:pins.catalogUid,bindingUid:pins.bindingUid,bindingDigest:pins.bindingDigest,revision:initial.configuration.revision,fingerprint:sourceCatalogFingerprint(initial.configuration),operationId:initial.operationId},sources,zones,records,observations};
 };
}
