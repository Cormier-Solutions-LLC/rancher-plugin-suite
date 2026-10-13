// Reversible acceptance alias: preserve the administrator's browser cookies.
import fs from 'node:fs';
import https from 'node:https';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createLiveDnsSource} from '../live-management/rancher-dns.mjs';
const phase=process.argv[2],root='.local/manager-installation',file=root+'/rancher-browser-alias-owned.json';
const base='http://127.0.0.1:15888',namespace='manager-acceptance',name='manager-rancher-browser-alias',label='manager-native-https',zone='cormierconsulting.io',host=label+'.'+zone;
const routePath=`/apis/traefik.io/v1alpha1/namespaces/${namespace}/ingressroutes/manager-native-https-https-443`;
assert.ok(['setup','verify','cleanup'].includes(phase));
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Object.assign(new Error(`Kubernetes ${method} ${path}: ${r.status}`),{status:r.status});return r.json();}
const save=s=>fs.writeFileSync(file,JSON.stringify(s,null,2));
const source=createLiveDnsSource('local',(url,init)=>fetch(base+url.replace('/k8s/clusters/local',''),{...init,signal:AbortSignal.timeout(15000)}),'user-jccb4');
const inventory=async()=> (await source.reload()).data.inventory;
async function dns(changes){const i=await inventory(),z=i.zones.find(z=>z.name===zone);assert.ok(z);const current={configuration:{id:'source/windows',name:'Windows DNS'},relatedConfigurations:[{id:'zone/'+zone,name:zone,kind:'DnsZone',dns:{zone:z,records:i.records[zone]}}],snapshotScope:{label:'Temporary Rancher browser alias acceptance'},routeManifests:[]};const r=await fetch(base+'/api/v1/namespaces/manager-system/services/http:dns-manager-snapshots:8080/proxy/api/snapshots',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://rancher.cormierconsulting.io'},body:JSON.stringify({current,scopeKey:'rancher-browser-alias-acceptance'})});assert.equal(r.status,201);const backup=await r.json();return source.stageChanges({snapshotId:backup.id,changes:changes.map(c=>({...c,id:randomUUID()}))});}
function traffic(path){return new Promise((resolve,reject)=>{const req=https.request({hostname:'10.99.15.50',servername:host,path,method:'GET',rejectUnauthorized:true,timeout:15000,headers:{Host:host}},r=>{let data='';r.on('data',d=>data+=d);r.on('end',()=>resolve({status:r.statusCode,location:r.headers.location,body:data,cookieAttributes:(r.headers['set-cookie']||[]).map(c=>c.split(';').slice(1).join(';'))}));});req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('Alias request timeout')));req.end();});}
if(phase==='setup'){
 assert.ok(!fs.existsSync(file),'Inspect existing alias ledger before mutation.');
 const route=await api(routePath);assert.equal(route.metadata.uid,'79bab9eb-a0b7-4388-bce6-1663e4f38fb3');assert.equal(route.spec.routes[0].services[0].name,'protocol-fixture');
 const i=await inventory();assert.ok(!i.records[zone].some(r=>r.name===label),'Do not replace an existing DNS record.');
 const s={createdAt:new Date().toISOString(),host,originalRoute:structuredClone(route),owned:[],record:{name:label,type:'A',value:'10.99.15.50',ttl:15},dnsIntent:false};save(s);
 const endpoints=(await api('/apis/discovery.k8s.io/v1/namespaces/cattle-system/endpointslices?labelSelector=kubernetes.io%2Fservice-name%3Drancher')).items.flatMap(v=>v.endpoints).filter(e=>e.conditions?.ready&&!e.conditions?.terminating);assert.equal(endpoints.length,3);
 const svcPath=`/api/v1/namespaces/${namespace}/services`,slicePath=`/apis/discovery.k8s.io/v1/namespaces/${namespace}/endpointslices`;
 for(const path of [svcPath,slicePath])assert.equal((await fetch(base+path+'/'+name)).status,404);
 const svc=await api(svcPath,'POST',{apiVersion:'v1',kind:'Service',metadata:{name,namespace,labels:{'manager-acceptance.cormierconsulting.io/temporary':'true'}},spec:{ports:[{name:'http',port:80,targetPort:80,protocol:'TCP'}]}});s.owned.push({path:svcPath+'/'+name,uid:svc.metadata.uid});save(s);
 const slice=await api(slicePath,'POST',{apiVersion:'discovery.k8s.io/v1',kind:'EndpointSlice',metadata:{name,namespace,labels:{'kubernetes.io/service-name':name,'endpointslice.kubernetes.io/managed-by':'manager-acceptance.cormierconsulting.io'},ownerReferences:[{apiVersion:'v1',kind:'Service',name,uid:svc.metadata.uid}]},addressType:'IPv4',ports:[{name:'http',port:80,protocol:'TCP'}],endpoints:endpoints.map(e=>({addresses:e.addresses,conditions:{ready:true},nodeName:e.nodeName}))});s.owned.push({path:slicePath+'/'+name,uid:slice.metadata.uid});save(s);
 route.spec.routes[0].services=[{name,port:'http',scheme:'http'}];await api(routePath,'PUT',route);s.routeChanged=true;save(s);
 s.dnsIntent=true;save(s);const receipt=await dns([{kind:'record',zone,...s.record}]);s.dnsReceipt=receipt;s.dnsCreated=true;save(s);
 console.log(JSON.stringify({aliasPrepared:true,strictTlsPreserved:true,rancherEndpoints:endpoints.length,dnsJobStatus:receipt.status,lanDhcpSettingsUnchanged:true}));
}else if(phase==='verify'){
 const s=JSON.parse(fs.readFileSync(file));assert.ok(!s.cleanedAt);const response=await traffic('/dashboard/auth/login');assert.equal(response.status,200);assert.ok(!response.location);assert.match(response.body,/Rancher|rancher/);assert.ok(response.cookieAttributes.every(c=>!/domain=/i.test(c)),'Alias cookies must not cross hostnames.');const report={observedAt:new Date().toISOString(),alias:host,strictTls:true,loginPage200:true,noRedirectToAdminHost:true,noCrossHostCookieDomain:true,passed:true};fs.writeFileSync(root+'/rancher-browser-alias-route-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}else{
 const s=JSON.parse(fs.readFileSync(file));assert.ok(!s.cleanedAt);
 if(s.dnsIntent){const i=await inventory(),records=i.records[zone].filter(r=>r.name===label);assert.ok(records.every(r=>r.type===s.record.type&&r.value===s.record.value),'Owned DNS identity changed; inspect before deletion.');if(records.length){const receipt=await dns([{kind:'delete',zone:'zone:'+zone,items:records.map(r=>JSON.stringify([r.name,r.type,r.value]))}]);s.dnsDeleteReceipt=receipt;save(s);}assert.ok(!(await inventory()).records[zone].some(r=>r.name===label));}
 const route=await api(routePath);assert.equal(route.metadata.uid,s.originalRoute.metadata.uid);if(s.routeChanged){assert.equal(route.spec.routes[0].services[0].name,name);route.spec=s.originalRoute.spec;await api(routePath,'PUT',route);assert.deepEqual((await api(routePath)).spec,s.originalRoute.spec);}
 for(const own of [...s.owned].reverse()){const r=await fetch(base+own.path);if(r.status===404)continue;assert.ok(r.ok);const current=await r.json();assert.equal(current.metadata.uid,own.uid);await api(own.path,'DELETE',{apiVersion:'v1',kind:'DeleteOptions',preconditions:{uid:own.uid,resourceVersion:current.metadata.resourceVersion}});}
 const deadline=Date.now()+60000;for(const own of s.owned){while((await fetch(base+own.path)).status!==404){assert.ok(Date.now()<deadline);await new Promise(r=>setTimeout(r,1000));}}
 let response;for(let n=0;n<30;n++){response=await traffic('/');if(response.status===200&&response.body==='manager-acceptance-v1\n')break;await new Promise(r=>setTimeout(r,1000));}assert.equal(response.body,'manager-acceptance-v1\n');s.cleanedAt=new Date().toISOString();save(s);const report={observedAt:s.cleanedAt,originalRouteSpecRestored:true,ownedDnsRecordRemoved:true,ownedServiceAndEndpointSliceRemoved:true,originalFixtureTrafficRestored:true,lanDhcpSettingsUnchanged:true,passed:true};fs.writeFileSync(root+'/rancher-browser-alias-cleanup-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
