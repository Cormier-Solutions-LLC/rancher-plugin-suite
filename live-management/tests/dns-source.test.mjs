import test from 'node:test';import assert from 'node:assert/strict';
import {createLiveDnsSource} from '../rancher-dns.mjs';
import {dnsOperations} from '../dns-operations.mjs';
import {zoneName,validateZoneRecovery} from '../dns-operations.mjs';
const zone='cormierconsulting.io';
const inventory=()=>({observedAt:new Date().toISOString(),source:{name:'domain02',managementReachable:true},zones:[{id:zone,name:zone,serial:'4'}],records:{[zone]:[{name:'fixture',type:'A',value:'192.0.2.1',ttl:5}]},replicas:[{reachable:true,zones:[{zone,serial:4}]}]});
function fixture({lostReply=false,jobs=[]}={}){
 let writes=0;const queue={metadata:{resourceVersion:'1'},data:{'jobs.json':JSON.stringify(jobs)}};
 const request=async(url,init={})=>{
  const path=url.replace('/k8s/clusters/local','');
  if(path.includes('dns-manager-state'))return {ok:false,status:404};
  let body;
  if(path.endsWith('dns-windows-queue')){
   if(init.method==='PUT'){writes++;Object.assign(queue,JSON.parse(init.body));const accepted=JSON.parse(queue.data['jobs.json']);accepted.at(-1).status='Applied';accepted.at(-1).receipts=[{readBack:true}];queue.data['jobs.json']=JSON.stringify(accepted);if(lostReply)throw new Error('Response disconnected');}
   body=queue;
  }else if(path.endsWith('dns-manager-observations'))body={metadata:{resourceVersion:'1'},data:{'inventory.json':JSON.stringify(inventory())}};
  else body={data:{'inventory.json':JSON.stringify({...inventory(),managementReachable:true})}};
  return {ok:true,status:200,json:async()=>structuredClone(body)};
 };
 return {source:createLiveDnsSource('local',request,'user-test'),writes:()=>writes,queue};
}
const changes=[{id:'draft',kind:'record',zone,name:'fixture',type:'A',value:'192.0.2.2',ttl:10,targetId:JSON.stringify(['fixture','A','192.0.2.1'])}];
test('a lost queue response recovers the same job without replaying the submission',async()=>{
 const f=fixture({lostReply:true});const doc=await f.source.reload();assert.equal(doc.source.label,'Live Windows DNS inventory');
 const result=await f.source.stageChanges({changes,snapshotId:'snapshot'});assert.equal(result.status,'Applied');assert.equal(f.writes(),1);
});
test('unresolved proposals cannot be submitted twice; old active jobs are retained',async()=>{
 const pending={id:'older-job',requestedBy:'user-test',draftIds:['draft'],status:'Running',createdAt:'2020-01-01T00:00:00Z'};
 const f=fixture({jobs:[pending]});await f.source.reload();await assert.rejects(f.source.stageChanges({changes,snapshotId:'snapshot'}),/requires reconciliation/);assert.equal(f.writes(),0);
 const other=fixture({jobs:[{...pending,requestedBy:'someone-else',draftIds:['other']}]});await other.source.reload();await other.source.stageChanges({changes,snapshotId:'snapshot'});assert.equal(JSON.parse(other.queue.data['jobs.json'])[0].id,pending.id);
});
test('selective DNS restore updates saved records and leaves unrelated newer records untouched',()=>{
 const current=inventory();current.records[zone].push({name:'unrelated',type:'TXT',value:'preserve',ttl:10});
 const result=dnsOperations([{kind:'restore',configuration:{kind:'DnsZone',dns:{zone:{name:zone},records:[{name:'fixture',type:'A',value:'192.0.2.5',ttl:15}]}}}],current);
 assert.equal(result.operations.length,1);assert.equal(result.operations[0].operation,'Update');assert.equal(result.operations[0].name,'fixture');
});
test('zone drafts reject malformed, duplicate and mismatched forward/reverse names',()=>{
 assert.equal(zoneName('Acceptance.Example.Invalid.','Forward'),'acceptance.example.invalid');
 assert.equal(zoneName('2.0.192.in-addr.arpa','Reverse'),'2.0.192.in-addr.arpa');
 assert.equal(zoneName('8.b.d.0.1.0.0.2.ip6.arpa','Reverse'),'8.b.d.0.1.0.0.2.ip6.arpa');
 for(const [name,kind] of [['-bad.invalid','Forward'],['a..invalid','Forward'],['256.0.192.in-addr.arpa','Reverse'],['02.0.192.in-addr.arpa','Reverse'],['example.invalid','Reverse'],['2.0.192.in-addr.arpa','Forward'],['8.b.ip6.arpa','Reverse'],['x'.repeat(64)+'.invalid','Forward']])assert.throws(()=>zoneName(name,kind));
 assert.throws(()=>dnsOperations([{kind:'zone',zone,type:'Forward'}],inventory()),/already exists/);
});
test('only manager-owned zones can be deleted, and a zone cannot mix destructive and record operations',()=>{
 const current=inventory();assert.throws(()=>dnsOperations([{kind:'delete',zone:'zones',items:[zone]}],current),/protected/);
 current.zones[0].managed=true;current.zones[0].ownerId='owner';
 const deletion={kind:'delete',zone:'zones',items:[zone]};const result=dnsOperations([deletion],current);assert.deepEqual(result.operations,[{zone,operation:'DeleteZone',ownerId:'owner'}]);assert.equal(result.serials[zone],'4');
 assert.throws(()=>dnsOperations([deletion,...changes],current),/Conflicting/);
 assert.throws(()=>dnsOperations([{kind:'zone',zone:'new.invalid',type:'Forward'},{kind:'zone',zone:'NEW.INVALID.',type:'Forward'}],current),/Conflicting/);
});
test('child-zone creation and owned delegation deletion include the parent revision',()=>{
 const current=inventory();const created=dnsOperations([{kind:'zone',zone:'child.'+zone,type:'Forward'}],current);assert.equal(created.operations[0].parentZone,zone);assert.equal(created.serials[zone],'4');
 const child={id:'child.'+zone,name:'child.'+zone,serial:'2',managed:true,ownerId:'owner',parentZone:zone,delegationRecords:[{name:'child',type:'NS',value:'domain02.cormierconsulting.com',ttl:3600}]};current.zones.push(child);current.records[child.id]=[];
 const deleted=dnsOperations([{kind:'delete',zone:'zones',items:[child.id]}],current);assert.equal(deleted.serials[zone],'4');assert.equal(deleted.serials[child.id],'2');
 current.zones=current.zones.filter(z=>z.id!==zone);assert.throws(()=>dnsOperations([{kind:'delete',zone:'zones',items:[child.id]}],current),/parent delegation/);
});

