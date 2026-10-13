import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const path='.local/manager-installation/phone-profile-restart-owned.json',phase=process.argv[2]||'capture',start=Date.now();
let previous='',restartGapPrinted=false;
while(Date.now()-start<25*60*1000){
 let text;
 try{text=execFileSync(process.execPath,['scripts/test-phone-profile-restart.mjs','status'],{encoding:'utf8',timeout:60000,stdio:['ignore','pipe','pipe']});}
 catch(e){const l=JSON.parse(fs.readFileSync(path));if(l.nativeRedeployIntentAt&&!l.restartedReadyAt&&Date.now()-Date.parse(l.nativeRedeployIntentAt)<180000){if(!restartGapPrinted){console.log('Observing the same profile operation through the Rancher restart');restartGapPrinted=true;}await new Promise(r=>setTimeout(r,3000));continue;}throw Error('Profile observation failed; reconcile the same operation without repeating mutations');}
 const o=JSON.parse(text),l=JSON.parse(fs.readFileSync(path)),key=JSON.stringify([o.operationStatus,o.primaryDesiredReplicas,o.primaryReadyReplicas,o.ownedSnapshotReady,o.profileReady,o.restartedReady,o.workflowStatus,o.workflowCleaned,o.passed]);
 if(key!==previous){console.log(text.trim());previous=key;}
 if(phase==='restart-ready'&&o.operationStatus==='running'&&o.primaryDesiredReplicas===1&&o.primaryReadyReplicas===0&&o.ownedSnapshotReady)process.exit(0);
 if(phase==='capture'&&l.capturedAt&&l.restartedReadyAt||phase==='workflow'&&l.workflowCleanedAt||phase==='cleanup'&&l.cleanedAt)process.exit(0);
 await new Promise(r=>setTimeout(r,3000));
}
throw Error('Bounded profile observation expired; reconcile the existing profile and operation');
