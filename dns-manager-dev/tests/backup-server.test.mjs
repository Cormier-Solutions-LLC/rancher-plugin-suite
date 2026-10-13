import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, stat, rm, mkdir, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import net from 'node:net';
import { decodeBackup } from '../pkg/dns-manager/snapshot-feature/config/backup-zip.mjs';
const root=resolve(import.meta.dirname,'../..'), owned=resolve(root,'.local');
test('backup server persists ZIP, merges items, enforces quota, and unlocks encrypted files', async () => {
  const directory=await mkdtemp(resolve(owned,'dns-backup-test-'));
  let child;
  const port=await new Promise(done=>{const socket=net.createServer();socket.listen(0,'127.0.0.1',()=>{const port=socket.address().port;socket.close(()=>done(port));});});
  const origin=`http://127.0.0.1:${port}`;
  async function start(quota=1048576) {
    child=spawn(process.execPath,[resolve(root,'dns-manager-dev/container/server.mjs')],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,HOST:'127.0.0.1',PORT:String(port),SNAPSHOT_DIR:directory,SNAPSHOT_STORAGE_LIMIT_BYTES:String(quota)}});
    for(let i=0;i<100;i++){try{if((await fetch(origin+'/healthz')).ok)return;}catch{}await new Promise(done=>setTimeout(done,25));}
    throw new Error('Isolated backup test service did not start.');
  }
  async function stop(){if(child && child.exitCode===null){const stopped=new Promise(done=>child.once('exit',done));child.kill();await stopped;}}
  async function api(path,body){const response=await fetch(origin+'/api/'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
  const current={configuration:{id:'source/test',name:'Test Source',kind:'DnsSource',dns:{host:'fixture.invalid'}},relatedConfigurations:[{id:'zone/test',name:'fixture.invalid',kind:'DnsZone',namespace:'dns-system',dns:{sourceId:'source/test',records:[]}}],routeManifests:[],snapshotScope:{label:'Fixture Configuration'}};
  try{
    await start();
    const recoveryId='00000000-0000-4000-8000-000000000001';
    assert.equal((await api(`credential-recovery/${recoveryId}/status`)).status,405);
    assert.equal((await api(`credential-recovery/${recoveryId}/status`,{})).status,403);
    assert.equal((await api('credential-recovery/prepare',{id:recoveryId,snapshotId:recoveryId,names:['dns-manager-engine-admin'],password:'Synthetic-backup-2026!42'})).status,403);
    assert.equal((await api(`credential-recovery/${recoveryId}/status`,{host:'foreign.invalid'})).status,400);
    assert.ok(!(await readdir(directory)).includes('credential-recovery'));
    const first=await api('snapshots',{current,scopeKey:'fixture'});assert.equal(first.status,201);
    const zip=await fetch(`${origin}/api/snapshots/${first.data.id}/backup.zip`);assert.equal(zip.headers.get('content-type'),'application/zip');
    const bytes=new Uint8Array(await zip.arrayBuffer());assert.deepEqual((await decodeBackup(bytes)).current.configuration,current.configuration);
    await stop();await start();assert.equal((await api('snapshots')).data.snapshots.length,1);
    const second=await api('snapshots',{current:{...current,configuration:{...current.configuration,name:'Updated Source'}},scopeKey:'fixture'});
    const merged=await api('snapshots/merge',{ids:[second.data.id,first.data.id],priorityOrder:[second.data.id,first.data.id],selectedIds:['configuration/source/test','configuration/zone/test']});
    assert.equal(merged.status,201);assert.equal(merged.data.current.configuration.name,'Updated Source');
    const password='Only a test backup passphrase!';
    const secret={apiVersion:'v1',kind:'Secret',metadata:{name:'fixture',namespace:'dns-system'},stringData:{key:'fixture-sensitive-value'}};
    const rejected=await api('snapshots',{current:{...current,routeManifests:[secret]},scopeKey:'fixture'});assert.equal(rejected.status,400);
    const protectedFile=await api('snapshots',{current:{...current,routeManifests:[secret]},scopeKey:'fixture',password});assert.equal(protectedFile.status,201);
    assert.equal((await api('snapshots/'+protectedFile.data.id)).status,422);
    assert.equal((await api('snapshots/'+protectedFile.data.id+'/unlock',{password:'incorrect'})).status,422);
    assert.equal((await api('snapshots/'+protectedFile.data.id+'/unlock',{password})).data.current.routeManifests[0].stringData.key,secret.stringData.key);
    for(const name of await readdir(directory)){const stored=await readFile(resolve(directory,name));assert.ok(!stored.includes(Buffer.from(secret.stringData.key)),name+' disclosed a Secret');}
    const storage=(await api('snapshot-storage')).data;assert.ok(storage.availableBytes<=1048576);if(storage.totalBytes!==undefined)assert.ok(storage.totalBytes<=1048576);assert.ok(storage.largestSnapshotBytes>0);
    await mkdir(resolve(directory,'credential-recovery'));await writeFile(resolve(directory,'credential-recovery','fixture-journal.json'),Buffer.alloc(8192));
    assert.equal((await api('snapshot-storage')).data.usedBytes,storage.usedBytes+8192);
    const count=(await api('snapshots')).data.snapshots.length;
    const used=(await Promise.all((await readdir(directory)).map(name=>stat(resolve(directory,name))))).reduce((sum,file)=>sum+file.size,0);
    await stop();await start(used+100);
    const full=await api('snapshots',{current,scopeKey:'fixture'});assert.equal(full.status,507);assert.equal((await api('snapshots')).data.snapshots.length,count);
  }finally{
    await stop();
    if(!directory.startsWith(owned+sep+'dns-backup-test-'))throw new Error('Unsafe test cleanup target.');
    await rm(directory,{recursive:true,force:true});
  }
});
