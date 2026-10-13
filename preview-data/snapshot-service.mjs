import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
// The same ZIP service used by the runtime runs locally; no Docker or cluster is needed.
export function localSnapshotService({pluginId,folder,port}) {
 let child;
 return {name:'rancher-suite-local-snapshot-service',async configureServer(server){
  const snapshotDirectory=process.env.RANCHER_SUITE_PREVIEW_SESSION?resolve(process.env.RANCHER_SUITE_PREVIEW_SESSION,'snapshots',pluginId):resolve(root,'.local/preview-snapshots',pluginId);
  child=spawn(process.execPath,['container/server.mjs'],{cwd:resolve(root,folder),env:{...process.env,HOST:'127.0.0.1',SNAPSHOT_PREVIEW_MOCK_DATA:'true',PORT:String(port),STATIC_DIR:resolve(root,folder,'dist-preview'),SNAPSHOT_DIR:snapshotDirectory},windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});
  let error='';child.stderr.on('data',chunk=>{error+=chunk;});
  const stop=()=>{if(child?.exitCode===null)child.kill();};
  server.httpServer?.once('close',stop);process.once('exit',stop);
  await new Promise((done,reject)=>{
   const timeout=setTimeout(()=>{stop();reject(new Error(`Snapshot service did not become ready on port ${port}.`));},10000);
   const failed=()=>{clearTimeout(timeout);reject(new Error(`Snapshot service failed on port ${port}: ${error}`));};
   child.once('error',failed);child.once('exit',failed);
   child.once('message',message=>{if(message?.ready){clearTimeout(timeout);child.removeListener('exit',failed);child.removeListener('error',failed);done();}});
  });
 }};
}
