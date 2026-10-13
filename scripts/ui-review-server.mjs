import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createReviewStore } from './ui-review-store.mjs';

export function createUiReviewServer({directory,report,stateFile=resolve(directory,'decisions.json')}) {
  const store=createReviewStore(report,stateFile);
  const files=new Map([['/','report.html'],['/report.html','report.html'],['/report.md','report.md']]);
  for(const name of new Set(report.sections.flatMap(s=>s.images))) files.set('/evidence/'+name+'.png','evidence/'+name+'.png');
  return createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
    try {
      const url=new URL(req.url,'http://127.0.0.1');
      if(url.pathname==='/api/review') {
        if(req.method==='GET') {send(200,await store.read());return;}
        if(req.method!=='PUT'){send(405,{error:'Use GET or PUT.'});return;}
        if(req.headers.origin && req.headers.origin !== 'http://'+req.headers.host) {send(403,{error:'Review saves must originate from this local report.'});return;}
        if(req.headers['content-type']!=='application/json'){send(415,{error:'Review saves require JSON.'});return;}
        let size=0, chunks=[];
        for await (const chunk of req){size+=chunk.length;if(size>512000){send(413,{error:'Review is too large.'});return;}chunks.push(chunk);}
        let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{send(400,{error:'Invalid JSON.'});return;}
        const value=await store.save(input);send(200,value);
        if(value.completed) console.log('UI choices completed and saved: '+stateFile+' — ready for shared UI implementation.');
        return;
      }
      if(req.method!=='GET'){send(405,{error:'Read-only report resource.'});return;}
      const file=files.get(url.pathname);if(!file){send(404,{error:'Not found.'});return;}
      const body=await readFile(resolve(directory,file));
      res.writeHead(200,{'Content-Type':file.endsWith('.png')?'image/png':file.endsWith('.md')?'text/markdown; charset=utf-8':'text/html; charset=utf-8'});res.end(body);
    }catch(error){console.error('UI review error: '+error.message);send(error.status||500,{error:error.status?error.message:'Review could not be read or saved. Your choices are still visible; export a copy and check the review server.'});}
  });
}
