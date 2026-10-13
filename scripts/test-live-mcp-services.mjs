import fs from 'node:fs';import assert from 'node:assert/strict';import https from 'node:https';
const base='http://127.0.0.1:15888',results=[];
async function kube(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json();}
async function request(host,path,body,headers={},method='POST'){
 return new Promise((resolve,reject)=>{const req=https.request({host,port:443,path,method,lookup:(_h,_o,cb)=>cb(null,[{address:'10.99.15.50',family:4}]),rejectUnauthorized:true,headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...headers},timeout:15000},res=>{let text='';res.on('data',b=>{text+=b;if(text.length>2*1024*1024)req.destroy(new Error('Response exceeds limit'));});res.on('end',()=>{const messages=res.headers['content-type']?.includes('text/event-stream')?text.split('\n').filter(l=>l.startsWith('data:')).map(l=>JSON.parse(l.slice(5))):text?[JSON.parse(text)]:[];resolve({status:res.statusCode,headers:res.headers,messages});});});req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('Endpoint timeout')));req.end(body?JSON.stringify(body):undefined);});
}
try{
 const deployment=await kube('/apis/apps/v1/namespaces/automation/deployments/mcp-gateway'),env=deployment.spec.template.spec.containers[0].env;
 const config=await kube('/api/v1/namespaces/automation/configmaps/mcp-gateway-profiles-g9bttt95dc');
 for(const profile of JSON.parse(config.data['profiles.json']).profiles){
  const host=profile.hosts[0],ref=env.find(e=>e.name===profile.clientTokenEnv)?.valueFrom?.secretKeyRef;assert.ok(ref);
  const secret=await kube('/api/v1/namespaces/automation/secrets/'+ref.name),token=Buffer.from(secret.data[ref.key],'base64').toString('utf8');
  const initialize={jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'manager-acceptance',version:'1.0'}}};
  assert.ok([401,403].includes((await request(host,'/mcp',initialize)).status),'Unauthenticated MCP access was accepted.');
  assert.ok([401,403].includes((await request(host,'/mcp',initialize,{Authorization:'Bearer invalid-acceptance-token'})).status),'Invalid MCP credentials were accepted.');
  const initialized=await request(host,'/mcp',initialize,{Authorization:'Bearer '+token});assert.equal(initialized.status,200,host+' initialize failed');const response=initialized.messages.find(m=>m.id===1);assert.ok(response?.result?.protocolVersion);
  const headers={Authorization:'Bearer '+token,'MCP-Protocol-Version':response.result.protocolVersion,...(initialized.headers['mcp-session-id']?{'Mcp-Session-Id':initialized.headers['mcp-session-id']}:{})};
  const notification=await request(host,'/mcp',{jsonrpc:'2.0',method:'notifications/initialized'},headers);assert.ok([200,202,204].includes(notification.status));
  const listed=await request(host,'/mcp',{jsonrpc:'2.0',id:2,method:'tools/list',params:{}},headers);assert.equal(listed.status,200);const tools=listed.messages.find(m=>m.id===2)?.result?.tools;assert.ok(Array.isArray(tools)&&tools.length>0,'MCP tools were unavailable.');
  if(!profile.allowedTools.includes('*'))assert.ok(tools.every(t=>profile.allowedTools.includes(t.name)),'Observer catalog exposes a prohibited tool.');
  results.push({host,passed:true,tlsVerified:true,checks:['missing credential rejected','invalid credential rejected','authenticated initialize','initialized notification','live tool catalog','profile allowlist'],toolCount:tools.length});console.log(host+': authenticated MCP and '+tools.length+' allowed tools passed.');
  if(initialized.headers['mcp-session-id'])await request(host,'/mcp',undefined,headers,'DELETE').catch(()=>{});
 }
}finally{fs.writeFileSync('.local/manager-installation/mcp-service-live-tests.json',JSON.stringify(results,null,2));}
