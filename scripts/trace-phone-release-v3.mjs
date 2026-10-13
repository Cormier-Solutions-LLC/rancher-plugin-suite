import fs from 'node:fs';
import assert from 'node:assert/strict';
import {kube} from './phone-acceptance-client.mjs';
const dir='.local/manager-installation/',l=JSON.parse(fs.readFileSync(dir+'phone-pool-capacity-v3-owned.json'));
assert.ok(l.ceilingVerifiedAt&&!l.releaseOneIntentAt);
const records=[],start=Date.now(),owned=new Set(l.tasks.map(t=>t.id));
while(Date.now()-start<60000){
 const pods=(await kube('/api/v1/namespaces/automation/pods?labelSelector=app.kubernetes.io%2Fmanaged-by%3Dphone-queue-controller')).items.filter(p=>!['Succeeded','Failed'].includes(p.status.phase));
 assert.ok(pods.every(p=>owned.has(p.metadata.labels['automation.openai.com/task-id'])));
 const released=pods.find(p=>p.metadata.labels['automation.openai.com/task-id']===l.tasks[0].id),replacement=pods.find(p=>p.metadata.labels['automation.openai.com/task-id']===l.tasks[10].id);
 records.push({at:new Date().toISOString(),livePods:pods.length,terminating:pods.filter(p=>p.metadata.deletionTimestamp).length,releasedPodPresent:!!released,replacementPodPresent:!!replacement});
 fs.writeFileSync(dir+'phone-release-v3-trace.json',JSON.stringify(records));
 if(pods.length>10||released&&replacement)throw Error('Release physical overlap recurred; trace preserved');
 if(replacement){
  const report={observedAt:new Date().toISOString(),samples:records.length,maximumLivePods:Math.max(...records.map(r=>r.livePods)),terminatingObserved:records.some(r=>r.terminating>0),releasedPodGoneBeforeReplacement:true,passed:true};
  fs.writeFileSync(dir+'phone-release-v3-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));process.exit(0);
 }
 await new Promise(r=>setTimeout(r,100));
}
throw Error('No replacement observed within release trace window; reconcile the same jobs');
