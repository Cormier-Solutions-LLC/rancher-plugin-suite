const http=require('node:http'),net=require('node:net'),dgram=require('node:dgram'),fs=require('node:fs');
http.createServer((req,res)=>{if(req.url==='/configuration'){res.setHeader('Content-Type','application/json');res.end(fs.readFileSync('/state/config.json'));}else res.end('isolated-proxy-fixture\n');}).listen(8080,'0.0.0.0');
net.createServer(socket=>socket.pipe(socket)).listen(9001,'0.0.0.0');
const udp=dgram.createSocket('udp4');udp.on('message',(data,remote)=>udp.send(data,remote.port,remote.address));udp.bind(9002,'0.0.0.0');
