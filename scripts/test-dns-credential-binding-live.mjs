import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {decodeBackup} from '../dns-manager-dev/pkg/dns-manager/snapshot-feature/config/backup-zip.mjs';
import {orderedDnsRecords} from '../dns-manager-dev/pkg/dns-manager/snapshot-feature/config/dns-record-order.mjs';
const version=process.argv[3]||'16';assert.ok(['16','17'].includes(version));const phase=process.argv[2],root='.local/manager-installation',file=root+'/dns-credential-binding-'+version+'-owned.json',base='http://127.0.0.1:15889';
const api='/api/v1/namespaces/manager-system/services/http:dns-manager-snapshots:8080/proxy/api',statePath='/api/v1/namespaces/cattle-ui-plugin-system/configmaps/dns-manager-state-user-jccb4';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const request=(path,init={})=>fetch(base+path,{...init,signal:AbortSignal.timeout(20000)});
const get=async path=>{const r=await request(path);assert.ok(r.ok,'API '+r.status);return r.json();};
const credentials=()=>Promise.all(['dns-manager-engine-admin','dns-windows-bridge-credential'].map(name=>get('/api/v1/namespaces/dns-system/secrets/'+name)));
async function baseline(){
 const state=await get(statePath),source=JSON.parse((await get('/api/v1/namespaces/dns-system/configmaps/dns-windows-observations')).data['inventory.json']),sa=await get('/api/v1/namespaces/dns-system/serviceaccounts/dns-windows-bridge');
 assert.deepEqual(JSON.parse(state.data['state.json']).drafts,[]);
 return {stateUid:state.metadata.uid,navigationDigest:hash(state.data['navigation.json']),zoneDigests:Object.fromEntries(source.zones.map(z=>[z.id,hash({serial:z.serial,records:orderedDnsRecords(source.records[z.id])})])),queueIds:JSON.parse((await get('/api/v1/namespaces/dns-system/configmaps/dns-windows-queue')).data['jobs.json']).map(j=>j.id),serviceAccount:{uid:sa.metadata.uid,name:sa.metadata.name,namespace:sa.metadata.namespace},credentials:(await credentials()).map(s=>({name:s.metadata.name,uid:s.metadata.uid,resourceVersion:s.metadata.resourceVersion,digest:hash(s.data)}))};
}
let ledger=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):undefined;const save=()=>fs.writeFileSync(file,JSON.stringify(ledger,null,2));
try{
 if(phase==='prepare'){
  assert.ok(!ledger,'Reconcile the original native capture intent.');ledger={startedAt:new Date().toISOString(),status:'Native encrypted capture pending',beforeSnapshotIds:(await get(api+'/snapshots')).snapshots.map(s=>s.id),baseline:await baseline(),checks:[]};save();
  console.log('Native encrypted capture intent and original DNS/credential/archive baselines recorded privately.');
 }else{
  assert.ok(ledger);assert.deepEqual(await baseline(),ledger.baseline);
  const index=(await get(api+'/snapshots')).snapshots,ids=index.map(s=>s.id);
  if(phase==='captured'){
   const fresh=index.filter(s=>!ledger.beforeSnapshotIds.includes(s.id));assert.equal(fresh.length,1);assert.equal(fresh[0].encrypted,true);
   if(ledger.snapshotId)assert.equal(fresh[0].id,ledger.snapshotId);else{ledger.snapshotId=fresh[0].id;save();}
   const key=JSON.parse(fs.readFileSync(root+'/dns-credential-capture-13-owned.json')).password;
   assert.equal((await request(api+'/snapshots/'+ledger.snapshotId)).status,422);
   const r=await request(api+'/snapshots/'+ledger.snapshotId+'/backup.zip');assert.ok(r.ok);const bytes=Buffer.from(await r.arrayBuffer());
   await assert.rejects(decodeBackup(bytes,key+'incorrect'));const snapshot=await decodeBackup(bytes,key);
   assert.equal(snapshot.id,ledger.snapshotId);assert.equal(snapshot.current.secretBackup.complete,true);assert.deepEqual(snapshot.current.secretBackup.missing,[]);
   const saved=snapshot.current.routeManifests.filter(s=>s.kind==='Secret'),actual=await credentials();assert.equal(saved.length,2);
   for(const s of actual){const copy=saved.find(c=>c.metadata.name===s.metadata.name);assert.ok(copy);assert.equal(hash(copy.data),hash(s.data));assert.equal(copy.type,s.type);
    for(const value of Object.values(s.data)){assert.ok(!bytes.includes(Buffer.from(value)));assert.ok(!bytes.includes(Buffer.from(value,'base64')));}
   }
   const bridge=saved.find(s=>s.metadata.name==='dns-windows-bridge-credential');assert.equal(bridge.metadata.annotations['kubernetes.io/service-account.uid'],ledger.baseline.serviceAccount.uid);
   assert.equal(fresh[0].coverage.filter(c=>c.capturedValues).length,2);assert.ok(!JSON.stringify(fresh[0]).includes(key));
   ledger.archivePath=root+'/dns-credential-binding-'+version+'-native.zip';fs.writeFileSync(ledger.archivePath,bytes);ledger.archiveDigest=createHash('sha256').update(bytes).digest('hex');
   assert.equal(createHash('sha256').update(fs.readFileSync(ledger.archivePath)).digest('hex'),ledger.archiveDigest);
   ledger.status='Native encrypted capture verified and archived';ledger.checks.push({phase,passed:true,at:new Date().toISOString()});save();
   console.log('Native encrypted capture matches both installed credentials, current service-account binding, encrypted ZIP recovery and redacted index.');
  }else if(phase==='cleanup'){
   assert.ok(ledger.snapshotId&&ledger.archiveDigest);assert.equal(createHash('sha256').update(fs.readFileSync(ledger.archivePath)).digest('hex'),ledger.archiveDigest);
   const retained=JSON.parse(fs.readFileSync(root+'/dns-credential-capture-13-owned.json'));
   if(ids.includes(ledger.snapshotId)){
    assert.ok(!ledger.deleteIntent,'Reconcile the original delete outcome instead of repeating it.');
    assert.deepEqual(ids.filter(id=>id!==ledger.snapshotId).sort(),ledger.beforeSnapshotIds.slice().sort());
    ledger.deleteIntent=new Date().toISOString();save();
    const response=await request(api+'/snapshots/delete',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://rancher.cormierconsulting.io'},body:JSON.stringify({ids:[ledger.snapshotId],backupId:retained.apiSnapshotId,backupPassword:retained.password})});assert.ok(response.ok,'Owned test archive cleanup '+response.status);assert.equal((await response.json()).deleted,1);
   }
   assert.deepEqual((await get(api+'/snapshots')).snapshots.map(s=>s.id).sort(),ledger.beforeSnapshotIds.slice().sort());assert.deepEqual(await baseline(),ledger.baseline);
   ledger.passed=true;ledger.status='Verified; owned test archive preserved privately and active index restored';ledger.finishedAt=new Date().toISOString();save();
   console.log('Only the owned test archive removed after encrypted private recovery verification; all original backups and production state preserved.');
  }else throw new Error('Unknown binding verification phase');
 }
}catch(error){if(ledger){(ledger.failures||=[]).push({phase,at:new Date().toISOString(),message:error.message});save();}throw error;}
