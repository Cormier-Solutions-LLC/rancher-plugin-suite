import {rancherSessionHeaders,rancherRecoveryRequest} from './rancher-recovery-session.mjs';
import {dnsCredentialReferences} from './dns-credentials.mjs';
import {freshDnsSnapshot,readDnsInventory} from '../preview-data/fresh-dns-source.mjs';
const fail=(status=403)=>Object.assign(new Error('DNS credential capture requires the Rancher caller\'s named Secret read permissions.'),{status,code:'DNS_CAPTURE_ACCESS_DENIED'});
// The caller supplies a cookie only for this request. Every Secret/account read
// is delegated through Rancher; the backend identity is used for observations
// and candidate-token authentication, never as a fallback for denied reads.
export async function captureDnsForRancher(saved,{headers,request=rancherRecoveryRequest,readInventory=readDnsInventory,now=Date.now()}={}){
 const forwarded=rancherSessionHeaders(headers);
 async function call(path,method='GET',body){let result;try{result=await request(path,{method,headers:forwarded,...(body?{body:JSON.stringify(body)}:{})});}catch{throw fail(503);}if(![200,201].includes(result.status))throw fail(result.status===401?401:result.status===403?403:503);return result.body;}
 const identity=await call('/apis/authentication.k8s.io/v1/selfsubjectreviews','POST',{apiVersion:'authentication.k8s.io/v1',kind:'SelfSubjectReview'}),userId=identity?.status?.userInfo?.username;
 if(identity?.apiVersion!=='authentication.k8s.io/v1'||identity.kind!=='SelfSubjectReview'||!/^user-[a-z0-9-]+$/.test(userId||''))throw fail();
 const references=new Map();
 for(const ref of dnsCredentialReferences){references.set('credential/'+ref.name,{resource:'secrets',name:ref.name,namespace:ref.namespace});if(ref.serviceAccountName)references.set('service-account/'+ref.serviceAccountName,{resource:'serviceaccounts',name:ref.serviceAccountName,namespace:ref.namespace});}
 for(const ref of references.values()){
  const result=await call('/apis/authorization.k8s.io/v1/selfsubjectaccessreviews','POST',{apiVersion:'authorization.k8s.io/v1',kind:'SelfSubjectAccessReview',spec:{resourceAttributes:{verb:'get',group:'',...ref}}});
  if(result?.status?.allowed!==true||result.status.denied||result.status.evaluationError)throw fail();
 }
 const read=(name,candidate)=>{const ref=references.get(name);if(ref)return call('/api/v1/namespaces/'+ref.namespace+'/'+ref.resource+'/'+ref.name);if(name.startsWith('credential/')||name.startsWith('service-account/'))throw fail();return readInventory(name,candidate);};
 const captured=await freshDnsSnapshot(saved,read,now,{includeSecrets:true});
 return {...captured,caller:{userId}};
}
