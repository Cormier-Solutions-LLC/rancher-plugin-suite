import assert from 'node:assert/strict';import {writeFile}from'node:fs/promises';
const base='http://127.0.0.1:15889',api='/api/v1/namespaces/manager-system/services/http:dns-manager-snapshots:8080/proxy';
async function get(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json();}
const workload=await get('/apis/apps/v1/namespaces/manager-system/statefulsets/dns-manager-snapshots');assert.ok(workload.spec.template.spec.containers[0].image.includes('2026.10.13-17@sha256:'));assert.equal(workload.status.readyReplicas,1);
const index=await get(api+'/api/snapshots'),ids=index.snapshots.map(s=>s.id).sort(),schedule=await get(api+'/api/snapshot-schedule');assert.equal(schedule.enabled,false);
const source=index.snapshots.find(s=>!s.encrypted);assert.ok(source);const snapshot=await get(api+'/api/snapshots/'+source.id),current=structuredClone(snapshot.current);
current.routeManifests=(current.routeManifests||[]).filter(r=>r.kind!=='Secret');
const body={current,scopeKey:'capture-permission-denial-only',includeSecrets:true,password:'Synthetic-only-dns-capture-denial-2026!',enabled:false,interval:1,unit:'days'},results=[];
for(const [path,method]of [['/api/snapshots','POST'],['/api/snapshot-schedule/run','POST'],['/api/snapshot-source','PUT'],['/api/snapshot-schedule','PUT']]){
 const r=await fetch(base+api+path,{method,headers:{'Content-Type':'application/json',Origin:'https://rancher.cormierconsulting.io'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});assert.equal(r.status,403,'Missing caller session was not rejected: '+path);const rejected=await r.json();assert.ok(!JSON.stringify(rejected).includes(body.password));results.push({path,method,status:r.status});
}
assert.deepEqual((await get(api+'/api/snapshots')).snapshots.map(s=>s.id).sort(),ids);assert.deepEqual(await get(api+'/api/snapshot-schedule'),schedule);
const report={observedAt:new Date().toISOString(),runtime:17,ready:true,results,snapshotCount:ids.length,snapshotIdsPreserved:true,schedulePreserved:true,credentialWrites:0,archiveWrites:0,nativeAuthorizedCallerTested:false,passed:true};await writeFile('.local/manager-installation/dns-capture-authorization-17-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
