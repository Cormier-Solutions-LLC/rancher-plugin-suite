import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const phase=process.argv[2]||'running',path='.local/manager-installation/phone-restart-recovery-owned.json',started=Date.now();
let previous='';
while(Date.now()-started<30*60*1000){
 const text=execFileSync(process.execPath,['scripts/test-phone-restart-recovery.mjs','status'],{encoding:'utf8',timeout:60000,stdio:['ignore','pipe','pipe']}),o=JSON.parse(text),key=JSON.stringify([o.tasks,o.readyClones,o.liveClonePods,o.restartedReady,o.passed]);
 if(key!==previous){console.log(text.trim());previous=key;}
 const l=JSON.parse(fs.readFileSync(path));
 if(phase==='running'&&o.allRunning||phase==='complete'&&l.cleanedAt)process.exit(0);
 if(phase==='running'&&o.tasks.some(t=>['failed','succeeded','cancelled'].includes(t.status)))throw Error('An owned job became terminal before restart; reconcile the existing jobs');
 await new Promise(r=>setTimeout(r,phase==='complete'&&!l.restartedReadyAt?1000:3000));
}
throw Error('Bounded restart observation expired; reconcile the same owned jobs');
