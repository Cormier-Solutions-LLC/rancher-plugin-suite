import test from 'node:test';import assert from 'node:assert/strict';
import {createLiveDnsSource} from '../rancher-dns.mjs';
import {currentZoneOrder,navigationProposal,validateNavigationBackup} from '../dns-navigation.mjs';
const zones=[{id:'one.example.test',name:'one.example.test',serial:'3'},{id:'two.example.test',name:'two.example.test',serial:'4'}],order=zones.map(z=>z.id),next=[...order].reverse(),user='user-test',stateName='dns-manager-state-'+user;
const change={id:'owned-order-draft',kind:'order',name:'Zone Navigation',order:next,baseOrder:order};
function fixture(options={}){
 let cm={apiVersion:'v1',kind:'ConfigMap',metadata:{name:stateName,namespace:'cattle-ui-plugin-system',uid:'original-state',resourceVersion:'1'},data:{'state.json':JSON.stringify({version:1,order,drafts:[change],preferences:{density:'comfortable'}}),unrelated:'preserve'}};
 let attempts=0,writes=0,queueWrites=0,orderWrites=0;
 const inv=()=>({observedAt:new Date().toISOString(),source:{name:'Windows',host:'domain',address:'192.0.2.1',credential:'Reference',managementReachable:true},managementReachable:true,zones:structuredClone(zones),records:Object.fromEntries(zones.map(z=>[z.id,[]])),replicas:[{reachable:true,zones:zones.map(z=>({zone:z.name,serial:Number(z.serial)}))}]});
 const snapshot={id:'backup',createdAt:new Date().toISOString(),current:{snapshotScope:{managerStateName:stateName},relatedConfigurations:[{kind:'DnsNavigation',dns:{order}}]}};
 Object.assign(snapshot,options.snapshot||{});
 const request=async(url,init={})=>{
  const path=url.replace('/k8s/clusters/local','');let body;
  const fail=status=>({ok:false,status});
  if(path.includes('/configmaps/'+stateName)){
   if(init.method==='PUT'){
    const proposed=JSON.parse(init.body);
    if(path.endsWith('?dryRun=All')){if(options.dryDenied)return fail(403);return {ok:true,status:200,json:async()=>proposed};}
    attempts++;if(options.denied||options.confirmationDenied&&JSON.parse(proposed.data['navigation.json']||'null')?.processes?.at(-1)?.status==='Applied')return fail(403);if(options.conflict)return fail(409);
    if(JSON.stringify(JSON.parse(cm.data['navigation.json']||'null')?.order??JSON.parse(cm.data['state.json']).order)!==JSON.stringify(JSON.parse(proposed.data['navigation.json']||'null')?.order??JSON.parse(proposed.data['state.json']).order))orderWrites++;
    assert.equal(proposed.metadata.resourceVersion,cm.metadata.resourceVersion);cm=proposed;cm.metadata.resourceVersion=String(Number(cm.metadata.resourceVersion)+1);writes++;
    if(options.altered){const n=JSON.parse(cm.data['navigation.json']);n.order=order;cm.data['navigation.json']=JSON.stringify(n);}
    if(options.lostReply)throw new Error('Accepted response disconnected');
   }body=cm;
  }else if(path.includes('/proxy/api/snapshots/')){if(options.missingBackup)return fail(404);body=snapshot;}
  else if(path.endsWith('dns-manager-observations'))body={metadata:{resourceVersion:'10'},data:{'inventory.json':JSON.stringify(inv())}};
  else if(path.endsWith('dns-windows-observations'))body={data:{'inventory.json':JSON.stringify(inv())}};
  else if(path.endsWith('dns-windows-queue')){if(init.method==='PUT')queueWrites++;body={data:{'jobs.json':'[]'}};}
  else throw new Error('Unexpected request '+path);
  return {ok:true,status:200,json:async()=>structuredClone(body)};
 };
 return {source:createLiveDnsSource('local',request,user),stats:()=>({attempts,writes,queueWrites}),orderWrites:()=>orderWrites,allowConfirmation:()=>options.confirmationDenied=false,state:()=>JSON.parse(cm.data['state.json']),navigation:()=>JSON.parse(cm.data['navigation.json']||'null'),cm:()=>cm};
}
test('navigation identities preserve surviving priority and append new zones; malformed and stale drafts are rejected',()=>{
 assert.deepEqual(currentZoneOrder(['removed.example.test',order[1]],zones),next);
 assert.throws(()=>currentZoneOrder([order[0],order[0]],zones),/invalid/);
 for(const invalid of [{...change,order:[order[0],order[0]]},{...change,order:[order[0]]},{...change,order:['foreign',order[0]]},{...change,baseOrder:next},{...change,needsCompletion:true}])assert.throws(()=>navigationProposal([invalid],order,zones));
 assert.throws(()=>navigationProposal([change,{...change,id:'second'}],order,zones),/one complete/);
});
test('navigation applies by reviewed CAS with durable receipt, preserves unrelated state and never writes Windows DNS',async()=>{
 const f=fixture();await f.source.reload();const receipt=await f.source.stageChanges({changes:[change],snapshotId:'backup'});assert.equal(receipt.kind,'Navigation');assert.deepEqual(receipt.receipts[0].order,next);assert.equal(receipt.receipts[0].readBack,true);assert.deepEqual(f.stats(),{attempts:2,writes:2,queueWrites:0});assert.deepEqual(f.state().order,next);assert.equal(f.cm().data.unrelated,'preserve');
 const fresh=await f.source.reload();assert.deepEqual(fresh.data.inventory.navigation.order,next);assert.equal(fresh.data.inventory.processes[0].id,receipt.id);
 await f.source.saveState({...f.state(),order,drafts:[]});assert.deepEqual(f.state().order,next);assert.equal(f.navigation().processes[0].id,receipt.id);
 await assert.rejects(f.source.stageChanges({changes:[change],snapshotId:'backup'}),/changed after review|durable receipt/);assert.equal(f.stats().queueWrites,0);
});
test('lost accepted navigation reply recovers the same receipt without replay; altered readback remains unresolved',async()=>{
 const lost=fixture({lostReply:true});await lost.source.reload();const result=await lost.source.stageChanges({changes:[change],snapshotId:'backup'});assert.equal(result.status,'Applied');assert.equal(lost.stats().writes,2);assert.equal(lost.stats().attempts,2);
 const altered=fixture({altered:true});await altered.source.reload();await assert.rejects(altered.source.stageChanges({changes:[change],snapshotId:'backup'}),e=>/readback differs/.test(e.message)&&!!e.receipt);await assert.rejects(altered.source.stageChanges({changes:[change],snapshotId:'backup'}),/durable receipt/);assert.equal(altered.stats().writes,1);assert.equal(altered.navigation().processes[0].status,'Running');assert.equal(altered.navigation().processes[0].receipts[0].readBack,false);
});
test('interrupted completion remains durably Running until refresh confirms it; reconciliation never repeats the order write',async()=>{
 const f=fixture({confirmationDenied:true});await f.source.reload();await assert.rejects(f.source.stageChanges({changes:[change],snapshotId:'backup'}),e=>!!e.jobId&&/completion receipt is pending/.test(e.message));assert.equal(f.navigation().processes[0].status,'Running');assert.equal(f.navigation().processes[0].receipts[0].readBack,false);
 const pending=await f.source.reload();assert.equal(pending.data.inventory.processes[0].status,'Running');assert.equal(f.orderWrites(),1);assert.equal(f.state().drafts.length,1);
 f.allowConfirmation();const done=await f.source.reload();assert.equal(done.data.inventory.processes[0].status,'Applied');assert.equal(done.data.inventory.processes[0].receipts[0].readBack,true);assert.equal(f.orderWrites(),1);assert.equal(f.state().drafts.length,0);
 await f.source.saveState({...f.state(),drafts:[change]});assert.deepEqual(f.state().drafts,[]);
});
test('missing, outdated, future, encrypted, foreign and wrong-order backups prevent navigation writes',async()=>{
 const backups=[{createdAt:'2020-01-01T00:00:00Z'},{createdAt:new Date(Date.now()+60000).toISOString()},{encrypted:true},{current:{snapshotScope:{managerStateName:'foreign'},relatedConfigurations:[{kind:'DnsNavigation',dns:{order}}]}},{current:{snapshotScope:{managerStateName:stateName},relatedConfigurations:[{kind:'DnsNavigation',dns:{order:next}}]}}];
 for(const snapshot of backups){const f=fixture({snapshot});await f.source.reload();await assert.rejects(f.source.stageChanges({changes:[change],snapshotId:'backup'}));assert.equal(f.stats().writes,0);}
 const missing=fixture({missingBackup:true});await missing.source.reload();await assert.rejects(missing.source.stageChanges({changes:[change],snapshotId:'backup'}));assert.equal(missing.stats().writes,0);
 assert.throws(()=>validateNavigationBackup({},order,stateName));
});
test('authorization, admission denial and concurrent revisions stop navigation without replay',async()=>{
 for(const options of [{dryDenied:true},{denied:true},{conflict:true}]){const f=fixture(options);await f.source.reload();await assert.rejects(f.source.stageChanges({changes:[change],snapshotId:'backup'}));assert.equal(f.stats().writes,0);assert.ok(f.stats().attempts<=1);assert.equal(f.stats().queueWrites,0);}
});
test('snapshot navigation restore supports unchanged DNS dependencies but rejects mixed mutations before any write',async()=>{
 const f=fixture();const current=await f.source.reload(),restore={id:'restore-navigation',kind:'restore',configuration:{kind:'DnsNavigation',dns:{order:next}}};
 const receipt=await f.source.stageChanges({changes:[restore,{id:'same-source',kind:'restore',configuration:{kind:'DnsSource',dns:{...current.data.inventory.source,address:'192.0.2.2'}}}],snapshotId:'backup'}).catch(e=>e);
 assert.match(receipt.message,/differs/);assert.equal(f.stats().writes,0);
 const another=fixture();await another.source.reload();await assert.rejects(another.source.stageChanges({changes:[restore,{id:'record',kind:'record',zone:order[0],name:'new',type:'A',value:'192.0.2.1',ttl:30}],snapshotId:'backup'}),/separately/);assert.equal(another.stats().writes,0);
 const success=fixture();const fresh=await success.source.reload();assert.equal((await success.source.stageChanges({changes:[restore,{id:'same-source',kind:'restore',configuration:{kind:'DnsSource',dns:fresh.data.inventory.source}},{id:'same-zone',kind:'restore',configuration:{kind:'DnsZone',dns:{zone:{name:order[0]},records:[]}}}],snapshotId:'backup'})).kind,'Navigation');
});
