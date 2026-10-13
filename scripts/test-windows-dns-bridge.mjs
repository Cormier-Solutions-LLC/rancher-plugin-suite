import fs from 'node:fs';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const run=promisify(execFile),base='http://127.0.0.1:15888',zone='cormierconsulting.io',label='manager-bridge-'+randomUUID().slice(0,8),results=[];
const queuePath='/api/v1/namespaces/dns-system/configmaps/dns-windows-queue';
const call=async(path,init={})=>{const r=await fetch(base+path,{...init,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Object.assign(new Error(`Kubernetes ${r.status}`),{status:r.status});return r.json();};
const read=async()=>JSON.parse((await call('/api/v1/namespaces/dns-system/configmaps/dns-windows-observations')).data['inventory.json']);
async function job(operations,{stale=false,snapshot=true,incomplete=false}={}) {
 const inventory=await read();assert.ok(Date.now()-Date.parse(inventory.observedAt)<30000);const z=inventory.zones.find(z=>z.name===zone);
 const current={configuration:{id:'source/windows',name:'Windows DNS'},relatedConfigurations:[{id:'zone/'+zone,name:zone,kind:'DnsZone',dns:{zone:z,records:inventory.records[zone]}}],snapshotScope:{label:'Live Windows DNS acceptance'},routeManifests:[]};
 if(incomplete)current.relatedConfigurations[0].dns.records=[];
 const response=await fetch(base+'/api/v1/namespaces/manager-system/services/http:dns-manager-snapshots:8080/proxy/api/snapshots',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://rancher.cormierconsulting.io'},body:JSON.stringify({current,scopeKey:'windows-live-acceptance'})});assert.equal(response.status,201);const backup=await response.json();
 const request={id:randomUUID(),createdAt:new Date().toISOString(),status:'Queued',snapshotId:snapshot?backup.id:'',serials:{[zone]:String(Number(z.serial)-(stale?1:0))},operations,receipts:[],startedAt:null,finishedAt:null,error:''};
 const cm=await call(queuePath),jobs=JSON.parse(cm.data['jobs.json']);jobs.push(request);cm.data['jobs.json']=JSON.stringify(jobs);await call(queuePath,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(cm)});
 const deadline=Date.now()+60000;let result;
 while(Date.now()<deadline){const state=await call(queuePath);result=JSON.parse(state.data['jobs.json']).find(j=>j.id===request.id);if(['Applied','Rejected','PartialFailure'].includes(result.status))return result;await new Promise(r=>setTimeout(r,1000));}
 throw new Error('Windows job did not finish: '+JSON.stringify({id:request.id,status:result?.status,error:result?.error}));
}
const initial=[['A','192.0.2.201'],['AAAA','2001:db8::201'],['CNAME',`${label}-a.${zone}`],['TXT','manager-bridge-before'],['MX',`10 ${label}-a.${zone}`],['SRV',`10 5 8443 ${label}-a.${zone}`],['PTR',`${label}-a.${zone}`]].map(([type,value])=>({zone,name:type==='SRV'?`_test._tcp.${label}`:`${label}-${type.toLowerCase()}`,type,value,ttl:5,operation:'Create'}));
try {
 if(process.argv.includes('--cleanup-previous')){
  const jobs=JSON.parse((await call(queuePath)).data['jobs.json']);const inventory=await read();
  const proven=jobs.filter(j=>j.status==='Applied'&&j.operations?.length===7&&j.operations.every(o=>o.operation==='Create'&&o.zone===zone&&/^(?:manager-bridge-[0-9a-f]{8}-(?:a|aaaa|cname|txt|mx|srv|ptr)|_test\._tcp\.manager-bridge-[0-9a-f]{8})$/.test(o.name))).flatMap(j=>j.operations);
  const records=inventory.records[zone].filter(r=>proven.some(o=>r.name===o.name&&r.type===o.type&&r.value===o.value));
  if(records.length){const cleanup=await job(records.map(r=>({...r,zone,operation:'Delete',targetId:JSON.stringify([r.name,r.type,r.value])})));assert.equal(cleanup.status,'Applied',cleanup.error);results.push({check:'Earlier proven fixture records removed',passed:true,count:records.length});}
 }
 const denied=await job([{...initial[0],zone:'outside.invalid'}]);assert.equal(denied.status,'Rejected');results.push({check:'Unauthorized zone rejected',passed:true});
 const stale=await job([initial[0]],{stale:true});assert.equal(stale.status,'Rejected');results.push({check:'Changed zone serial rejected before writes',passed:true});
 const noBackup=await job([initial[0]],{snapshot:false});assert.equal(noBackup.status,'Rejected');results.push({check:'Missing durable snapshot rejected',passed:true});
 const partialBackup=await job([initial[0]],{incomplete:true});assert.equal(partialBackup.status,'Rejected');assert.match(partialBackup.error,/complete reviewed/);results.push({check:'Incomplete zone snapshot rejected before writes',passed:true});
 const invalidTarget=await job([{...initial[5],value:'1 2 9000 invalid-target'}]);assert.equal(invalidTarget.status,'Rejected');results.push({check:'Invalid SRV target rejected before writes',passed:true});
 const create=await job(initial);assert.equal(create.status,'Applied',create.error);assert.equal(create.receipts.length,7);results.push({check:'Seven record types created with Windows readback',passed:true});
 const values={'A':'192.0.2.202','AAAA':'2001:db8::202','CNAME':'rancher.'+zone,'TXT':'manager-bridge-after','MX':'20 rancher.'+zone,'SRV':'20 10 9443 rancher.'+zone,'PTR':'rancher.'+zone};
 const updates=initial.map(r=>({...r,operation:'Update',targetId:JSON.stringify([r.name,r.type,r.value]),value:values[r.type],ttl:10}));
 const update=await job(updates);assert.equal(update.status,'Applied',update.error);assert.equal(update.receipts.length,7);results.push({check:'Seven record types updated with Windows readback',passed:true});
 for(const server of ['10.99.15.55','10.99.15.56','10.99.15.57','10.99.15.58'])for(const record of updates){
   const deadline=Date.now()+30000;let matched=false;
   while(Date.now()<deadline){const {stdout}=await run('dotnet',['dns-manager-dev/tests/LiveQuery/bin/Release/net10.0/LiveQuery.dll',server,record.name+'.'+zone,record.type,'tcp']);const reply=JSON.parse(stdout);if(reply.rcode==='NoError'&&reply.answers.some(a=>a.value.replace(/\.$/,'').includes(record.value))){matched=true;break;}await new Promise(r=>setTimeout(r,1000));}
   assert.ok(matched,`Replicated ${record.type} missing at ${server}`);
 }
 results.push({check:'Updated records propagated to all four VIPs',passed:true});
 const deletes=updates.map(r=>({...r,operation:'Delete',targetId:JSON.stringify([r.name,r.type,r.value])}));
 const deleted=await job(deletes);assert.equal(deleted.status,'Applied',deleted.error);assert.equal(deleted.receipts.length,7);results.push({check:'Seven record types deleted with Windows readback',passed:true});
 console.log('Windows bridge record CRUD, snapshot/serial/zone gates and replica propagation passed.');
}finally{fs.writeFileSync('.local/manager-installation/windows-bridge-live-tests.json',JSON.stringify({label,results},null,2));}
