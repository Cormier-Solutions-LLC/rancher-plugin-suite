import {rancherSessionHeaders,rancherRecoveryRequest}from'./rancher-recovery-session.mjs';import{validateDnsSourceCatalog,validateDnsSourceBindings}from'./dns-source-catalog.mjs';
const namespace='dns-system',catalogName='dns-manager-sources',registryName='dns-manager-source-bindings',base=`/api/v1/namespaces/${namespace}/configmaps/`;
const fail=status=>Object.assign(new Error('Source management authorization or API readback is unconfirmed.'),{status,code:'SOURCE_ACCESS_UNCONFIRMED'});
// The pinned registry is supplied by the installed factory. Source request
// bodies never select accounts, resource namespaces, queue paths or credentials.
export function createRancherDnsSourceSession(headers,userId,registry,request=rancherRecoveryRequest,pins={}){
 if(!/^user-[a-z0-9-]+$/.test(userId||''))throw fail(403);registry=validateDnsSourceBindings(registry);const forwarded=rancherSessionHeaders(headers);let authorized=false,writeAuthorized=false;
 async function call(path,method='GET',body,accept){let response;try{response=await request(path,{method,headers:accept?{...forwarded,Accept:accept}:forwarded,...(body?{body:JSON.stringify(body)}:{})});}catch{throw fail(503);}if(![200,201].includes(response.status))throw fail([400,401,403,404,409,422].includes(response.status)?response.status:503);return response.body;}
 function allowed(){if(!authorized)throw fail(403);}
 function binding(id){allowed();const value=registry.bindings.find(b=>b.id===id);if(!value)throw fail(403);return value;}
 function pinnedMap(object,value,name,uid){if(object?.apiVersion!=='v1'||object.kind!=='ConfigMap'||object.metadata?.name!==name||object.metadata.namespace!==value.namespace||object.metadata.uid!==uid||!object.metadata.resourceVersion||object.metadata.deletionTimestamp)throw fail(409);return object;}
 async function grant(resourceAttributes){allowed();const access=await call('/apis/authorization.k8s.io/v1/selfsubjectaccessreviews','POST',{apiVersion:'authorization.k8s.io/v1',kind:'SelfSubjectAccessReview',spec:{resourceAttributes}});if(access.status?.allowed!==true||access.status.denied||access.status.evaluationError)throw fail(403);}
 async function proposalIdentities(){
  await grant({verb:'list',group:'',resource:'configmaps',namespace:'cattle-ui-plugin-system'});let continuation='',version;const found=new Map();
  for(let page=0;page<20;page++){
   const list=await call('/api/v1/namespaces/cattle-ui-plugin-system/configmaps?limit=200'+(continuation?'&continue='+encodeURIComponent(continuation):''),'GET',undefined,'application/json;as=PartialObjectMetadataList;g=meta.k8s.io;v=v1');
   if(list?.apiVersion!=='meta.k8s.io/v1'||list.kind!=='PartialObjectMetadataList'||!Array.isArray(list.items)||list.items.length>200||!list.metadata?.resourceVersion||version&&version!==list.metadata.resourceVersion)throw fail(409);version=list.metadata.resourceVersion;
   for(const item of list.items){const meta=item.metadata;if(!meta||meta.namespace!=='cattle-ui-plugin-system'||!meta.name||!meta.uid||!meta.resourceVersion)throw fail(409);if(!/^dns-manager-state-user-[a-z0-9-]+$/.test(meta.name))continue;if(meta.deletionTimestamp||found.has(meta.name)||found.size>=200)throw fail(409);found.set(meta.name,{name:meta.name,uid:meta.uid,resourceVersion:meta.resourceVersion});}
   const next=list.metadata.continue||'';if(typeof next!=='string'||next.length>4096||next===continuation&&next)throw fail(409);if(!next)return [...found.values()].sort((a,b)=>a.name.localeCompare(b.name));continuation=next;
  }throw fail(503);
 }
 return{
  get userId(){return userId;},
  async authorize({write=true}={}){authorized=false;writeAuthorized=false;if(typeof write!=='boolean')throw fail(403);const review=await call('/apis/authentication.k8s.io/v1/selfsubjectreviews','POST',{apiVersion:'authentication.k8s.io/v1',kind:'SelfSubjectReview'});if(review.apiVersion!=='authentication.k8s.io/v1'||review.kind!=='SelfSubjectReview'||review.status?.userInfo?.username!==userId)throw fail(403);for(const [name,verb]of [[catalogName,'get'],...(write?[[catalogName,'update']]:[]),[registryName,'get']]){const access=await call('/apis/authorization.k8s.io/v1/selfsubjectaccessreviews','POST',{apiVersion:'authorization.k8s.io/v1',kind:'SelfSubjectAccessReview',spec:{resourceAttributes:{verb,group:'',resource:'configmaps',namespace,name}}});if(access.status?.allowed!==true||access.status.denied||access.status.evaluationError)throw fail(403);}authorized=true;writeAuthorized=write;return{userId};},
  readCatalog(){allowed();return call(base+catalogName).then(object=>{if(pins.catalogUid)pinnedMap(object,{namespace},catalogName,pins.catalogUid);return object;});},
  async readRegistry(){allowed();if(!pins.bindingUid)throw fail(503);return pinnedMap(await call(base+registryName),{namespace},registryName,pins.bindingUid);},
  async readController(){allowed();if(!pins.controllerUid)throw fail(503);await grant({verb:'get',group:'',resource:'configmaps',namespace,name:'dns-manager-observations'});return pinnedMap(await call(base+'dns-manager-observations'),{namespace},'dns-manager-observations',pins.controllerUid);},
  async readSourceProposals(){
   const before=await proposalIdentities(),proposals=[];
   for(const identity of before){await grant({verb:'get',group:'',resource:'configmaps',namespace:'cattle-ui-plugin-system',name:identity.name});const object=pinnedMap(await call('/api/v1/namespaces/cattle-ui-plugin-system/configmaps/'+identity.name),{namespace:'cattle-ui-plugin-system'},identity.name,identity.uid);if(object.metadata.resourceVersion!==identity.resourceVersion)throw fail(409);let state;try{state=JSON.parse(object.data['state.json']);}catch{throw fail(409);}if(state?.version!==1||!Array.isArray(state.drafts)||state.drafts.length>1000)throw fail(409);proposals.push({ownerId:identity.name.slice('dns-manager-state-'.length),drafts:state.drafts});}
   if(JSON.stringify(before)!==JSON.stringify(await proposalIdentities()))throw fail(409);return proposals;
  },
  async replaceCatalog(object,{dryRun=true}={}){allowed();if(!writeAuthorized||typeof dryRun!=='boolean'||object?.apiVersion!=='v1'||object.kind!=='ConfigMap'||object.metadata?.name!==catalogName||object.metadata.namespace!==namespace||!object.metadata.uid||typeof object.metadata.resourceVersion!=='string'||object.metadata.deletionTimestamp)throw fail(403);let value;try{value=JSON.parse(object.data['sources.json']);validateDnsSourceCatalog(value,registry);}catch{throw fail(400);}return call(base+catalogName+(dryRun?'?dryRun=All':''),'PUT',object);},
  async authorizeBinding(id){const value=binding(id);for(const name of [value.observationName,value.queueName]){const access=await call('/apis/authorization.k8s.io/v1/selfsubjectaccessreviews','POST',{apiVersion:'authorization.k8s.io/v1',kind:'SelfSubjectAccessReview',spec:{resourceAttributes:{verb:'get',group:'',resource:'configmaps',namespace:value.namespace,name}}});if(access.status?.allowed!==true||access.status.denied||access.status.evaluationError)throw fail(403);}return value;},
  async readObservation(id){const value=await this.authorizeBinding(id),object=await call(`/api/v1/namespaces/${value.namespace}/configmaps/${value.observationName}`);return pinnedMap(object,value,value.observationName,value.observationUid);},
  async readQueue(id){const value=await this.authorizeBinding(id),object=await call(`/api/v1/namespaces/${value.namespace}/configmaps/${value.queueName}`);return pinnedMap(object,value,value.queueName,value.queueUid);}
 };
}
