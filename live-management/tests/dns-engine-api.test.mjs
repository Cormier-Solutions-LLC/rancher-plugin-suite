import test from 'node:test';import assert from 'node:assert/strict';import {dnsEngineApi} from '../dns-engine-api.mjs';
function fixture(){
 let mounted='Synthetic-before',current=mounted,serial=0,fail=false,drop=false;const tokens=new Set(),calls=[];
 const fetchImpl=async(url,init)=>{calls.push({url,...init});if(fail)throw Error('Sensitive transport details '+mounted);const path=url.split('/api/')[1],values=Object.fromEntries(init.body),token=init.headers.Authorization?.slice(7);let data;
  if(path==='user/login')data=values.pass===current?{status:'ok',token:'synthetic-session-'+(++serial)}:{status:'error',errorMessage:current};
  else if(!tokens.has(token))data={status:'invalid-token'};
  else if(path==='user/profile/get')data={status:'ok',response:{username:'admin',disabled:false,isSsoUser:false}};
  else if(path==='user/changePassword'){assert.equal(values.pass,current);current=values.newPass;data={status:'ok'};if(drop){drop=false;throw Error('Accepted response lost '+current);}}
  else if(path==='user/logout'){tokens.delete(token);data={status:'ok'};}
  else data={status:'ok',response:{zones:[]}};
  if(data.token)tokens.add(data.token);return {ok:true,text:async()=>JSON.stringify(data)};
 };
 const api=dnsEngineApi({readPassword:()=>mounted,fetchImpl});return {api,calls,tokens,mount:value=>mounted=value,engine:value=>current=value,fail:()=>fail=true,drop:()=>drop=true};
}
test('controller reuses sessions until the mounted password changes, then authenticates again with the new value',async()=>{
 const f=fixture();await f.api.api(0,'zones/list');await f.api.api(0,'zones/list');assert.equal(f.calls.filter(c=>c.url.endsWith('user/login')).length,1);f.engine('Synthetic-restored');f.mount('Synthetic-restored');await f.api.api(0,'zones/list');assert.equal(f.calls.filter(c=>c.url.endsWith('user/login')).length,2);assert.equal(f.calls.filter(c=>c.url.endsWith('user/login')).at(-1).body.get('pass'),'Synthetic-restored');
});
test('password changes send current/new values only as POST form data and verify a fresh admin login',async()=>{
 const f=fixture();assert.deepEqual(await f.api.changePassword(1,'Synthetic-before','Synthetic-restored'),{replica:1,authenticated:true});assert.equal(f.calls.filter(c=>c.url.endsWith('user/changePassword')).length,1);assert.equal(f.tokens.size,0);for(const c of f.calls){assert.equal(c.redirect,'error');assert.ok(!c.url.includes('Synthetic'));assert.equal(c.headers['Content-Type'],'application/x-www-form-urlencoded');}
});
test('lost accepted password-change response is redacted and never retries the mutation',async()=>{
 const f=fixture();f.drop();await assert.rejects(f.api.changePassword(2,'Synthetic-before','Synthetic-restored'),e=>e.code==='ENGINE_API_UNAVAILABLE'&&!e.message.includes('Synthetic'));assert.equal(f.calls.filter(c=>c.url.endsWith('user/changePassword')).length,1);await f.api.verifyPassword(2,'Synthetic-restored');assert.equal(f.calls.filter(c=>c.url.endsWith('user/changePassword')).length,1);
});
test('invalid replica/path/credential, rejected authentication and transport errors never disclose sensitive responses',async()=>{
 const f=fixture();await assert.rejects(f.api.api(3,'zones/list'));await assert.rejects(f.api.api(0,'../user/login'));await assert.rejects(f.api.verifyPassword(0,''));assert.equal(f.calls.length,0);await assert.rejects(f.api.verifyPassword(0,'Wrong-secret'),e=>e.code==='ENGINE_AUTH_REJECTED'&&!e.message.includes('Synthetic'));f.fail();await assert.rejects(f.api.api(0,'zones/list'),e=>!e.message.includes('Sensitive'));
});
test('mounted credential proof rejects an old password even when a cached inventory session remains usable',async()=>{
 const f=fixture();await f.api.api(0,'zones/list');f.engine('Synthetic-restored');assert.deepEqual(await f.api.api(0,'zones/list'),{zones:[]});await assert.rejects(f.api.verifyMountedPassword(0),e=>e.code==='ENGINE_AUTH_REJECTED');f.mount('Synthetic-restored');assert.deepEqual(await f.api.verifyMountedPassword(0),{replica:0,authenticated:true});assert.equal(f.calls.filter(c=>c.url.endsWith('user/login')).at(-1).body.get('pass'),'Synthetic-restored');
});
