import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import net from 'node:net';import {spawn} from 'node:child_process';
test('actual DNS snapshot HTTP service enforces source method/origin/type/size/session boundaries and counts both private journals',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'dns-source-server-')),snapshots=join(directory,'snapshots');await mkdir(snapshots,{mode:0o700});t.after(()=>rm(directory,{recursive:true,force:true}));
 const reservation=net.createServer();await new Promise(done=>reservation.listen(0,'127.0.0.1',done));const port=reservation.address().port;await new Promise(done=>reservation.close(done));
 const child=spawn(process.execPath,['container/server.mjs'],{cwd:resolve('dns-manager-dev'),env:{...process.env,SNAPSHOT_DIR:snapshots,STATIC_DIR:directory,HOST:'127.0.0.1',PORT:String(port),SNAPSHOT_PREVIEW_MOCK_DATA:'true',SNAPSHOT_FRESH_DNS:'false',SNAPSHOT_ALLOWED_ORIGIN:'https://rancher.cormierconsulting.io'},windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});let errors='';child.stderr.on('data',value=>errors+=value);t.after(()=>{if(child.exitCode===null)child.kill();});
 await new Promise((done,reject)=>{const timer=setTimeout(()=>reject(Error('Source test service startup unconfirmed '+errors)),10000);child.once('error',reject);child.once('exit',()=>reject(Error('Source test service exited '+errors)));child.once('message',message=>{if(message.ready){clearTimeout(timer);done();}});});
 const base='http://127.0.0.1:'+port,headers={Origin:'https://rancher.cormierconsulting.io','Content-Type':'application/json'};
 assert.equal((await fetch(base+'/api/sources/backup',{method:'GET',headers})).status,405);
 assert.equal((await fetch(base+'/api/sources/backup?namespace=other',{method:'POST',headers,body:'{}'})).status,400);
 assert.equal((await fetch(base+'/api/sources/backup',{method:'POST',headers:{...headers,Origin:'https://foreign.invalid'},body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/sources/backup',{method:'POST',headers:{...headers,'Content-Type':'text/plain'},body:'{}'})).status,415);
 assert.equal((await fetch(base+'/api/sources/backup',{method:'POST',headers,body:'Invalid JSON'})).status,400);
 assert.equal((await fetch(base+'/api/sources/backup',{method:'POST',headers,body:' '.repeat(65537)})).status,413);
 const anonymous=await fetch(base+'/api/sources/backup',{method:'POST',headers,body:'{}'});assert.equal(anonymous.status,403);assert.ok(!(await anonymous.text()).includes('Cookie'));
 const before=await(await fetch(base+'/api/snapshot-storage')).json();const bytes=[['credential-recovery',Buffer.from('Encrypted credential journal fixture')],['source-operations',Buffer.from('Public source operation journal fixture')]];for(const [name,value]of bytes){await mkdir(join(snapshots,name),{mode:0o700});await writeFile(join(snapshots,name,'owned-fixture.json'),value,{mode:0o600});}
 const after=await(await fetch(base+'/api/snapshot-storage')).json();assert.equal(after.usedBytes,before.usedBytes+bytes.reduce((n,[,value])=>n+value.length,0));
 child.kill();await new Promise(done=>child.once('exit',done));
});
