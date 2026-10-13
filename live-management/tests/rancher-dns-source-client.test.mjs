import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createLiveDnsSource} from '../rancher-dns.mjs';
import {prepareDnsSourceOperations,sourceCatalogFingerprint} from '../dns-source-catalog.mjs';

function fixture(options={}){
 const user='user-test',stateName='dns-manager-state-'+user;
 const binding={id:'domain02',host:'domain02.example.test',address:'10.99.3.2',credential:'Registered bridge',namespace:'dns-system',observationName:'observations',observationUid:randomUUID(),queueName:'queue',queueUid:randomUUID(),accountUid:randomUUID(),sourceDigest:'a'.repeat(64),writable:true};
 const registry={version:1,bindings:[binding]},source={id:'windows-dns',name:'Windows DNS',type:'Windows Domain Controller',host:binding.host,address:binding.address,credential:binding.credential,bindingId:binding.id,revision:1};
 const cm=(name,data)=>({apiVersion:'v1',kind:'ConfigMap',metadata:{name,namespace:name===stateName?'cattle-ui-plugin-system':'dns-system',uid:randomUUID(),resourceVersion:'1'},data});
 const catalogCM=cm('dns-manager-sources',{'sources.json':JSON.stringify({version:1,revision:0,sources:[source]})});
 const registryCM={...cm('dns-manager-source-bindings',{'bindings.json':JSON.stringify(registry)}),immutable:true};
 const change={id:randomUUID(),operation:'Update',sourceId:source.id,expected:source,value:{...source,name:'Reviewed name'}};delete change.value.revision;
 const draft={id:change.id,kind:'source',name:change.value.name,sourceId:source.id,sourceChange:change};
 let stateCM=cm(stateName,{'state.json':JSON.stringify({version:1,drafts:[draft,{id:'unrelated',kind:'record',name:'preserve'}],order:[],preferences:{density:'comfortable'}}),unrelated:'keep'});
 let receipts=new Map(),calls=[],writes=0,cleanupWrites=0;
 const catalog=()=>JSON.parse(catalogCM.data['sources.json']);
 const inv=()=>({observedAt:new Date().toISOString(),source:{...catalog().sources[0],managementReachable:true},zones:[],records:{},replicas:[],sourceCatalog:{uid:catalogCM.metadata.uid,bindingUid:registryCM.metadata.uid,bindingDigest:createHash('sha256').update(registryCM.data['bindings.json']).digest('hex'),fingerprint:sourceCatalogFingerprint(catalog())}});
 const request=async(url,init={})=>{
  assert.equal(init.credentials,'same-origin');const path=url.replace('/k8s/clusters/local','');let body,status=200;
  if(path.includes('/configmaps/'+stateName)){
   if(options.unreadableState)return{ok:false,status:403};
   if(init.method==='PUT'){
    const proposed=JSON.parse(init.body);if(options.deniedSave)return{ok:false,status:403};
    if(!path.endsWith('?dryRun=All')){
     if(proposed.metadata.resourceVersion!==stateCM.metadata.resourceVersion)return{ok:false,status:409};
     const cleanup=proposed.data['state.json']!==stateCM.data['state.json'];stateCM=proposed;stateCM.metadata.resourceVersion=String(Number(stateCM.metadata.resourceVersion)+1);writes++;if(cleanup)cleanupWrites++;
     if(options.lostJournalReply&&!cleanup||options.lostCleanupReply&&cleanup)throw Error('Accepted response disconnected');
    }body=stateCM;
   }else body=stateCM;
  }else if(path.endsWith('dns-manager-observations'))body={metadata:{resourceVersion:'10'},data:{'inventory.json':JSON.stringify(inv())}};
  else if(path.endsWith('dns-windows-observations'))body={data:{'inventory.json':JSON.stringify({...inv(),managementReachable:true})}};
  else if(path.endsWith('dns-windows-queue'))body={data:{'jobs.json':'[]'}};
  else if(path.endsWith('dns-manager-sources'))body=options.foreignCatalog?{...catalogCM,metadata:{...catalogCM.metadata,uid:randomUUID()}}:catalogCM;
  else if(path.endsWith('dns-manager-source-bindings'))body=options.mutableRegistry?{...registryCM,immutable:false}:registryCM;
  else if(path.includes('/proxy/api/sources/')){
   const action=path.split('/').at(-1),input=JSON.parse(init.body);calls.push(action);
   if(action==='backup'){status=201;body={snapshot:{id:randomUUID(),kind:'DnsSourceCatalog',encrypted:false,createdAt:new Date().toISOString()}};}
   else if(action==='prepare'){
    const prepared=prepareDnsSourceOperations(input.changes,catalog(),registry);status=201;
    body={receipt:{id:input.id,userId:user,snapshotId:input.snapshotId,status:'Prepared',createdAt:new Date().toISOString(),finishedAt:null,draftIds:prepared.draftIds,operations:prepared.operations}};
    receipts.set(input.id,body.receipt);if(options.lostPrepareReply)throw Error('Prepared response disconnected');
   }else{
    const id=path.split('/').at(-2),receipt=receipts.get(id);assert.ok(receipt);
    if(action==='apply'){
     const prepared=prepareDnsSourceOperations(receipt.operations.map(op=>({id:op.draftId,operation:op.operation.replace('Source',''),sourceId:op.sourceId,expected:op.before,value:op.after&&Object.fromEntries(Object.entries(op.after).filter(([key])=>key!=='revision'))})),catalog(),registry);
     catalogCM.data['sources.json']=JSON.stringify(prepared.next);catalogCM.metadata.resourceVersion=String(Number(catalogCM.metadata.resourceVersion)+1);
     Object.assign(receipt,{status:'Applied',finishedAt:new Date().toISOString()});if(options.lostApplyReply)throw Error('Applied response disconnected');
    }body={receipt};
   }
  }else throw Error('Unexpected request '+path);
  return{ok:status<300,status,json:async()=>structuredClone(body)};
 };
 let adapter=createLiveDnsSource('local',request,user);
 return{input:{id:randomUUID(),snapshotId:randomUUID(),changes:[change]},get adapter(){return adapter;},restart:()=>adapter=createLiveDnsSource('local',request,user),calls,stats:()=>({writes,cleanupWrites}),catalog,registryCM,state:()=>JSON.parse(stateCM.data['state.json']),journal:()=>JSON.parse(stateCM.data['source-operations.json']||'null'),changeDraft:()=>{const s=JSON.parse(stateCM.data['state.json']);s.drafts[0].sourceChange.value.name='Newer proposal';stateCM.data['state.json']=JSON.stringify(s);stateCM.metadata.resourceVersion=String(Number(stateCM.metadata.resourceVersion)+1);},advanceState:()=>stateCM.metadata.resourceVersion=String(Number(stateCM.metadata.resourceVersion)+1),tamperReceipt:()=>{const journal=JSON.parse(stateCM.data['source-operations.json']);journal.operations[0].receipt.operations[0].after.name='Unreviewed name';journal.operations[0].receipt.operations[0].name='Unreviewed name';stateCM.data['source-operations.json']=JSON.stringify(journal);}};
}
test('source adapter saves original intents, reads back accepted lost journal and cleanup replies, and preserves unrelated drafts',async()=>{
 const f=fixture({lostJournalReply:true,lostCleanupReply:true});await f.adapter.reload();
 assert.equal((await f.adapter.sourceAction({action:'backup'})).kind,'DnsSourceCatalog');await f.adapter.sourceAction({action:'prepare',...f.input});
 assert.equal(f.catalog().revision,0);assert.equal(f.journal().operations[0].phase,'Prepared');
 const receipt=await f.adapter.sourceAction({action:'apply',id:f.input.id});assert.equal(receipt.status,'Applied');assert.equal(f.catalog().revision,1);assert.deepEqual(f.state().drafts.map(d=>d.id),['unrelated']);assert.equal(f.stats().cleanupWrites,1);
 const writes=f.stats().writes;await f.adapter.sourceAction({action:'status',id:f.input.id});assert.equal(f.stats().writes,writes+1);assert.equal(f.stats().cleanupWrites,1);assert.deepEqual(f.calls,['backup','prepare','apply','status']);
});
test('lost preparation replies survive a fresh adapter and require original status before Apply',async()=>{
 const f=fixture({lostPrepareReply:true});await f.adapter.reload();await assert.rejects(f.adapter.sourceAction({action:'prepare',...f.input}));assert.equal(f.journal().operations[0].phase,'PrepareIntent');
 f.restart();const doc=await f.adapter.reload();assert.equal(doc.data.inventory.processes[0].status,'PrepareIntent');await assert.rejects(f.adapter.sourceAction({action:'apply',id:f.input.id}));
 assert.equal((await f.adapter.sourceAction({action:'status',id:f.input.id})).status,'Prepared');assert.equal((await f.adapter.sourceAction({action:'apply',id:f.input.id})).status,'Applied');assert.deepEqual(f.calls,['prepare','status','apply']);
});
test('lost Apply replies retain the original operation across reload and never submit Apply twice',async()=>{
 const f=fixture({lostApplyReply:true});await f.adapter.reload();await f.adapter.sourceAction({action:'prepare',...f.input});await assert.rejects(f.adapter.sourceAction({action:'apply',id:f.input.id}));assert.equal(f.catalog().revision,1);
 f.restart();const doc=await f.adapter.reload();assert.equal(doc.data.inventory.processes[0].status,'ApplyIntent');await assert.rejects(f.adapter.sourceAction({action:'apply',id:f.input.id}));
 assert.equal((await f.adapter.sourceAction({action:'status',id:f.input.id})).status,'Applied');assert.equal(f.state().drafts.length,1);assert.equal(f.catalog().revision,1);assert.deepEqual(f.calls,['prepare','apply','status']);
});
test('a proposal edited after preparation is retained and cannot apply the previous review',async()=>{
 const f=fixture();await f.adapter.reload();await f.adapter.sourceAction({action:'prepare',...f.input});f.changeDraft();await assert.rejects(f.adapter.sourceAction({action:'apply',id:f.input.id}),/proposals changed/);assert.deepEqual(f.calls,['prepare']);assert.equal(f.catalog().revision,0);assert.equal(f.state().drafts[0].sourceChange.value.name,'Newer proposal');assert.equal(f.journal().operations[0].phase,'Prepared');
});
test('CAS conflicts and denied state admission prevent submission of source preparation',async()=>{
 for(const option of [{deniedSave:true},{}]){const f=fixture(option);await f.adapter.reload();if(!option.deniedSave)f.advanceState();await assert.rejects(f.adapter.sourceAction({action:'prepare',...f.input}));assert.deepEqual(f.calls,[]);assert.equal(f.catalog().revision,0);}
});
test('foreign catalog identity or mutable bridge declarations disable source management',async()=>{
 for(const option of [{foreignCatalog:true},{mutableRegistry:true}]){const f=fixture(option);const doc=await f.adapter.reload();assert.equal(doc.data.inventory.sourceManagement.ready,false);await assert.rejects(f.adapter.sourceAction({action:'prepare',...f.input}));assert.deepEqual(f.calls,[]);}
});
test('a persisted receipt with different target settings cannot enable Apply after reload',async()=>{
 const f=fixture();await f.adapter.reload();await f.adapter.sourceAction({action:'prepare',...f.input});f.tamperReceipt();f.restart();assert.equal((await f.adapter.reload()).data.inventory.sourceManagement.ready,false);await assert.rejects(f.adapter.sourceAction({action:'apply',id:f.input.id}),/receipt differs/);assert.deepEqual(f.calls,['prepare']);
});
test('simultaneous distinct reviews retain both durable original references',async()=>{
 const f=fixture();await f.adapter.reload();const second={...structuredClone(f.input),id:randomUUID()};second.changes[0].id=randomUUID();second.changes[0].value.name='Second review';
 await Promise.all([f.adapter.sourceAction({action:'prepare',...f.input}),f.adapter.sourceAction({action:'prepare',...second})]);assert.deepEqual(f.journal().operations.map(r=>r.id),[f.input.id,second.id]);assert.equal(f.journal().operations.every(r=>r.phase==='Prepared'),true);assert.deepEqual(f.calls,['prepare','prepare']);
});
