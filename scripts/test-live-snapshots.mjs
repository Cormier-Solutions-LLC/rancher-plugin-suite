import fs from 'node:fs';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const run=promisify(execFile),kubectl='C:/Program Files/Docker/Docker/resources/bin/kubectl.exe';
const root='.local/manager-installation',results=[];
for(const plugin of ['network-manager','dns-manager']) {
 const base=`http://127.0.0.1:15888/api/v1/namespaces/manager-system/services/http:${plugin}-snapshots:8080/proxy`;
 const request=(path,body,method='POST',origin='https://rancher.cormierconsulting.io')=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const get=async path=>{const response=await fetch(base+path,{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);return response.json();};
 const prior=await get('/api/snapshot-schedule');
 // Do not replace any pre-existing user's scheduled capture scope.
 const ownedSource=prior.scope?.label==='Isolated manager acceptance' && prior.scope?.namespace==='manager-acceptance';
 assert.ok(!prior.enabled || ownedSource);assert.ok(!prior.hasSource || ownedSource);
 const password='Test-only-'+randomBytes(24).toString('base64url')+'!';
 const secret={apiVersion:'v1',kind:'Secret',metadata:{name:'synthetic-acceptance',namespace:'manager-acceptance'},data:{token:Buffer.from('synthetic-test-value').toString('base64')}};
 const manifest={apiVersion:'v1',kind:'ConfigMap',metadata:{name:'synthetic-acceptance',namespace:'manager-acceptance'},data:{value:'v1'}};
 const current={configuration:{id:'acceptance',name:'Acceptance test',ports:[]},routeManifests:[manifest],snapshotScope:{label:'Isolated manager acceptance',namespace:'manager-acceptance'}};
 const ids=[];
 try {
  assert.equal((await request('/api/snapshots',{current,scopeKey:'acceptance'},'POST','https://wrong.invalid')).status,403);
  assert.equal((await request('/api/snapshots',{current:{...current,routeManifests:[secret]},scopeKey:'acceptance'})).status,400);
  let response=await request('/api/snapshots',{current,scopeKey:'acceptance'});assert.equal(response.status,201);const plain=await response.json();ids.push(plain.id);
  response=await request('/api/snapshots',{current:{...current,routeManifests:[manifest,secret]},scopeKey:'acceptance',password});assert.equal(response.status,201);const encrypted=await response.json();ids.push(encrypted.id);
  assert.equal((await fetch(base+`/api/snapshots/${encrypted.id}`)).status,422);
  assert.equal((await request(`/api/snapshots/${encrypted.id}/unlock`,{password:'incorrect'})).status,422);
  response=await request(`/api/snapshots/${encrypted.id}/unlock`,{password});assert.equal(response.status,200);assert.deepEqual((await response.json()).current.routeManifests.find(r=>r.kind==='Secret'),secret);
  const zip=Buffer.from(await (await fetch(base+`/api/snapshots/${encrypted.id}/backup.zip`)).arrayBuffer());assert.equal(zip.includes(Buffer.from(secret.data.token)),false);assert.equal(zip.includes(Buffer.from(password)),false);
  response=await request('/api/snapshots/merge',{ids,priorityOrder:ids,passwords:{[encrypted.id]:password},password});assert.equal(response.status,201);const merged=await response.json();
  assert.equal((await request('/api/snapshots/delete',{ids,backupId:merged.id,merged:true,passwords:{[encrypted.id]:password},backupPassword:password})).status,200);
  assert.equal((await fetch(base+`/api/snapshots/${plain.id}`)).status,404);
  const schedule={enabled:true,interval:1,unit:'minutes',includeSecrets:true,password,current:{...current,routeManifests:[manifest,secret]}};
  assert.equal((await request('/api/snapshot-schedule',schedule,'PUT')).status,200);
  assert.equal((await get('/api/snapshot-schedule')).hasPassword,true);
  const podName=`${plugin}-snapshots-0`,before=JSON.parse((await run(kubectl,['-n','manager-system','get','pod',podName,'-o','json'])).stdout);
  await run(kubectl,['-n','manager-system','delete','pod',podName,'--wait=false']);
  const restartDeadline=Date.now()+120000;let restarted=false;
  while(Date.now()<restartDeadline){
    try{const after=JSON.parse((await run(kubectl,['-n','manager-system','get','pod',podName,'-o','json'])).stdout);if(after.metadata.uid!==before.metadata.uid && after.status.conditions?.some(c=>c.type==='Ready'&&c.status==='True')){restarted=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,2000));
  }
  assert.ok(restarted,'A new ready pod was not observed');
  assert.equal((await get('/api/snapshot-schedule')).enabled,true);
  const deadline=Date.now()+90000;let automatic;
  while(Date.now()<deadline){automatic=(await get('/api/snapshots')).snapshots.find(s=>s.generation==='Automatic'&&s.createdAt>encrypted.createdAt);if(automatic)break;await new Promise(r=>setTimeout(r,2000));}
  assert.ok(automatic,'Scheduled encrypted snapshot did not run after restart');assert.equal(automatic.encrypted,true);
  assert.equal((await fetch(base+`/api/snapshots/${automatic.id}`)).status,422);
  const unlockedAutomatic=await request(`/api/snapshots/${automatic.id}/unlock`,{password});assert.equal(unlockedAutomatic.status,200);assert.deepEqual((await unlockedAutomatic.json()).current.routeManifests.find(r=>r.kind==='Secret'),secret);
  const storage=await get('/api/snapshot-storage');assert.equal(storage.mockCapacity,false);assert.equal(storage.quotaBytes,1073741824);assert.ok(storage.availableBytes>0);
  results.push({plugin,passed:true,mergedArchive:merged.id,automaticArchive:automatic.id,checks:['cross-origin rejection','plaintext Secret rejection','encrypted archive','wrong password','unlock','merge','recovery-backed deletion','persistent schedule','automatic encrypted capture after pod restart','named password vault','real 1 GiB quota']});
  console.log(`${plugin}: encrypted recovery, merge, scheduling and restart checks passed.`);
 } finally {
  const restored=await request('/api/snapshot-schedule',{enabled:false,interval:prior.interval,unit:prior.unit,includeSecrets:false},'PUT');
  assert.equal(restored.status,200,'Test schedule could not be disabled');
  fs.writeFileSync(`${root}/snapshot-live-tests.json`,JSON.stringify(results,null,2));
 }
}
