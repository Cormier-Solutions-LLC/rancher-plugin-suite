import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const root=fileURLToPath(new URL(`../dist/${manifest.version}/`,import.meta.url));
const names=new Set([`rancher-common-ui-${manifest.version}.umd.min.js`,'files.txt','package.json']);
createServer(async(req,res)=>{const name=new URL(req.url,'http://localhost').pathname.split('/').pop();if(!names.has(name)){res.writeHead(404).end();return}try{const data=await readFile(root+name);res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':'text/plain','Cache-Control':'no-cache','Access-Control-Allow-Origin':'*'}).end(data)}catch{res.writeHead(503).end('Build the common UI plugin first.')}}).listen(5177,'127.0.0.1',()=>console.log('Common UI independent assets: http://127.0.0.1:5177/'));
