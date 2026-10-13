import test from 'node:test';import assert from 'node:assert/strict';import {persistentManagerState} from '../safe-manager-state.mjs';import {validateChangeBatch} from '../../simple-network-manager-dev/pkg/simple-network-manager/config/change-batch.mjs';
import {createLiveNetworkSource} from '../rancher-network.mjs';
const secret={apiVersion:'v1',kind:'Secret',metadata:{name:'synthetic',namespace:'demo',annotations:{'kubectl.kubernetes.io/last-applied-configuration':'synthetic-sensitive-annotation'}},data:{token:Buffer.from('synthetic-private-value').toString('base64')}};
const change={id:'restore:secret',name:'Restore synthetic',namespace:'demo',category:'Restore Secret',resources:[secret],configuration:{restoreSecretConfirmed:true}};
test('persisted draft and process copies contain no Secret data or Secret annotations; reload is blocked until unlocking again',()=>{
 const original={pendingChanges:[change],runningProcesses:[{resources:[secret]}],publications:[{resources:[secret]}]},saved=persistentManagerState(original),json=JSON.stringify(saved);
 assert.equal(json.includes(secret.data.token),false);assert.equal(json.includes('synthetic-sensitive-annotation'),false);assert.equal(saved.pendingChanges[0].requiresSecretUnlock,true);assert.deepEqual(original.pendingChanges[0].resources[0],secret);
 assert.throws(()=>validateChangeBatch(saved.pendingChanges),/Unlock the encrypted backup/);assert.throws(()=>validateChangeBatch([{...change,resources:[{apiVersion:'v1',kind:'Secret',metadata:secret.metadata}]}]),/Unlock the encrypted backup/);
 assert.equal(validateChangeBatch([change])[0],change,'The current unlocked in-memory restoration remains available.');
});
test('actual live adapter saves only redacted state while preserving the active unlocked in-memory proposal',async()=>{
 let persisted;
 const source=createLiveNetworkSource('local',async(url,init)=>{if(init?.method&&init.method!=='GET'){persisted=JSON.parse(JSON.parse(init.body).data['state.json']);return {ok:true,status:200,json:async()=>({metadata:{resourceVersion:'2'}})};}if(url.includes('/configmaps/'))return {ok:false,status:404};return {ok:true,status:200,json:async()=>({apiVersion:'v1',kind:'List',items:[]})};},'user-test');
 await source.reload();await source.saveState({portConfigurations:[],pendingChanges:[change]});assert.equal(persisted.pendingChanges[0].requiresSecretUnlock,true);assert.equal(JSON.stringify(persisted).includes(secret.data.token),false);assert.equal(source.loadState().pendingChanges[0].resources[0].data.token,secret.data.token);
});
