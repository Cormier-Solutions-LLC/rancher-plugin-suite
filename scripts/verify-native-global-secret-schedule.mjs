import fs from 'node:fs';import assert from 'node:assert/strict';
import {freshNetworkSnapshot} from '../preview-data/fresh-network-source.mjs';
import {secretReferences} from '../simple-network-manager-dev/pkg/simple-network-manager/config/snapshot-secrets.mjs';
const phase=process.argv[2],root='.local/manager-installation',file=root+'/native-global-secret-schedule-before.json',base='http://127.0.0.1:15888',api='/api/v1/namespaces/manager-system/services/http:network-manager-snapshots:8080/proxy';assert.ok(['before','after'].includes(phase));process.env.SNAPSHOT_NETWORK_STATE_CONFIGMAP='network-manager-state-user-jccb4';
async function read(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);return r.json();}
const schedule=await read(api+'/api/snapshot-schedule'),index=(await read(api+'/api/snapshots')).snapshots;
if(phase==='before'){assert.equal(schedule.enabled,false);assert.ok(!fs.existsSync(file));fs.writeFileSync(file,JSON.stringify({ids:index.map(r=>r.id),createdAt:new Date().toISOString()},null,2));console.log('Recorded disabled schedule before native all-namespace encrypted capture.');}
else{
 assert.equal(schedule.enabled,true);assert.equal(schedule.includeSecrets,true);assert.equal(schedule.scope.namespace,'');const before=JSON.parse(fs.readFileSync(file)),records=index.filter(r=>r.generation==='Automatic'&&!before.ids.includes(r.id));
 if(!records.length){console.log(JSON.stringify({waiting:true,nextRun:schedule.nextRun,lastError:schedule.lastError||null}));process.exit(0);}
 const password=JSON.parse(fs.readFileSync(root+'/native-network-snapshot-password.json')).password,record=records.at(-1);assert.equal(record.encrypted,true);assert.equal((await fetch(base+api+'/api/snapshots/'+record.id)).status,422);
 const response=await fetch(base+api+'/api/snapshots/'+record.id+'/unlock',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://rancher.cormierconsulting.io'},body:JSON.stringify({password}),signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);const current=(await response.json()).current;
 const fresh=(await freshNetworkSnapshot({snapshotScope:{namespace:'',source:'Authenticated Kubernetes inventory and saved manager configuration'}},read)).current,refs=secretReferences(fresh.routeManifests,'cert-manager');
 const secrets=current.routeManifests.filter(r=>r.kind==='Secret'&&r.data);assert.equal(secrets.length,refs.length);assert.ok(refs.every(ref=>secrets.some(secret=>secret.metadata.name===ref.name&&secret.metadata.namespace===ref.namespace)));assert.equal(current.secretBackup.complete,true);assert.deepEqual(current.pendingChanges,[]);
 const report={observedAt:new Date().toISOString(),snapshotId:record.id,nativeAllNamespaceSchedule:true,encrypted:true,capturedReferencedSecrets:secrets.length,secretNamespaces:new Set(secrets.map(r=>r.metadata.namespace)).size,passwordRequired:true,passed:true};fs.writeFileSync(root+'/native-global-secret-schedule-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
