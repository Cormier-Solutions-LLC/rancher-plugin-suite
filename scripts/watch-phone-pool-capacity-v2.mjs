import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const phase=process.argv[2]||'ceiling',path='.local/manager-installation/phone-pool-capacity-v2-owned.json',start=Date.now();
let previous='';
while(Date.now()-start<20*60*1000){
 const text=execFileSync(process.execPath,['scripts/test-phone-pool-capacity-v2.mjs','status'],{encoding:'utf8',timeout:60000,stdio:['ignore','pipe','pipe']});
 const o=JSON.parse(text),key=JSON.stringify([o.readyClones,o.retainedSuccesses,o.queued,o.failed,o.ceilingVerified,o.queueResumed,o.passed]);
 if(key!==previous){console.log(text.trim());previous=key;}
 const l=JSON.parse(fs.readFileSync(path));
 if(l.physicalOverlapObservedAt)throw Error('Physical overlap observed again; preserve the trace');
 if((phase==='ceiling'&&l.ceilingVerifiedAt)||(phase==='resume'&&l.queueResumedAt)||(phase==='cleanup'&&l.cleanedAt))process.exit(0);
 await new Promise(r=>setTimeout(r,phase==='resume'?250:5000));
}
throw Error('Bounded capacity observation expired; reconcile the same jobs');
