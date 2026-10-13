import https from 'node:https';import {readFile} from 'node:fs/promises';
const fail=()=>Object.assign(new Error('Trusted cluster signing keys are unavailable.'),{status:503,code:'RECOVERY_SIGNING_KEYS_UNAVAILABLE'});
// Rancher's dashboard proxy does not expose the API server's non-resource JWKS
// URL. Read this fixed public verification material directly with mounted trust.
// This transport cannot address Secrets, writes, external hosts or caller URLs.
export function clusterSigningKeysReader({host=process.env.KUBERNETES_SERVICE_HOST,port=Number(process.env.KUBERNETES_SERVICE_PORT_HTTPS||443),loadTrust=()=>Promise.all([readFile('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt'),readFile('/var/run/secrets/kubernetes.io/serviceaccount/token','utf8')]),send}={}){
 return async()=>{try{
  const [ca,rawToken]=await loadTrust(),token=rawToken.trim();if(!host||!ca||!token||!Number.isInteger(port)||port<1||port>65535)throw fail();
  const options={host,port,servername:'kubernetes.default.svc',path:'/openid/v1/jwks',method:'GET',ca,rejectUnauthorized:true,headers:{Authorization:'Bearer '+token,Accept:'application/jwk-set+json'},timeout:10000};
  const result=send?await send(options):await new Promise((resolve,reject)=>{const q=https.request(options,r=>{let bytes=0,text='';r.setEncoding('utf8');r.on('data',part=>{bytes+=Buffer.byteLength(part);text+=part;if(bytes>262144)q.destroy(fail());});r.on('end',()=>{try{resolve({status:r.statusCode,body:JSON.parse(text)});}catch{reject(fail());}});});q.on('error',()=>reject(fail()));q.on('timeout',()=>q.destroy(fail()));q.end();});
  if(result.status!==200||!Array.isArray(result.body?.keys)||!result.body.keys.length||result.body.keys.length>20)throw fail();return result.body;
 }catch{throw fail();}};
}
