// Bounded HLS acceptance with its own DeviceId and exact encoding cleanup.
import fs from 'node:fs';import https from 'node:https';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const run=promisify(execFile),kubectl='C:/Program Files/Docker/Docker/resources/bin/kubectl.exe',root='.local/manager-installation',dir=root+'/emby-auth-inspection',host='emby.cormierconsulting.io';
const keys=JSON.parse(fs.readFileSync(dir+'/active-tokens-private.json')).filter(t=>!t.hasUser);assert.equal(keys.length,1);let token=keys[0].token;
const evidence=JSON.parse(fs.readFileSync(dir+'/media-evidence-private.json'))[0],deviceId='manager-hls-acceptance-'+randomUUID(),playSessionId=randomUUID().replaceAll('-','');
const ledgerPath=root+'/emby-hls-owned.json';if(fs.existsSync(ledgerPath))assert.ok(JSON.parse(fs.readFileSync(ledgerPath)).cleanedAt,'Reconcile the previous owned Emby session before a new test.');
const ledger={createdAt:new Date().toISOString(),deviceId,playSessionId,encodingStopAttempted:false},save=()=>fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2));save();
function call(path,method='GET',limit=2*1024*1024){return new Promise((resolve,reject)=>{const req=https.request({hostname:'10.99.15.50',servername:host,path,method,rejectUnauthorized:true,timeout:25000,headers:{Host:host,'X-Emby-Token':token}},r=>{const parts=[];let bytes=0;r.on('data',d=>{bytes+=d.length;if(bytes>limit){req.destroy(new Error('Bounded HLS response size exceeded'));return;}parts.push(d);});r.on('error',reject);r.on('end',()=>resolve({status:r.statusCode,body:Buffer.concat(parts)}));});req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('HLS request timed out')));req.end();});}
function internalLink(link,base){const u=new URL(link,base);assert.equal(u.hostname,host);assert.equal(u.protocol,'https:');assert.ok(u.pathname.startsWith('/emby/'));u.searchParams.delete('api_key');return u.pathname+u.search;}
const processes=async()=>{const {stdout}=await run(kubectl,['-n','emby','exec','emby-0','--','ps','-eo','pid,comm']);return stdout.split('\n').filter(l=>/\bffmpeg\b/.test(l)).map(l=>Number(l.trim().split(/\s+/)[0]));};
let error,report,startingProcesses=[];
try{
 startingProcesses=await processes();
 const users=JSON.parse((await call('/emby/Users')).body),admin=users.find(u=>u.Policy?.IsAdministrator&&!u.Policy?.IsDisabled);assert.ok(admin);
 const userDataPath='/emby/Users/'+encodeURIComponent(admin.Id)+'/Items/'+encodeURIComponent(evidence.item.Id);
 const before=JSON.parse((await call(userDataPath)).body).UserData;
 const query=new URLSearchParams({MediaSourceId:evidence.source.Id,DeviceId:deviceId,PlaySessionId:playSessionId,Container:'ts',VideoCodec:'h264',AudioCodec:'aac',VideoBitrate:'400000',AudioBitrate:'64000',MaxAudioChannels:'2',MaxWidth:'640',MaxHeight:'360',EnableAutoStreamCopy:'false',AllowVideoStreamCopy:'false',AllowAudioStreamCopy:'false',SegmentLength:'3',MinSegments:'1'});
 const masterPath='/emby/Videos/'+encodeURIComponent(evidence.item.Id)+'/master.m3u8?'+query,master=await call(masterPath);assert.equal(master.status,200);assert.match(master.body.toString(),/^#EXTM3U/);
 const mainLine=master.body.toString().split(/\r?\n/).find(l=>l.trim()&&!l.startsWith('#')&&l.includes('.m3u8'));assert.ok(mainLine);
 const mainPath=internalLink(mainLine,'https://'+host+masterPath),main=await call(mainPath);assert.equal(main.status,200);assert.match(main.body.toString(),/^#EXTM3U/);
 const segmentLine=main.body.toString().split(/\r?\n/).find(l=>l.trim()&&!l.startsWith('#'));assert.ok(segmentLine);
 const segmentPath=internalLink(segmentLine,'https://'+host+mainPath),segment=await call(segmentPath);assert.equal(segment.status,200);assert.ok(segment.body.length>188);
 const streams=await new Promise((resolve,reject)=>{const child=execFile(kubectl,['-n','emby','exec','-i','emby-0','--','/bin/ffprobe','-v','error','-show_entries','stream=codec_name,codec_type,width,height','-of','json','-i','pipe:0'],{maxBuffer:1024*1024,timeout:30000},(e,stdout)=>e?reject(new Error('Owned HLS segment codec inspection failed.')):resolve(JSON.parse(stdout).streams));child.stdin.end(segment.body);});
 const video=streams.find(s=>s.codec_type==='video'),audio=streams.find(s=>s.codec_type==='audio');assert.equal(video?.codec_name,'h264');assert.ok(video.width<=640&&video.height<=360);assert.equal(audio?.codec_name,'aac');
 const after=JSON.parse((await call(userDataPath)).body).UserData;assert.deepEqual(after,before,'Acceptance must preserve existing playback/watch data.');
 report={observedAt:new Date().toISOString(),strictTls:true,masterPlaylist200:true,mediaPlaylist200:true,ownedSegment200:true,segmentBytes:segment.body.length,segmentSha256:createHash('sha256').update(segment.body).digest('hex'),videoCodec:video.codec_name,width:video.width,height:video.height,audioCodec:audio.codec_name,userWatchDataUnchanged:true,newCredentialCreated:false};
}catch(e){error=e;}
finally{
 ledger.encodingStopAttempted=true;save();try{const stop=await call('/emby/Videos/ActiveEncodings?'+new URLSearchParams({DeviceId:deviceId,PlaySessionId:playSessionId}),'DELETE');assert.ok([200,204].includes(stop.status));ledger.encodingStopStatus=stop.status;ledger.cleanedAt=new Date().toISOString();save();let remaining;for(let n=0;n<10;n++){remaining=await processes();if(remaining.every(pid=>startingProcesses.includes(pid)))break;await new Promise(r=>setTimeout(r,1000));}ledger.remainingEncoderCount=remaining.length;save();if(report){report.ownedEncodingStopStatus=stop.status;report.encoderCounts={before:startingProcesses.length,after:remaining.length};report.passed=!error;}}catch(cleanup){error=error||cleanup;}
 token=undefined;for(const key of keys)delete key.token;
 if(report){fs.writeFileSync(root+'/emby-hls-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
}
if(error)throw error;
