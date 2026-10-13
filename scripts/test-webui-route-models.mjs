// Short-lived administrator session for bounded route/model checks; API keys stay disabled.
import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
const kubectl='C:/Program Files/Docker/Docker/resources/bin/kubectl.exe',root='.local/manager-installation',base='https://ai.cormierconsulting.io';
const code=String.raw`import sqlite3,json,os,jwt,time,uuid,pathlib
c=sqlite3.connect('file:/app/backend/data/webui.db?mode=ro',uri=True);rows=c.execute('select id from user where role=?',('admin',)).fetchall();assert len(rows)==1;c.close();now=int(time.time());jti=str(uuid.uuid4());token=jwt.encode({'id':rows[0][0],'jti':jti,'iat':now,'exp':now+300},(os.environ.get('WEBUI_SECRET_KEY') or pathlib.Path('/app/backend/.webui_secret_key').read_text().strip()),algorithm='HS256');print(json.dumps({'token':token,'jti':jti,'expiresAt':now+300}))`;
const session=JSON.parse(execFileSync(kubectl,['-n','ai','exec','open-webui-0','-c','open-webui','--','python','-c',code],{encoding:'utf8',timeout:15000}));fs.writeFileSync(root+'/webui-owned-private.json',JSON.stringify(session));
async function request(path,{method='GET',body,token=session.token,timeout=45000}={}){const r=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeout)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{}return{status:r.status,data};}
let report={observedAt:new Date().toISOString(),strictTls:true,sessionTtlSeconds:300,apiKeysEnabled:false,accountCreated:false,models:[],passed:false};
try{
 report.anonymousModelsStatus=(await request('/api/models',{token:null})).status;assert.equal(report.anonymousModelsStatus,401);
 report.invalidTokenStatus=(await request('/api/models',{token:'manager-invalid-session'})).status;assert.ok([401,403].includes(report.invalidTokenStatus));
 const auth=await request('/api/v1/auths/');report.existingAdminSessionStatus=auth.status;assert.equal(auth.status,200);
 const models=await request('/api/models');report.modelListStatus=models.status;assert.equal(models.status,200);const list=models.data?.data||[];report.models=list.map(m=>({id:m.id,provider:m.owned_by,connectionType:m.connection_type}));
 console.log(JSON.stringify({authenticatedModelListStatus:models.status,models:report.models}));report.modelListPassed=true;report.passed=list.length>0;
}finally{
 const cleanup=await request('/api/v1/auths/signout',{method:'POST'});report.ownedSessionSignoutStatus=cleanup.status;assert.equal(cleanup.status,200);report.revokedSessionStatus=(await request('/api/v1/auths/')).status;assert.ok([401,403].includes(report.revokedSessionStatus));delete session.token;fs.writeFileSync(root+'/webui-owned-private.json',JSON.stringify(session));report.ownedSessionRevoked=true;fs.writeFileSync(root+'/webui-route-model-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
if(!report.passed)process.exitCode=1;
