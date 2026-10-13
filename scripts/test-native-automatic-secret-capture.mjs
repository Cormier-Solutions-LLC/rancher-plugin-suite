import fs from 'node:fs';import assert from 'node:assert/strict';
import {withoutSecretValues} from '../simple-network-manager-dev/pkg/simple-network-manager/config/backup-zip.mjs';
const phase=process.argv[2],root='.local/manager-installation',file=root+'/native-automatic-secret-before.json',base='http://127.0.0.1:15888',api='/api/v1/namespaces/manager-system/services/http:network-manager-snapshots:8080/proxy',ns='manager-acceptance',name='manager-auto-secret-capture',secretPath=`/api/v1/namespaces/${ns}/secrets/${name}`,routePath=`/apis/traefik.io/v1alpha1/namespaces/${ns}/ingressroutes/${name}`;
assert.ok(['create','first','rotate','second','denied','cleanup'].includes(phase));
async function request(path,method='GET',body){return fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:'https://rancher.cormierconsulting.io'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}
async function read(path){const r=await request(path);assert.equal(r.status,200);return r.json();}
async function others(){return (await Promise.all(['/apis/cert-manager.io/v1/clusterissuers','/apis/cert-manager.io/v1/issuers','/apis/cert-manager.io/v1/certificates','/apis/traefik.io/v1alpha1/ingressroutes'].map(read))).flatMap(list=>list.items.filter(r=>!(r.metadata.name===name&&r.metadata.namespace===ns)).map(r=>({kind:list.kind,name:r.metadata.name,namespace:r.metadata.namespace||'',uid:r.metadata.uid,spec:r.spec}))).sort((a,b)=>(a.kind+'/'+a.namespace+'/'+a.name).localeCompare(b.kind+'/'+b.namespace+'/'+b.name));}
const schedule=await read(api+'/api/snapshot-schedule'),index=(await read(api+'/api/snapshots')).snapshots;
if(phase==='create'){
 assert.ok(!fs.existsSync(file));assert.equal(schedule.enabled,false);assert.equal((await request(secretPath)).status,404);assert.equal((await request(routePath)).status,404);
 const source=await read(`/apis/traefik.io/v1alpha1/namespaces/${ns}/ingressroutes/manager-native-https-https-443`),tls=await read(`/api/v1/namespaces/${ns}/secrets/${source.spec.tls.secretName}`);assert.ok(tls.data['tls.crt']&&tls.data['tls.key']);
 const before={createdAt:new Date().toISOString(),ids:index.map(r=>r.id),others:await others()};fs.writeFileSync(file,JSON.stringify(before,null,2));
 let r=await request(secretPath.replace('/'+name,''),'POST',{apiVersion:'v1',kind:'Secret',type:'kubernetes.io/tls',metadata:{name,namespace:ns,labels:{'app.kubernetes.io/part-of':'manager-acceptance'}},data:{...tls.data,'acceptance-rotation':Buffer.from('acceptance-before').toString('base64')}});assert.equal(r.status,201);before.secretUid=(await r.json()).metadata.uid;fs.writeFileSync(file,JSON.stringify(before,null,2));
 const spec=structuredClone(source.spec);spec.tls.secretName=name;for(const route of spec.routes)route.match+= ' && PathPrefix(`/snapshot-secret-acceptance`)';
 r=await request(routePath.replace('/'+name,''),'POST',{apiVersion:'traefik.io/v1alpha1',kind:'IngressRoute',metadata:{name,namespace:ns,labels:{'app.kubernetes.io/part-of':'manager-acceptance'}},spec});assert.equal(r.status,201);before.routeUid=(await r.json()).metadata.uid;fs.writeFileSync(file,JSON.stringify(before,null,2));console.log('Created an isolated TLS backup reference and named Secret with a synthetic rotation marker; existing routes were untouched.');
}else{
 const before=JSON.parse(fs.readFileSync(file));assert.ok(JSON.stringify(await others())===JSON.stringify(before.others),'Existing route, issuer and certificate identities/specifications changed.');
 if(phase==='rotate'){
  assert.equal(schedule.enabled,true);assert.ok(before.firstId);const secret=await read(secretPath);assert.equal(secret.metadata.uid,before.secretUid);secret.data['acceptance-rotation']=Buffer.from('acceptance-after').toString('base64');const r=await request(secretPath,'PUT',secret);assert.equal(r.status,200);before.rotatedAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(before,null,2));console.log('Rotated only the isolated synthetic marker, without changing schedule settings or TLS certificate/key values.');
 }else if(phase==='denied'){
  assert.ok(before.secondId);assert.equal(schedule.enabled,true);
  const rolePath=`/apis/rbac.authorization.k8s.io/v1/namespaces/${ns}/roles/network-snapshot-referenced-secrets`,original=await read(rolePath),restricted=structuredClone(original);
  assert.ok(restricted.rules.some(r=>r.resourceNames.includes(name)));for(const rule of restricted.rules)rule.resourceNames=rule.resourceNames.filter(n=>n!==name);
  const password=JSON.parse(fs.readFileSync(root+'/native-network-snapshot-password.json')).password,r=await request(api+'/api/snapshots/'+before.secondId+'/unlock','POST',{password});assert.equal(r.status,200);const current=withoutSecretValues((await r.json()).current);
  try{
   assert.equal((await request(rolePath+'?fieldManager=network-snapshot-referenced-secrets','PUT',restricted)).status,200);
   const rejected=await request(api+'/api/snapshot-source','PUT',{current});assert.equal(rejected.status,503);assert.deepEqual(await read(api+'/api/snapshot-schedule'),schedule);assert.equal((await read(api+'/api/snapshots')).snapshots.length,index.length);
   before.deniedSecretReadRejected=true;fs.writeFileSync(file,JSON.stringify(before,null,2));console.log('Denied fresh named Secret read rejected source synchronization and preserved the schedule plus all archives.');
  }finally{const restored=await read(rolePath);assert.equal(restored.metadata.uid,original.metadata.uid);restored.rules=original.rules;assert.equal((await request(rolePath+'?fieldManager=network-snapshot-referenced-secrets','PUT',restored)).status,200);}
 }else if(phase==='cleanup'){
  assert.equal(schedule.enabled,false);assert.ok(before.secondId);
  for(const [path,uid] of [[routePath,before.routeUid],[secretPath,before.secretUid]]){assert.equal((await read(path)).metadata.uid,uid);const r=await request(path,'DELETE',{apiVersion:'v1',kind:'DeleteOptions',preconditions:{uid}});assert.equal(r.status,200);assert.equal((await request(path)).status,404);}
  const report={observedAt:new Date().toISOString(),firstId:before.firstId,secondId:before.secondId,nativeProtectedSchedule:true,freshSecretRotation:true,implicitPasswordUnlockRejected:true,deniedSecretReadRejected:before.deniedSecretReadRejected===true,existingResourcesPreserved:before.others.length,ownedFixturesRemoved:true,scheduleDisabled:true,passed:true};assert.equal(report.deniedSecretReadRejected,true);fs.writeFileSync(root+'/native-automatic-secret-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }else{
  assert.equal(schedule.enabled,true);assert.equal(schedule.includeSecrets,true);assert.equal(schedule.scope.namespace,ns);
  const candidates=index.filter(r=>r.generation==='Automatic'&&!before.ids.includes(r.id)&&r.createdAt>=(phase==='second'?before.rotatedAt:before.createdAt)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const password=JSON.parse(fs.readFileSync(root+'/native-network-snapshot-password.json')).password;let found;
  for(const record of candidates){assert.equal(record.encrypted,true);assert.equal((await request(api+'/api/snapshots/'+record.id)).status,422);assert.equal((await request(api+'/api/snapshots/'+record.id+'/unlock','POST',{password:''})).status,422);const r=await request(api+'/api/snapshots/'+record.id+'/unlock','POST',{password});assert.equal(r.status,200);const current=(await r.json()).current,secret=current.routeManifests.find(r=>r.kind==='Secret'&&r.metadata.name===name&&r.metadata.namespace===ns);if(!secret)continue;assert.equal(secret.data['acceptance-rotation'],Buffer.from(phase==='first'?'acceptance-before':'acceptance-after').toString('base64'));assert.equal(current.secretBackup.complete,true);assert.deepEqual(current.pendingChanges,[]);found=record;break;}
  if(!found){console.log(JSON.stringify({waiting:true,nextRun:schedule.nextRun,lastError:schedule.lastError||null}));process.exit(0);}
  before[phase==='first'?'firstId':'secondId']=found.id;fs.writeFileSync(file,JSON.stringify(before,null,2));console.log(JSON.stringify({phase,archive:found.id,encrypted:true,freshSecretValues:true,passwordRequired:true,passed:true}));
 }
}
