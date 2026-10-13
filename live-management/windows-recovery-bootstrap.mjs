import {createHash} from 'node:crypto';
import https from 'node:https';
import {readFile} from 'node:fs/promises';
import {recoveryRecipientId} from './windows-recovery-envelope.mjs';
const fail=()=>Object.assign(new Error('The installed Windows recovery bootstrap is unavailable or changed.'),{status:503,code:'WINDOWS_BOOTSTRAP_UNCONFIRMED'});
const uuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value||'');
const bootstrapPath='/api/v1/namespaces/manager-system/configmaps/dns-windows-recovery-bootstrap';
const requestPath='/api/v1/namespaces/dns-system/secrets/dns-windows-recovery-request';
const receiptPath='/api/v1/namespaces/dns-system/configmaps/dns-windows-recovery-receipt';
export async function readWindowsRecoveryBootstrap({expectedUid,expectedDigest,request}){
 try{
  if(!uuid(expectedUid)||!/^[a-f0-9]{64}$/.test(expectedDigest||''))throw fail();const result=await request(bootstrapPath,{method:'GET'}),object=result.body;
  if(result.status!==200||object?.apiVersion!=='v1'||object.kind!=='ConfigMap'||object.metadata?.name!=='dns-windows-recovery-bootstrap'||object.metadata.namespace!=='manager-system'||object.metadata.uid!==expectedUid||object.metadata.deletionTimestamp||object.immutable!==true||Object.keys(object.data||{}).join('|')!=='configuration.json')throw fail();
  const text=object.data['configuration.json'];if(typeof text!=='string'||text.length>4096||createHash('sha256').update(text).digest('hex')!==expectedDigest)throw fail();const value=JSON.parse(text),fields=['version','clusterUid','accountUid','agentAccountUid','requestUid','receiptUid','recipient','bridgeSourceDigest'];
  if(Object.keys(value).sort().join('|')!==fields.sort().join('|')||value.version!==1||['clusterUid','accountUid','agentAccountUid','requestUid','receiptUid'].some(k=>!uuid(value[k]))||!/^[a-f0-9]{64}$/.test(value.bridgeSourceDigest||'')||Object.keys(value.recipient||{}).sort().join('|')!==['kty','e','n','kid','alg','use'].sort().join('|')||value.recipient.alg!=='RSA-OAEP-256'||value.recipient.use!=='enc'||value.recipient.kid!==recoveryRecipientId(value.recipient))throw fail();
  return structuredClone(value);
 }catch{throw fail();}
}
// Dedicated mounted backend identity. This transport cannot address unrelated
// resources or perform bridge Secret mutations on behalf of a Rancher caller.
export function clusterWindowsRecoveryRequest({host=process.env.KUBERNETES_SERVICE_HOST,port=Number(process.env.KUBERNETES_SERVICE_PORT_HTTPS||443),loadTrust=()=>Promise.all([readFile('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt'),readFile('/var/run/secrets/kubernetes.io/serviceaccount/token','utf8')]),send}={}){
 return async(path,init={})=>{
  const method=init.method||'GET';if(![bootstrapPath,requestPath,receiptPath].includes(path)||!['GET','PUT'].includes(method)||method==='PUT'&&path!==requestPath||method==='GET'&&init.body!==undefined||method==='PUT'&&(typeof init.body!=='string'||init.body.length>262144))throw fail();
  try{
   const [ca,rawToken]=await loadTrust();const token=rawToken.trim();if(!token||!ca||!host||!Number.isInteger(port)||port<1||port>65535)throw fail();
   const options={host,port,servername:'kubernetes.default.svc',ca,rejectUnauthorized:true,path,method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},timeout:10000};
   if(send)return await send(options,init.body);
   return await new Promise((resolve,reject)=>{const q=https.request(options,r=>{let bytes=0,text='';r.setEncoding('utf8');r.on('data',part=>{bytes+=Buffer.byteLength(part);text+=part;if(bytes>2*1024*1024)q.destroy(fail());});r.on('end',()=>{try{resolve({status:r.statusCode,body:text?JSON.parse(text):null});}catch{reject(fail());}});});q.on('error',()=>reject(fail()));q.on('timeout',()=>q.destroy(fail()));q.end(init.body);});
  }catch{throw fail();}
 };
}
