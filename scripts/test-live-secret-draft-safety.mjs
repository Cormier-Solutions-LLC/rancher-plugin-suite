import fs from 'node:fs';import assert from 'node:assert/strict';import {randomUUID,randomBytes} from 'node:crypto';import {createLiveNetworkSource} from '../live-management/rancher-network.mjs';
const base='http://127.0.0.1:15888',user='user-safety-'+randomUUID().slice(0,8),path='/api/v1/namespaces/cattle-ui-plugin-system/configmaps/network-manager-state-'+user,results=[];
const request=(url,init)=>fetch(base+url.replace('/k8s/clusters/local',''),{...init,signal:AbortSignal.timeout(15000)}),source=createLiveNetworkSource('local',request,user),value=randomBytes(24).toString('base64');
const secret={apiVersion:'v1',kind:'Secret',metadata:{name:'synthetic-draft-only',namespace:'manager-acceptance',annotations:{'last-applied-acceptance':value}},data:{token:value}},change={id:'restore:synthetic',name:'Synthetic credential restore',namespace:'manager-acceptance',category:'Restore Secret',resources:[secret],configuration:{restoreSecretConfirmed:true}};
const existing=await fetch(base+path);assert.equal(existing.status,404,'Do not modify an existing manager state.');let created=false;
try{
 await source.reload();await source.saveState({portConfigurations:[],pendingChanges:[change],runningProcesses:[{resources:[secret]}]});created=true;
 const response=await fetch(base+path);assert.equal(response.status,200);const cm=await response.json();assert.equal(cm.data['state.json'].includes(value),false);const saved=JSON.parse(cm.data['state.json']);assert.equal(saved.pendingChanges[0].requiresSecretUnlock,true);assert.equal(saved.pendingChanges[0].resources[0].data,undefined);assert.equal(saved.runningProcesses[0].resources[0].metadata.annotations,undefined);
 const restarted=createLiveNetworkSource('local',request,user);await restarted.reload();assert.equal(restarted.loadState().pendingChanges[0].requiresSecretUnlock,true);await assert.rejects(restarted.stageChanges(restarted.loadState().pendingChanges),/Unlock the encrypted backup/);
 assert.equal(source.loadState().pendingChanges[0].resources[0].data.token,value);results.push({check:'Live Kubernetes draft storage excludes Secret values and annotations; source reload requires encrypted backup unlock; active unlocked memory retains payload',passed:true});console.log('Live Secret draft persistence and reload safety passed; no Secret was created.');
}finally{
 if(created){const cm=await(await fetch(base+path)).json();const removed=await fetch(base+path,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiVersion:'v1',kind:'DeleteOptions',preconditions:{uid:cm.metadata.uid,resourceVersion:cm.metadata.resourceVersion}})});assert.ok(removed.ok);}
 fs.writeFileSync('.local/manager-installation/secret-draft-safety-live-tests.json',JSON.stringify({user,results},null,2));
}
