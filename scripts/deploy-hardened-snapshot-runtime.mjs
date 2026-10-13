import fs from 'node:fs';
import assert from 'node:assert/strict';
const root='.local/manager-installation',file=root+'/hardened-snapshot-runtime-11-owned.json',base='http://127.0.0.1:15889';
const image='harbor.cormierconsulting.io/automation/manager-snapshot-api:2026.10.12-11@sha256:843c44f6f6cfdd13967bd3fbff681ebaa3f0caa9145b740e0ed1361a2156e1e3';
const scan=JSON.parse(fs.readFileSync(root+'/dns-recovery-image-scan-11-tests.json'));assert.ok(scan.passed);assert.equal(scan.vulnerabilities.total,0);
assert.ok(!fs.existsSync(file),'Reconcile existing deployment intent instead of replaying it.');
async function call(path,init={}){const r=await fetch(base+path,{...init,signal:AbortSignal.timeout(20000)});assert.ok(r.ok,'Kubernetes '+r.status);return r.json();}
const ledger={startedAt:new Date().toISOString(),image,targets:[]};
for(const name of ['dns-manager-snapshots','network-manager-snapshots']){
 const path='/apis/apps/v1/namespaces/manager-system/statefulsets/'+name,before=await call(path);
 assert.equal(before.status.readyReplicas,before.spec.replicas);assert.equal(before.spec.template.spec.containers.length,1);
 assert.match(before.spec.template.spec.containers[0].image,new RegExp('manager-snapshot-api:2026\\.10\\.12-'+(name.startsWith('dns')?'10':'8')+'@sha256:'));
 fs.writeFileSync(root+'/'+name+'-before-hardened-11.json',JSON.stringify(before,null,2));
 const indexPath='/api/v1/namespaces/manager-system/services/http:'+name+':8080/proxy/api/snapshots';
 const snapshotIds=(await call(indexPath)).snapshots.map(s=>s.id).sort();
 ledger.targets.push({name,path,indexPath,uid:before.metadata.uid,beforeSpec:before.spec,snapshotIds,oldImage:before.spec.template.spec.containers[0].image,status:'Prepared'});
}
const save=()=>fs.writeFileSync(file,JSON.stringify(ledger,null,2));save();
for(const target of ledger.targets){
 const current=await call(target.path);assert.equal(current.metadata.uid,target.uid);assert.deepEqual(current.spec,target.beforeSpec);
 current.spec.template.spec.containers[0].image=image;const expected=structuredClone(current.spec);
 await call(target.path+'?dryRun=All',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(current)});
 target.status='Submitting';save();const applied=await call(target.path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(current)});assert.equal(applied.metadata.uid,target.uid);assert.deepEqual(applied.spec,expected);target.status='Accepted';target.generation=applied.metadata.generation;save();
 const end=Date.now()+180000;let ready=false;while(Date.now()<end){const live=await call(target.path);if(live.status.observedGeneration>=target.generation&&live.status.currentRevision===live.status.updateRevision&&live.status.readyReplicas===live.spec.replicas){ready=true;break;}await new Promise(r=>setTimeout(r,2000));}assert.ok(ready,'Deployment still pending; reconcile original target without resubmitting.');
 assert.deepEqual((await call(target.indexPath)).snapshots.map(s=>s.id).sort(),target.snapshotIds);target.status='Ready';save();console.log(target.name+': hardened runtime Ready; original StatefulSet specification and snapshot index preserved.');
}
ledger.passed=true;ledger.finishedAt=new Date().toISOString();save();
