import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {orderedDnsRecords} from '../dns-manager-dev/pkg/dns-manager/snapshot-feature/config/dns-record-order.mjs';
import {coverageEntries} from '../dns-manager-dev/pkg/dns-manager/snapshot-feature/config/snapshot-coverage.mjs';
import {decodeBackup,containsSecretValues} from '../dns-manager-dev/pkg/dns-manager/snapshot-feature/config/backup-zip.mjs';
const phase=process.argv[2],root='.local/manager-installation',file=root+'/dns-record-order-21-owned.json',base='http://127.0.0.1:15889';
const api='/api/v1/namespaces/manager-system/services/http:dns-manager-snapshots:8080/proxy/api/snapshots',statePath='/api/v1/namespaces/cattle-ui-plugin-system/configmaps/dns-manager-state-user-jccb4';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function request(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(20000)});assert.ok(r.ok,'Kubernetes read '+r.status);return r;}
const get=async path=>(await request(path)).json();
let ledger=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):undefined;
const save=()=>fs.writeFileSync(file,JSON.stringify(ledger,null,2));
async function observed(){
 const cm=await get('/api/v1/namespaces/dns-system/configmaps/dns-windows-observations'),source=JSON.parse(cm.data['inventory.json']);
 const state=await get(statePath),navigation=JSON.parse(state.data['navigation.json']);
 const credentials=await Promise.all(['dns-manager-engine-admin','dns-windows-bridge-credential'].map(name=>get('/api/v1/namespaces/dns-system/secrets/'+name)));
 return {source,navigation,stateUid:state.metadata.uid,navigationDigest:hash(state.data['navigation.json']),drafts:JSON.parse(state.data['state.json']).drafts,
  queueIds:JSON.parse((await get('/api/v1/namespaces/dns-system/configmaps/dns-windows-queue')).data['jobs.json']).map(j=>j.id),
  zoneDigests:Object.fromEntries(source.zones.map(z=>[z.id,hash({serial:z.serial,records:orderedDnsRecords(source.records[z.id])})])),
  credentials:credentials.map(s=>({name:s.metadata.name,uid:s.metadata.uid,resourceVersion:s.metadata.resourceVersion,digest:hash(s.data)}))};
}
try{
 if(phase==='prepare'){
  assert.ok(!ledger,'Reconcile the existing capture intent');const current=await observed();assert.deepEqual(current.drafts,[]);
  ledger={startedAt:new Date().toISOString(),status:'Native canonical capture pending',beforeSnapshotIds:(await get(api)).snapshots.map(s=>s.id),
   baseline:Object.fromEntries(['stateUid','navigationDigest','queueIds','zoneDigests','credentials'].map(k=>[k,current[k]])),checks:[]};save();console.log('Recorded original snapshots, DNS record sets/serials, navigation, queue and credential identities privately.');
 }else{
  assert.ok(ledger);const current=await observed();for(const [key,value]of Object.entries(ledger.baseline)){
   const expected=key==='credentials'?value.map(s=>{const update=ledger.credentialMetadataUpdates?.[s.name];if(!update)return s;assert.equal(update.uid,s.uid);assert.equal(update.digest,s.digest);assert.equal(update.originalResourceVersion,s.resourceVersion);return {...s,resourceVersion:update.resourceVersion};}):value;
   assert.deepEqual(current[key],expected,key+' changed');
  }assert.deepEqual(current.drafts,[]);
  const index=(await get(api)).snapshots,newIds=index.filter(s=>!ledger.beforeSnapshotIds.includes(s.id));assert.equal(newIds.length,1);const record=newIds[0];
  if(ledger.snapshotId)assert.equal(record.id,ledger.snapshotId);else{ledger.snapshotId=record.id;save();}
  assert.ok(ledger.beforeSnapshotIds.every(id=>index.some(s=>s.id===id)));assert.equal(record.encrypted,false);
  const saved=await get(api+'/'+record.id);assert.ok(!containsSecretValues(saved));
  const zones=saved.current.relatedConfigurations.filter(c=>c.kind==='DnsZone');assert.equal(zones.length,current.source.zones.length);
  for(const config of zones){const actual=current.source.zones.find(z=>z.id===config.dns.zone.id);assert.ok(actual);assert.equal(config.dns.zone.serial,actual.serial);
   assert.deepEqual(config.dns.records,orderedDnsRecords(current.source.records[actual.id]));assert.equal(config.dns.priority,current.navigation.order.indexOf(actual.id));}
  assert.deepEqual(saved.current.relatedConfigurations.find(c=>c.kind==='DnsNavigation').dns.order,current.navigation.order);
  const expected=coverageEntries(saved.current).filter(e=>!e.incomplete);assert.equal(expected.length,6);
  for(const entry of expected)assert.equal(record.coverage.find(c=>c.id===entry.id)?.digest,createHash('sha256').update(entry.value).digest('hex'));
  if(phase==='captured'){
   const bytes=Buffer.from(await(await request(api+'/'+record.id+'/backup.zip')).arrayBuffer()),decoded=await decodeBackup(bytes);assert.deepEqual(decoded.current,saved.current);assert.ok(!containsSecretValues(decoded));
   const zipPath=root+'/dns-record-order-21-configuration.zip';fs.writeFileSync(zipPath,bytes);ledger.zipDigest=createHash('sha256').update(bytes).digest('hex');
   assert.equal(createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex'),ledger.zipDigest);
   const captureFile=root+'/dns-credential-capture-13-owned.json',capture=JSON.parse(fs.readFileSync(captureFile));
   assert.deepEqual(ledger.beforeSnapshotIds.slice().sort(),[...capture.beforeSnapshotIds,...capture.ownedSnapshots,...(capture.additionalRetainedSnapshotIds||[])].sort());
   capture.additionalRetainedSnapshotIds=[...(capture.additionalRetainedSnapshotIds||[]),record.id];capture.retainedSnapshotEvidence={...(capture.retainedSnapshotEvidence||{}),[record.id]:file};fs.writeFileSync(captureFile,JSON.stringify(capture,null,2));
   ledger.status='Canonical native backup verified and retained';
  }else if(phase==='preserved'){ledger.status='Canonical backup and live baselines verified after native reload';ledger.passed=true;ledger.finishedAt=new Date().toISOString();}
  else throw new Error('Unknown verification phase');
  ledger.checks.push({phase,passed:true,at:new Date().toISOString()});save();console.log(JSON.stringify({passed:true,phase,snapshotCount:index.length,configurationItems:expected.length,canonicalZoneCount:zones.length}));
 }
}catch(error){if(ledger){(ledger.failures||=[]).push({phase,at:new Date().toISOString(),message:error.message});save();}throw error;}
