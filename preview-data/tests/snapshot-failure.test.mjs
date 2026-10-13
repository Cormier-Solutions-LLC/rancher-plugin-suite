import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {randomBytes} from 'node:crypto';import {mkdtemp,writeFile,readFile,rm,readdir,stat} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import net from 'node:net';
const root=fileURLToPath(new URL('../../',import.meta.url));
for(const folder of ['dns-manager-dev','simple-network-manager-dev'])test(folder+': exhausted quota and interrupted metadata commit preserve usable backups without partial files',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'manager-storage-failure-')),snapshots=join(directory,'snapshots'),marker=join(directory,'fail-metadata'),preload=join(directory,'failure-hook.mjs');
 // Inject a real rename failure into the child, keeping production code free of test hooks.
 await writeFile(preload,`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const rename=fs.promises.rename;fs.promises.rename=async(from,to)=>{if(to.endsWith('.meta.json')&&fs.existsSync(${JSON.stringify(marker)}))throw Object.assign(new Error('Injected metadata commit failure'),{code:'EIO'});return rename(from,to);};syncBuiltinESMExports();`);
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const server=spawn(process.execPath,['--import',pathToFileURL(preload).href,'container/server.mjs'],{cwd:join(root,folder),env:{...process.env,SNAPSHOT_DIR:snapshots,STATIC_DIR:directory,HOST:'127.0.0.1',PORT:String(port),SNAPSHOT_STORAGE_LIMIT_BYTES:'8192',SNAPSHOT_PREVIEW_MOCK_DATA:'true',SNAPSHOT_FRESH_DNS:'false'},stdio:'pipe'});let errors='';server.stderr.on('data',b=>errors+=b);
 const base='http://127.0.0.1:'+port,current={configuration:{id:'failure-acceptance',name:'Failure acceptance',ports:[]},routeManifests:[],snapshotScope:{label:'Isolated failure test'}};
 const post=c=>fetch(base+'/api/snapshots',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({current:c,scopeKey:'failure-acceptance'})});
 try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/healthz')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,25));}assert.ok(ready,errors);
  const first=await post(current);assert.equal(first.status,201);const saved=await first.json(),original=await readFile(join(snapshots,saved.id+'.zip'));
  const before=await readdir(snapshots);await writeFile(marker,'fail');assert.equal((await post(current)).status,500);await rm(marker);
  assert.deepEqual((await readdir(snapshots)).sort(),before.sort(),'Metadata commit failure left an archive or temporary file.');assert.deepEqual(await readFile(join(snapshots,saved.id+'.zip')),original);
  assert.equal((await post({...current,configuration:{...current.configuration,description:randomBytes(100000).toString('base64')}})).status,507);assert.deepEqual((await readdir(snapshots)).sort(),before.sort());
  const responses=await Promise.all(Array.from({length:12},()=>post({...current,configuration:{...current.configuration,description:randomBytes(250).toString('base64')}})));assert.ok(responses.some(r=>r.status===507));assert.ok(responses.every(r=>[201,507].includes(r.status)));
  const files=await readdir(snapshots);assert.ok(files.every(f=>!f.endsWith('.tmp')));for(const f of files.filter(f=>f.endsWith('.zip')))assert.ok(files.includes(f.replace(/\.zip$/,'.meta.json')));
  const bytes=(await Promise.all(files.map(f=>stat(join(snapshots,f))))).reduce((n,s)=>n+s.size,0);assert.ok(bytes<=8192,'Concurrent writes exceeded the configured quota.');assert.equal((await fetch(base+'/api/snapshots/'+saved.id)).status,200);
 }finally{if(server.exitCode===null){const done=new Promise(r=>server.once('exit',r));server.kill();await done;}await rm(directory,{recursive:true,force:true});}
});
