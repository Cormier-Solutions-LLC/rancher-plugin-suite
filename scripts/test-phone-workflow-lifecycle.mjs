import fs from 'node:fs';
import https from 'node:https';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const dir='.local/manager-installation', ledgerPath=dir+'/phone-workflow-owned.json', reportPath=dir+'/phone-workflow-lifecycle-tests.json';
const phase=process.argv[2]||'status', scenario=process.argv[3]||'success', host='mcp-phone.cormierconsulting.io';
async function kube(path){const r=await fetch('http://127.0.0.1:15888'+path,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json();}
function request(body,headers={},method='POST'){return new Promise((resolve,reject)=>{const req=https.request({host,port:443,path:'/mcp',method,lookup:(_h,_o,cb)=>cb(null,[{address:'10.99.15.50',family:4}]),rejectUnauthorized:true,headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...headers},timeout:20000},res=>{let text='';res.on('data',b=>{text+=b;assert.ok(text.length<4*1024*1024);});res.on('end',()=>{try{const messages=res.headers['content-type']?.includes('text/event-stream')?text.split('\n').filter(l=>l.startsWith('data:')).map(l=>JSON.parse(l.slice(5))):text?[JSON.parse(text)]:[];resolve({status:res.statusCode,headers:res.headers,messages});}catch(e){reject(e);}});});req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('MCP timeout; do not repeat an unknown mutation')));req.end(body?JSON.stringify(body):undefined);});}
function unpack(result){assert.ok(result&&!result.isError,'Phone tool rejected operation');if(result.structuredContent!==undefined){const value=result.structuredContent;return Object.keys(value).length===1&&Array.isArray(value.result)?value.result:value;}const t=result.content?.find(c=>c.type==='text')?.text;return t?JSON.parse(t):undefined;}
const deployment=await kube('/apis/apps/v1/namespaces/automation/deployments/mcp-gateway');
const config=await kube('/api/v1/namespaces/automation/configmaps/mcp-gateway-profiles-g9bttt95dc');
const profile=JSON.parse(config.data['profiles.json']).profiles.find(p=>p.hosts.includes(host));
const ref=deployment.spec.template.spec.containers[0].env.find(e=>e.name===profile.clientTokenEnv).valueFrom.secretKeyRef;
const secret=await kube('/api/v1/namespaces/automation/secrets/'+ref.name),token=Buffer.from(secret.data[ref.key],'base64').toString('utf8');
const init=await request({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'manager-lifecycle-acceptance',version:'1.0'}}},{Authorization:'Bearer '+token});
assert.equal(init.status,200);const headers={Authorization:'Bearer '+token,'MCP-Protocol-Version':init.messages.find(m=>m.id===1).result.protocolVersion,...(init.headers['mcp-session-id']?{'Mcp-Session-Id':init.headers['mcp-session-id']}:{})};
await request({jsonrpc:'2.0',method:'notifications/initialized'},headers);let id=2;
async function call(name,args={}){const callId=id++;const r=await request({jsonrpc:'2.0',id:callId,method:'tools/call',params:{name,arguments:args}},headers);assert.equal(r.status,200);return unpack(r.messages.find(m=>m.id===callId)?.result);}
function save(path,data){fs.writeFileSync(path,JSON.stringify(data,null,2),{mode:0o600});}
let ledger=fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath)):null;
try{
 if(phase==='reject'){
  const before=await call('list_mobile_tasks',{limit:100}),cases=[{actions:[]},{actions:[{type:'unsupported-acceptance-action'}]},{actions:[{type:'wait',seconds:0}],profile_name:'invalid/profile'}],checks=[];
  assert.ok(Array.isArray(before));
  for(const args of cases){const callId=id++,r=await request({jsonrpc:'2.0',id:callId,method:'tools/call',params:{name:'enqueue_mobile_workflow',arguments:args}},headers);assert.equal(r.status,200);const reply=r.messages.find(m=>m.id===callId);assert.ok(reply?.error||reply?.result?.isError,'Invalid workflow was not rejected');checks.push({rejected:true});}
  const after=await call('list_mobile_tasks',{limit:100});assert.deepEqual(after.map(t=>t.id),before.map(t=>t.id));const report={observedAt:new Date().toISOString(),strictTls:true,checks:['empty actions','unsupported action','invalid profile name'],allRejected:true,noTasksCreated:true,passed:true};save(dir+'/phone-workflow-rejection-tests.json',report);console.log(JSON.stringify(report));
 }else if(phase==='start'){
  assert.ok(!ledger||ledger.cleanedAt,'Existing workflow intent must be reconciled before another enqueue');
  const pool=await call('get_phone_pool_status');assert.equal(['queued','provisioning','running','cancelling'].reduce((a,k)=>a+(pool.counts?.[k]||0),0),0,'Pool has existing jobs; defer acceptance clone');assert.ok(Array.isArray(pool.ready_phone_profiles)&&pool.ready_phone_profiles.length>0);
  const profiles=await call('list_phone_profiles');assert.ok(profiles.profiles?.some(p=>p.profile_name==='default'&&p.snapshots.some(s=>s.ready_to_use||s.ready)),'Default profile is not ready');
  assert.ok(['success','missing-profile','cancel','retained'].includes(scenario));if(ledger?.cleanedAt){save(dir+'/phone-workflow-'+(ledger.scenario||'success')+'-'+ledger.taskId+'-owned.json',ledger);if(fs.existsSync(reportPath))save(dir+'/phone-workflow-'+(ledger.scenario||'success')+'-'+ledger.taskId+'-tests.json',JSON.parse(fs.readFileSync(reportPath)));}
  ledger={acceptanceId:'manager-lifecycle-'+randomUUID(),scenario,intentAt:new Date().toISOString(),poolBefore:pool,originalProfiles:profiles,keepInstance:scenario==='retained',maxAttempts:1,expectedTerminal:scenario==='missing-profile'?'failed':scenario==='cancel'?'cancelled':'succeeded'};save(ledgerPath,ledger);
  const result=await call('enqueue_mobile_workflow',{actions:[{type:'wait',seconds:scenario==='cancel'?60:2,acceptance_id:ledger.acceptanceId}],profile_name:scenario==='missing-profile'?'manager-missing-'+randomUUID().slice(0,8):'default',keep_instance:ledger.keepInstance,max_attempts:1});
  assert.match(result.task_id,/^[a-f0-9]{32}$/);ledger.taskId=result.task_id;ledger.enqueuedAt=new Date().toISOString();save(ledgerPath,ledger);
  console.log(JSON.stringify({enqueued:true,taskId:ledger.taskId,action:'wait',ownedClone:scenario!=='missing-profile'}));
 }else{
  assert.ok(ledger?.taskId,'No confirmed owned workflow ID; reconcile intent rather than enqueue again');
  const task=await call('get_mobile_task',{task_id:ledger.taskId});assert.equal(task.id,ledger.taskId);assert.equal(task.actions?.[0]?.acceptance_id,ledger.acceptanceId);assert.equal(task.keep_instance,ledger.keepInstance);
  save(dir+'/phone-workflow-task-private.json',task);
  ledger.observations??=[];ledger.observations.push({at:new Date().toISOString(),status:task.status,attempt:task.attempt,resourceName:task.resource_name});save(ledgerPath,ledger);
  const name='phone-task-'+ledger.taskId.slice(0,12), urls=['/apis/apps/v1/namespaces/automation/deployments/'+name,'/api/v1/namespaces/automation/services/'+name,'/api/v1/namespaces/automation/persistentvolumeclaims/'+name];
  const resources=[];for(const url of urls){const r=await fetch('http://127.0.0.1:15888'+url,{signal:AbortSignal.timeout(15000)});assert.ok([200,404].includes(r.status));const obj=r.status===200?await r.json():null;if(obj)assert.equal(obj.metadata.labels['automation.openai.com/task-id'],ledger.taskId);if(obj?.kind==='PersistentVolumeClaim'&&obj.spec.volumeName){ledger.volumeName=obj.spec.volumeName;save(ledgerPath,ledger);}resources.push({kind:obj?.kind||url.split('/').at(-2),exists:r.status===200,uid:obj?.metadata.uid,readyReplicas:obj?.status?.readyReplicas,phase:obj?.status?.phase,deleting:!!obj?.metadata.deletionTimestamp});}
  if(phase==='cancel'){assert.ok(['queued','provisioning','running','cancelling'].includes(task.status));ledger.cancelIntentAt=new Date().toISOString();save(ledgerPath,ledger);const receipt=await call('cancel_mobile_task',{task_id:ledger.taskId});assert.equal(receipt.task_id,ledger.taskId);ledger.cancelReceipt=receipt;save(ledgerPath,ledger);}
  if(phase==='release'){assert.equal(task.status,'succeeded');assert.equal(task.keep_instance,true);assert.equal(task.resource_name,name);assert.ok(resources.every(r=>r.exists));ledger.releaseIntentAt=new Date().toISOString();save(ledgerPath,ledger);const receipt=await call('release_mobile_task_instance',{task_id:ledger.taskId});assert.equal(receipt.task_id,ledger.taskId);assert.equal(receipt.released,true);ledger.keepInstance=false;ledger.releaseReceipt=receipt;save(ledgerPath,ledger);}
  if(ledger.volumeName){for(const url of ['/api/v1/persistentvolumes/'+ledger.volumeName,'/apis/longhorn.io/v1beta2/namespaces/longhorn-system/volumes/'+ledger.volumeName]){const r=await fetch('http://127.0.0.1:15888'+url,{signal:AbortSignal.timeout(15000)});assert.ok([200,404].includes(r.status));resources.push({kind:url.includes('persistentvolumes')?'PersistentVolume':'LonghornVolume',exists:r.status===200});}}
  const terminal=['succeeded','failed','cancelled'].includes(task.status),cleaned=terminal&&resources.every(r=>!r.exists);
  const pool=await call('get_phone_pool_status');
  if(cleaned){ledger.cleanedAt=new Date().toISOString();save(ledgerPath,ledger);}
  const report={observedAt:new Date().toISOString(),strictTls:true,taskId:ledger.taskId,scenario:ledger.scenario||'success',status:task.status,attempt:task.attempt,steps:task.result?.steps,ownedResources:resources,cleaned,readyProfilesAfter:pool.ready_phone_profiles.length,primaryProfileUnchanged:JSON.stringify((await call('list_phone_profiles')).profiles)===JSON.stringify(ledger.originalProfiles.profiles),passed:task.status===(ledger.expectedTerminal||'succeeded')&&cleaned&&((ledger.expectedTerminal||'succeeded')!=='succeeded'||task.result?.steps?.length===1),errorPresent:!!task.error};save(reportPath,report);console.log(JSON.stringify(report));
 }
}finally{if(init.headers['mcp-session-id'])await request(undefined,headers,'DELETE').catch(()=>{});}
