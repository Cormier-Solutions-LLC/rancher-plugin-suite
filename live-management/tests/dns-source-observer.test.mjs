import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import {dnsSourceObserver} from '../dns-source-observer.mjs';import {confirmedSourceActivation} from '../dns-source-activation.mjs';

function fixture(count=1){
 const now=Date.now(),operationId=randomUUID(),catalogUid=randomUUID(),bindingUid=randomUUID(),bindings=[],sources=[],maps=new Map(),calls=[],probes=[];
 const map=(name,uid,data,namespace='dns-system')=>({apiVersion:'v1',kind:'ConfigMap',metadata:{name,namespace,uid,resourceVersion:'1'},data});
 for(let i=0;i<count;i++){
  const id=`dc-${i}`,host=`${id}.example.test`,address=`10.99.3.${2+i}`,source={id:`source-${i}`,name:`Source ${i}`,type:'Windows Domain Controller',host,address,credential:`Registered ${id}`,bindingId:id,revision:1};
  const binding={id,host,address,credential:source.credential,namespace:'dns-system',observationName:id+'-observations',observationUid:randomUUID(),queueName:id+'-queue',queueUid:randomUUID(),accountUid:randomUUID(),sourceDigest:'a'.repeat(64),writable:i===0};sources.push(source);bindings.push(binding);
  const inventory={host,observedAt:new Date(now).toISOString(),managementReachable:true,credentialRecoveryGuard:{version:1,sourceDigest:binding.sourceDigest},zones:[{id:'example.test',name:'example.test',kind:'Forward',serial:'7'}],records:{'example.test':[{name:'@',type:'SOA',value:host,ttl:300}]}};
  maps.set(`/api/v1/namespaces/dns-system/configmaps/${binding.observationName}`,map(binding.observationName,binding.observationUid,{'inventory.json':JSON.stringify(inventory)}));
 }
 const catalog={version:1,revision:1,sources},registry={version:1,bindings},catalogMap=map('dns-manager-sources',catalogUid,{'sources.json':JSON.stringify(catalog)});catalogMap.metadata.annotations={'dns-manager.cormierconsulting.io/source-operation':operationId};
 const registryMap=map('dns-manager-source-bindings',bindingUid,{'bindings.json':JSON.stringify(registry)});registryMap.immutable=true;
 maps.set('/api/v1/namespaces/dns-system/configmaps/dns-manager-sources',catalogMap);maps.set('/api/v1/namespaces/dns-system/configmaps/dns-manager-source-bindings',registryMap);
 const pins={catalogUid,bindingUid,bindingDigest:createHash('sha256').update(registryMap.data['bindings.json']).digest('hex')};
 let tick=now,readHook,queryHook;
 const options={pins,publishedSources:['source-0'],now:()=>tick,async read(path){calls.push(path);if(readHook)await readHook(path);if(!maps.has(path))throw Error('Missing');return structuredClone(maps.get(path));},async query(address,zone,options){probes.push({address,zone,options});if(queryHook)return queryHook(address,zone,options);return {serial:7,authoritative:true};}};
 return {now,operationId,catalog,registry,maps,pins,options,calls,probes,advance:ms=>tick+=ms,readHook:fn=>readHook=fn,queryHook:fn=>queryHook=fn,inventory(index,mutate){const path=`/api/v1/namespaces/dns-system/configmaps/dc-${index}-observations`,object=maps.get(path),value=JSON.parse(object.data['inventory.json']);mutate(value,object);object.data['inventory.json']=JSON.stringify(value);},catalogMap,registryMap,transaction:{id:operationId,...pins,next:catalog,operations:sources.map(s=>({operation:'UpdateSource',sourceId:s.id}))}};
}

