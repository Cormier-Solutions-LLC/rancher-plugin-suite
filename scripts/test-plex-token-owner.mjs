import fs from 'node:fs';import{execFileSync}from'node:child_process';import assert from 'node:assert/strict';
const k='C:/Program Files/Docker/Docker/resources/bin/kubectl.exe';const pref=execFileSync(k,['-n','plex-server','exec','deployment/plex-server','--','cat','/config/Library/Application Support/Plex Media Server/Preferences.xml'],{encoding:'utf8',timeout:15000});const token=pref.match(/\bPlexOnlineToken="([^"]*)"/)[1];
const code=String.raw`import configparser,json,urllib.request,urllib.error,xml.etree.ElementTree as ET,sys,sqlite3
c=configparser.ConfigParser(strict=False);c.read('/config/config.ini');r=json.loads(sys.stdin.read());candidate=r['token']
req=urllib.request.Request('https://plex.tv/users/account',headers={'X-Plex-Token':candidate,'Accept':'application/xml'})
with urllib.request.urlopen(req,timeout=15) as response:account=ET.fromstring(response.read());assert response.status==200;owner_id=account.get('id');assert owner_id
con=sqlite3.connect('file:/config/tautulli.db?mode=ro',uri=True);columns=[x[1] for x in con.execute('pragma table_info(users)')];assert 'is_admin' in columns
rows=con.execute('select is_admin from users where user_id=?',(owner_id,)).fetchall();con.close()
print(json.dumps({'serverOwnerTokenValidated':True,'ownerMatchesExistingTautulliAdmin':any(x[0]==1 for x in rows),'matchingUserRows':len(rows),'existingTautulliTokenDifferent':c.get('PMS','pms_token')!=candidate,'writes':0}))`;
const report=JSON.parse(execFileSync(k,['-n','plex-manager','exec','-i','deployment/plex-manager','--','python3','-c',code],{input:JSON.stringify({token}),encoding:'utf8',timeout:25000}));report.observedAt=new Date().toISOString();fs.writeFileSync('.local/manager-installation/plex-token-owner-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.ok(report.ownerMatchesExistingTautulliAdmin,'Owner alignment remains unverified');
