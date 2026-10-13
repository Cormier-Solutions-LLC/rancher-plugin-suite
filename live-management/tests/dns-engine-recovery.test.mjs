import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {dnsEngineRecovery} from '../dns-engine-recovery.mjs';
const secret=value=>({kind:'Secret',type:'Opaque',metadata:{name:'dns-manager-engine-admin',namespace:'dns-system'},data:{'admin-password':Buffer.from(value).toString('base64')}});
async function fixture(t,{unchanged=false,missing=false}={}){
 const directory=await mkdtemp(join(tmpdir(),'dns-engine-recovery-'));t.after(()=>rm(directory,{recursive:true,force:true}));let controller=true,drop=null,unavailable=null;const current=new Map([0,1,2].map(i=>[i,unchanged||missing?'Synthetic-target':'Synthetic-before'])),calls=[];
 const api={async verifyPassword(replica,value){calls.push({type:'probe',replica});if(unavailable===replica)throw Object.assign(Error('Unavailable'),{code:'ENGINE_API_UNAVAILABLE'});if(current.get(replica)!==value)throw Object.assign(Error('Rejected'),{code:'ENGINE_AUTH_REJECTED'});return {authenticated:true};},async changePassword(replica,before,target){calls.push({type:'change',replica});assert.equal(current.get(replica),before);current.set(replica,target);if(drop===replica){drop=null;throw Error('Reply lost');}await this.verifyPassword(replica,target);}};
 const options={directory,api,confirmController:async()=>({confirmed:controller})},input={id:randomUUID(),before:missing?null:secret(unchanged?'Synthetic-target':'Synthetic-before'),target:secret('Synthetic-target')};let recovery=dnsEngineRecovery(options);
 return {directory,current,calls,input,options,get recovery(){return recovery;},restart(){recovery=dnsEngineRecovery(options);},drop:replica=>drop=replica,unavailable:replica=>unavailable=replica,controller:confirmed=>controller=confirmed};
}
test('all three engines are authenticated before any mutation; receipts contain neither passwords nor tokens',async t=>{
 const f=await fixture(t);await f.recovery.prepare(f.input);assert.equal(f.calls.filter(c=>c.type==='change').length,0);assert.equal((await f.recovery.commit(f.input)).status,'Applied');assert.equal(f.calls.filter(c=>c.type==='change').length,3);assert.ok([...f.current.values()].every(v=>v==='Synthetic-target'));const text=await readFile(join(f.directory,(await readdir(f.directory))[0]),'utf8');assert.ok(!text.includes('Synthetic'));assert.ok(!text.includes('token'));await f.recovery.commit(f.input);assert.equal(f.calls.filter(c=>c.type==='change').length,3);
});
test('failed preflight or unavailable controller verification prevents every engine mutation',async t=>{
 const unavailable=await fixture(t);unavailable.unavailable(2);await assert.rejects(unavailable.recovery.prepare(unavailable.input));assert.deepEqual(await readdir(unavailable.directory),[]);assert.equal(unavailable.calls.filter(c=>c.type==='change').length,0);
 const missing=await fixture(t);await missing.recovery.prepare(missing.input);await assert.rejects(dnsEngineRecovery({...missing.options,confirmController:undefined}).commit(missing.input));assert.equal(missing.calls.filter(c=>c.type==='change').length,0);
});
test('lost accepted reply reconciles its replica and resumes remaining replicas without replay after restart',async t=>{
 const f=await fixture(t);await f.recovery.prepare(f.input);f.drop(1);await assert.rejects(f.recovery.commit(f.input));f.restart();await assert.rejects(f.recovery.commit(f.input));assert.equal((await f.recovery.reconcile(f.input)).status,'ReadyToContinue');assert.equal((await f.recovery.commit(f.input)).status,'Applied');assert.deepEqual(f.calls.filter(c=>c.type==='change').map(c=>c.replica),[0,1,2]);
});
test('unconfirmed mutation or foreign change cannot be replayed or adopted',async t=>{
 const f=await fixture(t);await f.recovery.prepare(f.input);f.drop(0);await assert.rejects(f.recovery.commit(f.input));f.current.set(0,'Foreign-password');assert.equal((await f.recovery.reconcile(f.input)).status,'Interrupted');await assert.rejects(f.recovery.commit(f.input));assert.equal(f.calls.filter(c=>c.type==='change').length,1);
 const changed=await fixture(t);await changed.recovery.prepare(changed.input);changed.current.set(2,'Foreign-password');await assert.rejects(changed.recovery.commit(changed.input));assert.equal(changed.calls.filter(c=>c.type==='change').length,0);
});
test('successful engine changes remain incomplete until controller confirmation; reconciliation never repeats them',async t=>{
 const f=await fixture(t);await f.recovery.prepare(f.input);f.controller(false);await assert.rejects(f.recovery.commit(f.input));assert.equal((await f.recovery.verify(f.input)).confirmed,false);f.restart();f.controller(true);assert.equal((await f.recovery.reconcile(f.input)).status,'Applied');assert.equal((await f.recovery.verify(f.input)).confirmed,true);assert.equal(f.calls.filter(c=>c.type==='change').length,3);
});
test('controller delay resolves every engine intent and permits confirmation to resume without password mutations',async t=>{
 const f=await fixture(t);await f.recovery.prepare(f.input);f.controller(false);await assert.rejects(f.recovery.commit(f.input));f.restart();assert.equal((await f.recovery.reconcile(f.input)).status,'ReadyToContinue');await assert.rejects(f.recovery.commit(f.input));assert.equal(f.calls.filter(c=>c.type==='change').length,3);f.controller(true);assert.equal((await f.recovery.reconcile(f.input)).status,'Applied');assert.equal(f.calls.filter(c=>c.type==='change').length,3);
});
test('unchanged passwords and a missing Secret authenticate existing target credentials without changing engines',async t=>{
 for(const options of [{unchanged:true},{missing:true}]){const f=await fixture(t,options);await f.recovery.prepare(f.input);assert.equal((await f.recovery.commit(f.input)).status,'Applied');assert.equal(f.calls.filter(c=>c.type==='change').length,0);}
});
test('mixed current/target engine state changes only remaining engines; invalid target values or neither password stop preparation',async t=>{
 const mixed=await fixture(t);mixed.current.set(1,'Synthetic-target');await mixed.recovery.prepare(mixed.input);assert.equal((await mixed.recovery.commit(mixed.input)).status,'Applied');assert.deepEqual(mixed.calls.filter(c=>c.type==='change').map(c=>c.replica),[0,2]);
 const foreign=await fixture(t);foreign.current.set(2,'Foreign-password');await assert.rejects(foreign.recovery.prepare(foreign.input));assert.equal(foreign.calls.filter(c=>c.type==='change').length,0);assert.deepEqual(await readdir(foreign.directory),[]);
 const malformed=await fixture(t);malformed.input.target.data['admin-password']=Buffer.from([255,254]).toString('base64');await assert.rejects(malformed.recovery.prepare(malformed.input));assert.equal(malformed.calls.length,0);assert.deepEqual(await readdir(malformed.directory),[]);
});
