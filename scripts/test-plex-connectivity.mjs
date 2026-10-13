// Read-only identity and authenticated library checks using the existing Tautulli token.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
const kubectl='C:/Program Files/Docker/Docker/resources/bin/kubectl.exe';
const code=String.raw`import configparser,json,urllib.request,urllib.error,xml.etree.ElementTree as ET,hashlib,re,socket
c=configparser.ConfigParser(strict=False);c.read('/config/config.ini');p=c['PMS']; configured=p.get('pms_identifier','');suffix=re.search(r'\.([a-zA-Z0-9]+)\.plex\.direct',p.get('pms_url',''))
report={'observedConfiguredIdentity':bool(configured),'configuredIp':p.get('pms_ip'),'configuredPort':p.get('pms_port'),'configuredSsl':p.get('pms_ssl'),'writes':0,'candidates':[]}
urls=['http://10.99.15.52:32400','http://plex-server.plex-server.svc.cluster.local:32400']
if suffix:urls.append('https://10-99-15-52.'+suffix.group(1)+'.plex.direct:32400')
for url in urls:
 result={'endpoint':url}
 try:
  with urllib.request.urlopen(url+'/identity',timeout=10) as response: root=ET.fromstring(response.read());result.update(status=response.status,identityMatchesConfigured=root.get('machineIdentifier')==configured,version=root.get('version'),claimed=root.get('claimed'))
  if url.startswith('https:'):
   req=urllib.request.Request(url+'/library/sections',headers={'X-Plex-Token':p.get('pms_token','')})
   with urllib.request.urlopen(req,timeout=10) as response: libs=ET.fromstring(response.read());result.update(authenticatedLibraryStatus=response.status,libraryCount=len(libs.findall('Directory')),libraryTypes=sorted(set(x.get('type') for x in libs.findall('Directory'))),strictTls=True)
 except Exception as error:result.update(errorClass=type(error).__name__,status=getattr(error,'code',None))
 report['candidates'].append(result)
print(json.dumps(report))`;
const result=execFileSync(kubectl,['-n','plex-manager','exec','deployment/plex-manager','--','python3','-c',code],{encoding:'utf8',timeout:55000});const report=JSON.parse(result);report.observedAt=new Date().toISOString();report.sameServerAvailableOverTls=report.candidates.some(c=>c.strictTls&&c.identityMatchesConfigured&&c.authenticatedLibraryStatus===200);fs.writeFileSync('.local/manager-installation/plex-connectivity-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
