import test from 'node:test';import assert from 'node:assert/strict';import {prepareCatalogOperations,verifyCatalogOperations} from '../catalog-operations.mjs';import {createLiveNetworkSource} from '../rancher-network.mjs';
const config={id:'catalog-test',name:'Test web',namespace:'demo',ports:[{label:'HTTP',port:80,mode:'HTTP'}],revision:1},change={name:'Test web',resources:[],configuration:config};
const ownedIssuer={apiVersion:'cert-manager.io/v1',kind:'ClusterIssuer',metadata:{name:'owned-issuer',uid:'issuer-uid',resourceVersion:'7'},spec:{acme:{privateKeySecretRef:{name:'owned-account'}}}};
const ownedProfile={name:'owned-issuer',source:'Local draft',environment:'staging',challenge:'http01',manifest:ownedIssuer};
const issuerDeletion={name:'owned-issuer',resources:[ownedIssuer],configuration:{operation:'Delete',secretPreserved:true,issuerProfileTarget:ownedProfile}};
test('issuer removal checks the reviewed profile, target identity, duplicate and pending certificate dependencies',()=>{
 const other={...ownedProfile,name:'other',manifest:{...ownedIssuer,metadata:{name:'other'}}},state={issuerProfiles:[ownedProfile,other],portConfigurations:[config]};
 const removed=prepareCatalogOperations([issuerDeletion],state,['demo']);assert.deepEqual(removed.next.issuerProfiles,[other]);assert.deepEqual(state.issuerProfiles,[ownedProfile,other]);verifyCatalogOperations(removed.operations,removed.next);assert.equal(removed.operations[0].entity,'IssuerProfile');assert.throws(()=>verifyCatalogOperations(removed.operations,state),/readback/);
 assert.throws(()=>prepareCatalogOperations([issuerDeletion,issuerDeletion],state,['demo']),/duplicate/);
 assert.throws(()=>prepareCatalogOperations([{...issuerDeletion,configuration:{...issuerDeletion.configuration,issuerProfileTarget:{...ownedProfile,environment:'production'}}}],state,['demo']),/changed/);
 assert.throws(()=>prepareCatalogOperations([{...issuerDeletion,resources:[{...ownedIssuer,metadata:{name:'other',uid:'other',resourceVersion:'7'}}]}],state,['demo']),/match/);
 assert.throws(()=>prepareCatalogOperations([issuerDeletion],{...state,pendingChanges:[{resources:[{apiVersion:'cert-manager.io/v1',kind:'Certificate',metadata:{name:'pending',namespace:'demo'},spec:{issuerRef:{name:ownedProfile.name,kind:'ClusterIssuer'}}}]}]},['demo']),/pending certificates/);
});
test('live issuer deletion confirms absence then removes only its saved profile, with both readback receipts and no Secret calls',async()=>{
 let state={managerCatalogVersion:1,portConfigurations:[config],issuerProfiles:[ownedProfile]},revision='1',deleted=false;const writes=[];
 const source=createLiveNetworkSource('local',async(url,init={})=>{
  if(url.includes('/secrets'))assert.fail('Credential values or objects must remain untouched');
  if(url.includes('/configmaps/')){if(url.endsWith('?dryRun=All')){assert.equal(deleted,false);writes.push('state-validation');return {ok:true,status:200,json:async()=>JSON.parse(init.body)};}if(init.method){assert.equal(deleted,true);writes.push('state');state=JSON.parse(JSON.parse(init.body).data['state.json']);revision='2';}return {ok:true,status:200,json:async()=>({metadata:{resourceVersion:revision},data:{'state.json':JSON.stringify(state)}})};}
  if(url.endsWith('/clusterissuers/owned-issuer')||url.includes('/clusterissuers/owned-issuer?')){
   if(init.method){const options=JSON.parse(init.body);assert.equal(options.propagationPolicy,'Orphan');writes.push(options.dryRun?'dry-run':'delete');if(!options.dryRun)deleted=true;return {ok:true,status:200,json:async()=>({})};}
   return deleted?{ok:false,status:404}:{ok:true,status:200,json:async()=>ownedIssuer};
  }
  assert.equal(init.method,undefined);
  const cluster=url.endsWith('/clusterissuers');return {ok:true,status:200,json:async()=>({apiVersion:cluster?'cert-manager.io/v1':'v1',kind:cluster?'ClusterIssuerList':'List',items:cluster?(deleted?[]:[ownedIssuer]):url.endsWith('/namespaces')?[{metadata:{name:'demo'}}]:[]})};
 },'user-test');await source.reload();assert.deepEqual(source.issuerReferences(ownedIssuer),[]);
 const result=await source.stageChanges([issuerDeletion]);assert.deepEqual(writes,['state-validation','dry-run','delete','state']);assert.equal(result.applied[0].readBack,true);assert.equal(result.catalog[0].readBack,true);assert.deepEqual(state.issuerProfiles,[]);assert.deepEqual(state.portConfigurations,[config]);
 const reloaded=await source.reload();assert.deepEqual(reloaded.data.state.issuerProfiles,[]);
});
test('local profile removal requires authoritative issuer absence and preserves every Kubernetes resource',async()=>{
 for(const status of [200,403,404]){
  let state={managerCatalogVersion:1,issuerProfiles:[ownedProfile]},writes=0;
  const source=createLiveNetworkSource('local',async(url,init={})=>{
   if(url.includes('/configmaps/')){if(url.endsWith('?dryRun=All'))return {ok:true,status:200,json:async()=>JSON.parse(init.body)};if(init.method){writes++;state=JSON.parse(JSON.parse(init.body).data['state.json']);}return {ok:true,status:200,json:async()=>({metadata:{resourceVersion:String(writes+1)},data:{'state.json':JSON.stringify(state)}})};}
   assert.equal(init.method,undefined);
   if(url.endsWith('/clusterissuers/owned-issuer'))return {ok:status===200,status,json:async()=>ownedIssuer};
   return {ok:true,status:200,json:async()=>({apiVersion:'v1',kind:'List',items:[]})};
  },'user-test');await source.reload();const removal={...issuerDeletion,resources:[],configuration:{operation:'RemoveIssuerProfile',issuerProfileTarget:ownedProfile}};
  if(status===404){const result=await source.stageChanges([removal]);assert.equal(result.applied.length,0);assert.equal(result.catalog[0].readBack,true);assert.equal(writes,1);}else{await assert.rejects(source.stageChanges([removal]),/exists|403/);assert.equal(writes,0);assert.equal(state.issuerProfiles.length,1);}
 }
});
test('reviewed publication draft removal preserves deployed resource specifications and other drafts',()=>{
 const target={name:'owned',namespace:'demo',configurationIds:['catalog-test'],resources:[{apiVersion:'traefik.io/v1alpha1',kind:'IngressRouteUDP',metadata:{name:'owned',namespace:'demo'}}]},other={...target,namespace:'other'};
 const state={portConfigurations:[config],publications:[target,other]},removal={resources:[],configuration:{operation:'DeletePublicationDraft',target}};
 const removed=prepareCatalogOperations([removal],state,['demo','other']);assert.deepEqual(removed.next.publications,[other]);assert.deepEqual(state.publications,[target,other]);assert.deepEqual(removed.next.portConfigurations,[config]);verifyCatalogOperations(removed.operations,removed.next);
 assert.throws(()=>prepareCatalogOperations([{...removal,configuration:{...removal.configuration,target:{...target,configurationIds:[]}}}],state,['demo']),/changed/);
 assert.throws(()=>prepareCatalogOperations([removal,removal],state,['demo']),/duplicate/);
 assert.throws(()=>verifyCatalogOperations(removed.operations,state),/readback/);
});
test('publication removal writes only owner state and records confirmed readback without touching routes',async()=>{
 const target={name:'owned',namespace:'demo',configurationIds:['catalog-test'],resources:[{apiVersion:'traefik.io/v1alpha1',kind:'IngressRouteUDP',metadata:{name:'owned',namespace:'demo'}}]};
 let state={managerCatalogVersion:1,portConfigurations:[config],publications:[target]},revision='1',writes=[];
 const source=createLiveNetworkSource('local',async(url,init={})=>{
  if(url.includes('/configmaps/')){if(url.endsWith('?dryRun=All'))return {ok:true,status:200,json:async()=>JSON.parse(init.body)};if(init.method){writes.push(url);state=JSON.parse(JSON.parse(init.body).data['state.json']);revision='2';}return {ok:true,status:200,json:async()=>({metadata:{resourceVersion:revision},data:{'state.json':JSON.stringify(state)}})};}
  assert.equal(init.method,undefined);return {ok:true,status:200,json:async()=>({apiVersion:'v1',kind:'List',items:url.endsWith('/namespaces')?[{metadata:{name:'demo'}}]:[]})};
 },'user-test');await source.reload();
 const result=await source.stageChanges([{resources:[],configuration:{operation:'DeletePublicationDraft',target}}]);assert.equal(writes.length,1);assert.match(writes[0],/network-manager-state-user-test$/);assert.equal(result.applied.length,0);assert.equal(result.catalog[0].entity,'PublicationDraft');assert.equal(result.catalog[0].readBack,true);assert.deepEqual(state.publications,[]);
 await assert.rejects(source.stageChanges([{resources:target.resources,configuration:{operation:'DeletePublicationDraft',target}}]),/preserve/);assert.equal(writes.length,1);
});
test('catalog creates, edits and deletes preserve scope, enforce dependencies and verify saved metadata',()=>{
 const first=prepareCatalogOperations([change],{portConfigurations:[],publications:[]},['demo']);assert.equal(first.next.portConfigurations[0].source,'Saved catalog configuration');verifyCatalogOperations(first.operations,first.next);
 const edited=prepareCatalogOperations([{...change,configuration:{...config,name:'Edited',revision:2}}],first.next,['demo']);assert.equal(edited.next.portConfigurations[0].name,'Edited');
 const deletion={name:'Delete edited',resources:[],configuration:{operation:'Delete',target:edited.next.portConfigurations[0]}};assert.throws(()=>prepareCatalogOperations([deletion],{...edited.next,publications:[{configurationIds:[config.id]}]},['demo']),/still used/);
 const removed=prepareCatalogOperations([deletion],edited.next,['demo']);assert.equal(removed.next.portConfigurations.length,0);verifyCatalogOperations(removed.operations,removed.next);
 assert.throws(()=>prepareCatalogOperations([{...change,configuration:{...config,namespace:'other'}}],first.next,['demo','other']),/namespace scope/);
 assert.throws(()=>prepareCatalogOperations([{...change,configuration:{...config,ports:[{label:'UDP',port:80,mode:'UDP',action:'forward',targetLabel:'HTTP'},...config.ports]}}],first.next,['demo']),/convert TCP/);
});
test('catalog validation prevents unrelated Kubernetes writes in a mixed batch',async()=>{
 let writes=0;const source=createLiveNetworkSource('local',async(url,init)=>{if(init?.method){writes++;throw new Error('Unexpected mutation');}if(url.includes('/configmaps/'))return {ok:false,status:404};return {ok:true,status:200,json:async()=>({apiVersion:'v1',kind:'List',items:[]})};},'user-test');await source.reload();
 await assert.rejects(source.stageChanges([{...change,configuration:{...config,ports:[{label:'Bad',port:0,mode:'HTTP'}]}},{name:'Unrelated resource',resources:[{apiVersion:'v1',kind:'Service',metadata:{name:'unrelated',namespace:'demo'},spec:{ports:[{port:80}]}}]}]),/Invalid/);assert.equal(writes,0);
});
