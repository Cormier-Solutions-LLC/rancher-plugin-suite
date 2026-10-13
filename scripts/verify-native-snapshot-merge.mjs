import fs from 'node:fs';
import assert from 'node:assert/strict';
import {containsSecretValues} from '../simple-network-manager-dev/pkg/simple-network-manager/config/backup-zip.mjs';
const phase=process.argv[2],root='.local/manager-installation',file=root+'/native-snapshot-merge-before.json',base='http://127.0.0.1:15888',api='/api/v1/namespaces/manager-system/services/http:network-manager-snapshots:8080/proxy';
assert.ok(['before','after'].includes(phase));
async function read(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);return r.json();}
async function resources(){return (await Promise.all(['/apis/cert-manager.io/v1/clusterissuers','/apis/cert-manager.io/v1/issuers','/apis/cert-manager.io/v1/certificates'].map(read))).flatMap(list=>list.items.map(r=>({kind:list.kind,name:r.metadata.name,namespace:r.metadata.namespace||'',uid:r.metadata.uid,spec:r.spec}))).sort((a,b)=>(a.kind+'/'+a.namespace+'/'+a.name).localeCompare(b.kind+'/'+b.namespace+'/'+b.name));}
const index=(await read(api+'/api/snapshots')).snapshots,cm=await read('/api/v1/namespaces/cattle-ui-plugin-system/configmaps/network-manager-state-user-jccb4');
if(phase==='before'){
 assert.ok(!fs.existsSync(file));
 const protectedSource=JSON.parse(fs.readFileSync(root+'/native-protected-snapshot-before.json')).snapshotId,automaticSource=JSON.parse(fs.readFileSync(root+'/native-snapshot-schedule-before.json')).snapshotId;
 assert.ok(index.some(r=>r.id===protectedSource&&r.encrypted));assert.ok(index.some(r=>r.id===automaticSource&&!r.encrypted));
 fs.writeFileSync(file,JSON.stringify({ids:index.map(r=>r.id),priorityOrder:[protectedSource,automaticSource],stateRevision:cm.metadata.resourceVersion,stateJson:cm.data['state.json'],resources:await resources()},null,2));
 console.log('Owned merge sources and unchanged cluster baseline recorded.');
}else{
 const before=JSON.parse(fs.readFileSync(file)),fresh=index.filter(r=>!before.ids.includes(r.id));assert.equal(fresh.length,1);const merged=fresh[0];assert.equal(merged.encrypted,true);
 assert.equal(cm.metadata.resourceVersion,before.stateRevision);assert.equal(cm.data['state.json'],before.stateJson);assert.ok(JSON.stringify(await resources())===JSON.stringify(before.resources));assert.ok(before.ids.every(id=>index.some(r=>r.id===id)));
 const password=JSON.parse(fs.readFileSync(root+'/native-network-snapshot-password.json')).password;
 const response=await fetch(base+api+'/api/snapshots/'+merged.id+'/unlock',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://rancher.cormierconsulting.io'},body:JSON.stringify({password}),signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);const archive=await response.json();
 assert.ok(containsSecretValues(archive.current));assert.deepEqual(archive.current.pendingChanges,[]);assert.ok(archive.current.routeManifests.some(r=>r.kind==='Issuer'&&r.metadata.namespace==='manager-acceptance'&&r.metadata.name==='manager-native-schedule-issuer'));
 const report={observedAt:new Date().toISOString(),snapshotId:merged.id,encrypted:true,sourceSnapshotsPreserved:before.priorityOrder.length,allOtherSnapshotsPreserved:true,liveIssuerCertificateResourcesPreserved:before.resources.length,managerStateUnchanged:true,mergedIsolatedIssuer:true,passed:true};fs.writeFileSync(root+'/native-snapshot-merge-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
