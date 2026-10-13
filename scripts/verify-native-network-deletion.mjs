import fs from 'node:fs';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
const base='http://127.0.0.1:15888',namespace='manager-acceptance';
const paths={route:`/apis/traefik.io/v1alpha1/namespaces/${namespace}/ingressroutes/manager-native-acceptance-http-80`,service:`/api/v1/namespaces/${namespace}/services/protocol-fixture`,httpsRoute:`/apis/traefik.io/v1alpha1/namespaces/${namespace}/ingressroutes/manager-native-https-https-443`,certificate:`/apis/cert-manager.io/v1/namespaces/${namespace}/certificates/manager-native-https-tls`,secret:`/api/v1/namespaces/${namespace}/secrets/manager-native-https-tls`};
async function metadata(path){const r=await fetch(base+path,{headers:{Accept:'application/json;as=PartialObjectMetadata;g=meta.k8s.io;v=v1'},signal:AbortSignal.timeout(15000)});if(r.status===404)return null;assert.equal(r.status,200);const v=await r.json();assert.equal(v.kind,'PartialObjectMetadata','Metadata-only reads must not fall back to credential data.');return {uid:v.metadata.uid,resourceVersion:v.metadata.resourceVersion};}
const reportPath='.local/manager-installation/native-network-deletion.json';
if(process.argv[2]==='before'){
 const before=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([k,p])=>[k,await metadata(p)])));
 assert.ok(Object.values(before).every(Boolean));fs.writeFileSync(reportPath,JSON.stringify({before,observedAt:new Date().toISOString()},null,2));console.log('Recorded route, dependency and TLS identities using metadata-only reads.');
}else{
 const report=JSON.parse(fs.readFileSync(reportPath));
 const after=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([k,p])=>[k,await metadata(p)])));
 assert.equal(after.route,null);for(const k of ['service','httpsRoute','certificate','secret'])assert.equal(after[k]?.uid,report.before[k].uid,`${k} was removed or replaced.`);
 async function traffic(tls,host){return new Promise((resolve,reject)=>{const req=(tls?https:http).get({hostname:'10.99.15.50',servername:host,headers:{Host:host},rejectUnauthorized:true,path:'/',timeout:8000},r=>{let body='';r.on('data',c=>body+=c);r.on('end',()=>resolve({status:r.statusCode,body,tlsVerified:tls?r.socket?.authorized:undefined}));});req.on('timeout',()=>req.destroy(new Error('Traffic timeout')));req.on('error',reject);});}
 const httpResult=await traffic(false,'manager-native-acceptance.cormierconsulting.io');assert.equal(httpResult.status,404);
 const httpsResult=await traffic(true,'manager-native-https.cormierconsulting.io');assert.equal(httpsResult.status,200);assert.equal(httpsResult.body,'manager-acceptance-v1\n');
 report.after=after;report.traffic={deletedHttpStatus:httpResult.status,preservedHttpsStatus:httpsResult.status,httpsCertificateValidated:true};report.passed=true;report.verifiedAt=new Date().toISOString();fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log('Native route deletion passed: HTTP 404, dependency identities preserved, unrelated HTTPS fixture still serves through verified TLS.');
}
