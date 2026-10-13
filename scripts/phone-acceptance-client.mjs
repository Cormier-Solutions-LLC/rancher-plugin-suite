import https from 'node:https';
import assert from 'node:assert/strict';
export const base='http://127.0.0.1:15889';
export async function kube(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,path);return r.json();}
export async function connect(){
  const host='mcp-phone.cormierconsulting.io';
  const [deployment,config]=await Promise.all([kube('/apis/apps/v1/namespaces/automation/deployments/mcp-gateway'),kube('/api/v1/namespaces/automation/configmaps/mcp-gateway-profiles-g9bttt95dc')]);
  const profile=JSON.parse(config.data['profiles.json']).profiles.find(p=>p.hosts.includes(host));
  const ref=deployment.spec.template.spec.containers[0].env.find(e=>e.name===profile.clientTokenEnv).valueFrom.secretKeyRef;
  const secret=await kube('/api/v1/namespaces/automation/secrets/'+ref.name),token=Buffer.from(secret.data[ref.key],'base64').toString('utf8');
  async function request(body,headers={},method='POST'){
    return new Promise((resolve,reject)=>{const req=https.request({host,port:443,path:'/mcp',method,lookup:(_h,_o,cb)=>cb(null,[{address:'10.99.15.50',family:4}]),rejectUnauthorized:true,headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...headers},timeout:20000},res=>{let text='';res.on('data',b=>{text+=b;if(text.length>4*1024*1024)req.destroy(Error('Response exceeds bounded size'));});res.on('end',()=>{try{const messages=res.headers['content-type']?.includes('text/event-stream')?text.split('\n').filter(l=>l.startsWith('data:')).map(l=>JSON.parse(l.slice(5))):text?[JSON.parse(text)]:[];resolve({status:res.statusCode,headers:res.headers,messages});}catch{reject(Error('Invalid MCP response; reconcile unknown mutations'));}});});req.on('error',reject);req.on('timeout',()=>req.destroy(Error('MCP timeout; never repeat an unknown mutation')));req.end(body?JSON.stringify(body):undefined);});
  }
  const initialized=await request({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'manager-phone-acceptance',version:'1.0'}}},{Authorization:'Bearer '+token});
  assert.equal(initialized.status,200);
  const headers={Authorization:'Bearer '+token,'MCP-Protocol-Version':initialized.messages.find(m=>m.id===1).result.protocolVersion,...(initialized.headers['mcp-session-id']?{'Mcp-Session-Id':initialized.headers['mcp-session-id']}:{})};
  await request({jsonrpc:'2.0',method:'notifications/initialized'},headers);let id=2;
  async function raw(name,args={}){const callId=id++,r=await request({jsonrpc:'2.0',id:callId,method:'tools/call',params:{name,arguments:args}},headers);assert.equal(r.status,200);return r.messages.find(m=>m.id===callId);}
  async function call(name,args={}){const reply=await raw(name,args);assert.ok(reply?.result&&!reply.result.isError,'Phone tool rejected '+name+'; private error suppressed');const result=reply.result;if(result.structuredContent!==undefined){const v=result.structuredContent;return Object.keys(v).length===1&&Array.isArray(v.result)?v.result:v;}const t=result.content?.find(c=>c.type==='text')?.text;return t?JSON.parse(t):undefined;}
  return {call,raw,close:async()=>{if(initialized.headers['mcp-session-id'])await request(undefined,headers,'DELETE').catch(()=>{});}};
}
