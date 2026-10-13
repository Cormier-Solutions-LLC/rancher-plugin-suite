import test from 'node:test';import assert from 'node:assert/strict';
import {createLiveNetworkSource} from '../rancher-network.mjs';
const issuer={apiVersion:'cert-manager.io/v1',kind:'ClusterIssuer',metadata:{name:'permission-fixture',uid:'owned',resourceVersion:'7'},spec:{selfSigned:{}}};
const profile={name:issuer.metadata.name,source:'Local draft',manifest:issuer};
test('denied owner-state persistence prevents every Kubernetes mutation in a mixed issuer deletion',async()=>{
 const state={managerCatalogVersion:1,portConfigurations:[],issuerProfiles:[profile]},mutations=[];let deleted=false;
 const source=createLiveNetworkSource('local',async(url,init={})=>{
  if(url.includes('/configmaps/'))return init.method?{ok:false,status:403}:{ok:true,status:200,json:async()=>({metadata:{resourceVersion:'1'},data:{'state.json':JSON.stringify(state)}})};
  if(url.includes('/clusterissuers/permission-fixture')){
   if(init.method){const options=JSON.parse(init.body);if(!options.dryRun){deleted=true;mutations.push('issuer-delete');}return {ok:true,status:200,json:async()=>({})};}
   return deleted?{ok:false,status:404}:{ok:true,status:200,json:async()=>issuer};
  }
  assert.equal(init.method,undefined);const cluster=url.endsWith('/clusterissuers');return {ok:true,status:200,json:async()=>({apiVersion:cluster?'cert-manager.io/v1':'v1',kind:cluster?'ClusterIssuerList':'List',items:cluster?[issuer]:[]})};
 },'permission-test');await source.reload();
 await assert.rejects(source.stageChanges([{name:profile.name,resources:[issuer],configuration:{operation:'Delete',issuerProfileTarget:profile}}]),/403/);
 assert.deepEqual(mutations,[],'Catalog permission must be checked before deleting the Kubernetes issuer');
});
test('state create/update denial, conflicts, admission failure and altered validation prevent resource-only writes',async()=>{
 for(const exists of [false,true])for(const outcome of [403,409,422,500,'altered']){
  const attempts=[],state={managerCatalogVersion:1,portConfigurations:[],issuerProfiles:[]};
  const source=createLiveNetworkSource('local',async(url,init={})=>{
   if(url.includes('/configmaps')){
    if(!init.method)return exists?{ok:true,status:200,json:async()=>({metadata:{resourceVersion:'1'},data:{'state.json':JSON.stringify(state)}})}:{ok:false,status:404};
    attempts.push({method:init.method,dryRun:url.endsWith('?dryRun=All')});
    if(outcome==='altered'){const resource=JSON.parse(init.body);resource.data['state.json']='{}';return {ok:true,status:200,json:async()=>resource};}
    return {ok:false,status:outcome};
   }
   assert.equal(init.method,undefined,'No resource mutation may precede valid state persistence');return {ok:true,status:200,json:async()=>({apiVersion:'v1',kind:'List',items:[]})};
  },'permission-test');await source.reload();
  await assert.rejects(source.stageChanges([{name:'test',resources:[{apiVersion:'v1',kind:'Service',metadata:{name:'test',namespace:'demo'},spec:{ports:[{port:80}]}}]}]),outcome==='altered'?/validation differs/:new RegExp(String(outcome)));
  assert.deepEqual(attempts,[{method:exists?'PUT':'POST',dryRun:true}]);
 }
});
