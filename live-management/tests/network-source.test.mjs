import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveNetworkSource, NETWORK_CACHE_INTERVAL_MS } from '../rancher-network.mjs';

test('automatic view refreshes use the 15-minute cache while manual refresh reads Kubernetes immediately',async()=>{
 let now=1_000,listReads=0,scheduled,automaticDocument;
 const ingress={metadata:{name:'cached-app',namespace:'test'},spec:{rules:[{host:'cached.example.test',http:{paths:[{backend:{service:{name:'app',port:{number:80}}}}]}}]}};
 const request=async url=>{
  if(url.includes('/configmaps/'))return {ok:false,status:404};
  listReads++;
  return {ok:true,status:200,json:async()=>url.endsWith('/ingresses')?{apiVersion:'networking.k8s.io/v1',kind:'IngressList',items:[ingress]}:{apiVersion:'v1',kind:'List',items:[]}};
 };
 const source=createLiveNetworkSource('cache-test',request,'cache-user',{now:()=>now,schedule:(fn,delay)=>{scheduled={fn,delay};return scheduled;},cancelSchedule:()=>{}});
 const initial=await source.reload({mode:'cache'}),initialReads=listReads;
 assert.equal(source.cachePolicy.refreshIntervalMs,NETWORK_CACHE_INTERVAL_MS);
 assert.equal(initial.cache.refreshIntervalMs,NETWORK_CACHE_INTERVAL_MS);
 assert.match(initial.source.label,/Cached Kubernetes/);
 ingress.spec.rules[0].host='updated.example.test';
 const cached=await source.reload({mode:'cache'});
 assert.equal(listReads,initialReads,'View refreshes must reuse the shared cache.');
 assert.match(JSON.stringify(cached.data.inventory),/cached\.example\.test/);
 assert.doesNotMatch(JSON.stringify(cached.data.inventory),/updated\.example\.test/);
 now=2_000;
 const manual=await source.reload();
 assert.equal(listReads,initialReads*2,'Manual refresh must reread every Kubernetes inventory endpoint.');
 assert.match(JSON.stringify(manual.data.inventory),/updated\.example\.test/);
 const stop=source.startCacheRefresh({onRefresh:document=>{automaticDocument=document;}});
 assert.equal(scheduled.delay,NETWORK_CACHE_INTERVAL_MS);
 ingress.spec.rules[0].host='automatic.example.test';now+=NETWORK_CACHE_INTERVAL_MS;
 const tick=scheduled.fn;await tick();
 assert.match(JSON.stringify(automaticDocument.data.inventory),/automatic\.example\.test/);
 assert.equal(listReads,initialReads*3,'The scheduled cache refresh must reread Kubernetes once every 15 minutes.');
 stop();
});
test('refresh imports namespaced issuers without replacing same-named global or local profiles',async()=>{
 const global={metadata:{name:'shared',uid:'global',resourceVersion:'1'},spec:{selfSigned:{}}};
 const namespaced=['one','two'].map(namespace=>({metadata:{name:'shared',namespace,uid:namespace,resourceVersion:'1'},spec:{selfSigned:{}}}));
 const source=createLiveNetworkSource('local',async(url,init={})=>{
  if(url.includes('/configmaps')){if(init.method)return {ok:true,status:200,json:async()=>({metadata:{resourceVersion:'2'}})};return {ok:false,status:404};}
  const list=url.endsWith('/clusterissuers')?{apiVersion:'cert-manager.io/v1',kind:'ClusterIssuerList',items:[global]}:url.endsWith('/issuers')?{apiVersion:'cert-manager.io/v1',kind:'IssuerList',items:namespaced}:{apiVersion:'v1',kind:'List',items:[]};
  return {ok:true,status:200,json:async()=>list};
 },'user-test');const initial=await source.reload();assert.equal(initial.data.state.issuerProfiles.length,3);
 const local=source.loadState();local.issuerProfiles[0].source='Local draft';local.issuerProfiles[0].manifest.spec={ca:{secretName:'unapplied'}};await source.saveState(local);
 namespaced[0].spec={ca:{secretName:'updated-ca'}};namespaced[0].metadata.resourceVersion='2';
 const refreshed=await source.reload(),profiles=refreshed.data.state.issuerProfiles;
 assert.equal(profiles.length,3);assert.equal(profiles[0].source,'Local draft');assert.equal(profiles[0].manifest.spec.ca.secretName,'unapplied');assert.equal(profiles[1].manifest.spec.ca.secretName,'updated-ca');assert.ok(profiles[2].manifest.spec.selfSigned);
 assert.deepEqual(source.reviewedResourceIdentity(profiles[1].manifest),{uid:'one',resourceVersion:'2'});
});
test('refresh updates observed issuer settings while preserving unapplied local edits',async()=>{
 const issuer={metadata:{name:'fresh-issuer',uid:'owned',resourceVersion:'1'},spec:{acme:{email:'test@example.com',server:'https://acme-staging-v02.api.letsencrypt.org/directory',privateKeySecretRef:{name:'account'},solvers:[{http01:{ingress:{ingressClassName:'traefik'}}}]}}};
 const source=createLiveNetworkSource('local',async(url,init={})=>{
  if(url.includes('/configmaps')){if(init.method)return {ok:true,status:200,json:async()=>({metadata:{resourceVersion:'2'}})};return {ok:false,status:404};}
  return {ok:true,status:200,json:async()=>url.endsWith('/clusterissuers')?{apiVersion:'cert-manager.io/v1',kind:'ClusterIssuerList',items:[issuer]}:{apiVersion:'v1',kind:'List',items:[]}};
 },'user-test');const initial=await source.reload();assert.equal(initial.data.state.issuerProfiles[0].settings.ingressClass,'traefik');
 issuer.spec.acme.solvers[0].http01.ingress.ingressClassName='updated-traefik';issuer.metadata.resourceVersion='2';const refreshed=await source.reload();assert.equal(refreshed.data.state.issuerProfiles[0].settings.ingressClass,'updated-traefik');
 const local=source.loadState();local.issuerProfiles[0].source='Local draft';local.issuerProfiles[0].settings.ingressClass='unapplied';await source.saveState(local);issuer.spec.acme.solvers[0].http01.ingress.ingressClassName='other';assert.equal((await source.reload()).data.state.issuerProfiles[0].settings.ingressClass,'unapplied');
});
test('managed deletion identity comes only from matching authenticated Certificate and issuer observations',async()=>{
 const certificate={metadata:{name:'owned',namespace:'demo',uid:'cert-uid',resourceVersion:'7'},spec:{secretName:'owned-tls',dnsNames:['owned.example.com'],issuerRef:{name:'issuer',kind:'ClusterIssuer'}}},issuer={metadata:{name:'issuer',uid:'issuer-uid',resourceVersion:'8'},spec:{selfSigned:{}}};
 const source=createLiveNetworkSource('local',async url=>{
  if(url.includes('/configmaps/'))return {ok:false,status:404};
  const list=url.endsWith('/certificates')?{apiVersion:'cert-manager.io/v1',kind:'CertificateList',items:[certificate]}:url.endsWith('/clusterissuers')?{apiVersion:'cert-manager.io/v1',kind:'ClusterIssuerList',items:[issuer]}:{apiVersion:'v1',kind:'List',items:[]};
  return {ok:true,status:200,json:async()=>list};
 },'user-test');const doc=await source.reload(),projected=doc.data.inventory['certificate-resources-snapshot.json'].resources[0];
 assert.equal(projected.metadata.uid,undefined);assert.deepEqual(source.reviewedResourceIdentity(projected),{uid:'cert-uid',resourceVersion:'7'});
 source.reviewedResourceIdentity(projected).uid='edited';assert.equal(source.reviewedResourceIdentity(projected).uid,'cert-uid');
 assert.equal(source.reviewedRouteIdentity(projected),undefined);assert.equal(source.reviewedResourceIdentity({...projected,metadata:{...projected.metadata,namespace:'another'}}),undefined);
 assert.deepEqual(source.reviewedResourceIdentity({apiVersion:'cert-manager.io/v1',kind:'ClusterIssuer',metadata:{name:'issuer'}}),{uid:'issuer-uid',resourceVersion:'8'});
 assert.equal(source.reviewedResourceIdentity({apiVersion:'v1',kind:'Secret',metadata:{name:'owned',namespace:'demo'}}),undefined);
});
test('Kubernetes list members acquire their resource identity and expose published listener ports', async () => {
 const responses = {
  '/apis/networking.k8s.io/v1/ingresses': { apiVersion:'networking.k8s.io/v1',kind:'IngressList',items:[{metadata:{name:'app',namespace:'test'},spec:{rules:[{host:'test.invalid',http:{paths:[{backend:{service:{name:'app',port:{number:80}}}}]}}]}}] },
  '/api/v1/services': {apiVersion:'v1',kind:'ServiceList',items:[{metadata:{name:'traefik',namespace:'traefik-system'},spec:{selector:{app:'traefik'},type:'LoadBalancer',ports:[{name:'web',targetPort:'web',port:80},{name:'manager-test-tc',targetPort:'manager-test-tc',port:15001}]}}]},
  '/apis/apps/v1/namespaces/traefik-system/deployments': {apiVersion:'apps/v1',kind:'DeploymentList',items:[{metadata:{name:'traefik',namespace:'traefik-system'},spec:{template:{metadata:{labels:{app:'traefik'}},spec:{containers:[{args:['--entrypoints.web.address=:8000/tcp','--entrypoints.manager-test-tcp.address=:15001/tcp'],ports:[{name:'manager-test-tc',containerPort:15001}]}]}}}}]},
 };
 let denied=false;
 const source=createLiveNetworkSource('local',async url => {
  const path=url.replace('/k8s/clusters/local','');
  if(path.includes('configmaps/')) return {ok:false,status:404};
  if(denied&&path.endsWith('/services'))return {ok:false,status:403};
  return {ok:true,status:200,json:async()=>responses[path]||{apiVersion:'v1',kind:'List',items:[]}};
 },'user-test');
 const doc=await source.reload();
 responses['/apis/networking.k8s.io/v1/ingresses'].items[0].metadata.uid='reviewed-route';
 responses['/apis/networking.k8s.io/v1/ingresses'].items[0].metadata.resourceVersion='19';
 const current=await source.reload();
 const projected=current.data.inventory['route-resources-snapshot.json'].resources.find(r=>r.kind==='Ingress');
 assert.equal(projected.metadata.uid,undefined,'Stable configuration snapshots omit live object versions.');
 assert.deepEqual(source.reviewedRouteIdentity(projected),{uid:'reviewed-route',resourceVersion:'19'});
 source.reviewedRouteIdentity(projected).uid='mutated-copy';
 assert.equal(source.reviewedRouteIdentity(projected).uid,'reviewed-route');
 assert.equal(source.reviewedRouteIdentity({...projected,metadata:{...projected.metadata,namespace:'other'}}),undefined);
 assert.equal(doc.data.inventory['route-details-snapshot.json'].routes[0].kind,'Ingress');
 assert.equal(doc.data.inventory['listener-snapshot.json'].entryPoints[0].port,80);
 assert.equal(doc.data.inventory['listener-snapshot.json'].entryPoints[1].exposed,true,'Chart-truncated container port names must map to the real listener');
 assert.equal(doc.data.state.portConfigurations.length,3);
 assert.ok(doc.data.state.portConfigurations.every(c=>c.source==='Predefined'));
 denied=true;await assert.rejects(source.reload(),/403/);
 assert.deepEqual(source.document,current,'Denied reads must retain the last confirmed inventory');
});
