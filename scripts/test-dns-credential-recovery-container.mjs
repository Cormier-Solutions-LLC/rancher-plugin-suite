import {mkdtemp,mkdir,cp,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
const run=promisify(execFile),root=resolve(import.meta.dirname,'..');
const image='node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1';
const context=await mkdtemp(join(root,'.local','dns-recovery-linux-'));
const files=['live-management/dns-credential-recovery.mjs','live-management/dns-credentials.mjs','live-management/dns-bridge-token.mjs','live-management/tests/dns-credential-recovery.test.mjs','live-management/windows-credential-recovery.mjs','live-management/windows-recovery-channel.mjs','live-management/windows-recovery-envelope.mjs','live-management/dns-engine-recovery.mjs','live-management/tests/windows-credential-recovery.test.mjs','live-management/tests/windows-recovery-channel.test.mjs','live-management/tests/dns-engine-recovery.test.mjs','live-management/dns-recovery-coordinator.mjs','live-management/dns-controller-credential-proof.mjs','live-management/tests/dns-recovery-coordinator.test.mjs'];
files.push(...['cluster-signing-keys','rancher-recovery-session','rancher-credential-recovery','installed-dns-credential-recovery','windows-recovery-bootstrap','dns-engine-api','dns-navigation'].map(n=>'live-management/'+n+'.mjs'),'preview-data/fresh-dns-source.mjs',...['cluster-signing-keys','rancher-credential-recovery','installed-dns-credential-recovery'].map(n=>'live-management/tests/'+n+'.test.mjs'));
files.push(...['rancher-dns-source-test','dns-source-wire','dns-source-test-result','dns-source-client','rancher-dns','dns-operations'].map(n=>'live-management/'+n+'.mjs'),'preview-data/data-source.mjs',...['rancher-dns-source-test','dns-source-wire','dns-source-test-result'].map(n=>'live-management/tests/'+n+'.test.mjs'));
files.push(...['dns-source-catalog','dns-source-transactions','dns-source-transaction-store','rancher-dns-source-session','dns-source-activation','dns-source-observer'].flatMap(n=>['live-management/'+n+'.mjs','live-management/tests/'+n+'.test.mjs']));
files.push(...['dns-source-backup','rancher-dns-source-management','dns-source-bootstrap'].flatMap(n=>['live-management/'+n+'.mjs','live-management/tests/'+n+'.test.mjs']));
files.push(...['dns-source-dependencies','dns-source-connection','installed-dns-source-management'].flatMap(n=>['live-management/'+n+'.mjs','live-management/tests/'+n+'.test.mjs']),'live-management/tests/rancher-dns-source-dependencies-session.test.mjs');
files.push('live-management/dns-source-settings.mjs');
for(const file of [...files,'dns-manager-dev/pkg/dns-manager/snapshot-feature/config']){await mkdir(resolve(context,file,'..'),{recursive:true});await cp(resolve(root,file),resolve(context,file),{recursive:true});}
await mkdir(join(context,'node_modules','@zip.js'),{recursive:true});
await cp(join(root,'simple-network-manager-dev','node_modules','@zip.js','zip.js'),join(context,'node_modules','@zip.js','zip.js'),{recursive:true});
const report={startedAt:new Date().toISOString(),image,context,container:'dns-recovery-'+context.split(/[\\/]/).at(-1).toLowerCase(),sourceDigests:Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(resolve(root,file))).digest('hex')]))),status:'Intent',productionWrites:0};
const output=join(root,'.local','manager-installation','dns-credential-recovery-linux-tests.json');
await writeFile(output,JSON.stringify(report,null,2));
try{
 const {stdout}=await run('docker',['run','--rm','--name',report.container,'--network','none','--read-only','--user','1000:1000','--tmpfs','/tmp:rw,nosuid,nodev,size=64m','--mount',`type=bind,source=${context},target=/work,readonly`,'--workdir','/work',image,'node','--test',...files.filter(f=>f.includes('/tests/'))],{timeout:60000,maxBuffer:1024*1024});
 report.status='Verified';report.passed=true;report.output=stdout;report.finishedAt=new Date().toISOString();await writeFile(output,JSON.stringify(report,null,2));process.stdout.write(stdout);
}catch(error){report.status='Unconfirmed or failed';report.passed=false;report.finishedAt=new Date().toISOString();report.error=error.stderr||error.message;await writeFile(output,JSON.stringify(report,null,2));throw Error('Linux credential recovery verification failed; inspect its private test receipt.');}
