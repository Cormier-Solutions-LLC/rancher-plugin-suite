// Passive proof for local-only issuer removal; never submit or replay a rollout.
import fs from 'node:fs';import assert from 'node:assert/strict';
const phase=process.argv[2],root='.local/manager-installation',base='http://127.0.0.1:15888',name='manager-native-unapplied-issuer',file=root+'/native-unapplied-issuer-before.json';
assert.ok(['before','draft','discarded','prepared','removed'].includes(phase));
async function read(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json();}
async function resources(){const lists=await Promise.all(['/apis/cert-manager.io/v1/clusterissuers','/apis/cert-manager.io/v1/issuers','/apis/cert-manager.io/v1/certificates'].map(read));return lists.flatMap(l=>l.items.map(r=>({kind:l.kind.replace(/List$/,''),name:r.metadata.name,namespace:r.metadata.namespace||'',uid:r.metadata.uid,spec:r.spec}))).sort((a,b)=>(a.kind+'/'+a.namespace+'/'+a.name).localeCompare(b.kind+'/'+b.namespace+'/'+b.name));}
assert.equal((await fetch(base+'/apis/cert-manager.io/v1/clusterissuers/'+name)).status,404);
assert.equal((await fetch(base+'/api/v1/namespaces/cert-manager/secrets/'+name+'-account-key',{headers:{Accept:'application/json;as=PartialObjectMetadata;g=meta.k8s.io;v=v1'}})).status,404);
const cm=await read('/api/v1/namespaces/cattle-ui-plugin-system/configmaps/network-manager-state-user-jccb4'),state=JSON.parse(cm.data['state.json']);
if(phase==='before'){
 assert.ok(!fs.existsSync(file),'Baseline already exists; observe the original test before considering replay.');assert.equal(state.pendingChanges.length,0);assert.ok(!state.issuerProfiles.some(profile=>profile.name===name));fs.writeFileSync(file,JSON.stringify({resources:await resources(),otherProfiles:state.issuerProfiles},null,2));console.log('Unapplied issuer and account Secret are absent; live resource baseline recorded.');
}else{
 const before=JSON.parse(fs.readFileSync(file));assert.deepEqual(await resources(),before.resources);const profile=state.issuerProfiles.find(profile=>profile.name===name);
 if(phase==='removed'){assert.ok(!profile);assert.equal(state.pendingChanges.length,0);assert.deepEqual(state.issuerProfiles,before.otherProfiles);}
 else{
  assert.ok(profile);assert.equal(profile.environment,'staging');assert.equal(profile.challenge,'http01');assert.equal(profile.source,'Local draft');
  if(phase==='discarded')assert.equal(state.pendingChanges.length,0);
  else{assert.equal(state.pendingChanges.length,1);const change=state.pendingChanges[0];assert.equal(change.name,name);if(phase==='prepared'){assert.equal(change.configuration.operation,'RemoveIssuerProfile');assert.deepEqual(change.resources,[]);assert.equal(change.configuration.secretPreserved,true);}else{assert.equal(change.resources.length,1);assert.equal(change.resources[0].kind,'ClusterIssuer');assert.equal(change.resources[0].metadata.name,name);}}
 }
 const report={observedAt:new Date().toISOString(),phase,issuerAndAccountSecretAbsent:true,allLiveResourcesPreserved:true,profileRemoved:phase==='removed',passed:true};fs.writeFileSync(root+'/native-unapplied-issuer-'+phase+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
