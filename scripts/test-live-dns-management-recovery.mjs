import fs from 'node:fs';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const run=promisify(execFile),kubectl='C:/Program Files/Docker/Docker/resources/bin/kubectl.exe',base='http://127.0.0.1:15888',results=[],id=randomUUID(),name='manager-interrupted-'+id.slice(0,8),zone='cormierconsulting.io';
const queue='/api/v1/namespaces/dns-system/configmaps/dns-windows-queue';
async function call(path,init){const r=await fetch(base+path,{...init,signal:AbortSignal.timeout(15000)});assert.ok(r.ok,`Kubernetes ${r.status}`);return r.json();}
async function observation(name){return JSON.parse((await call('/api/v1/namespaces/dns-system/configmaps/'+name)).data['inventory.json']);}
async function task(action){await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Invoke-Command -ComputerName domain02.cormierconsulting.com -ScriptBlock { ${action}-ScheduledTask -TaskName 'Cormier DNS Manager Bridge' }`],{timeout:30000});}
let stopped=false,inserted=false;
try{
 const initial=await observation('dns-windows-observations');assert.ok(initial.managementReachable);assert.ok(!initial.records[zone].some(r=>r.name===name));
 const first=await call(queue);assert.ok(!JSON.parse(first.data['jobs.json']).some(j=>['Queued','Running'].includes(j.status)),'Do not interrupt an active DNS write.');
 await task('Stop');stopped=true;
 const cm=await call(queue),jobs=JSON.parse(cm.data['jobs.json']);assert.ok(!jobs.some(j=>['Queued','Running'].includes(j.status)),'A DNS write arrived while stopping the bridge.');
 jobs.push({id,createdAt:new Date().toISOString(),status:'Running',startedAt:new Date().toISOString(),receipts:[],operations:[{operation:'Create',zone,name,type:'A',value:'192.0.2.231',ttl:10}]});cm.data['jobs.json']=JSON.stringify(jobs);await call(queue,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(cm)});inserted=true;
 await task('Start');stopped=false;
 const deadline=Date.now()+90000;let recovered;
 while(Date.now()<deadline){recovered=JSON.parse((await call(queue)).data['jobs.json']).find(j=>j.id===id);if(recovered?.status==='Interrupted')break;await new Promise(r=>setTimeout(r,1000));}
 assert.equal(recovered?.status,'Interrupted');assert.deepEqual(recovered.receipts,[]);assert.match(recovered.error,/no writes are replayed/);
 let fresh;const inventoryDeadline=Date.now()+45000;while(Date.now()<inventoryDeadline){fresh=await observation('dns-windows-observations');if(fresh.observedAt>initial.observedAt)break;await new Promise(r=>setTimeout(r,1000));}
 assert.ok(fresh.observedAt>initial.observedAt);assert.ok(fresh.managementReachable);assert.ok(!fresh.records[zone].some(r=>r.name===name));
 results.push({check:'Windows bridge task restarts, refreshes authenticated inventory and refuses interrupted job replay',passed:true,receipt:recovered});console.log('Windows bridge restart and interrupted-operation recovery passed.');
 const deployment=await call('/apis/apps/v1/namespaces/dns-system/deployments/dns-manager-controller');const before=await observation('dns-manager-observations');
 const pod=await call('/api/v1/namespaces/dns-system/pods?labelSelector=app.kubernetes.io%2Fname%3Ddns-manager-controller');assert.equal(pod.items.length,1);
 await run(kubectl,['-n','dns-system','delete','pod',pod.items[0].metadata.name,'--wait=false']);
 const recoveryDeadline=Date.now()+90000;let restarted=false;
 while(Date.now()<recoveryDeadline){const pods=await call('/api/v1/namespaces/dns-system/pods?labelSelector=app.kubernetes.io%2Fname%3Ddns-manager-controller');const o=await observation('dns-manager-observations');if(pods.items.some(p=>p.metadata.uid!==pod.items[0].metadata.uid&&p.status.conditions?.some(c=>c.type==='Ready'&&c.status==='True'))&&o.observedAt>before.observedAt&&o.replicas.every(r=>r.reachable)){restarted=true;break;}await new Promise(r=>setTimeout(r,1000));}
 assert.ok(restarted);assert.equal(deployment.spec.replicas,1);results.push({check:'New controller pod resumes reconciliation with all DNS replicas reachable',passed:true});console.log('DNS controller restart and reconciliation recovery passed.');
}finally{
 if(stopped)await task('Start');
 if(inserted){const cm=await call(queue),jobs=JSON.parse(cm.data['jobs.json']),own=jobs.find(j=>j.id===id);if(own?.status==='Interrupted'){cm.data['jobs.json']=JSON.stringify(jobs.filter(j=>j.id!==id));await call(queue,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(cm)});}}
 fs.writeFileSync('.local/manager-installation/dns-management-recovery-live-tests.json',JSON.stringify({id,name,results},null,2));
}
