import { spawn } from 'node:child_process';
import { access, mkdir, open, readFile, readdir, stat, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../rancher-common-ui/',import.meta.url));
async function run(args){await new Promise((done,reject)=>{const child=spawn(process.execPath,args,{cwd:root,stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',code=>code?reject(new Error(`Common UI setup failed (${code}).`)):done());});}
try{await access(new URL('../rancher-common-ui/node_modules/@vue/compiler-sfc/package.json',import.meta.url));}catch{await run([process.env.npm_execpath,'ci','--ignore-scripts']);}
await mkdir(resolve(root,'.generated'),{recursive:true});
const lockPath=resolve(root,'.generated/preview-build.lock');
let lock; const deadline=Date.now()+60000;
while(!lock){try{lock=await open(lockPath,'wx');await lock.writeFile(String(process.pid));}catch(error){
  if(error.code!=='EEXIST')throw error;
  try{const pid=Number(await readFile(lockPath,'utf8'));if(pid){try{process.kill(pid,0);}catch(cause){if(cause.code==='ESRCH'){await unlink(lockPath);continue;}}}}catch{}
  if(Date.now()>deadline)throw new Error('Common UI preview build is busy. Retry after the running build finishes.');
  await new Promise(done=>setTimeout(done,200));
}}
async function newest(folder){const times=await Promise.all((await readdir(folder,{withFileTypes:true})).map(async entry=>entry.isDirectory()?newest(resolve(folder,entry.name)):(await stat(resolve(folder,entry.name))).mtimeMs));return Math.max(0,...times);}
try{
  const manifest=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
  let built=0;try{built=(await stat(resolve(root,`dist/${manifest.version}/plugin/rancher-common-ui-${manifest.version}.umd.min.js`))).mtimeMs;}catch{}
  const changed=Math.max(await newest(resolve(root,'src')),await newest(resolve(root,'scripts')),(await stat(resolve(root,'package.json'))).mtimeMs);
  if(built<changed)await run(['scripts/build.mjs']);
}finally{await lock.close();await unlink(lockPath);}
