import fs from 'node:fs';import path from 'node:path';import {gunzipSync} from 'node:zlib';
const root=path.resolve(import.meta.dirname,'..'),directory=path.join(root,'.local/manager-installation/published');
const cm=JSON.parse(fs.readFileSync(path.join(root,'.local/manager-installation/initial-published-assets.json'),'utf8'));
for(const [name,data] of Object.entries(JSON.parse(cm.data['files.json']))){const file=path.join(directory,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,gunzipSync(Buffer.from(data,'base64')));}
console.log('Recovered the initially published assets without changing their versions.');
