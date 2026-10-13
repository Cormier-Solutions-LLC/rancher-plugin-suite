import {createHash} from 'node:crypto';import https from 'node:https';import {readFile} from 'node:fs/promises';
import {validateDnsSourceBindings} from './dns-source-catalog.mjs';
const path='/api/v1/namespaces/dns-system/configmaps/dns-manager-source-bindings';
const fail=()=>Object.assign(new Error('The installed source registry is unavailable or changed.'),{status:503,code:'SOURCE_BOOTSTRAP_UNCONFIRMED'});
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v||'');
export async function readDnsSourceBindings({expectedUid,expectedDigest,request}){
 try{
  if(!uuid(expectedUid)||!/^[a-f0-9]{64}$/.test(expectedDigest||'')||typeof request!=='function')throw fail();
  const response=await request(path),object=response.body;
  if(response.status!==200||object?.apiVersion!=='v1'||object.kind!=='ConfigMap'||object.metadata?.namespace!=='dns-system'||object.metadata.name!=='dns-manager-source-bindings'||object.metadata.uid!==expectedUid||!object.metadata.resourceVersion||object.metadata.deletionTimestamp||object.immutable!==true||Object.keys(object.data||{}).join('|')!=='bindings.json'||Object.keys(object.binaryData||{}).length)throw fail();
  const text=object.data['bindings.json'];if(typeof text!=='string'||Buffer.byteLength(text)>65536||createHash('sha256').update(text).digest('hex')!==expectedDigest)throw fail();
  return {uid:expectedUid,digest:expectedDigest,document:validateDnsSourceBindings(JSON.parse(text))};
 }catch{throw fail();}
}
// Only the public, immutable named bridge registry is read with pod identity.
// Catalog, controller, bridge, proposal and queue access is caller delegated.
export function clusterSourceRegistryRequest({host=process.env.KUBERNETES_SERVICE_HOST,port=Number(process.env.KUBERNETES_SERVICE_PORT_HTTPS||443),loadTrust=()=>Promise.all([readFile('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt'),readFile('/var/run/secrets/kubernetes.io/serviceaccount/token','utf8')]),send}={}){
 return async(candidate,init={})=>{
  if(candidate!==path||Object.keys(init).some(key=>key!=='method')||init.method&&init.method!=='GET')throw fail();
  try{
   const [ca,rawToken]=await loadTrust(),token=rawToken.trim();if(!ca||!token||!host||!Number.isInteger(port)||port<1||port>65535)throw fail();
   const options={host,port,servername:'kubernetes.default.svc',ca,rejectUnauthorized:true,path,method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},timeout:10000};if(send)return await send(options);
   return await new Promise((resolve,reject)=>{const request=https.request(options,response=>{let bytes=0,text='';response.setEncoding('utf8');response.on('data',part=>{bytes+=Buffer.byteLength(part);if(bytes>131072)return request.destroy(fail());text+=part;});response.on('end',()=>{try{resolve({status:response.statusCode,body:JSON.parse(text)});}catch{reject(fail());}});});request.on('error',()=>reject(fail()));request.on('timeout',()=>request.destroy(fail()));request.end();});
  }catch{throw fail();}
 };
}
