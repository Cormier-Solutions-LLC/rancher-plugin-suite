// Optional private local backup service. It captures sample configuration only.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const child=spawn(process.execPath,[resolve(root,'container/server.mjs')],{
  cwd:root,stdio:'inherit',windowsHide:true,
  env:{...process.env,HOST:'127.0.0.1',PORT:'5184',SNAPSHOT_DIR:resolve(root,'../.local/dns-preview/snapshots'),SNAPSHOT_STORAGE_LIMIT_BYTES:process.env.SNAPSHOT_STORAGE_LIMIT_BYTES||String(256*1024*1024),STATIC_DIR:resolve(root,'dist-preview')}
});
console.log('Optional sample-backup API: http://127.0.0.1:5184 (256 MiB quota unless overridden). Ctrl+C stops it.');
child.on('error',error=>{console.error(error.message);process.exitCode=1});
child.on('exit',code=>process.exitCode=code||0);
process.on('SIGINT',()=>child.kill());process.on('SIGTERM',()=>child.kill());
