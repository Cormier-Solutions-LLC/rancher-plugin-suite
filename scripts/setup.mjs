import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const folder of ['rancher-common-ui','simple-network-manager-dev','dns-manager-dev']){
 console.log(`Installing locked dependencies: ${folder}`);
 const code=await new Promise((done,reject)=>{const child=spawn(process.execPath,[process.env.npm_execpath,'ci'],{cwd:resolve(root,folder),stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',done);});
 if(code){process.exitCode=code;break;}
}