const recovery=()=>({zone:{name:'recover.'+zone,kind:'Forward',managed:true,ownerId:'deleted-owner'},records:[{name:'@',type:'SOA',value:'domain02.cormierconsulting.com. hostmaster.cormierconsulting.com. 42 900 600 86400 3600',ttl:3600},{name:'@',type:'NS',value:'domain02.cormierconsulting.com',ttl:3600},{name:'fixture',type:'A',value:'192.0.2.8',ttl:30},{name:'fixture',type:'A',value:'192.0.2.9',ttl:30}]});
test('missing managed zone restoration retains all saved values, parent review and original ownership provenance',()=>{
 const saved=recovery(),current=inventory();current.source={...current.source,name:'Windows DNS',host:'domain02.cormierconsulting.com',address:'10.99.3.2',credential:'Scoped Windows management bridge'};
 const result=dnsOperations([{kind:'restore',configuration:{kind:'DnsSource',dns:current.source}},{kind:'restore',restoreSnapshotId:'original-backup',configuration:{kind:'DnsZone',dns:saved}}],current);
 assert.equal(result.operations.length,1);assert.equal(result.operations[0].operation,'RestoreZone');assert.equal(result.operations[0].previousOwnerId,'deleted-owner');assert.equal(result.operations[0].restoreSnapshotId,'original-backup');assert.deepEqual(result.operations[0].records,saved.records);assert.equal(result.serials[zone],'4');
 assert.throws(()=>dnsOperations([{kind:'zone',zone:'other.'+zone,type:'Forward',source:'other-source'}],current),/source changed/);
 assert.throws(()=>dnsOperations([{kind:'restore',configuration:{kind:'DnsSource',dns:{...current.source,address:'192.0.2.11'}}}],current),/differs/);
});
test('missing-zone recovery refuses unmanaged, incomplete, duplicate, unsupported or conflicting saved data',()=>{
 const cases=[s=>delete s.zone.managed,s=>s.records.shift(),s=>s.records.splice(1,1),s=>s.records.push({...s.records[2]}),s=>s.records[2].type='CAA',s=>s.records[2].ttl=30.5,s=>s.records[0].value='bad SOA',s=>s.records.push({name:'fixture',type:'CNAME',value:'host.example.test',ttl:30})];
 for(const mutate of cases){const saved=recovery();mutate(saved);assert.throws(()=>validateZoneRecovery(saved));}
 assert.equal(validateZoneRecovery(recovery()).length,4);
 const current=inventory();assert.throws(()=>dnsOperations([{kind:'restore',configuration:{kind:'DnsZone',dns:recovery()}},{kind:'record',zone:recovery().zone.name,name:'fixture',type:'A',value:'192.0.2.5',ttl:30}],current),/unavailable|Conflicting/);
});
test('distinct A values can be created together while identical create proposals and repeated reviewed targets are rejected',()=>{
 const first={kind:'record',zone,name:'multi',type:'A',value:'192.0.2.11',ttl:30},second={...first,value:'192.0.2.12'};
 assert.equal(dnsOperations([first,second],inventory()).operations.length,2);
 assert.throws(()=>dnsOperations([first,{...first}],inventory()),/Conflicting/);
 assert.throws(()=>dnsOperations([changes[0],{...changes[0],value:'192.0.2.99'}],inventory()),/Conflicting/);
});
