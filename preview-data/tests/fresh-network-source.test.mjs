import test from 'node:test';import assert from 'node:assert/strict';import {freshNetworkSnapshot,networkCapturePaths} from '../fresh-network-source.mjs';
process.env.SNAPSHOT_NETWORK_STATE_CONFIGMAP='network-manager-state-owner';
const saved={configuration:{id:'old',name:'Old saved scope'},routeManifests:[{kind:'IngressRoute',metadata:{name:'deleted',namespace:'demo'}}],pendingChanges:[{name:'unapplied'}],snapshotScope:{namespace:'demo',source:'Authenticated Kubernetes inventory and saved manager configuration'}};
const state={portConfigurations:[{id:'current',name:'Current saved configuration',ports:[]}],managerCatalogVersion:1,publications:[],connectionDrafts:[]};
const read=async path=>{if(path.includes('configmaps'))return {data:{'state.json':JSON.stringify(state)}};const key=Object.entries(networkCapturePaths).find(([,p])=>p===path)[0];const kind={services:'Service',ingresses:'Ingress',certificates:'Certificate',issuers:'Issuer',clusterissuers:'ClusterIssuer',ingressroutes:'IngressRoute',ingressroutetcps:'IngressRouteTCP',ingressrouteudps:'IngressRouteUDP',middlewares:'Middleware',serverstransports:'ServersTransport'}[key];return {apiVersion:kind==='Service'?'v1':'traefik.io/v1alpha1',kind:kind+'List',items:key==='ingressroutes'?[{metadata:{name:'new-route',namespace:'demo'},spec:{entryPoints:['web'],routes:[]}},{metadata:{name:'other-namespace',namespace:'other'},spec:{entryPoints:['web'],routes:[]}}]:[]};};
test('unattended network capture replaces frozen routes and configuration from fresh named observations, with namespace isolation',async()=>{const {current}=await freshNetworkSnapshot(saved,read);assert.equal(current.configuration.name,state.portConfigurations[0].name);assert.deepEqual(current.routeManifests.map(r=>r.metadata.name),['new-route']);assert.deepEqual(current.pendingChanges,[]);assert.equal(saved.routeManifests[0].metadata.name,'deleted');});
test('fresh capture includes global and scoped same-name issuers without importing another namespace',async()=>{
 const scopedRead=async path=>{
  if(path===networkCapturePaths.clusterissuers)return {apiVersion:'cert-manager.io/v1',kind:'ClusterIssuerList',items:[{metadata:{name:'shared'},spec:{selfSigned:{}}}]};
  if(path===networkCapturePaths.issuers)return {apiVersion:'cert-manager.io/v1',kind:'IssuerList',items:['demo','other'].map(namespace=>({metadata:{name:'shared',namespace},spec:{ca:{secretName:'ca'}}}))};
  return read(path);
 };
 const scoped=(await freshNetworkSnapshot(saved,scopedRead)).current.issuerProfiles;
 assert.deepEqual(scoped.map(p=>[p.manifest.kind,p.manifest.metadata.namespace||'',p.name]),[['ClusterIssuer','','shared'],['Issuer','demo','shared']]);
 const all=(await freshNetworkSnapshot({...saved,snapshotScope:{...saved.snapshotScope,namespace:''}},scopedRead)).current.issuerProfiles;
 assert.equal(all.length,3);
});
test('denied/partial reads, preview scopes and stale captured credentials fail closed',async()=>{await assert.rejects(freshNetworkSnapshot(saved,async()=>{throw new Error('Forbidden');}),/Forbidden/);await assert.rejects(freshNetworkSnapshot(saved,async path=>path===networkCapturePaths.services?{items:[]}:read(path)),e=>e.code==='FRESH_SOURCE_UNAVAILABLE');await assert.rejects(freshNetworkSnapshot({...saved,snapshotScope:{...saved.snapshotScope,source:'Preview'}},read));await assert.rejects(freshNetworkSnapshot({...saved,routeManifests:[{kind:'Secret',data:{token:'cached'},metadata:{name:'cached'}}]},read),/credential capture is not authorized/);});
const secretPath='/api/v1/namespaces/demo/secrets/live-tls';
function protectedRead(secretReader){return async path=>{
 if(path===networkCapturePaths.certificates)return {apiVersion:'cert-manager.io/v1',kind:'CertificateList',items:['demo','other'].map(namespace=>({metadata:{name:'live-cert',namespace},spec:{secretName:'live-tls',dnsNames:['example.invalid'],issuerRef:{name:'selfsigned',kind:'Issuer'}}}))};
 if(path.includes('/secrets/'))return secretReader(path);
 return read(path);
};}
test('protected unattended capture reads only fresh scoped referenced Secrets and sees rotation without source resaving',async()=>{
 let value='Zmlyc3Q=',reads=[];
 const source=protectedRead(async path=>{reads.push(path);return {apiVersion:'v1',kind:'Secret',metadata:{namespace:'demo',name:'live-tls',annotations:{cached:'never-copy'}},type:'kubernetes.io/tls',data:{'tls.crt':value,'tls.key':'c3ludGhldGlj'}};});
 const template={...saved,routeManifests:[...saved.routeManifests,{kind:'Certificate',metadata:{name:'injected',namespace:'foreign'},spec:{secretName:'unrelated-secret'}}]};
 const first=(await freshNetworkSnapshot(template,source,0,{includeSecrets:true})).current;
 value='cm90YXRlZA==';const second=(await freshNetworkSnapshot(template,source,1000,{includeSecrets:true})).current;
 assert.deepEqual(reads,[secretPath,secretPath]);assert.equal(first.routeManifests.find(r=>r.kind==='Secret').data['tls.crt'],'Zmlyc3Q=');assert.equal(second.routeManifests.find(r=>r.kind==='Secret').data['tls.crt'],value);assert.equal(second.routeManifests.find(r=>r.kind==='Secret').metadata.annotations,undefined);assert.equal(second.secretBackup.complete,true);assert.equal(second.secretBackup.capturedAt,new Date(1000).toISOString());
});
test('unprotected unattended capture never requests Secret values',async()=>{
 const current=(await freshNetworkSnapshot(saved,protectedRead(()=>{throw new Error('must not read Secrets');}))).current;
 assert.ok(!current.routeManifests.some(r=>r.kind==='Secret'&&r.data));assert.equal(current.secretBackup.complete,false);
});
test('protected capture rejects denied, missing, malformed and mismatched Secret observations without cached fallback',async()=>{
 for(const value of [null,{apiVersion:'v1',kind:'Secret',metadata:{name:'wrong',namespace:'demo'},data:{}},{apiVersion:'v1',kind:'Secret',metadata:{name:'live-tls',namespace:'other'},data:{}},{apiVersion:'v1',kind:'Secret',metadata:{name:'live-tls',namespace:'demo'},data:{token:1}}])await assert.rejects(freshNetworkSnapshot(saved,protectedRead(()=>value),0,{includeSecrets:true}),/incomplete or mismatched/);
 await assert.rejects(freshNetworkSnapshot(saved,protectedRead(()=>{throw new Error('Forbidden');}),0,{includeSecrets:true}),/named Secret read permissions/);
 const cached={...saved,routeManifests:[{kind:'Secret',metadata:{name:'live-tls',namespace:'demo'},data:{token:'cached'}}]};await assert.rejects(freshNetworkSnapshot(cached,protectedRead(()=>{throw new Error('Forbidden');}),0,{includeSecrets:true}),/credential capture is not authorized/);
});
