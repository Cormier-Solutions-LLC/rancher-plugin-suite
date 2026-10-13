import fs from 'node:fs';import assert from 'node:assert/strict';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const run=promisify(execFile),dir='.local/manager-installation',mode=process.argv[2]||'wait',deadline=Date.now()+12*60*1000;
let lastStatus;
while(Date.now()<deadline){
 const {stdout}=await run(process.execPath,['scripts/test-phone-workflow-lifecycle.mjs','status'],{timeout:30000});const report=JSON.parse(stdout.trim().split('\n').at(-1)),ledger=JSON.parse(fs.readFileSync(dir+'/phone-workflow-owned.json'));
 if(report.status!==lastStatus||report.cleaned){console.log(JSON.stringify({at:report.observedAt,status:report.status,scenario:report.scenario,existingResources:report.ownedResources.filter(r=>r.exists).length,cleaned:report.cleaned,passed:report.passed}));lastStatus=report.status;}
 if(mode==='cancel-running'&&report.status==='running'&&!ledger.cancelIntentAt){console.log('Cancelling the confirmed owned job during its final wait step.');await run(process.execPath,['scripts/test-phone-workflow-lifecycle.mjs','cancel'],{timeout:30000});}
 if(mode==='release-retained'&&report.status==='succeeded'&&ledger.keepInstance&&!ledger.releaseIntentAt){assert.ok(report.ownedResources.every(r=>r.exists));console.log('Releasing the confirmed owned retained phone instance.');await run(process.execPath,['scripts/test-phone-workflow-lifecycle.mjs','release'],{timeout:30000});}
 if(report.cleaned){assert.equal(report.passed,true,'Owned scenario finished with unexpected terminal status');assert.equal(report.primaryProfileUnchanged,true);break;}
 await new Promise(r=>setTimeout(r,10000));
}
const report=JSON.parse(fs.readFileSync(dir+'/phone-workflow-lifecycle-tests.json'));assert.equal(report.cleaned,true,'Owned phone lifecycle timed out; reconcile this same job rather than create another');assert.equal(report.passed,true);
