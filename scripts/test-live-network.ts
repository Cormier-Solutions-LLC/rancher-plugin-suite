import net from 'node:net';import dgram from 'node:dgram';
import fs from 'node:fs';import assert from 'node:assert/strict';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {buildMultiPublication} from '../simple-network-manager-dev/pkg/simple-network-manager/config/multi-publication';
import {applyResourceChanges,resourcePath} from '../live-management/kubernetes-apply.mjs';
const run=promisify(execFile),base='http://127.0.0.1:15888',host='manager-acceptance.cormierconsulting.io',root='.local/manager-installation';
const results:any[]=[];
async function call(path:string,init:any={}) {
 const response=await fetch(base+path,{...init,signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Object.assign(new Error(`Kubernetes ${response.status}: ${path}`),{status:response.status});
 return response.status===204?undefined:response.json();
}
async function apply(resources:any[],operation='Apply') {
 const targets=new Map();for(const r of resources){try{const current=await call(resourcePath(r));targets.set(resourcePath(r),current.metadata);}catch(e:any){if(e.status!==404)throw e;}}
 const backend=await call('/api/v1/namespaces/manager-acceptance/services/protocol-fixture');targets.set(resourcePath(backend),backend.metadata);
 const receipt=await applyResourceChanges([{name:'Isolated publication test',configuration:{operation},resources}],call,targets);
 for(const r of resources){if(operation==='Apply'){const current=await call(resourcePath(r));assert.equal(current.metadata.name,r.metadata.name);assert.ok(current.metadata.resourceVersion);}}
 return receipt;
}
async function snapshot(resources:any[],label:string) {
 const response=await fetch(base+'/api/v1/namespaces/manager-system/services/http:network-manager-snapshots:8080/proxy/api/snapshots',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://rancher.cormierconsulting.io'},body:JSON.stringify({scopeKey:'network-live-acceptance',current:{configuration:{id:'acceptance',name:label,ports:[]},routeManifests:resources,snapshotScope:{namespace:'manager-acceptance',label:'Isolated live publication'}}})});assert.equal(response.status,201);return response.json();
}
async function http(scheme:string,expected:string) {
 const port=scheme==='https'?443:80;
 const {stdout}=await run('curl.exe',['--silent','--show-error','--max-time','15','--resolve',`${host}:${port}:10.99.15.50`,`-w`,'\n%{http_code}',`${scheme}://${host}/`]);
 const split=stdout.trim().lastIndexOf('\n');assert.equal(stdout.trim().slice(0,split).trim(),'manager-acceptance-'+expected);assert.equal(stdout.trim().slice(split+1),'200');
}
async function echo(protocol:string,timeout=8000) {
 const payload=Buffer.from('manager-acceptance-'+protocol+'-'+Date.now());
 await new Promise<void>((resolve,reject)=>{
  const socket:any=protocol==='TCP'?net.createConnection({host:'10.99.15.50',port:15001}):dgram.createSocket('udp4');
  let finished=false;const finish=(error?:Error)=>{if(finished)return;finished=true;clearTimeout(timer);if(protocol==='TCP')socket.destroy();else socket.close();error?reject(error):resolve();};
  const timer=setTimeout(()=>finish(new Error(protocol+' echo timed out')),timeout);
  socket.on('error',finish);
  const verify=(data:Buffer)=>{try{assert.deepEqual(data,payload);finish();}catch(error:any){finish(error);}};
  if(protocol==='TCP'){socket.once('connect',()=>socket.write(payload));socket.once('data',verify);socket.once('end',()=>finish(new Error('TCP route closed without an echo')));}
  else {socket.once('message',verify);socket.send(payload,15002,'10.99.15.50',(error:Error)=>{if(error)finish(error);});}
 });
}
async function waitUdpControllers(present:boolean) {
 const pods=await call('/api/v1/namespaces/traefik-system/pods?labelSelector=app.kubernetes.io%2Fname%3Dtraefik');
 const addresses=pods.items.filter((p:any)=>p.status.phase==='Running').map((p:any)=>p.status.podIP);assert.equal(addresses.length,3);
 const fixture=(await call('/api/v1/namespaces/manager-acceptance/pods?labelSelector=app%3Dprotocol-fixture')).items.find((p:any)=>p.status.conditions?.some((c:any)=>c.type==='Ready'&&c.status==='True')).metadata.name;
 const code="const d=require('node:dgram');(async()=>{const results=[];for(const h of JSON.parse(process.argv[1]))results.push(await new Promise(resolve=>{const s=d.createSocket('udp4'),t=setTimeout(()=>{s.close();resolve(false);},1000);s.once('message',()=>{clearTimeout(t);s.close();resolve(true);});s.send('controller-route-check',15002,h);}));if(results.some(v=>v!==JSON.parse(process.argv[2])))process.exitCode=1;})();";
 const deadline=Date.now()+30000;let last;do{try{await run('C:/Program Files/Docker/Docker/resources/bin/kubectl.exe',['-n','manager-acceptance','exec',fixture,'--','node','-e',code,JSON.stringify(addresses),JSON.stringify(present)],{timeout:10000});return;}catch(e){last=e;}}while(Date.now()<deadline);throw last;
}
async function waitEcho(protocol:string){const start=Date.now();let last;do{try{await echo(protocol,1500);return Date.now()-start;}catch(error){last=error;}}while(Date.now()-start<30000);throw last;}
const resources:any[]=buildMultiPublication({name:'manager-acceptance',namespace:'manager-acceptance',service:'protocol-fixture',hosts:[host],issuer:'letsencrypt-prod',ingressClass:'traefik',mappings:[{label:'HTTP',port:80,mode:'HTTP',entryPoint:'web',backendPort:'http',backendScheme:'http'},{label:'HTTPS',port:443,mode:'HTTPS',entryPoint:'websecure',backendPort:'http',backendScheme:'http'}]});
try {
 const service=await call('/api/v1/namespaces/manager-acceptance/services/protocol-fixture');
 const backup=await snapshot([service],'Before publication');
 results.push({check:'Persistent pre-change snapshot',passed:true,id:backup.id});
 await apply(resources);results.push({check:'All dry runs, application and API readback',passed:true});
 await http('http','v1');results.push({check:'HTTP routing',passed:true});
 const certPath=resourcePath(resources.find(r=>r.kind==='Certificate'));const deadline=Date.now()+900000;let ready=false;
 while(Date.now()<deadline){const cert=await call(certPath);if(cert.status?.conditions?.some((c:any)=>c.type==='Ready'&&c.status==='True')){ready=true;break;}await new Promise(r=>setTimeout(r,3000));}
 assert.ok(ready,'Certificate issuance did not become Ready');
 await http('https','v1');results.push({check:'ACME DNS01 issuance and verified HTTPS traffic',passed:true});
 const original=resources.find(r=>r.kind==='IngressRoute'&&r.spec.entryPoints.includes('web'));
 const saved=await snapshot(resources,'Before route edit');
 const broken=structuredClone(original);broken.spec.routes[0].services[0].port=9999;
 await assert.rejects(apply([broken]),/does not expose TCP port 9999/);await http('http','v1');
 results.push({check:'Invalid backend port rejected before mutation; live route retains traffic',passed:true});
 const edited=structuredClone(original);edited.spec.routes[0].match="Host(\""+host+"\") && PathPrefix(\"/edited\")";
 await apply([edited]);await new Promise(r=>setTimeout(r,2000));
 const editTraffic=await run('curl.exe',['--silent','--show-error','--max-time','15','--resolve',host+':80:10.99.15.50','http://'+host+'/edited']);assert.equal(editTraffic.stdout.trim(),'manager-acceptance-v1');
 results.push({check:'Valid route edit serves matching traffic',passed:true});
 await apply([original]);await new Promise(r=>setTimeout(r,2000));await http('http','v1');
 results.push({check:'Route rollback restores traffic',passed:true,snapshot:saved.id});
 const path=resourcePath(original),old=(await call(path)).metadata;
 // A stale reviewed version must stop before mutating an independently edited target.
 const concurrent=await call(path);concurrent.metadata.annotations={...concurrent.metadata.annotations,'manager-acceptance/review-test':new Date().toISOString()};
 await call(path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(concurrent)});
 await assert.rejects(applyResourceChanges([{name:'Stale review',resources:[original]}],call,new Map([[path,old],[resourcePath(service),service.metadata]])),/reviewed target changed/);
 results.push({check:'Live stale review is rejected',passed:true});
 await apply([original]);await http('https','v1');
 const protocols:any[]=buildMultiPublication({name:'manager-protocols',namespace:'manager-acceptance',service:'protocol-fixture',hosts:[host],issuer:'',ingressClass:'traefik',mappings:[{label:'TCP echo',port:15001,mode:'TCP',entryPoint:'manager-test-tcp',backendPort:'tcp-echo',backendScheme:'http'},{label:'UDP echo',port:15002,mode:'UDP',entryPoint:'manager-test-udp',backendPort:'udp-echo',backendScheme:'http'}]});
 const protocolBackup=await snapshot([service],'Before TCP/UDP publication');await apply(protocols);await new Promise(r=>setTimeout(r,2000));
 await waitUdpControllers(true);const tcpReadyMs=await waitEcho('TCP'),udpReadyMs=await waitEcho('UDP');for(let i=0;i<8;i++){await echo('TCP');await echo('UDP');}
 results.push({check:'TCP and UDP publication routes actual round-trip traffic',passed:true,roundTrips:16,tcpReadyMs,udpReadyMs,snapshot:protocolBackup.id});
 const protocolRecovery=await snapshot(protocols,'Before TCP/UDP route removal');await apply(protocols,'Delete');await new Promise(r=>setTimeout(r,3000));
 await waitUdpControllers(false);await assert.rejects(echo('TCP',1500));await assert.rejects(echo('UDP',1500));
 results.push({check:'TCP and UDP route deletion removes routing',passed:true});
 await apply(protocols);await new Promise(r=>setTimeout(r,2000));await waitUdpControllers(true);await waitEcho('TCP');await waitEcho('UDP');await http('https','v1');
 results.push({check:'TCP and UDP rollback restores traffic and preserves HTTPS',passed:true,snapshot:protocolRecovery.id});
 console.log('Live HTTP/HTTPS publication, certificate, failure, edit, rollback and concurrency checks passed.');
} finally {fs.writeFileSync(`${root}/network-live-tests.json`,JSON.stringify(results,null,2));}
