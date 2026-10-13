import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {once} from 'node:events';
const require=createRequire(new URL('../simple-network-manager-dev/package.json',import.meta.url)),WebSocket=require('ws'),results=[];
const options={lookup:(_host,_options,cb)=>cb(null,[{address:'10.99.15.50',family:4}]),rejectUnauthorized:true,handshakeTimeout:10000};
for(let session=0;session<4;session++){
 const socket=new WebSocket('wss://manager-acceptance.cormierconsulting.io/websocket',options);let timer;
 try{
  const timeout=new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error('WebSocket acceptance timeout')),15000));
  await Promise.race([once(socket,'open'),timeout]);assert.equal(socket._socket.authorized,true,'TLS certificate was not verified.');
  for(let i=0;i<8;i++){const payload=`manager-wss-${session}-${i}`,reply=once(socket,'message');socket.send(payload);assert.equal((await Promise.race([reply,timeout]))[0].toString(),payload);}
  const pong=once(socket,'pong');socket.ping('manager-ping');assert.equal((await Promise.race([pong,timeout]))[0].toString(),'manager-ping');
  const closed=once(socket,'close');socket.close(1000,'acceptance complete');assert.equal((await Promise.race([closed,timeout]))[0],1000);
  results.push({check:'Verified WSS upgrade, eight text round trips, ping/pong and clean close',session,passed:true});
 }finally{clearTimeout(timer);if(socket.readyState!==WebSocket.CLOSED)socket.terminate();}
}
fs.writeFileSync('.local/manager-installation/websocket-live-tests.json',JSON.stringify(results,null,2));console.log('Four verified WSS sessions, 32 message round trips, ping/pong and clean closure passed.');
