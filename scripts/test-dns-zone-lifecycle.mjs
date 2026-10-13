import fs from 'node:fs';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {createLiveDnsSource} from '../live-management/rancher-dns.mjs';
const phase=process.argv[2],root='.local/manager-installation',file=root+'/dns-zone-lifecycle-owned.json',reportFile=root+'/dns-zone-lifecycle-tests.json',base='http://127.0.0.1:15889',snapshotApi='/api/v1/namespaces/manager-system/services/http:dns-manager-snapshots:8080/proxy/api/snapshots',queuePath='/api/v1/namespaces/dns-system/configmaps/dns-windows-queue';
const run=promisify(execFile),request=(path,init={})=>fetch(base+path.replace('/k8s/clusters/local',''),{...init,signal:AbortSignal.timeout(20000)});
const call=async(path,init)=>{const response=await request(path,init);assert.ok(response.ok,`API ${response.status}`);return response.json();};
const source=createLiveDnsSource('local',request,'user-jccb4');
const inventory=async()=>(await source.reload()).data.inventory;
const recordKey=r=>JSON.stringify([r.name,r.type,r.value,r.ttl]);
const normalize=inv=>Object.fromEntries(inv.zones.filter(z=>!ledger?.zones?.some(o=>o.name===z.name)).map(z=>[z.name,inv.records[z.id].filter(r=>r.type!=='SOA'&&!ledger?.zones?.some(o=>o.parentZone===z.name&&o.delegationRecords?.some(owned=>recordKey(owned)===recordKey(r)))).map(recordKey).sort()]));
let ledger=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):undefined;
for(const entry of ledger?.zones||[]){if(!Array.isArray(entry.delegationRecords))entry.delegationRecords=entry.delegationRecords?.type?[entry.delegationRecords]:[];}
const save=()=>fs.writeFileSync(file,JSON.stringify(ledger,null,2));
const pass=(check,details={})=>{ledger.results.push({check,passed:true,at:new Date().toISOString(),...details});save();console.log(check+' passed.');};
async function backup(inv=undefined,{incomplete=false}={}){
 inv||=await inventory();
 const current={configuration:{id:'source/'+inv.source.name,name:inv.source.name,kind:'DnsSource',dns:inv.source},relatedConfigurations:inv.zones.map(z=>({id:'zone/'+z.id,name:z.name,namespace:'dns-system',kind:'DnsZone',dns:{zone:z,records:incomplete&&ledger.zones.some(o=>o.name===z.name)?[]:inv.records[z.id]}})),pendingChanges:[],routeManifests:[],snapshotScope:{label:'Owned zone lifecycle acceptance backup',source:'Authenticated DNS management observations'}};
 const saved=await call(snapshotApi,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://rancher.cormierconsulting.io'},body:JSON.stringify({current,scopeKey:JSON.stringify(current)})});ledger.snapshots.push(saved.id);save();return saved.id;
}
async function apply(changes){return source.stageChanges({changes:changes.map(change=>({...change,id:randomUUID()})),snapshotId:await backup()});}
async function nativeJob(operations,options={}){
 const inv=await inventory(),snapshotId=options.noSnapshot?'':await backup(inv,options),id=randomUUID();ledger.jobs.push(id);save();
 const serials=Object.fromEntries(inv.zones.map(z=>[z.name,options.stale?String(Number(z.serial)-1):z.serial]));
 const cm=await call(queuePath),jobs=JSON.parse(cm.data['jobs.json']);assert.ok(!jobs.some(j=>['Queued','Running'].includes(j.status)));
 cm.data['jobs.json']=JSON.stringify([...jobs,{id,createdAt:new Date().toISOString(),requestedBy:'owned-zone-acceptance',status:'Queued',snapshotId,serials,operations,receipts:[],startedAt:null,finishedAt:null,error:''}]);await call(queuePath,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(cm)});
 const end=Date.now()+90000;while(Date.now()<end){const job=JSON.parse((await call(queuePath)).data['jobs.json']).find(j=>j.id===id);if(['Applied','Rejected','PartialFailure','Interrupted'].includes(job?.status))return job;await new Promise(resolve=>setTimeout(resolve,1000));}throw new Error('Original zone acceptance job is unresolved; do not resubmit '+id);
}
async function query(name,type,value){
 const observations=[];
 for(const server of ['10.99.3.2','10.99.15.55','10.99.15.56','10.99.15.57','10.99.15.58'])for(const transport of ['udp','tcp']){
  const {stdout}=await run('dotnet',['dns-manager-dev/tests/LiveQuery/bin/Release/net10.0/LiveQuery.dll',server,name,type,transport],{timeout:20000});const answer=JSON.parse(stdout);
  assert.equal(answer.rcode,'NoError',`${server} ${transport} ${name}`);assert.ok(answer.authoritative);assert.ok(answer.answers.some(r=>r.type===type&&(value===undefined||r.value.replace(/\.$/,'')===value)),`${server} ${transport} missing reviewed data`);observations.push({server,transport,name,type,passed:true});
 }return observations;
}
async function ownedZone(entry){const inv=await inventory(),zone=inv.zones.find(z=>z.name===entry.name);assert.ok(zone?.managed&&zone.ownerId);if(entry.ownerId)assert.equal(zone.ownerId,entry.ownerId);else entry.ownerId=zone.ownerId;entry.parentZone=zone.parentZone;entry.delegationRecords=zone.delegationRecords||[];save();return zone;}
try{
 if(phase==='prepare'){
  assert.ok(!ledger,'The owned lifecycle ledger already exists. Resume its current phase instead.');const inv=await inventory();assert.ok(inv.source.managementReachable&&inv.replicas.every(r=>r.reachable));
  ledger={startedAt:new Date().toISOString(),zones:[{name:'manager-zone-'+randomUUID().slice(0,8)+'.invalid',kind:'Forward',native:true},{name:'100.51.198.in-addr.arpa',kind:'Reverse'},{name:'8.b.d.0.1.0.0.2.ip6.arpa',kind:'Reverse'}],snapshots:[],jobs:[],results:[]};assert.ok(ledger.zones.every(o=>!inv.zones.some(z=>z.name===o.name)));ledger.before=normalize(inv);ledger.beforeSnapshotIds=(await call(snapshotApi)).snapshots.map(s=>s.id);save();console.log(JSON.stringify({nativeZone:ledger.zones[0].name,reverseZones:ledger.zones.slice(1).map(z=>z.name)}));
 }else{
  assert.ok(ledger);assert.deepEqual(normalize(await inventory()),ledger.before,'Existing source records or TTLs changed.');
  if(phase==='native-created'){
   const deadline=Date.now()+120000;while(Date.now()<deadline){const inv=await inventory();if(inv.zones.find(z=>z.name===ledger.zones[0].name)?.replication==='Synced')break;await new Promise(resolve=>setTimeout(resolve,1000));}
   const entry=ledger.zones[0];await ownedZone(entry);const inv=await inventory();assert.equal(inv.zones.find(z=>z.name===entry.name).replication,'Synced');const jobs=JSON.parse((await call(queuePath)).data['jobs.json']);const own=jobs.filter(j=>j.status==='Applied'&&j.operations?.some(o=>o.operation==='CreateZone'&&o.zone===entry.name));assert.equal(own.length,1);assert.ok(own[0].receipts.every(r=>r.readBack));ledger.jobs.push(own[0].id);save();pass('Native Rancher forward-zone creation and all three transfers',{queries:await query(entry.name,'SOA')});
  }else if(phase==='reverse'){
   for(const entry of ledger.zones.slice(1)){
    const receipt=await apply([{kind:'zone',zone:entry.name,type:entry.kind}]);assert.ok(receipt.replicationVerified);ledger.jobs.push(receipt.id);await ownedZone(entry);pass('Live '+entry.name+' reverse-zone creation and three transfers',{queries:await query(entry.name,'SOA')});
   }
  }else if(phase==='negative'){
   const forward=ledger.zones[0],zone=await ownedZone(forward),deletion={operation:'DeleteZone',zone:forward.name,ownerId:zone.ownerId};
   const cases=[['Protected AD zone deletion',[{operation:'DeleteZone',zone:'cormierconsulting.com',ownerId:zone.ownerId}],{},/cannot be deleted/],['Duplicate primary zone creation',[{operation:'CreateZone',zone:'cormierconsulting.io',kind:'Forward'}],{},/already exists/],['Malformed zone creation',[{operation:'CreateZone',zone:'-bad.invalid',kind:'Forward'}],{},/Invalid/],['Missing durable zone snapshot',[{operation:'CreateZone',zone:'manager-no-backup.invalid',kind:'Forward'}],{noSnapshot:true},/snapshot/],['Stale zone deletion',[deletion],{stale:true},/changed after review/],['Incomplete zone deletion snapshot',[deletion],{incomplete:true},/complete reviewed/],['Wrong zone ownership',[{...deletion,ownerId:randomUUID()}],{},/ownership changed/],['Mixed zone and record batch',[{operation:'CreateZone',zone:'manager-mixed.invalid',kind:'Forward'},{operation:'Create',zone:'manager-mixed.invalid',name:'fixture',type:'A',value:'192.0.2.5',ttl:60}],{},/separately/]];
   for(const [label,operations,options,error] of cases){const receipt=await nativeJob(operations,options);assert.equal(receipt.status,'Rejected',receipt.error);assert.deepEqual(receipt.receipts,[]);assert.match(receipt.error,error);pass(label+' refused before DNS writes');}
   for(const entry of ledger.zones)await ownedZone(entry);
  }else if(phase==='records'){
   const entry=ledger.zones[0];await ownedZone(entry);const receipt=await apply([{kind:'record',zone:entry.name,name:'fixture',type:'A',value:'192.0.2.215',ttl:30},{kind:'record',zone:entry.name,name:'fixture-txt',type:'TXT',value:'owned-zone-lifecycle',ttl:30}]);ledger.jobs.push(receipt.id);save();
   const end=Date.now()+90000;while(Date.now()<end){const inv=await inventory();if(inv.zones.find(z=>z.name===entry.name).replication==='Synced')break;await new Promise(resolve=>setTimeout(resolve,1000));}pass('Record writes in a new manager-owned zone',{queries:await query('fixture.'+entry.name,'A','192.0.2.215')});
  }else if(phase==='delegation'){
   let entry=ledger.zones.find(z=>z.name.startsWith('manager-delegation-')&&!z.deleted);
   if(!entry){entry={name:'manager-delegation-'+randomUUID().slice(0,8)+'.cormierconsulting.io',kind:'Forward'};ledger.zones.push(entry);save();const created=await apply([{kind:'zone',zone:entry.name,type:entry.kind}]);assert.ok(created.replicationVerified);ledger.jobs.push(created.id);}
   const zone=await ownedZone(entry);assert.equal(zone.parentZone,'cormierconsulting.io');assert.equal(zone.delegationRecords.length,1);assert.equal(zone.delegationRecords[0].type,'NS');assert.deepEqual(normalize(await inventory()),ledger.before);pass('New child-zone ownership covers its automatic parent delegation',{queries:await query(entry.name,'SOA')});
   const removed=await apply([{kind:'delete',zone:'zones',items:[entry.name]}]);assert.ok(removed.replicationVerified);ledger.jobs.push(removed.id);save();const inv=await inventory();assert.ok(!inv.zones.some(z=>z.name===entry.name));assert.ok(!inv.records[entry.parentZone].some(r=>entry.delegationRecords.some(d=>recordKey(d)===recordKey(r))));assert.deepEqual(normalize(inv),ledger.before);entry.deleted=true;save();pass('Owned child-zone deletion removes only its automatic parent delegation and confirms all three replicas');
  }else if(phase==='native-deleted'){
   const entry=ledger.zones[0],inv=await inventory();assert.ok(!inv.zones.some(z=>z.name===entry.name));const lifecycle=inv.zoneLifecycle.filter(r=>r.zone===entry.name&&r.ownerId===entry.ownerId);assert.ok([0,1,2].every(i=>lifecycle.some(r=>r.replica===i&&r.status==='Absent'&&r.readBack)));const jobs=JSON.parse((await call(queuePath)).data['jobs.json']);const own=jobs.filter(j=>j.status==='Applied'&&j.operations?.some(o=>o.operation==='DeleteZone'&&o.zone===entry.name));assert.equal(own.length,1);ledger.jobs.push(own[0].id);save();pass('Native Rancher forward-zone deletion and all three replica removals');
  }else if(phase==='cleanup'){
   assert.ok(ledger.results.some(r=>r.check==='Native Rancher forward-zone deletion and all three replica removals'));
   for(const entry of ledger.zones.slice(1).filter(e=>!e.deleted)){await ownedZone(entry);const receipt=await apply([{kind:'delete',zone:'zones',items:[entry.name]}]);assert.ok(receipt.replicationVerified);ledger.jobs.push(receipt.id);save();pass('Live '+entry.name+' owned reverse-zone deletion and replica removals');}
   const inv=await inventory();assert.ok(ledger.zones.every(o=>!inv.zones.some(z=>z.name===o.name)));assert.deepEqual(normalize(inv),ledger.before);
   // Remove only backups created after the baseline and attested to this fixture.
   const index=(await call(snapshotApi)).snapshots,owned=[];
   for(const record of index.filter(s=>!ledger.beforeSnapshotIds.includes(s.id))){const snapshot=await call(snapshotApi+'/'+record.id);if(ledger.snapshots.includes(record.id)||snapshot.current?.pendingChanges?.some(d=>ledger.zones.some(z=>d.zone===z.name||d.zone==='zones'&&d.items?.includes(z.name))))owned.push(record);}
   let recovery;
   for(const record of index.filter(s=>ledger.beforeSnapshotIds.includes(s.id)&&!s.encrypted&&Date.now()-Date.parse(s.createdAt)<86400000)){
    const snapshot=await call(snapshotApi+'/'+record.id),names=[snapshot.current?.configuration,...snapshot.current?.relatedConfigurations||[]].filter(c=>c?.kind==='DnsZone').map(c=>c.name);
    if(Object.keys(ledger.before).every(name=>names.includes(name))){recovery=record.id;break;}
   }
   assert.ok(recovery,'A recent existing full source backup is required before removing fixture copies.');
   // Retain recoverable ZIP copies privately before using the normal deletion API.
   const archiveRoot=root+'/dns-zone-lifecycle-backup-archives';fs.mkdirSync(archiveRoot,{recursive:true});ledger.archivedSnapshots||=[];
   for(const record of owned){const response=await request(snapshotApi+'/'+record.id+'/backup.zip');assert.ok(response.ok);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,2).toString(),'PK');fs.writeFileSync(archiveRoot+'/'+record.id+'.zip',bytes);const sha256=createHash('sha256').update(bytes).digest('hex');assert.equal(createHash('sha256').update(fs.readFileSync(archiveRoot+'/'+record.id+'.zip')).digest('hex'),sha256);ledger.archivedSnapshots.push({id:record.id,sha256});save();}
   if(owned.length){const result=await call(snapshotApi+'/delete',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://rancher.cormierconsulting.io'},body:JSON.stringify({ids:owned.map(s=>s.id),backupId:recovery})});assert.equal(result.deleted,owned.length);ledger.snapshots=ledger.snapshots.filter(id=>!owned.some(s=>s.id===id));ledger.cleanupRecoveryBackupId=recovery;save();}
   assert.deepEqual((await call(snapshotApi)).snapshots.map(s=>s.id).sort(),ledger.beforeSnapshotIds.slice().sort());
   pass('All owned zone fixtures removed and fixture backups privately archived; existing source records and original snapshots preserved');ledger.finishedAt=new Date().toISOString();ledger.passed=true;if(ledger.lastFailure){ledger.resolvedFailures||=[];ledger.resolvedFailures.push(ledger.lastFailure);delete ledger.lastFailure;}save();
  }else throw new Error('Unsupported phase');
 }
}catch(error){if(ledger){ledger.lastFailure={phase,message:error.message,at:new Date().toISOString()};save();}throw error;}
finally{if(ledger)fs.writeFileSync(reportFile,JSON.stringify({startedAt:ledger.startedAt,finishedAt:ledger.finishedAt,passed:ledger.passed===true,zones:ledger.zones,results:ledger.results,lastFailure:ledger.lastFailure},null,2));}
