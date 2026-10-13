import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,generateKeyPairSync,sign}from'node:crypto';
import {mkdtemp,readdir,readFile,rm}from'node:fs/promises';import {tmpdir}from'node:os';import {join}from'node:path';
import {dnsCredentialRecovery}from'../dns-credential-recovery.mjs';import {decodeBackup}from'../../dns-manager-dev/pkg/dns-manager/snapshot-feature/config/backup-zip.mjs';
const password='Synthetic-Encrypted-Recovery-Only-2026!42',userId='user-test',names=['dns-manager-engine-admin','dns-windows-bridge-credential'],marker='dns-manager.cormierconsulting.io/credential-recovery';
const signing=generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...signing.publicKey.export({format:'jwk'}),kid:'fixture-key',alg:'RS256',use:'sig'};
function bridgeToken(value){const header=Buffer.from(JSON.stringify({alg:'RS256',kid:jwk.kid})).toString('base64url'),body=Buffer.from(JSON.stringify({iss:'kubernetes/serviceaccount',sub:'system:serviceaccount:dns-system:dns-windows-bridge','kubernetes.io/serviceaccount/namespace':'dns-system','kubernetes.io/serviceaccount/service-account.name':'dns-windows-bridge','kubernetes.io/serviceaccount/service-account.uid':'bridge-account','kubernetes.io/serviceaccount/secret.name':names[1],fixture:value})).toString('base64url'),input=header+'.'+body;return input+'.'+sign('RSA-SHA256',Buffer.from(input),signing.privateKey).toString('base64url');}
const account=()=>({apiVersion:'v1',kind:'ServiceAccount',metadata:{name:'dns-windows-bridge',namespace:'dns-system',uid:'bridge-account'}});
const secret=(name,value='Synthetic-current-value')=>({apiVersion:'v1',kind:'Secret',type:name===names[0]?'Opaque':'kubernetes.io/service-account-token',metadata:{name,namespace:'dns-system',uid:'uid-'+name,resourceVersion:'1',annotations:name===names[1]?{'kubernetes.io/service-account.name':'dns-windows-bridge','kubernetes.io/service-account.uid':'bridge-account'}:{preserved:'annotation'}},data:name===names[0]?{'admin-password':Buffer.from(value).toString('base64')}:{'ca.crt':Buffer.from('Synthetic-CA').toString('base64'),namespace:Buffer.from('dns-system').toString('base64'),token:Buffer.from(bridgeToken(value)).toString('base64')}});
async function fixture(t,{changed=true,missing=false,coordinatorEnabled=true}={}){
 const directory=await mkdtemp(join(tmpdir(),'dns-credential-recovery-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const id=randomUUID(),snapshotId=randomUUID(),live=new Map(names.map(name=>[name,secret(name)]));if(missing)live.delete(names[0]);
 const saved=names.map(name=>secret(name,changed?'Synthetic-restored-value':'Synthetic-current-value'));for(const s of saved){delete s.metadata.uid;delete s.metadata.resourceVersion;}
 let bridgeAccount=account(),writeCount=0,deny=false,loadCount=0,readDisconnect=false,writeDisconnect=false,commitDisconnect=false,prepareDisconnect=false,prepared=false,reportPrepared=false,verification=false,mutateAfterVerify=false,blockedDryRun=false;const calls=[];
 const session={
  async authorize(selected,options={}){calls.push({type:'authorize',selected,options});if(deny)throw Object.assign(Error('Denied'),{status:403});},
  async readSecret(name){calls.push({type:'read',name});if(readDisconnect&&live.get(name)?.metadata.annotations[marker]){readDisconnect=false;throw Error('Disconnected readback');}if(!live.has(name))throw Object.assign(Error('Missing'),{status:404});return structuredClone(live.get(name));},
  async readBridgeAccount(){return structuredClone(bridgeAccount);},
  async readSigningKeys(){calls.push({type:'signing-keys'});return {keys:[jwk]};},
  async replaceSecret(s,{dryRun=true}={}){calls.push({type:'replace',name:s.metadata.name,dryRun});if(dryRun){if(blockedDryRun)throw Object.assign(Error('Admission denied'),{status:403});return structuredClone(s);}const before=live.get(s.metadata.name);if(before.metadata.resourceVersion!==s.metadata.resourceVersion)throw Object.assign(Error('Conflict'),{status:409});writeCount++;const applied=structuredClone(s);applied.metadata.resourceVersion=String(Number(before.metadata.resourceVersion)+1);live.set(s.metadata.name,applied);if(writeDisconnect){writeDisconnect=false;throw Error('Accepted reply lost');}return structuredClone(applied);},
  async createSecret(s,{dryRun=true}={}){calls.push({type:'create',name:s.metadata.name,dryRun});if(dryRun)return structuredClone(s);writeCount++;const applied=structuredClone(s);applied.metadata.uid='new-'+s.metadata.name;applied.metadata.resourceVersion='1';live.set(s.metadata.name,applied);return applied;}
 };
 const coordinator={async prepare(){calls.push({type:'dependencies'});prepared=true;if(prepareDisconnect){prepareDisconnect=false;throw Error('Preparation reply lost');}},async commit(){calls.push({type:'activation'});verification=true;if(commitDisconnect){commitDisconnect=false;throw Error('Activation reply lost');}},async verify(){if(mutateAfterVerify)live.get(names[0]).data['admin-password']=Buffer.from('Concurrent-new-value').toString('base64');return {confirmed:verification};},async reconcile(){return {confirmed:verification,prepared:reportPrepared&&prepared};}};
 const loadSnapshot=async()=>{loadCount++;return {encrypted:true,snapshot:{id:snapshotId,current:{routeManifests:structuredClone(saved)}}};};
 const options={directory,loadSnapshot,coordinator:coordinatorEnabled?coordinator:undefined};let recovery=dnsCredentialRecovery(options);
 const request={id,userId,snapshotId,names,password,session};
 return {directory,id,snapshotId,names,live,saved,session,calls,request,options,get recovery(){return recovery;},restart(){recovery=dnsCredentialRecovery(options);},writes:()=>writeCount,loads:()=>loadCount,deny:()=>deny=true,disconnectRead:()=>readDisconnect=true,disconnectWrite:()=>writeDisconnect=true,disconnectCommit:()=>commitDisconnect=true,disconnectPrepare:()=>prepareDisconnect=true,confirmPrepared:()=>reportPrepared=true,replaceAccount:()=>bridgeAccount.metadata.uid='replacement-account',concurrentAfterVerify:()=>mutateAfterVerify=true,denyAdmission:()=>blockedDryRun=true};
}
test('encrypted preparation keeps before/target values and password out of receipts, persists no session, and is idempotent across restart',async t=>{
 const f=await fixture(t),prepared=await f.recovery.prepare(f.request);assert.equal(prepared.status,'Prepared');assert.equal(f.writes(),0);assert.ok(prepared.items.every(i=>i.changed));
 const files=await readdir(f.directory);assert.equal(files.length,2);const text=await readFile(join(f.directory,files.find(n=>n.endsWith('.json'))),'utf8');assert.ok(!text.includes(password));assert.ok(!text.includes('Synthetic'));assert.ok(!text.includes('Cookie'));assert.ok(!text.includes('"data"'));
 const bytes=await readFile(join(f.directory,files.find(n=>n.endsWith('.zip'))));await assert.rejects(decodeBackup(bytes,password+'wrong'));const decoded=await decodeBackup(bytes,password);assert.deepEqual(decoded.current.credentialRecovery.target.map(s=>s.data),f.saved.map(s=>s.data));
 f.restart();assert.deepEqual(await f.recovery.prepare(f.request),prepared);assert.equal(f.loads(),1);
});
test('changed credentials apply once with reviewed CAS identities and final dependency/current-secret readback',async t=>{
 const f=await fixture(t);await f.recovery.prepare(f.request);const applied=await f.recovery.apply(f.request);assert.equal(applied.status,'Applied');assert.equal(applied.dependencyConfirmed,true);assert.equal(f.writes(),2);
 for(const name of names){assert.equal(f.live.get(name).metadata.annotations[marker],f.id+'/'+name);assert.deepEqual(f.live.get(name).data,f.saved.find(s=>s.metadata.name===name).data);}
 assert.ok(f.calls.findIndex(c=>c.type==='dependencies')<f.calls.findIndex(c=>c.type==='replace'&&!c.dryRun));await f.recovery.apply(f.request);assert.equal(f.writes(),2);
});
test('unchanged credential restoration still verifies dependencies without rewriting Secrets',async t=>{
 const f=await fixture(t,{changed:false});const prepared=await f.recovery.prepare(f.request);assert.ok(prepared.items.every(i=>!i.changed));assert.ok(f.calls.filter(c=>c.type==='authorize').every(c=>!c.options.allowCreate));assert.equal((await f.recovery.apply(f.request)).status,'Applied');assert.equal(f.writes(),0);
});
test('missing credential restoration requires explicit create authorization and binds its newly observed UID',async t=>{
 const f=await fixture(t,{missing:true});const prepared=await f.recovery.prepare(f.request);assert.equal(prepared.items[0].create,true);assert.ok(f.calls.some(c=>c.type==='authorize'&&c.options.allowCreate));const applied=await f.recovery.apply(f.request);assert.equal(applied.status,'Applied');assert.equal(applied.steps.find(s=>s.id==='secret/'+names[0]).uid,'new-'+names[0]);
});
test('denied callers and rejected admission never create transactions, decrypt archives or change dependencies',async t=>{
 const denied=await fixture(t);denied.deny();await assert.rejects(denied.recovery.prepare(denied.request));assert.equal(denied.loads(),0);assert.deepEqual(await readdir(denied.directory),[]);
 const admission=await fixture(t);admission.denyAdmission();await assert.rejects(admission.recovery.prepare(admission.request));assert.equal(admission.writes(),0);assert.deepEqual(await readdir(admission.directory),[]);assert.ok(!admission.calls.some(c=>c.type==='dependencies'));
});
test('changed account UID, stale Secret revisions or a missing dependency coordinator stop apply before every mutation',async t=>{
 for(const change of ['account','revision','coordinator']){
  const f=await fixture(t,{coordinatorEnabled:change!=='coordinator'});await f.recovery.prepare(f.request);if(change==='account')f.replaceAccount();if(change==='revision')f.live.get(names[0]).metadata.resourceVersion='2';await assert.rejects(f.recovery.apply(f.request));assert.equal(f.writes(),0);assert.ok(!f.calls.some(c=>c.type==='dependencies'));assert.equal((await f.recovery.status(f.request)).status,'Prepared');
 }
});
test('lost accepted Secret response is reconciled by its original marker and never repeats the write',async t=>{
 const f=await fixture(t);await f.recovery.prepare(f.request);f.disconnectWrite();await assert.rejects(f.recovery.apply(f.request));assert.equal(f.writes(),1);f.restart();const reconciled=await f.recovery.reconcile(f.request);assert.equal(reconciled.status,'Interrupted');assert.equal(reconciled.steps.find(s=>s.id==='secret/'+names[0]).status,'Confirmed');assert.equal(f.writes(),1);await assert.rejects(f.recovery.apply(f.request));assert.equal(f.writes(),1);
});
test('interrupted activation becomes Applied only after independent dependency and current-secret confirmation',async t=>{
 const f=await fixture(t);await f.recovery.prepare(f.request);f.disconnectCommit();await assert.rejects(f.recovery.apply(f.request));assert.equal(f.writes(),2);f.restart();const reconciled=await f.recovery.reconcile(f.request);assert.equal(reconciled.status,'Applied');assert.equal(reconciled.dependencyConfirmed,true);assert.equal(f.writes(),2);assert.equal(f.calls.filter(c=>c.type==='activation').length,1);
});
test('foreign writers or changed credential readback cannot be adopted as successful recovery',async t=>{
 const f=await fixture(t);await f.recovery.prepare(f.request);f.disconnectWrite();await assert.rejects(f.recovery.apply(f.request));f.live.get(names[0]).metadata.annotations[marker]='foreign-writer';const reconciled=await f.recovery.reconcile(f.request);assert.equal(reconciled.status,'Interrupted');assert.equal(reconciled.steps.find(s=>s.id==='secret/'+names[0]).status,'Intent');assert.equal(f.writes(),1);
 const altered=await fixture(t);await altered.recovery.prepare(altered.request);altered.concurrentAfterVerify();await assert.rejects(altered.recovery.apply(altered.request));assert.equal((await altered.recovery.status(altered.request)).status,'Interrupted');
});
test('wrong password, different selection and another user cannot unlock or reuse an existing transaction',async t=>{
 const f=await fixture(t);await f.recovery.prepare(f.request);await assert.rejects(f.recovery.apply({...f.request,password:password+'wrong'}));await assert.rejects(f.recovery.prepare({...f.request,names:[names[0]]}));await assert.rejects(f.recovery.status({...f.request,userId:'user-other'}));assert.equal(f.writes(),0);
});

test('partial accepted write resumes after fresh dependency reconciliation without repeating preparation or confirmed writes',async t=>{
 const f=await fixture(t);await f.recovery.prepare(f.request);f.disconnectWrite();await assert.rejects(f.recovery.apply(f.request));f.restart();f.confirmPrepared();
 assert.equal((await f.recovery.reconcile(f.request)).status,'ReadyToContinue');assert.equal(f.writes(),1);assert.equal((await f.recovery.apply(f.request)).status,'Applied');assert.equal(f.writes(),2);
 assert.equal(f.calls.filter(c=>c.type==='dependencies').length,1);assert.equal(f.calls.filter(c=>c.type==='replace'&&!c.dryRun&&c.name===names[0]).length,1);assert.ok(!(await readdir(f.directory)).includes('credential-recovery-active.json'));
});

test('lost preparation reply requires coordinator evidence and then resumes without replaying dependency changes',async t=>{
 const f=await fixture(t);await f.recovery.prepare(f.request);f.disconnectPrepare();await assert.rejects(f.recovery.apply(f.request));assert.equal(f.writes(),0);assert.equal((await f.recovery.reconcile(f.request)).status,'Interrupted');
 f.restart();f.confirmPrepared();assert.equal((await f.recovery.reconcile(f.request)).status,'ReadyToContinue');assert.equal((await f.recovery.apply(f.request)).status,'Applied');assert.equal(f.calls.filter(c=>c.type==='dependencies').length,1);
});

test('continuation rejects foreign changes in both confirmed and unsubmitted credentials',async t=>{
 for(const position of [0,1]){
  const f=await fixture(t);await f.recovery.prepare(f.request);f.disconnectWrite();await assert.rejects(f.recovery.apply(f.request));f.confirmPrepared();assert.equal((await f.recovery.reconcile(f.request)).status,'ReadyToContinue');
  f.live.get(names[position]).data[position===0?'admin-password':'token']=Buffer.from('Foreign-change').toString('base64');await assert.rejects(f.recovery.apply(f.request));assert.equal(f.writes(),1);assert.ok((await readdir(f.directory)).includes('credential-recovery-active.json'));
 }
});

test('durable active lease blocks another transaction after restart until the original recovery is confirmed',async t=>{
 const f=await fixture(t),other={...f.request,id:randomUUID()};await f.recovery.prepare(f.request);await f.recovery.prepare(other);f.disconnectWrite();await assert.rejects(f.recovery.apply(f.request));f.restart();await assert.rejects(f.recovery.apply(other),/Another credential recovery/);assert.equal(f.writes(),1);
 f.confirmPrepared();await f.recovery.reconcile(f.request);await f.recovery.apply(f.request);await assert.rejects(f.recovery.apply(other),/changed after review/);assert.equal(f.writes(),2);assert.ok(!(await readdir(f.directory)).includes('credential-recovery-active.json'));
});

test('concurrent duplicate Apply submissions are serialized and produce a single set of mutations',async t=>{
 const f=await fixture(t);await f.recovery.prepare(f.request);const results=await Promise.all([f.recovery.apply(f.request),f.recovery.apply(f.request)]);assert.ok(results.every(r=>r.status==='Applied'));assert.equal(f.writes(),2);assert.equal(f.calls.filter(c=>c.type==='activation').length,1);
});

test('storage quota prevents dependency or credential writes and leaves no prepared files',async t=>{
 const f=await fixture(t),limited=dnsCredentialRecovery({...f.options,quotaBytes:1});await assert.rejects(limited.prepare(f.request),e=>e.status===507);assert.equal(f.writes(),0);assert.deepEqual(await readdir(f.directory),[]);assert.ok(!f.calls.some(c=>c.type==='dependencies'));
});
test('untrusted saved token and signing-key revocation stop recovery before dependencies or credential writes',async t=>{
 const invalid=await fixture(t);invalid.saved[1].data.token=Buffer.from('Synthetic.invalid.signature').toString('base64');await assert.rejects(invalid.recovery.prepare(invalid.request),e=>e.code==='BRIDGE_TOKEN_REJECTED');assert.equal(invalid.writes(),0);assert.deepEqual(await readdir(invalid.directory),[]);assert.ok(!invalid.calls.some(c=>c.type==='dependencies'));
 const revoked=await fixture(t);await revoked.recovery.prepare(revoked.request);revoked.session.readSigningKeys=async()=>({keys:[]});await assert.rejects(revoked.recovery.apply(revoked.request),e=>e.code==='BRIDGE_TOKEN_REJECTED');assert.equal(revoked.writes(),0);assert.ok(!revoked.calls.some(c=>c.type==='dependencies'));assert.equal((await revoked.recovery.status(revoked.request)).status,'Prepared');assert.ok(!(await readdir(revoked.directory)).includes('credential-recovery-active.json'));
});

test('partly completed activation resumes only after explicit coordinator evidence, without repeating confirmed Secret writes',async t=>{
 const f=await fixture(t);let phase='Pending',changes=0,reconciled=false;
 f.options.coordinator.commit=async()=>{if(phase==='Pending'){changes++;phase='FirstConfirmed';throw Error('Second dependency interrupted');}assert.equal(phase,'FirstConfirmed');assert.equal(reconciled,true);changes++;phase='Applied';};
 f.options.coordinator.verify=async()=>({confirmed:phase==='Applied'});
 f.options.coordinator.reconcile=async()=>({activationReady:reconciled});
 await f.recovery.prepare(f.request);await assert.rejects(f.recovery.apply(f.request));assert.equal(changes,1);assert.equal(f.writes(),2);
 f.restart();assert.equal((await f.recovery.reconcile(f.request)).status,'Interrupted');await assert.rejects(f.recovery.apply(f.request));assert.equal(changes,1);
 reconciled=true;assert.equal((await f.recovery.reconcile(f.request)).status,'ReadyToContinue');assert.equal((await f.recovery.apply(f.request)).status,'Applied');assert.equal(changes,2);assert.equal(f.writes(),2);
 await f.recovery.apply(f.request);assert.equal(changes,2);assert.equal(f.writes(),2);
});

test('activation continuation cannot adopt an unresolved Secret intent or foreign post-reconciliation values',async t=>{
 const unresolved=await fixture(t);unresolved.options.coordinator.reconcile=async()=>({activationReady:true});await unresolved.recovery.prepare(unresolved.request);unresolved.disconnectWrite();await assert.rejects(unresolved.recovery.apply(unresolved.request));assert.equal((await unresolved.recovery.reconcile(unresolved.request)).status,'Interrupted');assert.equal(unresolved.writes(),1);
 const changed=await fixture(t);changed.options.coordinator.commit=async()=>{throw Error('Interrupted');};changed.options.coordinator.reconcile=async()=>({activationReady:true});await changed.recovery.prepare(changed.request);await assert.rejects(changed.recovery.apply(changed.request));assert.equal((await changed.recovery.reconcile(changed.request)).status,'ReadyToContinue');changed.live.get(names[0]).data['admin-password']=Buffer.from('Foreign-new-value').toString('base64');await assert.rejects(changed.recovery.apply(changed.request));assert.equal(changed.writes(),2);
});
