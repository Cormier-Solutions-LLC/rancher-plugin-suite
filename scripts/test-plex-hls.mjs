// Isolated Plex transcode session; never terminates an existing playback session.
import fs from 'node:fs';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const run=promisify(execFile),kubectl='C:/Program Files/Docker/Docker/resources/bin/kubectl.exe',root='.local/manager-installation';
const endpoint=JSON.parse(fs.readFileSync(root+'/plex-connectivity-tests.json')).candidates.find(c=>c.strictTls&&c.identityMatchesConfigured&&c.authenticatedLibraryStatus===200)?.endpoint;assert.ok(endpoint);
const parts=JSON.parse(fs.readFileSync(root+'/plex-media-parts-private.json')),part=parts[0];assert.ok(part.ratingKey);const session=randomUUID();
const ledgerPath=root+'/plex-hls-owned.json';if(fs.existsSync(ledgerPath))assert.ok(JSON.parse(fs.readFileSync(ledgerPath)).cleanedAt,'Reconcile the previous owned Plex session before a new test.');
const ledger={createdAt:new Date().toISOString(),session,ownedOnly:true},save=()=>fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2));save();
const code=String.raw`import configparser,json,urllib.request,urllib.parse,urllib.error,xml.etree.ElementTree as ET,sys,base64,hashlib,datetime,time
c=configparser.ConfigParser(strict=False);c.read('/config/config.ini');token=c.get('PMS','pms_token');base,rating,session=sys.argv[1:];headers={'X-Plex-Token':token,'X-Plex-Client-Identifier':session,'X-Plex-Session-Identifier':session,'X-Plex-Product':'Manager acceptance','X-Plex-Version':'1.0.0','X-Plex-Platform':'Chrome','X-Plex-Device':'Acceptance','X-Plex-Client-Profile-Name':'Chrome'}
def request(path,limit=2097152):
 with urllib.request.urlopen(urllib.request.Request(base+path,headers=headers),timeout=25) as r:
  data=r.read(limit+1);assert len(data)<=limit,'Bounded acceptance response exceeded';return r.status,data
def xml(path):
 status,data=request(path);assert status==200;return ET.fromstring(data)
def link(line,path):
 u=urllib.parse.urlparse(urllib.parse.urljoin(base+path,line));b=urllib.parse.urlparse(base);assert u.scheme==b.scheme and u.netloc==b.netloc
 pairs=[(k,v) for k,v in urllib.parse.parse_qsl(u.query) if k.lower() not in ('x-plex-token','api_key')];return u.path+('?' + urllib.parse.urlencode(pairs) if pairs else '')
def watched():
 node=xml('/library/metadata/'+rating).find('Video');assert node is not None;return {k:node.get(k) for k in ('viewCount','viewOffset','lastViewedAt')}
def sessions():return xml('/transcode/sessions').findall('TranscodeSession')
before=watched();before_sessions=sessions();assert not any(session in json.dumps(s.attrib) for s in before_sessions)
stop_path='/video/:/transcode/universal/stop?'+urllib.parse.urlencode({'session':session})
try:probe_status,_=request(stop_path)
except urllib.error.HTTPError as e:probe_status=e.code
assert probe_status in (200,404),'Inspect the own-session cleanup endpoint before starting'
report={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'strictTls':True,'newCredentialCreated':False,'nonexistentOwnSessionStopStatus':probe_status}
try:
 query=urllib.parse.urlencode({'session':session,'hasMDE':'1','path':'/library/metadata/'+rating,'mediaIndex':'0','partIndex':'0','protocol':'hls','offset':'0','fastSeek':'1','directPlay':'0','directStream':'0','directStreamAudio':'0','videoQuality':'60','videoResolution':'480x270','maxVideoBitrate':'400','videoBitrate':'400','secondsPerSegment':'3','audioChannelCount':'2','location':'lan','autoAdjustQuality':'0','subtitles':'none'})
 master_path='/video/:/transcode/universal/start.m3u8?'+query;status,master=request(master_path);assert status==200 and master.startswith(b'#EXTM3U')
 main_line=next((l for l in master.decode().splitlines() if l and not l.startswith('#') and '.m3u8' in l),None);assert main_line is not None
 main_path=link(main_line,master_path);status,main=request(main_path);assert status==200 and main.startswith(b'#EXTM3U')
 segment_line=next((l for l in main.decode().splitlines() if l and not l.startswith('#')),None);assert segment_line
 segment_path=link(segment_line,main_path);assert session in segment_path,'Segment must belong to the owned session';status,data=request(segment_path);assert status==200 and len(data)>188
 active=sessions();assert any(session in json.dumps(s.attrib) for s in active),'Owned transcode must be visible'
 assert watched()==before,'Watch data changed during read-only streaming acceptance'
 report.update(masterPlaylist200=True,mediaPlaylist200=True,ownedSegment200=True,segmentBytes=len(data),segmentSha256=hashlib.sha256(data).hexdigest(),ownedTranscodeObserved=True,userWatchDataUnchanged=True,privateSegment=base64.b64encode(data).decode())
finally:
 status,_=request(stop_path);assert status==200;report['ownedStopStatus']=status
 deadline=time.time()+30
 while True:
  remaining=sessions()
  if not any(session in json.dumps(s.attrib) for s in remaining):break
  assert time.time()<deadline,'Owned transcode cleanup did not finish';time.sleep(1)
 report['ownedTranscodeRemoved']=True;report['otherTranscodeCounts']={'before':len(before_sessions),'after':len(remaining)}
print(json.dumps(report))`;
let report;
try{
 let result;try{result=await run(kubectl,['-n','plex-manager','exec','deployment/plex-manager','--','python3','-c',code,endpoint,part.ratingKey,session],{encoding:'utf8',timeout:150000,maxBuffer:4*1024*1024});}catch(e){fs.writeFileSync(root+'/plex-hls-diagnostic-private.log',(e.stderr||'')+'\n'+(e.stdout||''),{mode:0o600});throw new Error('Plex HLS acceptance failed; private diagnostics were retained.');}
 report=JSON.parse(result.stdout);const segment=Buffer.from(report.privateSegment,'base64');delete report.privateSegment;
 const streams=await new Promise((resolve,reject)=>{const child=execFile(kubectl,['-n','emby','exec','-i','emby-0','--','/bin/ffprobe','-v','error','-show_entries','stream=codec_name,codec_type,width,height','-of','json','-i','pipe:0'],{maxBuffer:1024*1024,timeout:30000},(e,stdout)=>e?reject(new Error('Owned Plex segment codec inspection failed.')):resolve(JSON.parse(stdout).streams));child.stdin.end(segment);});
 const video=streams.find(s=>s.codec_type==='video'),audio=streams.find(s=>s.codec_type==='audio');assert.equal(video?.codec_name,'h264');assert.ok(video.width<=480&&video.height<=270);assert.ok(audio?.codec_name);report.videoCodec=video.codec_name;report.width=video.width;report.height=video.height;report.audioCodec=audio.codec_name;report.passed=true;
 ledger.cleanedAt=new Date().toISOString();ledger.ownedTranscodeRemoved=report.ownedTranscodeRemoved;save();fs.writeFileSync(root+'/plex-hls-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{if(report&&!report.passed)fs.writeFileSync(root+'/plex-hls-tests.json',JSON.stringify(report,null,2));}
