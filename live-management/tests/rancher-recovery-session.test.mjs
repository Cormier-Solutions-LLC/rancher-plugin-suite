import test from 'node:test';import assert from 'node:assert/strict';
import {createRancherRecoverySession} from '../rancher-recovery-session.mjs';
const headers={origin:'https://rancher.cormierconsulting.io',cookie:'R_SESS=Synthetic-session-only; CSRF=Synthetic-csrf-only'},userId='user-test';
const secret=()=>({apiVersion:'v1',kind:'Secret',type:'Opaque',metadata:{name:'dns-manager-engine-admin',namespace:'dns-system',uid:'existing-secret',resourceVersion:'2'},data:{'admin-password':Buffer.from('Synthetic-password-only').toString('base64')}});
function fixture({username=userId,denied='',error='',disconnect=false}={}){
 const calls=[];const request=async(path,init)=>{
  calls.push({path,...init});const body=init.body?JSON.parse(init.body):null;
  if(path.endsWith('/selfsubjectreviews'))return {status:201,body:{apiVersion:'authentication.k8s.io/v1',kind:'SelfSubjectReview',status:{userInfo:{username}}}};
  if(path.endsWith('/selfsubjectaccessreviews'))return {status:201,body:{status:{allowed:body.spec.resourceAttributes.verb!==denied,evaluationError:error}}};
  if(init.method==='PUT'&&disconnect)throw Error(headers.cookie+' '+secret().data['admin-password']);
  return {status:200,body:secret()};
 };return {calls,session:createRancherRecoverySession(headers,userId,request)};
}
test('recovery verifies the actual Rancher user and every named permission before delegated reads or CAS writes',async()=>{
 const {session,calls}=fixture();await session.authorize(['dns-manager-engine-admin']);await session.readSecret('dns-manager-engine-admin');await session.replaceSecret(secret());
 assert.deepEqual(calls.slice(0,3).map(c=>c.path),['/apis/authentication.k8s.io/v1/selfsubjectreviews','/apis/authorization.k8s.io/v1/selfsubjectaccessreviews','/apis/authorization.k8s.io/v1/selfsubjectaccessreviews']);
 assert.equal(calls.at(-1).path,'/api/v1/namespaces/dns-system/secrets/dns-manager-engine-admin?dryRun=All');assert.equal(calls.at(-1).headers.Cookie,headers.cookie);assert.equal(calls.at(-1).headers['x-api-csrf'],'Synthetic-csrf-only');assert.equal(calls.at(-1).headers.Authorization,undefined);
 await session.replaceSecret(secret(),{dryRun:false});assert.equal(calls.at(-1).path,'/api/v1/namespaces/dns-system/secrets/dns-manager-engine-admin');
});
test('missing, foreign, malformed or cross-origin sessions fail before any transport and cannot use pod identity',()=>{
 let calls=0;for(const modified of [{...headers,cookie:''},{...headers,origin:'https://foreign.example'},{...headers,'sec-fetch-site':'cross-site'},{...headers,cookie:'CSRF=one; CSRF=two'},{...headers,cookie:'CSRF=%ZZ'},{...headers,cookie:'CSRF=one\r\nInjected: value'}])assert.throws(()=>createRancherRecoverySession(modified,userId,()=>calls++));
 assert.throws(()=>createRancherRecoverySession(headers,'system:serviceaccount:manager-system:dns-manager-snapshots',()=>calls++));assert.equal(calls,0);
});
test('another user, capture ServiceAccount, denied access or indeterminate authorization stops every credential read and write',async()=>{
 for(const scenario of [{username:'user-other'},{username:'system:serviceaccount:manager-system:dns-manager-snapshots'},{denied:'get'},{denied:'update'},{error:'Unavailable'}]){
  const {session,calls}=fixture(scenario);await assert.rejects(session.authorize(['dns-manager-engine-admin']));assert.throws(()=>session.readSecret('dns-manager-engine-admin'));assert.throws(()=>session.replaceSecret(secret(),{dryRun:false}));assert.ok(calls.every(c=>c.path.endsWith('reviews')));
 }
});
test('unknown names, namespaces, unreviewed CAS identities, plaintext values and duplicate selections never reach a write',async()=>{
 const {session,calls}=fixture();await assert.rejects(session.authorize(['dns-manager-engine-admin','dns-manager-engine-admin']));await assert.rejects(session.authorize(['unrelated']));assert.equal(calls.length,0);
 await session.authorize(['dns-manager-engine-admin']);const count=calls.length;
 for(const change of [s=>({...s,metadata:{...s.metadata,name:'unrelated'}}),s=>({...s,metadata:{...s.metadata,namespace:'other'}}),s=>({...s,metadata:{...s.metadata,uid:''}}),s=>({...s,metadata:{...s.metadata,resourceVersion:''}}),s=>({...s,stringData:{'admin-password':'Synthetic'}}),s=>({...s,data:{'admin-password':'Not-base64'}})])assert.throws(()=>session.replaceSecret(change(secret()),{dryRun:false}));
 assert.equal(calls.length,count);assert.throws(()=>session.readBridgeAccount());
});
test('creation requires explicit create authorization and an absent UID/revision; bridge recovery checks the named account',async()=>{
 const {session,calls}=fixture();await session.authorize(['dns-manager-engine-admin']);const absent=secret();delete absent.metadata.uid;delete absent.metadata.resourceVersion;assert.throws(()=>session.createSecret(absent));
 await session.authorize(['dns-manager-engine-admin','dns-windows-bridge-credential'],{allowCreate:true});assert.ok(calls.some(c=>c.body&&JSON.parse(c.body).spec?.resourceAttributes.resource==='serviceaccounts'));await session.readBridgeAccount();await session.createSecret(absent);assert.equal(calls.at(-1).path,'/api/v1/namespaces/dns-system/secrets?dryRun=All');assert.throws(()=>session.createSecret(secret()));
});
test('an uncertain delegated write is never replayed and sensitive transport errors are redacted',async()=>{
 const {session,calls}=fixture({disconnect:true});await session.authorize(['dns-manager-engine-admin']);let error;try{await session.replaceSecret(secret(),{dryRun:false});}catch(e){error=e;}
 assert.equal(error.code,'RECOVERY_UNCONFIRMED');assert.ok(!error.message.includes('Synthetic'));assert.equal(calls.filter(c=>c.method==='PUT').length,1);
});

test('fresh channel authorization preserves the parent engine capability and its explicit create grant',async()=>{
 const {session,calls}=fixture();await session.authorize(['dns-manager-engine-admin','dns-windows-bridge-credential'],{allowCreate:true});const evidence=await session.authorizeWindowsRecoveryChannel();assert.deepEqual(evidence.credentialNames,['dns-windows-bridge-credential']);assert.equal(evidence.allowCreate,false);assert.equal(calls.filter(c=>c.path.endsWith('/selfsubjectreviews')).length,2);
 await session.readSecret('dns-manager-engine-admin');const absent=secret();delete absent.metadata.uid;delete absent.metadata.resourceVersion;await session.createSecret(absent);assert.equal(calls.at(-1).path,'/api/v1/namespaces/dns-system/secrets?dryRun=All');await session.replaceSecret(secret());assert.equal(calls.at(-1).path,'/api/v1/namespaces/dns-system/secrets/dns-manager-engine-admin?dryRun=All');
});
