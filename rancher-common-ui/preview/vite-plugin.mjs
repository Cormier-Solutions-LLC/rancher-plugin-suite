import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
// Serves the independent release artifact. Vite does not bundle common UI into a manager.
export function commonUIAssets() {
  const root=fileURLToPath(new URL('../',import.meta.url));
  return {name:'common-ui-assets',configureServer(server){server.middlewares.use('/common-ui',async(req,res,next)=>{
    const name=req.url.split('?')[0].replace(/^\//,'');
    const manifest=JSON.parse(await readFile(root+'package.json','utf8'));
    if(![`rancher-common-ui-${manifest.version}.umd.min.js`,'files.txt','package.json'].includes(name))return next();
    const folder=`${root}dist/${manifest.version}/`;
    try{res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':'text/plain');res.setHeader('Cache-Control','no-cache');res.end(await readFile(folder+name));}
    catch{res.statusCode=503;res.end('Build rancher-common-ui before starting the managers.');}
  });}};
}
