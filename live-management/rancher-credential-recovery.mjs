import {rancherSessionHeaders,rancherRecoveryRequest,createRancherRecoverySession} from './rancher-recovery-session.mjs';
import {clusterSigningKeysReader} from './cluster-signing-keys.mjs';
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v||'');
const fail=status=>Object.assign(new Error('Credential restore request is unavailable or unauthorized.'),{status});
// This is a caller-scoped API, not a pod-credential proxy. The user identity is
// obtained from Rancher and cannot be supplied by the request body or URL.
export function rancherCredentialRecovery({getRecovery,request=rancherRecoveryRequest,readSigningKeys=clusterSigningKeysReader(),onDiagnostic=()=>{}}){
 function diagnostic(event){try{onDiagnostic(event);}catch{}}
 const observedRequest=async(path,init)=>{try{const result=await request(path,init);diagnostic({stage:'RancherAPI',method:init.method,status:result.status,path:path.replace(/\?.*$/,'')});return result;}catch(e){diagnostic({stage:'RancherAPI',method:init.method,status:e.status||503,path:path.replace(/\?.*$/,''),code:/^[A-Z_]{1,64}$/.test(e.code||'')?e.code:'UNCONFIRMED'});throw e;}};
 return async({path,method,headers,input})=>{
  let stage='Validation';
  try{
   const prepare=path==='/api/credential-recovery/prepare',match=/^\/api\/credential-recovery\/([0-9a-f-]+)\/(status|apply|reconcile)$/.exec(path);
   if(!prepare&&!match)return {status:404,body:{error:'Credential restore action not found.'}};
   if(method!=='POST')throw fail(405);if(!input||typeof input!=='object'||Array.isArray(input))throw fail(400);
   const action=prepare?'prepare':match[2],allowed=prepare?['id','snapshotId','names','password']:action==='status'?[]:['password'];if(Object.keys(input).some(k=>!allowed.includes(k)))throw fail(400);
   const id=prepare?input.id:match[1];if(!uuid(id)||prepare&&(!uuid(input.snapshotId)||!Array.isArray(input.names)||!input.names.length||input.names.length>2||new Set(input.names).size!==input.names.length||input.names.some(n=>!['dns-manager-engine-admin','dns-windows-bridge-credential'].includes(n)))||action!=='status'&&(typeof input.password!=='string'||input.password.length>4096))throw fail(400);
   const forwarded=rancherSessionHeaders(headers);stage='Identity';let identity;try{identity=await observedRequest('/apis/authentication.k8s.io/v1/selfsubjectreviews',{method:'POST',headers:forwarded,body:JSON.stringify({apiVersion:'authentication.k8s.io/v1',kind:'SelfSubjectReview'})});}catch{throw fail(503);}
   if(identity.status!==201&&identity.status!==200)throw fail(identity.status===401?401:identity.status===403?403:503);
   const userId=identity.body?.status?.userInfo?.username;if(identity.body?.apiVersion!=='authentication.k8s.io/v1'||identity.body.kind!=='SelfSubjectReview'||!/^user-[a-z0-9-]+$/.test(userId||''))throw fail(403);
   const session=createRancherRecoverySession(headers,userId,observedRequest,{readSigningKeys});stage='Bootstrap';const recovery=await getRecovery();stage=action;
   const receipt=await recovery[action]({...input,id,userId,session});return {status:prepare?201:200,body:{receipt}};
  }catch(error){
   diagnostic({stage,status:error.status||503,code:/^[A-Z_]{1,64}$/.test(error.code||'')?error.code:'UNCONFIRMED'});
   const status=[400,401,403,404,405,409,422,503,507].includes(error.status)?error.status:error.code==='ENOENT'?404:503;
   const messages={400:'Choose an encrypted backup, its password, and installed DNS credentials.',401:'Sign in to Rancher again.',403:'Credential restoration requires your Rancher Secret read and update permissions.',404:'The original credential restore transaction or backup was not found.',405:'Use a POST request for credential restoration.',409:'Review or reconcile the original restore operation before continuing.',422:'Unlock the original encrypted backup with its password.',503:'Credential restoration is unconfirmed. Reconcile the original operation before continuing.',507:'Credential recovery storage quota is exhausted.'};
   return {status,body:{error:messages[status],...(error.receipt?{receipt:error.receipt}:{})}};
  }
 };
}
