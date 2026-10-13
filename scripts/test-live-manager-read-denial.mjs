// Exercise existing identity permissions without creating credentials or RBAC.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {createLiveNetworkSource} from '../live-management/rancher-network.mjs';
const base='http://127.0.0.1:15888',identity='system:serviceaccount:manager-acceptance:default';let denied=false;const failures=[];
const source=createLiveNetworkSource('local',async(url,init={})=>{
 assert.equal(init.method,undefined,'Inventory checks must never mutate Kubernetes');
 const r=await fetch(base+url.replace('/k8s/clusters/local',''),{...init,headers:{...init.headers,...(denied?{'Impersonate-User':identity}:{})},signal:AbortSignal.timeout(15000)});
 if(denied){assert.equal(r.status,403);const status=await r.clone().json();assert.equal(status.reason,'Forbidden');assert.ok(status.message.includes(identity));assert.ok(!status.message.includes('cannot impersonate'),'An impersonation failure does not prove inventory authorization');failures.push({path:url,status:r.status});}
 return r;
},'user-jccb4');
const confirmed=await source.reload(),fingerprint=JSON.stringify(confirmed);denied=true;await assert.rejects(source.reload(),/Kubernetes 403/);assert.ok(JSON.stringify(source.document)===fingerprint,'Denied reads retain the last complete document');
assert.equal(failures.length,18);assert.ok(failures.some(f=>f.path.endsWith('/services')));assert.ok(failures.some(f=>f.path.endsWith('/issuers')));
denied=false;const restored=await source.reload();assert.ok(restored.data.state.issuerProfiles.length>=3);
const report={observedAt:new Date().toISOString(),identity,deniedReads:failures.length,lastConfirmedInventoryRetained:true,recoveredWithoutChanges:true,mutations:0,passed:true};fs.writeFileSync('.local/manager-installation/live-manager-read-denial-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
