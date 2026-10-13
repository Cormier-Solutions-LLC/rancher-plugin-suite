import fs from 'node:fs';import assert from 'node:assert/strict';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {createLiveNetworkSource} from '../live-management/rancher-network.mjs';import {resourcePath} from '../live-management/kubernetes-apply.mjs';
import {selectSnapshotItems} from '../simple-network-manager-dev/pkg/simple-network-manager/config/snapshot-items.mjs';import {resourceCoverageId} from '../simple-network-manager-dev/pkg/simple-network-manager/config/snapshot-coverage.mjs';import {restorationManifest} from '../simple-network-manager-dev/pkg/simple-network-manager/config/restoration-manifest.mjs';
const run=promisify(execFile),base='http://127.0.0.1:15888',ns='manager-acceptance',results=[],source=createLiveNetworkSource('local',(url,init)=>fetch(base+url.replace('/k8s/clusters/local',''),{...init,signal:AbortSignal.timeout(15000)}),'user-jccb4');
async function call(path,init){const r=await fetch(base+path,{...init,signal:AbortSignal.timeout(15000)});assert.ok(r.ok,'Kubernetes '+r.status);return r.json();}
const routePath='/apis/traefik.io/v1alpha1/namespaces/'+ns+'/ingressroutes/manager-acceptance-http-80',udpPath='/apis/traefik.io/v1alpha1/namespaces/'+ns+'/ingressrouteudps/manager-protocols-udp-15002',snapshotPath='/api/v1/namespaces/manager-system/services/http:network-manager-snapshots:8080/proxy/api/snapshots';
async function snapshot(resources,label){return call(snapshotPath,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://rancher.cormierconsulting.io'},body:JSON.stringify({current:{configuration:{id:'acceptance',name:label,ports:[]},routeManifests:resources,snapshotScope:{namespace:ns,label:'Selective live restoration'}},scopeKey:'network-selective-restoration'})});}
async function apply(resources){await source.reload();return source.stageChanges([{name:'Selective restoration acceptance',resources}]);}
const original=await call(routePath),service=await call('/api/v1/namespaces/'+ns+'/services/protocol-fixture'),unrelated=await call(udpPath);let edited=false;
try{
 const saved=await snapshot([original,service,unrelated],'Before selective restoration');
 const edit=restorationManifest(original);edit.spec.routes[0].match='Host(`manager-acceptance.cormierconsulting.io`) && PathPrefix(`/selective`)';await apply([edit]);edited=true;
 const later=await call(udpPath);later.metadata.annotations={...later.metadata.annotations,'manager-acceptance/selective-unrelated':'preserve-newer-edit'};await call(udpPath,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(later)});
 const archive=await call(snapshotPath+'/'+saved.id),selection=selectSnapshotItems(archive.current,[resourceCoverageId(original)]);assert.deepEqual(selection.missing,[]);assert.ok(selection.items.some(i=>i.value.kind==='Service'));assert.ok(!selection.items.some(i=>i.value.kind==='IngressRouteUDP'));
 await snapshot([await call(routePath),await call(resourcePath(service))],'Before restoring selected items');const resources=selection.items.filter(i=>i.type==='resource').map(i=>restorationManifest(i.value));assert.ok(resources.every(r=>!r.metadata.resourceVersion&&!r.metadata.uid&&!r.status));
 const receipt=await apply(resources);assert.equal(receipt.applied.length,2);assert.ok(receipt.applied.every(r=>r.readBack));edited=false;
 assert.equal((await call(udpPath)).metadata.annotations['manager-acceptance/selective-unrelated'],'preserve-newer-edit');
 await new Promise(r=>setTimeout(r,2000));const traffic=await run('curl.exe',['--silent','--show-error','--max-time','15','--resolve','manager-acceptance.cormierconsulting.io:80:10.99.15.50','http://manager-acceptance.cormierconsulting.io/']);assert.equal(traffic.stdout.trim(),'manager-acceptance-v1');
 results.push({check:'Saved selection restores route and Service dependency through live adapter, preserves unrelated newer UDP edit, verifies API readback and actual HTTP traffic',passed:true,snapshot:saved.id});console.log('Live selective network restoration and unrelated-edit preservation passed.');
}finally{
 if(edited){await snapshot([await call(routePath),await call(resourcePath(service))],'Recover selective test route');await apply([restorationManifest(original)]);}
 const current=await call(udpPath);if(current.metadata.annotations?.['manager-acceptance/selective-unrelated']==='preserve-newer-edit'){delete current.metadata.annotations['manager-acceptance/selective-unrelated'];await call(udpPath,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(current)});}
 fs.writeFileSync('.local/manager-installation/network-selective-restore-live-tests.json',JSON.stringify(results,null,2));
}
