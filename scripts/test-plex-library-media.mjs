// Read actual Plex library metadata and bounded media ranges without playback state changes.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
const kubectl='C:/Program Files/Docker/Docker/resources/bin/kubectl.exe',root='.local/manager-installation';
const evidence=JSON.parse(fs.readFileSync(root+'/plex-connectivity-tests.json'));const endpoint=evidence.candidates.find(c=>c.strictTls&&c.identityMatchesConfigured&&c.authenticatedLibraryStatus===200)?.endpoint;assert.ok(endpoint);
const code=String.raw`import configparser,json,urllib.request,urllib.error,xml.etree.ElementTree as ET,sys,hashlib,datetime
c=configparser.ConfigParser(strict=False);c.read('/config/config.ini');token=c.get('PMS','pms_token');base=sys.argv[1]
def request(path,auth=True,headers=None):
 h={'X-Plex-Token':token} if auth else {};h.update(headers or {});return urllib.request.urlopen(urllib.request.Request(base+path,headers=h),timeout=20)
def xml(path):
 with request(path) as r: assert r.status==200;return ET.fromstring(r.read())
report={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'strictTls':True,'existingTokenAccepted':True,'libraries':[],'writes':0,'playbackStateChanged':False,'privateParts':[]}
for auth in (False,True):
 try:
  with request('/library/sections',auth,{'X-Plex-Token':'manager-invalid-token'} if auth else None) as r:status=r.status
 except urllib.error.HTTPError as e:status=e.code
 assert status in (200,401,403);report['trustedLanInvalidTokenStatus' if auth else 'trustedLanAnonymousStatus']=status
for library in xml('/library/sections').findall('Directory'):
 kind=library.get('type');items=xml('/library/sections/'+library.get('key')+'/all?X-Plex-Container-Start=0&X-Plex-Container-Size=1');video=next(iter(items.findall('Video')),None)
 if video is None:
  show=next(iter(items.findall('Directory')),None)
  if show is not None:video=next(iter(xml('/library/metadata/'+show.get('ratingKey')+'/allLeaves?X-Plex-Container-Size=1').findall('Video')),None)
 assert video is not None,'Library contains no media to verify';part=video.find('Media/Part')
 if part is None:part=xml('/library/metadata/'+video.get('ratingKey')).find('Video/Media/Part')
 assert part is not None and part.get('key');size=int(part.get('size','0'));assert size>0
 report['privateParts'].append({'libraryId':library.get('key'),'partKey':part.get('key'),'file':part.get('file'),'size':size,'ratingKey':video.get('ratingKey')})
 data=b''
 try:
  with request(part.get('key'),headers={'Range':'bytes=0-4095'}) as r:
   status=r.status;data=r.read(4096);content_range=r.headers.get('Content-Range','');assert status==206 and len(data)==min(size,4096);assert content_range.startswith('bytes 0-');assert content_range.endswith('/'+str(size))
 except urllib.error.HTTPError as error:status=error.code
 report['libraries'].append({'type':kind,'reportedItems':int(items.get('totalSize',items.get('size','0'))),'metadataRead':True,'actualMediaRangeStatus':status,'bytesVerified':len(data),'rangeSha256':hashlib.sha256(data).hexdigest()})
assert len(report['libraries'])==3;report['tokenAuthenticationProven']=report['trustedLanAnonymousStatus'] in (401,403);report['trustedLanBypassObserved']=report['trustedLanAnonymousStatus']==200;report['passed']=all(l['actualMediaRangeStatus']==206 for l in report['libraries']);print(json.dumps(report))`;
const report=JSON.parse(execFileSync(kubectl,['-n','plex-manager','exec','deployment/plex-manager','--','python3','-c',code,endpoint],{encoding:'utf8',timeout:115000}));fs.writeFileSync(root+'/plex-media-parts-private.json',JSON.stringify(report.privateParts,null,2));delete report.privateParts;fs.writeFileSync(root+'/plex-library-media-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
