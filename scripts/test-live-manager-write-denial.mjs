// Simulate permission loss after inventory loads using an existing service account.
// The wrapper refuses every actual resource write, even if validation regresses.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {createLiveNetworkSource} from '../live-management/rancher-network.mjs';
const base='http://127.0.0.1:15888',identity='system:serviceaccount:manager-system:network-manager-snapshots';let restricted=false;const attempts=[];
const cmPath='/api/v1/namespaces/cattle-ui-plugin-system/configmaps/network-manager-state-user-jccb4';
async function read(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json();}
const before=await read(cmPath),service=await read('/api/v1/namespaces/manager-acceptance/services/protocol-fixture');
const source=createLiveNetworkSource('local',async(url,init={})=>{
 const path=url.replace('/k8s/clusters/local','');
 if(restricted){assert.equal(path,cmPath+'?dryRun=All','State preflight must happen before resource operations');assert.equal(init.method,'PUT');attempts.push({path,method:init.method});}
 else assert.equal(init.method,undefined);
 const r=await fetch(base+path,{...init,headers:{...init.headers,...(restricted?{'Impersonate-User':identity}:{})},signal:AbortSignal.timeout(15000)});
 if(restricted){assert.equal(r.status,403);const status=await r.clone().json();assert.ok(status.message.includes(identity));assert.ok(status.message.includes('cannot update resource'));}
 return r;
},'user-jccb4');await source.reload();restricted=true;
await assert.rejects(source.stageChanges([{name:'State persistence permission check',resources:[{apiVersion:'v1',kind:'Service',metadata:{name:service.metadata.name,namespace:service.metadata.namespace,uid:service.metadata.uid,resourceVersion:service.metadata.resourceVersion},spec:service.spec}]}]),/403/);
const after=await read(cmPath),confirmed=await read('/api/v1/namespaces/manager-acceptance/services/protocol-fixture');assert.equal(after.metadata.resourceVersion,before.metadata.resourceVersion);assert.equal(after.data['state.json'],before.data['state.json']);assert.equal(confirmed.metadata.resourceVersion,service.metadata.resourceVersion);
const report={observedAt:new Date().toISOString(),identity,stateUpdateForbidden:true,validationAttempts:attempts.length,resourceWrites:0,ownerStatePreserved:true,servicePreserved:true,passed:true};fs.writeFileSync('.local/manager-installation/live-manager-write-denial-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
