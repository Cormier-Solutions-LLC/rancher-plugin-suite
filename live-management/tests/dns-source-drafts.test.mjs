import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {sourceRestoreDrafts} from '../dns-source-drafts.mjs';

const binding=(id,address)=>({id,host:`${id}.example.test`,address,credential:`Registered ${id}`,namespace:'dns-system',observationName:`${id}-observations`,observationUid:randomUUID(),queueName:`${id}-queue`,queueUid:randomUUID(),accountUid:randomUUID(),sourceDigest:'a'.repeat(64),writable:true});
const registry={version:1,bindings:[binding('dc-one','10.99.3.2'),binding('dc-two','10.99.3.3'),binding('dc-old','10.99.3.4')]};
const source=(id,bindingId,name=id,revision=1)=>{const owner=registry.bindings.find(item=>item.id===bindingId);return{id,name,type:'Windows Domain Controller',host:owner.host,address:owner.address,credential:owner.credential,bindingId,revision};};
const identity={catalogUid:randomUUID(),bindingUid:randomUUID(),bindingDigest:'b'.repeat(64),userId:'user-test'};
const current={version:1,revision:4,sources:[source('one','dc-one','Current One',3),source('obsolete','dc-old','Obsolete',2)]};
const saved={version:1,revision:1,sources:[source('one','dc-one','Saved One',1),source('two','dc-two','Saved Two',1)]};
const input=(overrides={})=>({configuration:{id:'sources/catalog',name:'DNS Sources',kind:'DnsSourceCatalog',namespace:'dns-system',dns:{catalog:saved}},snapshotScope:identity,restoreSnapshotId:randomUUID(),context:{...identity,registry,catalog:current},idFactory:randomUUID,...overrides});

test('catalog restoration stages one exact delete/update/create batch without restoring stale revision counters',()=>{
 const drafts=sourceRestoreDrafts(input());
 assert.deepEqual(drafts.map(d=>d.sourceChange.operation),['Delete','Update','Restore']);
 assert.deepEqual(drafts.map(d=>d.sourceChange.sourceId),['obsolete','one','two']);
 assert.equal(drafts.every(d=>d.kind==='source'&&d.id===d.sourceChange.id&&d.restoreSnapshotId),true);
 assert.equal(Object.hasOwn(drafts[1].sourceChange.value,'revision'),false);
 assert.equal(drafts[1].sourceChange.expected.revision,3);
 assert.equal(drafts[2].sourceChange.expected,null);
});

test('source restore rejects foreign identities, malformed snapshots, unregistered saved settings and no-op catalogs',()=>{
 for(const overrides of [
  {snapshotScope:{...identity,userId:'user-other'}},
  {snapshotScope:{...identity,bindingDigest:'c'.repeat(64)}},
  {restoreSnapshotId:'not-a-uuid'},
  {configuration:{id:'source/windows-dns',kind:'DnsSourceCatalog',namespace:'dns-system',dns:{catalog:saved}}},
  {configuration:{id:'sources/catalog',kind:'DnsSourceCatalog',namespace:'dns-system',dns:{catalog:{...saved,sources:[{...saved.sources[0],host:'foreign.example.test'}]}}}},
  {configuration:{id:'sources/catalog',kind:'DnsSourceCatalog',namespace:'dns-system',dns:{catalog:current}}}
 ])assert.throws(()=>sourceRestoreDrafts(input(overrides)));
});

test('an exact restore can reclaim a bridge from a source deleted by the same reviewed batch',()=>{
 const reclaim={version:1,revision:1,sources:[source('replacement','dc-old','Replacement')]};
 const drafts=sourceRestoreDrafts(input({configuration:{id:'sources/catalog',kind:'DnsSourceCatalog',namespace:'dns-system',dns:{catalog:reclaim}}}));
 assert.deepEqual(drafts.map(d=>[d.sourceChange.operation,d.sourceChange.sourceId]),[['Delete','one'],['Delete','obsolete'],['Restore','replacement']]);
});
