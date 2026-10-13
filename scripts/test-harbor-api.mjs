import fs from 'node:fs';
import https from 'node:https';
import assert from 'node:assert/strict';
const host='harbor.cormierconsulting.io',base='http://127.0.0.1:15888';
const secretResponse=await fetch(base+'/api/v1/namespaces/harbor/secrets/harbor-admin');
assert.ok(secretResponse.ok);
const secret=await secretResponse.json();
const authorization='Basic '+Buffer.from('admin:'+Buffer.from(secret.data.HARBOR_ADMIN_PASSWORD,'base64').toString()).toString('base64');
function request(path,authenticated=true){return new Promise((resolve,reject)=>{const req=https.get({hostname:'10.99.15.50',servername:host,path,rejectUnauthorized:true,headers:{Host:host,...(authenticated?{Authorization:authorization}:{})},timeout:15000},response=>{let body='';response.on('data',chunk=>body+=chunk);response.on('end',()=>resolve({status:response.statusCode,body}));});req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('Harbor request timed out')));});}
const me=await request('/api/v2.0/users/current');
assert.equal(me.status,200,'Stored Harbor administrator credential was not accepted');
const user=JSON.parse(me.body);assert.equal(user.username,'admin');assert.equal(user.sysadmin_flag,true);
assert.equal((await request('/api/v2.0/users/current',false)).status,401);
const health=await request('/api/v2.0/health');assert.equal(health.status,200);const componentHealth=JSON.parse(health.body);assert.equal(componentHealth.status,'healthy');
const projectsResponse=await request('/api/v2.0/projects?page_size=100');assert.equal(projectsResponse.status,200);const projects=JSON.parse(projectsResponse.body);
let repositories=0,artifacts=0;
for(const project of projects){const response=await request('/api/v2.0/projects/'+encodeURIComponent(project.name)+'/repositories?page_size=100');assert.equal(response.status,200);const repos=JSON.parse(response.body);repositories+=repos.length;for(const repo of repos){const name=repo.name.slice(project.name.length+1);const list=await request('/api/v2.0/projects/'+encodeURIComponent(project.name)+'/repositories/'+encodeURIComponent(encodeURIComponent(name))+'/artifacts?page_size=1');assert.equal(list.status,200);artifacts+=JSON.parse(list.body).length;}}
const report={observedAt:new Date().toISOString(),strictTls:true,administratorAuthenticated:true,anonymousCurrentUserRejected401:true,componentHealth:componentHealth.components.map(c=>({name:c.name,status:c.status})),projectCount:projects.length,repositoryCount:repositories,repositoriesWithReadableArtifact:artifacts,resourceWrites:0,passed:true};fs.writeFileSync('.local/manager-installation/harbor-api-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
