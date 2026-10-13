import fs from 'node:fs';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {inspectApplicationHealth} from './lib/service-health.mjs';
const run=promisify(execFile),root='.local/manager-installation';
const ingresses=JSON.parse(fs.readFileSync(`${root}/live-ingresses.json`));
const custom=JSON.parse(fs.readFileSync(`${root}/live-ingressroutes.json`));
const paths={'harbor.cormierconsulting.io':'/api/v2.0/health','gateway.cormierconsulting.io':'/realtime/tickets','home-assistant.cormierconsulting.io':'/api/'};
const endpoints=[...new Map([...ingresses.items.flatMap(r=>r.spec.rules.map(v=>({host:v.host,scheme:r.spec.tls?.some(t=>t.hosts?.includes(v.host))?'https':'http'}))),...custom.items.flatMap(r=>r.spec.routes.flatMap(v=>[...v.match.matchAll(/Host\(`([^`]+)`\)/g)].map(m=>({host:m[1],scheme:r.spec.tls?'https':'http'}))))].map(e=>[e.scheme+'://'+e.host,e])).values()];
const results=[];
for(let i=0;i<endpoints.length;i+=4) {
 await Promise.all(endpoints.slice(i,i+4).map(async ({host,scheme})=>{
  try {
   const port=scheme==='https'?443:80;
   const inspectBody=host==='harbor.cormierconsulting.io';
   const marker='__CURL_METRICS__';
   const args=['--silent','--show-error','--max-time','15','--resolve',`${host}:${port}:10.99.15.50`];
   if(inspectBody) args.push('--write-out',`\n${marker}%{json}`);
   else args.push('--output','NUL','--write-out','%{json}');
   args.push(`${scheme}://${host}${paths[host] || '/'}`);
   const {stdout}=await run('curl.exe',args);
   const markerAt=inspectBody?stdout.lastIndexOf(`\n${marker}`):-1;
   const body=inspectBody&&markerAt>=0?stdout.slice(0,markerAt):'';
   const metrics=JSON.parse(inspectBody?stdout.slice(markerAt+marker.length+1):stdout);const status=Number(metrics.http_code);
   const {applicationHealthy,applicationStatus,unhealthyComponents}=inspectApplicationHealth(host,body);
   const reachable=status>0&&status<500&&applicationHealthy;
   results.push({host,scheme,path:paths[host] || '/',status,tlsVerified:scheme==='https'?metrics.ssl_verify_result===0:null,reachable,seconds:metrics.time_total,...(inspectBody?{applicationStatus,unhealthyComponents}:{}),note:inspectBody&&applicationStatus!=='healthy'?`Harbor reports ${applicationStatus}: ${unhealthyComponents.join(', ')}`:[401,403].includes(status)?'Authenticated endpoint rejects anonymous access':status===405?'Endpoint rejects unsupported GET; functional request remains untested':status===404?'No root document; endpoint-specific verification remains required':''});
  }catch(error){results.push({host,scheme,reachable:false,error:error.stderr || error.message});}
 }));
}
const workloads=JSON.parse(fs.readFileSync(`${root}/live-workload-storage.json`));
const unready=workloads.items.filter(r=>r.kind==='PersistentVolumeClaim'?r.status.phase!=='Bound':r.kind==='DaemonSet'?(r.status.numberReady ?? 0)!==r.status.desiredNumberScheduled:(r.status.readyReplicas ?? 0)!==(r.spec.replicas ?? 1)).map(r=>`${r.kind}/${r.metadata.namespace}/${r.metadata.name}`);
const volumes=JSON.parse(fs.readFileSync(`${root}/live-longhorn-volumes.json`));
const unhealthyAttached=volumes.items.filter(r=>r.status.state==='attached'&&r.status.robustness!=='healthy').map(r=>r.metadata.name);
const report={observedAt:new Date().toISOString(),http:results,unready,unhealthyAttached};
fs.writeFileSync(`${root}/service-health-tests.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(unready.length||unhealthyAttached.length||results.some(r=>!r.reachable))process.exitCode=1;
