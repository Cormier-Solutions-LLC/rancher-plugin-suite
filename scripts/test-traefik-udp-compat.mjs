import fs from 'node:fs';import assert from 'node:assert/strict';import net from 'node:net';import dgram from 'node:dgram';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const run=promisify(execFile),compose=['compose','-p','manager-udp-compat','-f','live-management/traefik-udp-fixture.yaml'],results=[];
const active={http:{routers:{web:{entryPoints:['web'],rule:'PathPrefix(`/`)',service:'web'}},services:{web:{loadBalancer:{servers:[{url:'http://fixture:8080'}]}}}},tcp:{routers:{echo:{entryPoints:['echo-tcp'],rule:'HostSNI(`*`)',service:'echo'}},services:{echo:{loadBalancer:{servers:[{address:'fixture:9001'}]}}}},udp:{routers:{echo:{entryPoints:['echo-udp'],service:'echo'}},services:{echo:{loadBalancer:{servers:[{address:'fixture:9002'}]}}}}};
fs.mkdirSync('.local/traefik-udp-fixture',{recursive:true});fs.writeFileSync('.local/traefik-udp-fixture/config.json',JSON.stringify(active));
async function phase(configuration){await run('docker',[...compose,'exec','-T','fixture','node','-e',"require('node:fs').writeFileSync('/state/config.json',process.argv[1])",JSON.stringify(configuration)]);await new Promise(r=>setTimeout(r,2000));}
async function echo(protocol,port,timeout=1200){return new Promise((resolve,reject)=>{const socket=protocol==='UDP'?dgram.createSocket('udp4'):net.createConnection({host:'127.0.0.1',port});let ended=false;const finish=error=>{if(ended)return;ended=true;clearTimeout(timer);protocol==='UDP'?socket.close():socket.destroy();error?reject(error):resolve(true);};const timer=setTimeout(()=>finish(new Error('No echo')),timeout);socket.on('error',finish);const read=data=>{try{assert.equal(String(data),'isolated-udp-deletion');finish();}catch(e){finish(e);}};if(protocol==='UDP'){socket.once('message',read);socket.send('isolated-udp-deletion',port,'127.0.0.1');}else{socket.once('data',read);socket.once('connect',()=>socket.write('isolated-udp-deletion'));socket.once('end',()=>finish(new Error('Closed')));}});}
try{
 await run('docker',[...compose,'up','-d'],{timeout:120000});
 let ready=false;for(let i=0;i<20;i++){try{await echo('UDP',25002);await echo('UDP',25006);ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}assert.ok(ready,'Isolated proxy did not initialize');
 for(const ports of [[25001,25002,25004],[25005,25006,25008]]){await echo('TCP',ports[0]);await echo('UDP',ports[1]);assert.equal((await (await fetch(`http://127.0.0.1:${ports[2]}/`)).text()).trim(),'isolated-proxy-fixture');}
 results.push({check:'Upstream and patched HTTP/TCP/UDP traffic',passed:true});
 const removed=structuredClone(active);delete removed.udp;await phase(removed);await new Promise(r=>setTimeout(r,4000));
 await echo('UDP',25002);results.push({check:'Upstream stale UDP handler reproduced after route removal',passed:true});
 for(let i=0;i<3;i++)await assert.rejects(echo('UDP',25006));
 await echo('TCP',25005);assert.equal((await (await fetch('http://127.0.0.1:25008/')).text()).trim(),'isolated-proxy-fixture');
 results.push({check:'Patched UDP deletion rejects new traffic and preserves HTTP/TCP',passed:true});
 await phase(active);for(let i=0;i<5;i++){await echo('UDP',25006);await echo('TCP',25005);}
 results.push({check:'Patched UDP route restoration restores traffic',passed:true});
 console.log('Isolated UDP compatibility regression, deletion, restoration and HTTP/TCP preservation passed.');
}finally{fs.writeFileSync('.local/manager-installation/traefik-udp-compat-tests.json',JSON.stringify(results,null,2));await run('docker',[...compose,'stop']).catch(error=>console.error(error.message));}
