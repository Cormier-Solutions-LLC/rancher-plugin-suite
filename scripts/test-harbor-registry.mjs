// Synthetic empty image in an isolated repository; no workloads run this image.
import fs from 'node:fs';import https from 'node:https';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const host='harbor.cormierconsulting.io',repo='automation/manager-registry-acceptance',api='/api/v2.0/projects/automation/repositories/manager-registry-acceptance';
const response=await fetch('http://127.0.0.1:15888/api/v1/namespaces/harbor/secrets/harbor-admin');assert.ok(response.ok);const secret=await response.json();const basic='Basic '+Buffer.from('admin:'+Buffer.from(secret.data.HARBOR_ADMIN_PASSWORD,'base64').toString()).toString('base64');
const digest=data=>'sha256:'+createHash('sha256').update(data).digest('hex');
function request(path,{method='GET',authorization=basic,body,headers={}}={}){return new Promise((resolve,reject)=>{const req=https.request({hostname:'10.99.15.50',servername:host,path,method,rejectUnauthorized:true,timeout:15000,headers:{Host:host,Authorization:authorization,...(body?{'Content-Length':body.length}:{}),...headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('Registry request timed out')));req.end(body);});}
assert.equal((await request(api)).status,404,'Owned test repository already exists; inspect before reuse');
const auth=await request('/service/token?service=harbor-registry&scope='+encodeURIComponent('repository:'+repo+':pull,push,delete'));assert.equal(auth.status,200);const token=JSON.parse(auth.body).token;assert.ok(token);const authorization='Bearer '+token,media='application/vnd.docker.distribution.manifest.v2+json';
const manifests=[];let created=false;
try{
 for(const generation of ['v1','v2']){
  const config=Buffer.from(JSON.stringify({architecture:'amd64',os:'linux',config:{Labels:{'manager-acceptance.synthetic':'true','manager-acceptance.generation':generation}},rootfs:{type:'layers',diff_ids:[]},history:[]}));
  const upload=await request('/v2/'+repo+'/blobs/uploads/',{method:'POST',authorization,headers:{'Content-Length':'0'}});assert.equal(upload.status,202);created=true;const location=new URL(upload.headers.location,'https://'+host);assert.equal(location.hostname,host);location.searchParams.set('digest',digest(config));
  const stored=await request(location.pathname+location.search,{method:'PUT',authorization,body:config,headers:{'Content-Type':'application/octet-stream'}});assert.equal(stored.status,201);assert.equal(stored.headers['docker-content-digest'],digest(config));
  const manifest=Buffer.from(JSON.stringify({schemaVersion:2,mediaType:media,config:{mediaType:'application/vnd.docker.container.image.v1+json',size:config.length,digest:digest(config)},layers:[]}));
  const pushed=await request('/v2/'+repo+'/manifests/acceptance',{method:'PUT',authorization,body:manifest,headers:{'Content-Type':media}});assert.equal(pushed.status,201);assert.equal(pushed.headers['docker-content-digest'],digest(manifest));manifests.push({digest:digest(manifest),manifest,config});
  const pulled=await request('/v2/'+repo+'/manifests/acceptance',{authorization,headers:{Accept:media}});assert.equal(pulled.status,200);assert.equal(digest(pulled.body),digest(manifest));
  const blob=await request('/v2/'+repo+'/blobs/'+digest(config),{authorization});assert.equal(blob.status,200);assert.deepEqual(blob.body,config);
 }
 assert.notEqual(manifests[0].digest,manifests[1].digest);
 const original=await request('/v2/'+repo+'/manifests/'+manifests[0].digest,{authorization,headers:{Accept:media}});assert.equal(original.status,200);assert.deepEqual(original.body,manifests[0].manifest);
 const removed=await request('/v2/'+repo+'/manifests/'+manifests[1].digest,{method:'DELETE',authorization});assert.equal(removed.status,202);
 assert.equal((await request('/v2/'+repo+'/manifests/'+manifests[1].digest,{authorization,headers:{Accept:media}})).status,404);
 assert.equal((await request('/v2/'+repo+'/manifests/'+manifests[0].digest,{authorization,headers:{Accept:media}})).status,200);
 const report={observedAt:new Date().toISOString(),strictTls:true,authenticatedRegistryPushes:2,manifestAndBlobDigestVerified:true,tagUpdateServesNewDigest:true,priorDigestPreservedAfterTagUpdate:true,selectiveDeletionPreservesOtherDigest:true,workloadsCreated:0,passed:true};fs.writeFileSync('.local/manager-installation/harbor-registry-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{
 if(created){const deleted=await request(api,{method:'DELETE'});assert.equal(deleted.status,200,'Synthetic repository cleanup failed');assert.equal((await request(api)).status,404);console.log(JSON.stringify({ownedRepositoryRemoved:true,existingProjectRetained:true}));const file='.local/manager-installation/harbor-registry-tests.json';if(fs.existsSync(file)){const report=JSON.parse(fs.readFileSync(file));report.ownedRepositoryRemoved=true;fs.writeFileSync(file,JSON.stringify(report,null,2));}}
}
