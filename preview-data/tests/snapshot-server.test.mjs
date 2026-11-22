import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,statfs,readdir,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import net from 'node:net';
const root=fileURLToPath(new URL('../../',import.meta.url));
for(const [folder,config] of [['dns-manager-dev','pkg/dns-manager/snapshot-feature/config'],['simple-network-manager-dev','pkg/simple-network-manager/config']])test(`${folder}: encrypted recovery, verification, merge, mounted storage, restart and cleanup`,async()=>{
 const directory=await mkdtemp(join(tmpdir(),'suite-backups-')),snapshots=join(directory,'snapshots');
 const socket=net.createServer();await new Promise(done=>socket.listen(0,'127.0.0.1',done));const port=socket.address().port;await new Promise(done=>socket.close(done));
 const base=`http://127.0.0.1:${port}`;let server,error='';
 const preload = join(directory, 'rancher-session-fixture.mjs');
 async function start(extra={}, fixture=false) {
  const args = fixture ? ['--import', pathToFileURL(preload).href, 'container/server.mjs'] : ['container/server.mjs'];
  server=spawn(process.execPath,args,{cwd:join(root,folder),env:{...process.env,SNAPSHOT_PREVIEW_MOCK_DATA:'true',SNAPSHOT_STORAGE_LIMIT_BYTES:'',PORT:String(port),HOST:'127.0.0.1',SNAPSHOT_DIR:snapshots,STATIC_DIR:directory,...extra},stdio:['ignore','ignore','pipe','ipc']});
  error = '';
  server.stderr.on('data',chunk=>{error+=chunk;});
  await new Promise((ready,reject)=>{
   const timer=setTimeout(()=>reject(new Error('Snapshot service startup timed out. '+error)),15000);
   server.once('error',failure=>{clearTimeout(timer);reject(failure);});
   server.once('exit',()=>{clearTimeout(timer);reject(new Error('Snapshot service exited. '+error));});
   server.once('message',message=>{if(message.ready){clearTimeout(timer);ready();}});
  });
 }
 async function stop(){if(server?.exitCode===null){const ended=new Promise(done=>server.once('exit',done));server.kill();await ended;}}
 const request=(path,body,method='POST',origin=base)=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
 const password='Test-only-Strong-Password-2026';
 const manifest={apiVersion:'v1',kind:'ConfigMap',metadata:{name:'sample',namespace:'demo'},data:{setting:'old'}};
 const current={configuration:{id:'sample',name:'Sample',ports:[]},routeManifests:[manifest],snapshotScope:{label:'Demo'}};
 const secret={apiVersion:'v1',kind:'Secret',metadata:{name:'fake',namespace:'demo'},data:{token:Buffer.from('test-only-value').toString('base64')}};
 try{
  await start();const {decodeBackup}=await import(new URL(`../../${folder}/${config}/backup-zip.mjs`,import.meta.url));
  const plainReply=await request('/api/snapshots',{current,scopeKey:'plain'});assert.equal(plainReply.status,201);const plain=await plainReply.json();
  assert.equal((await request('/api/snapshots',{current,scopeKey:'bad'},'POST','http://wrong.invalid')).status,403);
  assert.equal((await request('/api/snapshots',{current:{...current,routeManifests:[secret]},scopeKey:'unprotected'})).status,400);
  const protectedReply=await request('/api/snapshots',{current:{...current,routeManifests:[manifest,secret]},scopeKey:'protected',password});assert.equal(protectedReply.status,201);const protectedSource=await protectedReply.json();
  assert.equal((await fetch(base+`/api/snapshots/${protectedSource.id}`)).status,422);
  assert.equal((await request(`/api/snapshots/${protectedSource.id}/unlock`,{password:'incorrect'})).status,422);
  const verified=await request(`/api/snapshots/${protectedSource.id}/unlock`,{password});assert.equal(verified.status,200);assert.deepEqual((await verified.json()).current.routeManifests.find(x=>x.kind==='Secret'),secret);
  const bytes=await readFile(join(snapshots,`${protectedSource.id}.zip`));assert.equal(bytes.includes(Buffer.from(secret.data.token)),false);await assert.rejects(decodeBackup(bytes));await assert.rejects(decodeBackup(bytes,'wrong'));assert.equal((await decodeBackup(bytes,password)).id,protectedSource.id);
  const metadata=await readFile(join(snapshots,`${protectedSource.id}.meta.json`),'utf8');assert.equal(metadata.includes(secret.data.token),false);assert.equal(metadata.includes(password),false);
  assert.equal((await fetch(base+`/api/snapshots/${protectedSource.id}/manifests.yaml`)).status,404);
  const protectedConfigReply=await request('/api/snapshots',{current,scopeKey:'protected-config-without-secret-values',password});assert.equal(protectedConfigReply.status,201);const protectedConfig=await protectedConfigReply.json();
  const configurationMerge={ids:[protectedConfig.id,plain.id],priorityOrder:[protectedConfig.id,plain.id],passwords:{[protectedConfig.id]:password}};
  assert.equal((await request('/api/snapshots/merge',configurationMerge)).status,400,'Merging protected configuration must not silently create a plaintext backup');
  assert.equal((await request('/api/snapshots/merge',{...configurationMerge,password:'weak'})).status,400);
  const configMergeReply=await request('/api/snapshots/merge',{...configurationMerge,password});assert.equal(configMergeReply.status,201);const configMerge=await configMergeReply.json();assert.equal((await fetch(base+`/api/snapshots/${configMerge.id}`)).status,422);assert.equal((await request(`/api/snapshots/${configMerge.id}/unlock`,{password})).status,200);
  const ids=[protectedSource.id,plain.id],passwords={[protectedSource.id]:password};
  assert.equal((await request('/api/snapshots/merge',{ids,priorityOrder:ids})).status,422);
  const mergedReply=await request('/api/snapshots/merge',{ids,priorityOrder:ids,passwords,password});assert.equal(mergedReply.status,201);const merged=await mergedReply.json();assert.deepEqual(merged.current.mergedFrom.sort(),ids.sort());
  assert.equal((await request('/api/snapshots/delete',{ids,backupId:merged.id,merged:true,passwords,backupPassword:password})).status,200);
  assert.equal((await fetch(base+`/api/snapshots/${plain.id}`)).status,404);
  const schedule={enabled:true,interval:1,unit:'days',current};assert.equal((await request('/api/snapshot-schedule',schedule,'PUT')).status,200);
  const runReply=await request('/api/snapshot-schedule/run',{current:{...current,routeManifests:[secret]},password});assert.equal(runReply.status,201);
  const persistedSchedule=await readFile(join(snapshots,'schedule.json'),'utf8');assert.equal(persistedSchedule.includes(password),false);assert.equal(persistedSchedule.includes(secret.data.token),false);
  await stop();await start();assert.equal((await (await fetch(base+'/api/snapshot-schedule')).json()).enabled,true);
  const storage=await (await fetch(base+'/api/snapshot-storage')).json(),space=await statfs(await realpath(snapshots));assert.equal(storage.totalBytes,Math.min(space.blocks*space.bsize,1073741824));assert.equal(storage.mockCapacity,true);assert.ok(storage.availableBytes<=space.bavail*space.bsize+1024*1024);
  assert.ok(storage.largestSnapshotBytes>=bytes.byteLength);assert.ok((await readdir(snapshots)).every(name=>!name.endsWith('.tmp')));
  assert.equal((await request('/api/snapshot-cleanup',{enabled:false,interval:1,unit:'days',retention:30,retentionUnit:'days'},'PUT')).status,200);assert.equal((await request('/api/snapshot-cleanup/run',{})).status,200);
  // Protected schedules persist credentials separately and encrypt their source.
  const protectedSchedule={...schedule,includeSecrets:true,password,current:{...current,routeManifests:[manifest,secret]}};
  assert.equal((await request('/api/snapshot-schedule',{...protectedSchedule,password:'weak'},'PUT')).status,400);
  const savedReply=await request('/api/snapshot-schedule',protectedSchedule,'PUT');assert.equal(savedReply.status,200);const saved=await savedReply.json();assert.equal(saved.hasPassword,true);assert.equal(saved.passwordSecret,undefined);assert.equal(saved.sourceArchive,undefined);
  let state=JSON.parse(await readFile(join(snapshots,'schedule.json'),'utf8'));assert.equal(JSON.stringify(state).includes(password),false);assert.equal(JSON.stringify(state).includes(secret.data.token),false);
  assert.equal((await readFile(join(snapshots,state.sourceArchive))).includes(Buffer.from(secret.data.token)),false);
  await stop();state.nextRun=new Date(Date.now()-1000).toISOString();await writeFile(join(snapshots,'schedule.json'),JSON.stringify(state));await start();
  let automatic;for(let i=0;i<100;i++){automatic=(await (await fetch(base+'/api/snapshots')).json()).snapshots.find(record=>record.generation==='Automatic');if(automatic)break;await new Promise(done=>setTimeout(done,50));}assert.ok(automatic,'protected automatic snapshot runs after restart');assert.equal(automatic.encrypted,true);
  assert.equal((await fetch(base+`/api/snapshots/${automatic.id}`)).status,422,'scheduled credentials must not unlock an archive for a caller without its password');
  assert.equal((await request(`/api/snapshots/${automatic.id}/unlock`,{password:''})).status,422,'empty unlock must not fall back to the schedule vault');
  assert.deepEqual((await (await request(`/api/snapshots/${automatic.id}/unlock`,{password})).json()).current.routeManifests.find(r=>r.kind==='Secret'),secret);
  assert.equal((await request(`/api/snapshots/${automatic.id}/unlock`,{password:'wrong'})).status,422);
  assert.equal((await request('/api/snapshot-schedule',{...protectedSchedule,password:'Rotated-test-only-Password2026!'},'PUT')).status,200);
  await stop();await start();assert.equal((await fetch(base+`/api/snapshots/${automatic.id}`)).status,422);assert.equal((await request(`/api/snapshots/${automatic.id}/unlock`,{password})).status,200,'old archive remains recoverable with its original password after rotation');
  assert.equal((await request('/api/snapshot-schedule',{...schedule,includeSecrets:false},'PUT')).status,200);assert.equal((await (await fetch(base+'/api/snapshot-schedule')).json()).hasPassword,false);assert.equal((await fetch(base+`/api/snapshots/${automatic.id}`)).status,422);assert.equal((await request(`/api/snapshots/${automatic.id}/unlock`,{password})).status,200,'disabling secret inclusion preserves password-protected recovery');
  let catalogId;
  if (folder === 'dns-manager-dev') {
    const catalog = {id: 'sources/catalog', kind: 'DnsSourceCatalog', name: 'Test catalog', namespace: 'dns-system'};
    const saved = await request('/api/snapshots', {current: {...current, relatedConfigurations: [catalog]}, scopeKey: 'older-merge'});
    assert.equal(saved.status, 201);
    const {id} = await saved.json();
    catalogId = id;
    const indexPath = join(snapshots, id + '.meta.json');
    const index = JSON.parse(await readFile(indexPath, 'utf8'));
    assert.equal(index.restrictedSourceCatalog, true);
    delete index.restrictedSourceCatalog;
    await writeFile(indexPath, JSON.stringify(index));
    const history = await (await fetch(base + '/api/snapshots')).json();
    assert.ok(!history.snapshots.some(record => record.id === id));
    assert.equal((await fetch(base + '/api/snapshots/' + id)).status, 404);
    assert.equal((await fetch(base + '/api/snapshots/' + id + '/backup.zip')).status, 404);
    assert.equal((await request('/api/snapshots/' + id + '/unlock', {})).status, 404);
    assert.equal((await request('/api/snapshots/merge', {ids: [id, automatic.id], authorityId: id})).status, 404);
  }
  await stop();
  // Stub Rancher transport in the installed service process. No live upstream is used.
  await writeFile(preload, `
    import https from 'node:https';
    import {EventEmitter} from 'node:events';
    https.request = (options, callback) => {
      const request = new EventEmitter();
      request.end = body => {
        const response = new EventEmitter();
        const fixture = options.headers.Cookie?.match(/^R_SESS=(catalog|reader); CSRF=fixture$/)?.[1];
        let result = {};
        response.statusCode = fixture ? 201 : 403;
        if (fixture && options.path.endsWith('/selfsubjectreviews')) {
          result = {apiVersion: 'authentication.k8s.io/v1', kind: 'SelfSubjectReview', status: {userInfo: {username: 'user-test'}}};
        }
        if (fixture && options.path.endsWith('/selfsubjectaccessreviews')) {
          const {name} = JSON.parse(body).spec.resourceAttributes;
          result = {status: {allowed: name !== 'dns-manager-sources' || fixture === 'catalog'}};
        }
        callback(response);
        queueMicrotask(() => {
          response.emit('data', JSON.stringify(result));
          response.emit('end');
        });
      };
      return request;
    };
  `);
  const previousSchedule = JSON.parse(await readFile(join(snapshots, 'schedule.json'), 'utf8'));
  const priorArchives = (await readdir(snapshots)).filter(name => name.endsWith('.zip'));
  await writeFile(join(snapshots, 'schedule.json'), JSON.stringify({
    ...previousSchedule, enabled: true, approvedBy: 'user-test', includeSecrets: true,
    nextRun: new Date(Date.now() - 1000).toISOString()
  }));
  const manager = folder === 'dns-manager-dev' ? 'DNS' : 'NETWORK';
  await start({
    SNAPSHOT_PREVIEW_MOCK_DATA: 'false',
    SNAPSHOT_ALLOWED_ORIGIN: 'https://rancher.cormierconsulting.io',
    [`SNAPSHOT_${manager}_STATE_CONFIGMAP`]: manager.toLowerCase() + '-manager-state-user-test',
    [`SNAPSHOT_FRESH_${manager}`]: 'true'
  }, true);
  const rancherRead = (path, session) => fetch(base + path, {headers: {Cookie: 'R_SESS=' + session + '; CSRF=fixture'}});
  const restarted = await rancherRead('/api/snapshot-schedule', 'reader');
  assert.equal(restarted.status, 200);
  const paused = await restarted.json();
  assert.equal(paused.enabled, false);
  assert.equal(paused.nextRun, null);
  assert.match(paused.lastError, /current Rancher session/);
  assert.deepEqual((await readdir(snapshots)).filter(name => name.endsWith('.zip')), priorArchives);
  if (catalogId) {
    const listed = async session => (await (await rancherRead('/api/snapshots', session)).json()).snapshots;
    assert.ok((await listed('catalog')).some(record => record.id === catalogId));
    assert.ok(!(await listed('reader')).some(record => record.id === catalogId));
    assert.equal((await rancherRead('/api/snapshots/' + catalogId + '/backup.zip', 'catalog')).status, 200);
    assert.equal((await rancherRead('/api/snapshots/' + catalogId + '/backup.zip', 'reader')).status, 404);
  }
  assert.equal((await fetch(base+'/healthz')).status,200);
  for (const path of ['/api/snapshots','/api/snapshot-storage','/api/snapshot-schedule','/api/snapshot-cleanup'])
    assert.equal((await fetch(base+path)).status,403);
  assert.equal((await request('/api/snapshot-schedule',protectedSchedule,'PUT')).status,403);
 }finally{await stop();await rm(directory,{recursive:true,force:true});}
});
