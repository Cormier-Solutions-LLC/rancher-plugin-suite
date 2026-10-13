// Passive HTTPS editor/restore verification; no writes or Secret payload reads.
import fs from 'node:fs';import assert from 'node:assert/strict';import https from 'node:https';
const phase=process.argv[2],root='.local/manager-installation',base='http://127.0.0.1:15888',ns='manager-acceptance',name='manager-native-https-https-443',original='manager-native-https.cormierconsulting.io',edited='manager-native-certificate.cormierconsulting.io',file=root+'/native-https-edit-before.json';assert.ok(['before','edited','restored'].includes(phase));
async function read(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json();}
async function traffic(servername,host=servername){return new Promise((resolve,reject)=>{const req=https.get({hostname:'10.99.15.50',servername,headers:{Host:host},rejectUnauthorized:true,timeout:8000},r=>{const fingerprint=r.socket.getPeerCertificate().fingerprint256;let body='';r.on('data',v=>body+=v);r.on('end',()=>resolve({status:r.statusCode,body,fingerprint}));});req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('Traffic timeout')));});}
const route=await read(`/apis/traefik.io/v1alpha1/namespaces/${ns}/ingressroutes/${name}`),service=await read(`/api/v1/namespaces/${ns}/services/protocol-fixture`);
const baseline={observedAt:new Date().toISOString(),route:{uid:route.metadata.uid,spec:route.spec},service:{uid:service.metadata.uid,spec:service.spec}};
if(phase==='before'){const response=await traffic(original);assert.equal(response.status,200);assert.equal(response.body,'manager-acceptance-v1\n');assert.equal(route.spec.tls.secretName,'manager-native-https-tls');fs.writeFileSync(file,JSON.stringify({...baseline,response},null,2));console.log('Native HTTPS original route baseline captured.');}
else{
 const before=JSON.parse(fs.readFileSync(file));assert.equal(route.metadata.uid,before.route.uid);assert.deepEqual(baseline.service,before.service);assert.deepEqual(route.spec.entryPoints,before.route.spec.entryPoints);assert.deepEqual(route.spec.routes[0].services,before.route.spec.routes[0].services);
 if(phase==='edited'){assert.equal(route.spec.tls.secretName,'manager-native-certificate-tls');assert.equal(route.spec.routes[0].match,`(Host(\`${edited}\`))`);}else assert.deepEqual(route.spec,before.route.spec);
 const active=phase==='edited'?edited:original,inactive=phase==='edited'?original:edited;
 for(let i=0;i<6;i++){const r=await traffic(active);assert.equal(r.status,200);assert.equal(r.body,'manager-acceptance-v1\n');const absent=await traffic(active,inactive);assert.equal(absent.status,404);}
 const report={observedAt:new Date().toISOString(),phase,activeHost:active,strictTlsChecks:12,activeBodyCorrect:true,inactiveHostAbsent:true,routeIdentityPreserved:true,serviceIdentityAndSpecPreserved:true,passed:true};fs.writeFileSync(root+'/native-https-'+phase+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
