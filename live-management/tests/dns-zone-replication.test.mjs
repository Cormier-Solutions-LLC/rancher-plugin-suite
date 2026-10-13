import test from 'node:test';import assert from 'node:assert/strict';
import {reconcileManagedZones} from '../dns-zone-replication.mjs';
const entry={name:'acceptance.example.invalid',ownerId:'owner',status:'Active'};
function fixture({existing=false,ownership={},lostCreate=false,lostDelete=false,source='10.99.3.2',type='Secondary'}={}){
 let present=existing;const writes=[],saved=[];
 const api=async(path,values)=>{
  if(path==='zones/list')return {zones:present?[{name:entry.name,type}]:[]};
  if(path==='zones/options/get')return {type,primaryZoneTransferProtocol:'Tcp',primaryNameServerAddresses:[source]};
  if(path==='zones/create'){writes.push({path,values});present=true;if(lostCreate)throw new Error('Disconnected create response');return {};}
  if(path==='zones/delete'){writes.push({path,values});present=false;if(lostDelete)throw new Error('Disconnected delete response');return {};}
  throw new Error('Unexpected API');
 };
 const reconcile=(entries=[entry])=>reconcileManagedZones({replica:0,entries,ownership,api,sourceAddress:'10.99.3.2',save:async()=>saved.push(structuredClone(ownership))});
 return {reconcile,ownership,writes,saved,setPresent:value=>present=value};
}
test('confirmed secondary creation persists intent and ownership; repeat reconciliation does not duplicate it',async()=>{
 const f=fixture();assert.equal((await f.reconcile())[0].status,'Present');assert.equal(f.writes.length,1);assert.equal(f.saved[0]['0/'+entry.name].status,'Creating');assert.equal(f.saved[1]['0/'+entry.name].status,'Active');
 assert.equal((await f.reconcile())[0].status,'Present');assert.equal(f.writes.length,1);
});
test('a pre-existing replica zone is never adopted or deleted',async()=>{
 const f=fixture({existing:true});assert.equal((await f.reconcile())[0].status,'NeedsReview');assert.equal((await f.reconcile([{...entry,status:'Deleted'}]))[0].status,'NeedsReview');assert.equal(f.writes.length,0);
});
test('unknown create outcome survives restart and does not authorize adoption, deletion or replay',async()=>{
 const f=fixture({lostCreate:true});assert.equal((await f.reconcile())[0].status,'NeedsReview');assert.equal(f.ownership['0/'+entry.name].status,'Creating');
 assert.equal((await f.reconcile())[0].status,'NeedsReview');assert.equal((await f.reconcile([{...entry,status:'Deleted'}]))[0].status,'NeedsReview');f.setPresent(false);assert.equal((await f.reconcile())[0].status,'NeedsReview');assert.equal(f.writes.length,1);
});
test('unknown delete outcome is recovered by absence; a still-present deletion is not replayed',async()=>{
 const ownership={['0/'+entry.name]:{ownerId:'owner',status:'Active'}};const f=fixture({existing:true,ownership,lostDelete:true});const deleted=[{...entry,status:'Deleted'}];
 assert.equal((await f.reconcile(deleted))[0].status,'NeedsReview');f.setPresent(true);assert.equal((await f.reconcile(deleted))[0].status,'NeedsReview');assert.equal(f.writes.length,1);
 f.setPresent(false);assert.equal((await f.reconcile(deleted))[0].status,'Absent');assert.equal(ownership['0/'+entry.name].status,'Deleted');assert.equal(f.writes.length,1);
 const recreated={...entry,ownerId:'new-owner'};assert.equal((await f.reconcile([recreated]))[0].status,'Present');assert.equal(ownership['0/'+entry.name].ownerId,'new-owner');
});
test('wrong ownership, primary endpoint or zone type cannot authorize deletion',async()=>{
 for(const options of [{source:'192.0.2.9'},{type:'Primary'},{}]){const f=fixture({existing:true,ownership:{['0/'+entry.name]:{ownerId:options.source||options.type?'owner':'foreign',status:'Active'}},...options});assert.equal((await f.reconcile([{...entry,status:'Deleted'}]))[0].status,'NeedsReview');assert.equal(f.writes.length,0);}
});
