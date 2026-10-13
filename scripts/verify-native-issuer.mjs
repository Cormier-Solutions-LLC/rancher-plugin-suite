// Isolated staging issuer acceptance. Account Secret reads return metadata only.
import fs from 'node:fs';import assert from 'node:assert/strict';
const phase=process.argv[2],root='.local/manager-installation',base='http://127.0.0.1:15888',name='manager-native-issuer-staging',secretName=name+'-account-key',file=root+'/native-issuer-before.json',issuerPath='/apis/cert-manager.io/v1/clusterissuers/'+name,secretPath='/api/v1/namespaces/cert-manager/secrets/'+secretName;
assert.ok(['before','created','edited','own-secret','deleted'].includes(phase));
async function read(path,metadata=false){const r=await fetch(base+path,{headers:metadata?{Accept:'application/json;as=PartialObjectMetadata;g=meta.k8s.io;v=v1'}:{},signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);const value=await r.json();if(metadata)assert.equal(value.kind,'PartialObjectMetadata');return value;}
const resources=async()=>{const lists=await Promise.all(['/apis/cert-manager.io/v1/clusterissuers','/apis/cert-manager.io/v1/issuers','/apis/cert-manager.io/v1/certificates'].map(path=>read(path)));return lists.flatMap(l=>l.items.filter(r=>r.metadata.name!==name||l.kind!=='ClusterIssuerList').map(r=>({kind:l.kind.replace(/List$/,''),namespace:r.metadata.namespace||'',name:r.metadata.name,uid:r.metadata.uid,spec:r.spec}))).sort((a,b)=>(a.kind+'/'+a.namespace+'/'+a.name).localeCompare(b.kind+'/'+b.namespace+'/'+b.name));};
const profileState=()=>read('/api/v1/namespaces/cattle-ui-plugin-system/configmaps/network-manager-state-user-jccb4').then(cm=>JSON.parse(cm.data['state.json']));
if(phase==='before'){
 assert.equal((await fetch(base+issuerPath)).status,404);assert.equal((await fetch(base+secretPath,{headers:{Accept:'application/json;as=PartialObjectMetadata;g=meta.k8s.io;v=v1'}})).status,404);
 const state=await profileState();assert.ok(!state.issuerProfiles.some(p=>p.name===name));
 fs.writeFileSync(file,JSON.stringify({observedAt:new Date().toISOString(),otherResources:await resources(),otherProfiles:state.issuerProfiles},null,2));console.log('Staging issuer and account Secret are absent; existing certificate and issuer specifications recorded.');
}else{
 const before=JSON.parse(fs.readFileSync(file));assert.deepEqual(await resources(),before.otherResources);
 if(phase==='deleted'){
  assert.equal((await fetch(base+issuerPath)).status,404);const secret=await read(secretPath,true);assert.equal(secret.metadata.uid,before.secretUid);assert.ok(!(secret.metadata.ownerReferences||[]).some(owner=>owner.uid===before.issuerUid));
  const state=await profileState();assert.deepEqual(state.issuerProfiles,before.otherProfiles);assert.equal(state.pendingChanges.length,0);
  const report={observedAt:new Date().toISOString(),issuerDeleted:true,profileRemoved:true,accountSecretUidPreserved:true,ownerReferenceRemoved:true,otherCertificatesAndIssuersPreserved:true,passed:true};fs.writeFileSync(root+'/native-issuer-deleted.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }else{
  const issuer=await read(issuerPath),secret=await read(secretPath,true);assert.ok(issuer.status.conditions.some(c=>c.type==='Ready'&&c.status==='True'&&c.observedGeneration===issuer.metadata.generation));assert.equal(issuer.spec.acme.server,'https://acme-staging-v02.api.letsencrypt.org/directory');assert.equal(issuer.spec.acme.privateKeySecretRef.name,secretName);
  if(phase==='created'){
   assert.deepEqual(issuer.spec.acme.solvers,[{http01:{ingress:{ingressClassName:'traefik'}}}]);if(before.issuerUid){assert.equal(issuer.metadata.uid,before.issuerUid);assert.equal(secret.metadata.uid,before.secretUid);}else{before.issuerUid=issuer.metadata.uid;before.secretUid=secret.metadata.uid;before.originalSecretOwners=secret.metadata.ownerReferences||[];fs.writeFileSync(file,JSON.stringify(before,null,2));}
  }else{assert.equal(issuer.metadata.uid,before.issuerUid);assert.equal(secret.metadata.uid,before.secretUid);}
  if(phase==='edited'||phase==='own-secret'){
   const solver=issuer.spec.acme.solvers[0];assert.deepEqual(solver.selector.dnsZones,['cormierconsulting.io']);assert.equal(solver.dns01.webhook.groupName,'acme.cormierconsulting.io');assert.equal(solver.dns01.webhook.solverName,'godaddy');assert.deepEqual(solver.dns01.webhook.config.apiKeySecretRef,{name:'godaddy-api-key',key:'token'});
  }
  if(phase==='own-secret'){
   assert.deepEqual(secret.metadata.ownerReferences||[],before.originalSecretOwners);assert.ok(!before.originalSecretOwners.some(owner=>owner.controller));
   const r=await fetch(base+secretPath,{method:'PATCH',headers:{'Content-Type':'application/merge-patch+json',Accept:'application/json;as=PartialObjectMetadata;g=meta.k8s.io;v=v1'},body:JSON.stringify({metadata:{uid:secret.metadata.uid,resourceVersion:secret.metadata.resourceVersion,ownerReferences:[...before.originalSecretOwners,{apiVersion:'cert-manager.io/v1',kind:'ClusterIssuer',name,uid:before.issuerUid,controller:true,blockOwnerDeletion:true}]}}),signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);const value=await r.json();assert.equal(value.kind,'PartialObjectMetadata');assert.ok(value.metadata.ownerReferences.some(owner=>owner.uid===before.issuerUid));
  }
  const report={observedAt:new Date().toISOString(),phase,issuerReady:true,sameAccountSecret:true,otherCertificatesAndIssuersPreserved:true,passed:true};fs.writeFileSync(root+`/native-issuer-${phase}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }
}
