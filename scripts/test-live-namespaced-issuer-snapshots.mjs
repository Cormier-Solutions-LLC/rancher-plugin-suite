import fs from 'node:fs';import assert from 'node:assert/strict';
import {containsSecretValues} from '../simple-network-manager-dev/pkg/simple-network-manager/config/backup-zip.mjs';
const root='.local/manager-installation',reportFile=root+'/live-namespaced-issuer-snapshots-tests.json',base='http://127.0.0.1:15888',api='/api/v1/namespaces/manager-system/services/http:network-manager-snapshots:8080/proxy';
assert.ok(!fs.existsSync(reportFile),'A prior result exists; inspect the original run before considering replay.');
async function read(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json();}
const proof=JSON.parse(fs.readFileSync(root+'/native-namespaced-issuers-tests.json')),archive=await read(api+'/api/snapshots/'+proof.snapshotId);assert.ok(!containsSecretValues(archive.current));assert.equal(archive.current.snapshotScope.namespace,'');
const prior=await read(api+'/api/snapshot-schedule');assert.equal(prior.enabled,false);
const r=await fetch(base+api+'/api/snapshot-schedule/run',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://rancher.cormierconsulting.io'},body:JSON.stringify({current:archive.current}),signal:AbortSignal.timeout(20000)});assert.equal(r.status,201);const saved=await r.json();
// Confirm the returned original snapshot; never replay an uncertain write.
const fresh=await read(api+'/api/snapshots/'+saved.id),profiles=fresh.current.issuerProfiles;
assert.equal(profiles.length,3);assert.deepEqual(fresh.current.pendingChanges,[]);
for(const name of ['godaddy-webhook-ca','godaddy-webhook-selfsign'])assert.ok(profiles.some(p=>p.name===name&&p.manifest.kind==='Issuer'&&p.manifest.metadata.namespace==='cert-manager'));
assert.ok(fresh.current.snapshotScope.capturedFrom.startsWith('Fresh Kubernetes reads'));assert.equal((await read(api+'/api/snapshot-schedule')).enabled,false);
const before=JSON.parse(fs.readFileSync(root+'/native-namespaced-issuers-before.json')),lists=await Promise.all(['/apis/cert-manager.io/v1/clusterissuers','/apis/cert-manager.io/v1/issuers','/apis/cert-manager.io/v1/certificates'].map(read));
const resources=lists.flatMap(l=>l.items.map(v=>({kind:l.kind.replace(/List$/,''),name:v.metadata.name,namespace:v.metadata.namespace||'',uid:v.metadata.uid,spec:v.spec}))).sort((a,b)=>(a.kind+'/'+a.namespace+'/'+a.name).localeCompare(b.kind+'/'+b.namespace+'/'+b.name));assert.deepEqual(resources,before.resources);
const report={observedAt:new Date().toISOString(),snapshotId:saved.id,freshProfiles:profiles.length,namespacedIssuers:2,scheduleRemainsDisabled:true,liveResourcesPreserved:resources.length,passed:true};fs.writeFileSync(reportFile,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
