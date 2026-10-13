import fs from 'node:fs';import assert from 'node:assert/strict';
import {containsSecretValues} from '../simple-network-manager-dev/pkg/simple-network-manager/config/backup-zip.mjs';
const phase=process.argv[2],root='.local/manager-installation',file=root+'/native-protected-snapshot-before.json',base='http://127.0.0.1:15888/api/v1/namespaces/manager-system/services/http:network-manager-snapshots:8080/proxy';assert.ok(['before','rejected','saved'].includes(phase));
async function read(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);return r.json();}
const snapshots=(await read('/api/snapshots')).snapshots,schedule=await read('/api/snapshot-schedule');assert.equal(schedule.enabled,false);
if(phase==='before'){assert.ok(!fs.existsSync(file));fs.writeFileSync(file,JSON.stringify({snapshotIds:snapshots.map(s=>s.id)},null,2));console.log('Snapshot index baseline recorded for native encrypted manual capture.');}
else{const before=JSON.parse(fs.readFileSync(file)),fresh=snapshots.filter(s=>!before.snapshotIds.includes(s.id));
 if(phase==='rejected'){assert.equal(fresh.length,0);console.log('Rejected native encrypted capture created no archive and left automatic scheduling disabled.');}
 else{assert.equal(fresh.length,1);const record=fresh[0];assert.equal(record.encrypted,true);assert.equal(record.scope.namespace,'manager-acceptance');
  const password=JSON.parse(fs.readFileSync(root+'/native-network-snapshot-password.json')).password;
  async function unlock(value){return fetch(base+'/api/snapshots/'+record.id+'/unlock',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://rancher.cormierconsulting.io'},body:JSON.stringify({password:value}),signal:AbortSignal.timeout(20000)});}
  const wrong=await unlock('Incorrect-test-password');assert.ok(!wrong.ok);const response=await unlock(password);assert.equal(response.status,200);const archive=await response.json();assert.ok(containsSecretValues(archive.current));assert.deepEqual(archive.current.pendingChanges,[]);
  const secrets=archive.current.routeManifests.filter(r=>r.kind==='Secret'&&(r.data||r.stringData));assert.ok(secrets.length>0);
  before.snapshotId=record.id;fs.writeFileSync(file,JSON.stringify(before,null,2));const report={observedAt:new Date().toISOString(),snapshotId:record.id,encrypted:true,capturedSecretObjects:secrets.length,wrongPasswordRejected:true,correctPasswordVerified:true,scheduleDisabled:true,passed:true};fs.writeFileSync(root+'/native-protected-snapshot-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }
}