test('independent observations verify registered sources, consume the original operation and distinguish identical zone names without publishing shadow sources',async()=>{
 const f=fixture(2),before=JSON.stringify([...f.maps]),result=await dnsSourceObserver(f.options)();
 assert.equal(result.sources.length,2);assert.ok(result.sources.every(s=>s.managementReachable&&s.dnsReachable&&s.connectionCatalogRevision===1));assert.ok(confirmedSourceActivation(result,f.transaction,{now:f.now}));
 assert.deepEqual(result.zones.map(z=>({id:z.id,published:z.published})),[{id:'source/source-0/zone/example.test',published:true},{id:'source/source-1/zone/example.test',published:false}]);
 assert.equal(Object.keys(result.records).length,2);assert.deepEqual(f.probes.map(p=>p.address),['10.99.3.2','10.99.3.3']);assert.equal(JSON.stringify([...f.maps]),before);assert.equal(result.observations.get('source-1').host,'dc-1.example.test');
 assert.ok(f.calls.every(path=>path.includes('/configmaps/')));assert.ok(!JSON.stringify(result).includes('password'));
});
test('no unpinned, mutable, changed or malformed catalog/registry can produce activation',async()=>{
 assert.throws(()=>dnsSourceObserver({read:async()=>{}}));
 for(const mutate of [f=>f.catalogMap.metadata.uid=randomUUID(),f=>f.registryMap.metadata.uid=randomUUID(),f=>f.registryMap.immutable=false,f=>f.registryMap.data['bindings.json']='{}',f=>f.catalogMap.metadata.deletionTimestamp=new Date().toISOString(),f=>f.catalogMap.metadata.annotations['dns-manager.cormierconsulting.io/source-operation']='foreign',f=>f.catalogMap.data['sources.json']='{}']){const f=fixture();mutate(f);await assert.rejects(dnsSourceObserver(f.options)());assert.equal(f.probes.length,0);}
});
test('stale, future, wrong host, code digest, identity, serial and record evidence fail closed per source',async()=>{
 for(const mutate of [(v,o)=>o.metadata.uid=randomUUID(),v=>v.observedAt=new Date(Date.now()-120001).toISOString(),v=>v.observedAt=new Date(Date.now()+6000).toISOString(),v=>v.host='foreign.example.test',v=>v.credentialRecoveryGuard.sourceDigest='b'.repeat(64),v=>v.managementReachable=false,v=>v.zones[0].serial='4294967296',v=>v.zones.push({...v.zones[0]}),v=>v.records['example.test'][0].ttl=-1,v=>v.records['foreign.test']=[],v=>v.records['example.test'][0].value='\u0000Bad']){
  const f=fixture();f.inventory(0,mutate);const result=await dnsSourceObserver(f.options)();assert.equal(result.sources[0].managementReachable,false);assert.equal(result.sources[0].dnsReachable,false);assert.equal(result.sources[0].connectionCatalogRevision,null);assert.equal(result.zones.length,0);assert.equal(f.probes.length,0);assert.equal(confirmedSourceActivation(result,f.transaction,{now:f.now}),false);
 }
});
test('DNS refusal, non-authoritative replies and different serials preserve management inventory without confirming activation',async()=>{
 for(const result of ['error',{authoritative:false,serial:7},{authoritative:true,serial:8},{authoritative:true,serial:'7'}]){const f=fixture();f.queryHook(async()=>{if(result==='error')throw Error('Refused');return result;});const actual=await dnsSourceObserver(f.options)();assert.equal(actual.sources[0].managementReachable,true);assert.equal(actual.sources[0].dnsReachable,false);assert.equal(actual.sources[0].connectionCatalogRevision,null);assert.equal(actual.zones[0].dnsVerified,false);assert.equal(confirmedSourceActivation(actual,f.transaction,{now:f.now}),false);}
});
test('a management revision or pinned agent replacement during probes cannot be adopted as the reviewed source',async()=>{
 for(const mutation of [(v,o)=>o.metadata.uid=randomUUID(),v=>v.zones[0].serial='8',v=>v.records['example.test'][0].ttl=400]){const f=fixture();f.queryHook(async()=>{f.inventory(0,mutation);return {authoritative:true,serial:7};});const result=await dnsSourceObserver(f.options)();assert.equal(result.sources[0].managementReachable,false);assert.equal(result.zones.length,0);assert.equal(confirmedSourceActivation(result,f.transaction,{now:f.now}),false);}
});
test('a concurrent catalog edit, original marker change or registry replacement invalidates the whole observation',async()=>{
 for(const mutate of [f=>{const value=JSON.parse(f.catalogMap.data['sources.json']);value.revision++;f.catalogMap.data['sources.json']=JSON.stringify(value);},f=>f.catalogMap.metadata.annotations['dns-manager.cormierconsulting.io/source-operation']=randomUUID(),f=>f.registryMap.metadata.uid=randomUUID()]){const f=fixture();f.queryHook(async()=>{mutate(f);return {authoritative:true,serial:7};});await assert.rejects(dnsSourceObserver(f.options)());}
});
test('offline source evidence cannot borrow another registered channel and probe deadlines stop the entire cycle',async()=>{
 const f=fixture(2);f.maps.delete('/api/v1/namespaces/dns-system/configmaps/dc-1-observations');const result=await dnsSourceObserver(f.options)();assert.equal(result.sources[0].managementReachable,true);assert.equal(result.sources[1].managementReachable,false);assert.equal(result.zones.length,1);assert.deepEqual(f.probes.map(p=>p.address),['10.99.3.2']);
 const expired=fixture();expired.queryHook(async()=>{expired.advance(20000);return {authoritative:true,serial:7};});await assert.rejects(dnsSourceObserver(expired.options)(),e=>e.code==='SOURCE_OBSERVER_DEADLINE');
});
test('empty source catalog proves consumption and absence without making network probes or deleting Windows DNS',async()=>{
 const f=fixture();f.catalog.sources=[];f.catalogMap.data['sources.json']=JSON.stringify(f.catalog);const result=await dnsSourceObserver(f.options)();assert.deepEqual(result.sources,[]);assert.deepEqual(result.zones,[]);assert.equal(f.probes.length,0);assert.equal(confirmedSourceActivation(result,{...f.transaction,next:f.catalog,operations:[{operation:'DeleteSource',sourceId:'source-0'}]},{now:f.now}),true);
});
test('observation proof cannot confirm activation against a different registered binding identity or digest',async()=>{
 const f=fixture(),result=await dnsSourceObserver(f.options)();assert.equal(confirmedSourceActivation(result,{...f.transaction,bindingUid:randomUUID()},{now:f.now}),false);assert.equal(confirmedSourceActivation(result,{...f.transaction,bindingDigest:'b'.repeat(64)},{now:f.now}),false);
});
