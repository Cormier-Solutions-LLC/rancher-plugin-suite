import https from 'node:https';
import {dnsCredentialReferences} from './dns-credentials.mjs';
const prefix='/k8s/clusters/local',origin='https://rancher.cormierconsulting.io';
const failure=(status=403,uncertain=false)=>Object.assign(new Error(uncertain?'Credential recovery submission was not confirmed. Reconcile its original receipt before retrying.':'Credential recovery authorization or API access failed.'),{status,code:uncertain?'RECOVERY_UNCONFIRMED':'RECOVERY_ACCESS_DENIED'});
export async function rancherRecoveryRequest(path,init){
 return new Promise((resolve,reject)=>{
  const request=https.request({hostname:'10.99.15.50',servername:'rancher.cormierconsulting.io',port:443,path:prefix+path,method:init.method,rejectUnauthorized:true,headers:{Host:'rancher.cormierconsulting.io',...init.headers},timeout:10000},response=>{
   let body='';response.on('data',chunk=>{body+=chunk;if(body.length>2*1024*1024)request.destroy(failure(503));});response.on('end',()=>{try{resolve({status:response.statusCode,body:body?JSON.parse(body):null});}catch{reject(failure(503));}});
  });request.on('timeout',()=>request.destroy(failure(503)));request.on('error',()=>reject(failure(503)));request.end(init.body);
 });
}
// Delegate through the authenticated Rancher session. Never fall back to the
// pod credential: named reads granted to capture do not authorize user writes.
export function rancherSessionHeaders(headers){
 if(headers?.origin!==origin||headers['sec-fetch-site']==='cross-site'||typeof headers.cookie!=='string'||!headers.cookie||headers.cookie.length>16384||/[\r\n]/.test(headers.cookie))throw failure();
 const values=headers.cookie.split(';').map(part=>part.trim()).filter(part=>part.startsWith('CSRF='));if(values.length!==1)throw failure();
 let csrf;try{csrf=decodeURIComponent(values[0].slice(5));}catch{throw failure();}if(!csrf||csrf.length>4096||/[\r\n]/.test(csrf))throw failure();
 const forwarded={Cookie:headers.cookie,'x-api-csrf':csrf,'Content-Type':'application/json',Accept:'application/json'};
 return forwarded;
}
export function createRancherRecoverySession(headers,userId,request=rancherRecoveryRequest,{readSigningKeys}={}){
 if(!/^user-[a-z0-9-]+$/.test(userId||''))throw failure();
 const forwarded=rancherSessionHeaders(headers);
 let identityVerified=false,authorized=new Set(),canCreate=false;
 async function call(path,method='GET',body,write=false){
  let result;try{result=await request(path,{method,headers:forwarded,...(body?{body:JSON.stringify(body)}:{})});}catch{throw failure(503,write);}
  if(![200,201].includes(result.status))throw failure(result.status,write&&result.status>=500);return result.body;
 }
 const reference=name=>{const ref=dnsCredentialReferences.find(r=>r.name===name);if(!ref)throw failure();return ref;};
 const secretPath=name=>{const ref=reference(name);return `/api/v1/namespaces/${ref.namespace}/secrets/${ref.name}`;};
 function permitted(name){const ref=reference(name);if(!identityVerified||!authorized.has(name))throw failure();return ref;}
 // Validate operation shape independently of transport; only installed names
 // and reviewed CAS identities can reach a write endpoint.
 function validate(secret,create){
  const ref=permitted(secret?.metadata?.name);
  if(secret.apiVersion!=='v1'||secret.kind!=='Secret'||secret.metadata.namespace!==ref.namespace||secret.type!==ref.type||!secret.data||secret.stringData||Object.keys(secret.data).sort().join('|')!==ref.keys.slice().sort().join('|')||Object.values(secret.data).some(value=>typeof value!=='string'||!value||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))||create&&(secret.metadata.uid||secret.metadata.resourceVersion)||!create&&(typeof secret.metadata.uid!=='string'||!secret.metadata.uid||typeof secret.metadata.resourceVersion!=='string'||!secret.metadata.resourceVersion))throw failure();
  return ref;
 }
 return {
  get userId(){return userId;},
  // Channel authorization must not narrow the parent transaction's selected
  // credential capabilities or discard its separately verified create grant.
  authorizeWindowsRecoveryChannel(){return createRancherRecoverySession({origin,cookie:forwarded.Cookie,'sec-fetch-site':'same-origin'},userId,request).authorize(['dns-windows-bridge-credential']);},
  async authorize(names,{allowCreate=false}={}){
   if(!Array.isArray(names)||!names.length||new Set(names).size!==names.length)throw failure();names.forEach(reference);authorized=new Set();canCreate=false;
   const identity=await call('/apis/authentication.k8s.io/v1/selfsubjectreviews','POST',{apiVersion:'authentication.k8s.io/v1',kind:'SelfSubjectReview'});
   if(identity?.apiVersion!=='authentication.k8s.io/v1'||identity.kind!=='SelfSubjectReview'||identity?.status?.userInfo?.username!==userId)throw failure();identityVerified=true;
   const requirements=names.flatMap(name=>['get','update'].map(verb=>({verb,group:'',resource:'secrets',namespace:reference(name).namespace,name})));
   if(names.includes('dns-windows-bridge-credential'))requirements.push({verb:'get',group:'',resource:'serviceaccounts',namespace:'dns-system',name:'dns-windows-bridge'});
   if(allowCreate)requirements.push({verb:'create',group:'',resource:'secrets',namespace:'dns-system'});
   for(const resourceAttributes of requirements){const result=await call('/apis/authorization.k8s.io/v1/selfsubjectaccessreviews','POST',{apiVersion:'authorization.k8s.io/v1',kind:'SelfSubjectAccessReview',spec:{resourceAttributes}});if(result?.status?.allowed!==true||result.status.denied||result.status.evaluationError)throw failure();}
   authorized=new Set(names);canCreate=allowCreate;return {userId,credentialNames:[...names],allowCreate};
  },
  readSecret(name){permitted(name);return call(secretPath(name));},
  readBridgeAccount(){permitted('dns-windows-bridge-credential');return call('/api/v1/namespaces/dns-system/serviceaccounts/dns-windows-bridge');},
  readSigningKeys(){permitted('dns-windows-bridge-credential');return readSigningKeys?readSigningKeys():call('/openid/v1/jwks');},
  replaceSecret(secret,{dryRun=true}={}){validate(secret,false);return call(secretPath(secret.metadata.name)+(dryRun?'?dryRun=All':''),'PUT',secret,!dryRun);},
  createSecret(secret,{dryRun=true}={}){const ref=validate(secret,true);if(!canCreate)throw failure();return call(`/api/v1/namespaces/${ref.namespace}/secrets`+(dryRun?'?dryRun=All':''),'POST',secret,!dryRun);}
 };
}
