// Create one Secret-free issuer only after native scheduling is enabled.
import fs from 'node:fs';import assert from 'node:assert/strict';
const phase=process.argv[2],root='.local/manager-installation',file=root+'/native-snapshot-schedule-before.json',base='http://127.0.0.1:15888',api='/api/v1/namespaces/manager-system/services/http:network-manager-snapshots:8080/proxy',name='manager-native-schedule-issuer',namespace='manager-acceptance',path=`/apis/cert-manager.io/v1/namespaces/${namespace}/issuers/${name}`;
assert.ok(['before','create','observed','removed'].includes(phase));
async function read(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json();}
async function others(){const lists=await Promise.all(['/apis/cert-manager.io/v1/clusterissuers','/apis/cert-manager.io/v1/issuers','/apis/cert-manager.io/v1/certificates'].map(read));return lists.flatMap(l=>l.items.filter(r=>!(l.kind==='IssuerList'&&r.metadata.name===name&&r.metadata.namespace===namespace)).map(r=>({kind:l.kind.replace(/List$/,''),name:r.metadata.name,namespace:r.metadata.namespace||'',uid:r.metadata.uid,spec:r.spec}))).sort((a,b)=>(a.kind+'/'+a.namespace+'/'+a.name).localeCompare(b.kind+'/'+b.namespace+'/'+b.name));}
const schedule=await read(api+'/api/snapshot-schedule');
if(phase==='before'){assert.ok(!fs.existsSync(file));assert.equal(schedule.enabled,false);assert.equal((await fetch(base+path)).status,404);fs.writeFileSync(file,JSON.stringify({observedAt:new Date().toISOString(),schedule,others:await others()},null,2));console.log('Disabled schedule and all other live issuer/certificate resources recorded.');}
else{
 const before=JSON.parse(fs.readFileSync(file));assert.ok(JSON.stringify(await others())===JSON.stringify(before.others),'Other live resource identities and specifications must remain unchanged');
 if(phase==='create'){
  assert.ok(!before.uid);assert.equal(schedule.enabled,true);assert.equal(schedule.interval,1);assert.equal(schedule.unit,'minutes');assert.equal(schedule.scope.namespace,namespace);assert.equal((await fetch(base+path)).status,404);
  const r=await fetch(base+path.replace('/'+name,''),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiVersion:'cert-manager.io/v1',kind:'Issuer',metadata:{name,namespace,labels:{'app.kubernetes.io/part-of':'manager-acceptance'}},spec:{selfSigned:{}}}),signal:AbortSignal.timeout(15000)});assert.equal(r.status,201);const resource=await r.json();before.uid=resource.metadata.uid;before.createdAt=resource.metadata.creationTimestamp;fs.writeFileSync(file,JSON.stringify(before,null,2));console.log('Created one isolated namespaced self-signed issuer after native scope save; no Certificate or Secret requested.');
 }else{
  assert.ok(before.uid);let snapshot;
  if(phase==='observed'){
   const fixture=await read(path);assert.equal(fixture.metadata.uid,before.uid);assert.deepEqual(fixture.spec,{selfSigned:{}});
   const candidates=(await read(api+'/api/snapshots')).snapshots.filter(s=>s.generation==='Automatic'&&s.createdAt>=before.createdAt).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
   for(const candidate of candidates){const archive=await read(api+'/api/snapshots/'+candidate.id);if(archive.current.issuerProfiles.some(p=>p.name===name&&p.manifest.kind==='Issuer'&&p.manifest.metadata.namespace===namespace)){snapshot=candidate;assert.deepEqual(archive.current.pendingChanges,[]);assert.ok(archive.current.routeManifests.every(r=>!r.metadata.namespace||r.metadata.namespace===namespace));assert.equal(archive.current.snapshotScope.namespace,namespace);break;}}
   if(!snapshot){console.log(JSON.stringify({waiting:true,enabled:schedule.enabled,nextRun:schedule.nextRun,lastError:schedule.lastError||null}));process.exit(0);}
   before.snapshotId=snapshot.id;fs.writeFileSync(file,JSON.stringify(before,null,2));
  }else{assert.equal(schedule.enabled,false);assert.equal((await fetch(base+path)).status,404);assert.ok(before.snapshotId);
   const cm=await read('/api/v1/namespaces/cattle-ui-plugin-system/configmaps/network-manager-state-user-jccb4'),state=JSON.parse(cm.data['state.json']);assert.equal(state.pendingChanges.length,0);assert.ok(!state.issuerProfiles.some(p=>p.name===name&&p.manifest.kind==='Issuer'&&p.manifest.metadata.namespace===namespace));
   const process=state.runningProcesses.filter(p=>p.name===name&&p.namespace===namespace).at(-1);assert.equal(process.progress,100);assert.equal(process.receipt.applied.length,1);assert.equal(process.receipt.applied[0].operation,'Delete');assert.equal(process.receipt.applied[0].readBack,true);assert.equal(process.receipt.catalog.length,1);assert.equal(process.receipt.catalog[0].kind,'Issuer');assert.equal(process.receipt.catalog[0].namespace,namespace);assert.equal(process.receipt.catalog[0].readBack,true);
  }
  const report={observedAt:new Date().toISOString(),phase,nativeAutomaticSnapshot:before.snapshotId,otherLiveResourcesPreserved:before.others.length,scheduleEnabled:schedule.enabled,passed:true};fs.writeFileSync(root+'/native-snapshot-schedule-'+phase+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }
}
