// Isolated certificate deletion proof; Secret reads request metadata only.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const phase=process.argv[2],root='.local/manager-installation',base='http://127.0.0.1:15888',ns='manager-acceptance',name='manager-native-certificate',uid='ebfee880-4de4-4bf1-a111-677daed0ddfb',secretName=name+'-tls',file=root+'/native-certificate-deletion-before.json';
assert.ok(['ready','own-secret','retained','deleted'].includes(phase));
const certificatePath=`/apis/cert-manager.io/v1/namespaces/${ns}/certificates/${name}`,secretPath=`/api/v1/namespaces/${ns}/secrets/${secretName}`;
async function read(path,metadata=false){const r=await fetch(base+path,{headers:metadata?{Accept:'application/json;as=PartialObjectMetadata;g=meta.k8s.io;v=v1'}:{},signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);const v=await r.json();if(metadata)assert.equal(v.kind,'PartialObjectMetadata');return v;}
const others=()=>read('/apis/cert-manager.io/v1/certificates').then(l=>l.items.filter(c=>c.metadata.uid!==uid).map(c=>({name:c.metadata.name,namespace:c.metadata.namespace,uid:c.metadata.uid,spec:c.spec})).sort((a,b)=>(a.namespace+'/'+a.name).localeCompare(b.namespace+'/'+b.name)));
if(phase==='ready'){
 const c=await read(certificatePath),s=await read(secretPath,true);assert.equal(c.metadata.uid,uid);assert.equal(c.status.revision,1);assert.ok(c.status.conditions.some(v=>v.type==='Ready'&&v.status==='True'));assert.deepEqual(c.spec.dnsNames,['manager-native-certificate.cormierconsulting.io']);assert.deepEqual(c.spec.issuerRef,{group:'cert-manager.io',kind:'ClusterIssuer',name:'letsencrypt-prod'});assert.equal(c.spec.secretName,secretName);
 fs.writeFileSync(file,JSON.stringify({observedAt:new Date().toISOString(),certificateUid:uid,secretUid:s.metadata.uid,originalOwnerReferences:s.metadata.ownerReferences||[],otherCertificates:await others()},null,2));console.log('Standalone native certificate Ready at revision 1; metadata baseline saved.');
}else{
 const before=JSON.parse(fs.readFileSync(file));assert.equal(before.certificateUid,uid);const s=await read(secretPath,true);assert.equal(s.metadata.uid,before.secretUid);
 if(phase==='own-secret'){
  const c=await read(certificatePath);assert.equal(c.metadata.uid,uid);assert.ok(c.status.conditions.some(v=>v.type==='Ready'&&v.status==='True'));assert.deepEqual(s.metadata.ownerReferences||[],before.originalOwnerReferences);
  assert.ok(!before.originalOwnerReferences.some(v=>v.controller),'Fixture has an unexpected controller owner');
  const r=await fetch(base+secretPath,{method:'PATCH',headers:{'Content-Type':'application/merge-patch+json',Accept:'application/json;as=PartialObjectMetadata;g=meta.k8s.io;v=v1'},body:JSON.stringify({metadata:{uid:s.metadata.uid,resourceVersion:s.metadata.resourceVersion,ownerReferences:[...before.originalOwnerReferences,{apiVersion:'cert-manager.io/v1',kind:'Certificate',name,uid,controller:true,blockOwnerDeletion:true}]}}),signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);const result=await r.json();assert.equal(result.kind,'PartialObjectMetadata');assert.ok(result.metadata.ownerReferences.some(v=>v.uid===uid));console.log('Only the owned acceptance TLS Secret now has the test Certificate owner reference.');
 }else if(phase==='retained'){
  const c=await read(certificatePath);assert.equal(c.metadata.uid,uid);assert.ok(!c.metadata.deletionTimestamp);assert.ok(s.metadata.ownerReferences.some(v=>v.uid===uid));assert.deepEqual(await others(),before.otherCertificates);
  const report={observedAt:new Date().toISOString(),certificateRetained:true,ownedSecretRetained:true,otherCertificatesPreserved:true,passed:true};fs.writeFileSync(root+'/native-certificate-stale-retained.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }else{
  assert.equal((await fetch(base+certificatePath)).status,404);assert.ok(!(s.metadata.ownerReferences||[]).some(v=>v.uid===uid));assert.deepEqual(await others(),before.otherCertificates);
  const report={observedAt:new Date().toISOString(),certificateDeleted:true,secretIdentityPreserved:true,deletedOwnerReferenceRemoved:true,otherCertificatesPreserved:true,passed:true};fs.writeFileSync(root+'/native-certificate-deleted.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }
}
