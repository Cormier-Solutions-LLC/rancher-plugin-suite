import {validateDnsSourceCatalog} from './dns-source-catalog.mjs';import {dnsSourceDomain,dnsUdpSoa,dnsTcpAxfr} from './dns-source-wire.mjs';
const fail=()=>Object.assign(new Error('The registered Windows source connection is unconfirmed.'),{status:409,code:'SOURCE_CONNECTION_UNCONFIRMED'});
const fresh=(at,now)=>Number.isFinite(Date.parse(at))&&now-Date.parse(at)<120000&&Date.parse(at)<=now+5000;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export function sourceObservationFingerprint(inventory){return JSON.stringify({zones:inventory.zones.map(canonical).sort((a,b)=>a.name.localeCompare(b.name)),records:Object.fromEntries(Object.keys(inventory.records).sort().map(zone=>[zone,inventory.records[zone].map(record=>JSON.stringify(canonical(record))).sort()]))});}
function observation(object,binding,now){
 if(object?.apiVersion!=='v1'||object.kind!=='ConfigMap'||object.metadata?.namespace!==binding.namespace||object.metadata.name!==binding.observationName||object.metadata.uid!==binding.observationUid||!object.metadata.resourceVersion||object.metadata.deletionTimestamp)throw fail();
 let state;try{state=JSON.parse(object.data['inventory.json']);}catch{throw fail();}
 if(!fresh(state.observedAt,now)||state.managementReachable!==true||state.credentialRecoveryGuard?.version!==1||state.credentialRecoveryGuard.sourceDigest!==binding.sourceDigest||dnsSourceDomain(state.host)!==binding.host||!Array.isArray(state.zones)||!state.zones.length||state.zones.length>1024||!state.records||typeof state.records!=='object'||Array.isArray(state.records))throw fail();
 const names=new Set();let rows=0;for(const zone of state.zones){const name=dnsSourceDomain(zone?.name,{allowUnderscore:true});if(name!==zone.name||zone.id!==name||names.has(name)||!/^\d{1,10}$/.test(String(zone.serial))||Number(zone.serial)>4294967295||!Array.isArray(state.records[name]))throw fail();names.add(name);for(const record of state.records[name])if(++rows>20000||!record||typeof record.name!=='string'||typeof record.type!=='string'||typeof record.value!=='string'||!Number.isSafeInteger(record.ttl)||record.ttl<0||record.ttl>2147483647)throw fail();}if(Object.keys(state.records).some(zone=>!names.has(zone)))throw fail();return state;
}
export async function verifyRegisteredDnsSource(source,{session,registry,query=dnsUdpSoa,transfer=dnsTcpAxfr,now=Date.now}={}){
 try{
  const normalized=validateDnsSourceCatalog({version:1,revision:0,sources:[source]},registry).sources[0],binding=registry.bindings.find(b=>b.id===normalized.bindingId),deadline=now()+20000,within=()=>{if(now()>=deadline)throw fail();};
  const initial=observation(await session.readObservation(binding.id),binding,now()),zones=[];
  for(const zone of initial.zones){within();const answer=await query(binding.address,zone.name,{timeoutMs:Math.min(4000,deadline-now())});if(answer?.authoritative!==true||answer.serial!==Number(zone.serial))throw fail();within();const axfr=await transfer(binding.address,zone.name,{timeoutMs:Math.min(6000,deadline-now())});if(axfr?.complete!==true||axfr.serial!==answer.serial||!Number.isInteger(axfr.records)||axfr.records<2||axfr.records>20000||!Number.isInteger(axfr.frames)||axfr.frames<1)throw fail();zones.push({name:zone.name,serial:answer.serial,records:axfr.records,frames:axfr.frames});}
  within();const current=observation(await session.readObservation(binding.id),binding,now());within();if(sourceObservationFingerprint(initial)!==sourceObservationFingerprint(current))throw fail();return{confirmed:true,observedAt:current.observedAt,zones};
 }catch(error){if(error.status===401||error.status===403)throw error;throw fail();}
}
