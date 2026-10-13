// Existing API-key read acceptance; no accounts, keys, or playback state are changed.
import fs from 'node:fs';import https from 'node:https';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const root='.local/manager-installation',privateDir=root+'/emby-auth-inspection',candidates=JSON.parse(fs.readFileSync(privateDir+'/active-tokens-private.json'));
const staticKeys=candidates.filter(t=>!t.hasUser);assert.equal(staticKeys.length,1,'Inspect existing API keys before selecting a credential.');let token=staticKeys[0].token;assert.ok(token);
const host='emby.cormierconsulting.io',results=[];
function call(path,{auth=true,key=token,headers={},limit=1024*1024}={}){return new Promise((resolve,reject)=>{const req=https.request({hostname:'10.99.15.50',servername:host,path,method:'GET',rejectUnauthorized:true,timeout:20000,headers:{Host:host,...(auth?{'X-Emby-Token':key}:{}),...headers}},r=>{const chunks=[];let bytes=0;r.on('data',d=>{bytes+=d.length;if(bytes>limit){req.destroy(new Error('Response exceeded bounded acceptance size.'));return;}chunks.push(d);});r.on('error',reject);r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,body:Buffer.concat(chunks)}));});req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('Emby acceptance request timed out.')));req.end();});}
async function json(path,options){const r=await call(path,options);assert.equal(r.status,200,'Emby read failed: '+path.split('?')[0]);return JSON.parse(r.body);}
try{
 const info=await json('/emby/System/Info');assert.equal(info.Version,'4.9.3.0');results.push({check:'Existing API key authenticates through strict HTTPS',passed:true,version:info.Version});
 for(const mode of [{auth:false},{key:'manager-invalid-api-key'}]){const r=await call('/emby/System/Info',mode);assert.equal(r.status,401);}results.push({check:'Anonymous and invalid API keys rejected',passed:true});
 const users=await json('/emby/Users'),admin=users.find(u=>u.Policy?.IsAdministrator&&!u.Policy?.IsDisabled);assert.ok(admin);
 const libraries=await json('/emby/Library/VirtualFolders');assert.ok(libraries.length);results.push({check:'Existing administrator and configured libraries readable',passed:true,users:users.length,libraries:libraries.length,libraryLocations:libraries.reduce((n,l)=>n+(l.Locations?.length||0),0)});
 const privateEvidence=[];
 for(const library of libraries){
  assert.ok(library.ItemId);const query=new URLSearchParams({ParentId:library.ItemId,Recursive:'true',IncludeItemTypes:'Movie,Episode',Limit:'1',Fields:'MediaSources,MediaStreams,Path',EnableUserData:'false'});
  const response=await json('/emby/Users/'+encodeURIComponent(admin.Id)+'/Items?'+query);assert.ok(response.TotalRecordCount>0);assert.equal(response.Items.length,1);
  const item=response.Items[0],source=item.MediaSources?.find(s=>s.Path&&s.Protocol==='File')||item.MediaSources?.[0];assert.ok(source?.Id);assert.ok(item.Id);
  const streamPath='/emby/Videos/'+encodeURIComponent(item.Id)+'/stream?'+new URLSearchParams({Static:'true',MediaSourceId:source.Id});
  const media=await call(streamPath,{headers:{Range:'bytes=0-4095'},limit:8192});assert.equal(media.status,206);assert.equal(media.body.length,4096);assert.match(media.headers['content-range'],/^bytes 0-4095\/\d+$/);
  const denied=await call(streamPath,{key:'manager-invalid-api-key',headers:{Range:'bytes=0-4095'},limit:8192});assert.equal(denied.status,401);
  results.push({check:'Library metadata and authenticated media range',passed:true,kind:library.CollectionType||'mixed',items:response.TotalRecordCount,rangeBytes:media.body.length,contentRange:media.headers['content-range'],sha256:createHash('sha256').update(media.body).digest('hex'),invalidKeyRejected:true});
  privateEvidence.push({library,item,source,streamPath});
 }
 fs.writeFileSync(privateDir+'/media-evidence-private.json',JSON.stringify(privateEvidence,null,2),{mode:0o600});
 const report={observedAt:new Date().toISOString(),strictTls:true,existingApiKeyUsed:true,newCredentialCreated:false,watchStateChanged:false,playbackOrTranscodingReported:false,results,passed:true};fs.writeFileSync(root+'/emby-route-media-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{token=undefined;for(const candidate of candidates)delete candidate.token;}
