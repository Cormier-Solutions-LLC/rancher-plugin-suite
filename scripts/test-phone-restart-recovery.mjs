import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {connect,kube,base} from './phone-acceptance-client.mjs';
const dir='.local/manager-installation/',path=dir+'phone-restart-recovery-owned.json',phase=process.argv[2]||'status',hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const build=JSON.parse(fs.readFileSync(dir+'phone-recovery-build-owned.json'));
let l=fs.existsSync(path)?JSON.parse(fs.readFileSync(path)):null;
const save=()=>fs.writeFileSync(path,JSON.stringify(l,null,2),{mode:0o600});
const client=await connect(),{call}=client;
function spec(d){const s=structuredClone(d.spec);if(s.template.metadata.annotations){delete s.template.metadata.annotations['cattle.io/timestamp'];delete s.template.metadata.annotations['kubectl.kubernetes.io/restartedAt'];if(!Object.keys(s.template.metadata.annotations).length)delete s.template.metadata.annotations;}return s;}
async function originals(){
 const [d,p,profiles,pvc]=await Promise.all([kube('/apis/apps/v1/namespaces/automation/deployments/phone-queue-controller'),kube('/apis/apps/v1/namespaces/automation/statefulsets/pixel-10-pro-xl'),call('list_phone_profiles'),kube('/api/v1/namespaces/automation/persistentvolumeclaims/data-pixel-10-pro-xl-0')]);
 assert.equal(d.metadata.uid,l.controllerUid);assert.equal(hash(spec(d)),l.controllerSpecHash);assert.equal(d.spec.template.spec.containers[0].image,build.pinnedImage);assert.equal(p.metadata.uid,l.primaryUid);assert.equal(hash(p.spec),l.primarySpecHash);assert.equal(p.status.readyReplicas,1);assert.equal(hash(profiles.profiles),l.profileHash);assert.equal(pvc.metadata.uid,l.primaryPvcUid);assert.equal(pvc.spec.volumeName,l.primaryVolume);
 return d;
}
async function observe(){
 const d=await originals();
 const [tasks,pods,pvcs,deps,services,controllers]=await Promise.all([
  Promise.all(l.tasks.map(async t=>{const x=await call('get_mobile_task',{task_id:t.id});assert.equal(x.max_attempts,t.maxAttempts);assert.equal(x.keep_instance,false);assert.equal(x.actions.length,6);assert.ok(x.actions.every((a,i)=>a.acceptance_id===l.id+'-'+t.role+'-'+i&&a.type==='wait'&&a.seconds===60));return x;})),
  ...['pods','persistentvolumeclaims'].map(k=>kube('/api/v1/namespaces/automation/'+k+'?labelSelector=app.kubernetes.io%2Fmanaged-by%3Dphone-queue-controller')),
  kube('/apis/apps/v1/namespaces/automation/deployments?labelSelector=app.kubernetes.io%2Fmanaged-by%3Dphone-queue-controller'),
  kube('/api/v1/namespaces/automation/services?labelSelector=app.kubernetes.io%2Fmanaged-by%3Dphone-queue-controller'),
  kube('/api/v1/namespaces/automation/pods?labelSelector=app.kubernetes.io%2Fname%3Dphone-queue-controller')]);
 for(const r of [...pods.items,...pvcs.items,...deps.items,...services.items])assert.ok(l.tasks.some(t=>t.id===r.metadata.labels['automation.openai.com/task-id']),'Foreign phone work appeared; stop before restarting');
 for(const p of pvcs.items)if(p.spec.volumeName&&!l.volumes.some(v=>v.name===p.spec.volumeName))l.volumes.push({name:p.spec.volumeName,pvcUid:p.metadata.uid,taskId:p.metadata.labels['automation.openai.com/task-id']});
 const o={at:new Date().toISOString(),controllerReady:d.status.readyReplicas===1,controllerPodUids:controllers.items.map(p=>p.metadata.uid),tasks:tasks.map((x,i)=>({role:l.tasks[i].role,status:x.status,attempt:x.attempt,steps:x.result?.steps?.length||0,errorPresent:!!x.error})),liveClonePods:pods.items.filter(p=>!['Failed','Succeeded'].includes(p.status.phase)).length,readyClones:pods.items.filter(p=>p.status.conditions?.some(c=>c.type==='Ready'&&c.status==='True')).length,pvcs:pvcs.items.length,deployments:deps.items.length,services:services.items.length};
 assert.ok(o.liveClonePods<=3,'Restart introduced overlapping clones');l.observations.push(o);save();
 if(l.nativeRedeployIntentAt&&d.status.readyReplicas===1&&controllers.items.length===1&&controllers.items[0].metadata.uid!==l.controllerPodBefore){l.restartedReadyAt??=o.at;l.controllerPodAfter=controllers.items[0].metadata.uid;save();}
 return {d,tasks,o,pods,pvcs,deps,services,controllers};
}
try{
 if(phase==='start'){
  assert.ok(!l,'Never repeat a confirmed restart acceptance enqueue');const deploy=JSON.parse(fs.readFileSync(dir+'phone-recovery-deploy-owned.json'));assert.ok(deploy.verifiedAt);
  const [pool,d,p,profiles,pvc,clones]=await Promise.all([call('get_phone_pool_status'),kube('/apis/apps/v1/namespaces/automation/deployments/phone-queue-controller'),kube('/apis/apps/v1/namespaces/automation/statefulsets/pixel-10-pro-xl'),call('list_phone_profiles'),kube('/api/v1/namespaces/automation/persistentvolumeclaims/data-pixel-10-pro-xl-0'),kube('/apis/apps/v1/namespaces/automation/deployments?labelSelector=app.kubernetes.io%2Fmanaged-by%3Dphone-queue-controller')]);
  assert.equal(['queued','provisioning','running','cancelling'].reduce((n,k)=>n+(pool.counts[k]||0),0),0);assert.equal(pool.max_phones,10);assert.equal(clones.items.length,0);assert.equal(d.status.readyReplicas,1);assert.equal(d.spec.template.spec.containers[0].image,build.pinnedImage);assert.equal(p.status.readyReplicas,1);
  l={id:'manager-restart-'+randomUUID(),intentAt:new Date().toISOString(),controllerUid:d.metadata.uid,controllerSpecHash:hash(spec(d)),primaryUid:p.metadata.uid,primarySpecHash:hash(p.spec),primaryPvcUid:pvc.metadata.uid,primaryVolume:pvc.spec.volumeName,profileHash:hash(profiles.profiles),image:build.pinnedImage,tasks:[],volumes:[],observations:[]};save();
  for(const [role,maxAttempts]of [['retry',2],['exhausted',1],['cancelled',2]]){l.nextEnqueueIntent={role,at:new Date().toISOString()};save();const r=await call('enqueue_mobile_workflow',{profile_name:'default',actions:Array.from({length:6},(_,i)=>({type:'wait',seconds:60,acceptance_id:l.id+'-'+role+'-'+i})),keep_instance:false,max_attempts:maxAttempts});assert.match(r.task_id,/^[a-f0-9]{32}$/);l.tasks.push({role,id:r.task_id,maxAttempts});delete l.nextEnqueueIntent;save();}l.enqueuedAt=new Date().toISOString();save();console.log(JSON.stringify({ownedWaitOnlyJobsEnqueued:3,retryBudgets:[2,1,2],configuredLimitUnchanged:10}));
 }else if(phase==='prepare-restart'){
  assert.ok(l?.enqueuedAt&&!l.restartPreparedAt);const {tasks,o,controllers,pods}=await observe();assert.ok(tasks.every(t=>t.status==='running'&&t.attempt===1),'Wait for all three owned jobs to be running');assert.equal(o.readyClones,3);assert.equal(controllers.items.length,1);assert.ok(controllers.items[0].status.conditions.some(c=>c.type==='Ready'&&c.status==='True'));l.controllerPodBefore=controllers.items[0].metadata.uid;l.clonePodsBefore=pods.items.map(p=>({uid:p.metadata.uid,taskId:p.metadata.labels['automation.openai.com/task-id']}));l.restartPreparedAt=new Date().toISOString();save();console.log(JSON.stringify({prepared:true,threeRunningJobs:true,controllerUidCaptured:true}));
 }else if(phase==='cancel'){
  assert.ok(l?.restartPreparedAt&&!l.cancelIntentAt&&!l.nativeRedeployIntentAt);await observe();const t=l.tasks.find(t=>t.role==='cancelled');l.cancelIntentAt=new Date().toISOString();save();const r=await call('cancel_mobile_task',{task_id:t.id});assert.equal(r.status,'cancelling');l.cancelReceiptAt=new Date().toISOString();l.cancellationPendingBeforeRestart=true;save();console.log(JSON.stringify({ownedCancellationAccepted:true,status:'cancelling'}));
 }else if(phase==='redeploy-intent'){
  assert.ok(l?.cancelReceiptAt&&!l.nativeRedeployIntentAt);const {tasks,controllers}=await observe();assert.equal(controllers.items[0]?.metadata.uid,l.controllerPodBefore);assert.equal(tasks[0].status,'running');assert.equal(tasks[1].status,'running');assert.equal(tasks[2].status,'cancelling');l.nativeRedeployIntentAt=new Date().toISOString();save();console.log(JSON.stringify({nativeRancherRestartPrepared:true,pendingCancellationConfirmed:true}));
 }else{
  assert.ok(l?.enqueuedAt);const {tasks,o,pods,pvcs,deps,services}=await observe();
  if(!l.nativeRedeployIntentAt){console.log(JSON.stringify({...o,allRunning:tasks.every(t=>t.status==='running')}));}
  else{
   const retry=tasks[0],exhausted=tasks[1],cancelled=tasks[2];assert.ok(retry.attempt<=2);assert.ok(exhausted.attempt<=1);assert.ok(cancelled.attempt<=1);
   if(l.restartedReadyAt){assert.equal(exhausted.status,'failed');assert.equal(cancelled.status,'cancelled');assert.ok(exhausted.error?.includes('attempt budget exhausted'));l.cancellationInterruptedByRestart=!!cancelled.error?.includes('controller restarted during cancellation');
    l.recoveryStatusesVerifiedAt??=o.at;save();}
   let gone=false;if(retry.status==='succeeded'&&pods.items.length===0&&pvcs.items.length===0&&deps.items.length===0&&services.items.length===0){const statuses=await Promise.all(l.volumes.flatMap(v=>['/api/v1/persistentvolumes/'+v.name,'/apis/longhorn.io/v1beta2/namespaces/longhorn-system/volumes/'+v.name]).map(async url=>(await fetch(base+url,{signal:AbortSignal.timeout(20000)})).status));gone=l.volumes.length===4&&statuses.every(s=>s===404);}
   if(gone){assert.equal(retry.attempt,2);assert.equal(retry.result.steps.length,6);assert.ok(l.recoveryStatusesVerifiedAt);l.cleanedAt=new Date().toISOString();save();const report={observedAt:l.cleanedAt,image:l.image,strictTls:true,nativeRancherRedeploy:true,newControllerPodVerified:true,interruptedJobSucceededOnSecondAttempt:true,exhaustedJobFailedWithoutReplay:true,pendingCancellationRecoveredWithoutReplay:l.cancellationInterruptedByRestart,cancellationFinishedBeforeRestart:!l.cancellationInterruptedByRestart,allOwnedClonesAndFourVolumesGone:true,originalProfileAndPrimaryPreserved:true,onlyRancherRedeployTimestampsChanged:true,maximumLiveClonePods:Math.max(...l.observations.map(o=>o.liveClonePods)),passed:l.cancellationInterruptedByRestart};fs.writeFileSync(dir+'phone-restart-recovery-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
   else console.log(JSON.stringify({...o,restartedReady:!!l.restartedReadyAt,recoveryStatusesVerified:!!l.recoveryStatusesVerifiedAt,cleaned:false}));
  }
 }
}finally{await client.close();}
