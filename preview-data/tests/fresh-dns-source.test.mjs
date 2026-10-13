import test from 'node:test';import assert from 'node:assert/strict';import {freshDnsSnapshot} from '../fresh-dns-source.mjs';
import {dnsCredentialReferences} from '../../live-management/dns-credentials.mjs';
const zone='example.test',old={configuration:{kind:'DnsSource',dns:{host:'domain',address:'192.0.2.1'}},relatedConfigurations:[{id:'zone/'+zone,kind:'DnsZone',dns:{zone:{name:zone,serial:'1'},records:[],priority:0}}],pendingChanges:[{kind:'record',name:'unapplied'}]};
const primary=()=>({observedAt:new Date().toISOString(),managementReachable:true,zones:[{id:zone,name:zone,kind:'Forward',serial:'2'}],records:{[zone]:[{name:'fresh',type:'A',value:'192.0.2.2',ttl:10}]}});
const controller=()=>({observedAt:new Date().toISOString(),source:{host:'domain',address:'192.0.2.1',name:'Windows',credential:'Reference'}});
test('automatic capture refreshes selected records and serials without promoting saved proposals',async()=>{
 const result=await freshDnsSnapshot(old,async name=>name==='dns-windows-observations'?primary():controller());assert.equal(result.current.relatedConfigurations[0].dns.zone.serial,'2');assert.equal(result.current.relatedConfigurations[0].dns.records[0].name,'fresh');assert.deepEqual(result.current.pendingChanges,[]);assert.deepEqual(old.relatedConfigurations[0].dns.records,[]);
});
test('fresh server capture is unchanged when Windows returns the same records in another order',async()=>{
 const live=primary();live.records[zone]=[{name:'multi',type:'A',value:'192.0.2.2',ttl:30},{name:'multi',type:'A',value:'192.0.2.1',ttl:60},{name:'multi',type:'AAAA',value:'2001:db8::1',ttl:60}];
 const read=async name=>name==='dns-windows-observations'?live:controller();
 const first=await freshDnsSnapshot(old,read);live.records[zone].reverse();const second=await freshDnsSnapshot(old,read);
 assert.deepEqual(first.current,second.current);assert.deepEqual(live.records[zone].map(r=>r.type),['AAAA','A','A']);
 live.records[zone][0].ttl=61;assert.notDeepEqual((await freshDnsSnapshot(old,read)).current,first.current);
});

test('fresh capture preserves authenticated managed-zone ownership and delegation for deleted-zone recovery',async()=>{
 const live=primary();Object.assign(live.zones[0],{managed:true,ownerId:'current-owner',parentZone:'test',delegationRecords:[{name:'example',type:'NS',value:'source.test',ttl:3600}]});
 const result=await freshDnsSnapshot(old,async name=>name==='dns-windows-observations'?live:controller());
 const captured=result.current.relatedConfigurations[0].dns.zone;
 assert.equal(captured.ownerId,'current-owner');assert.equal(captured.parentZone,'test');assert.deepEqual(captured.delegationRecords,live.zones[0].delegationRecords);assert.equal(captured.managed,true);
 live.zones[0].delegationRecords[0].ttl=30;assert.equal(captured.delegationRecords[0].ttl,3600);
});
test('stale, unavailable, replaced or unauthorized source observations never fall back to a frozen snapshot',async()=>{
 for(const changed of [{...primary(),observedAt:'2020-01-01T00:00:00Z'},{...primary(),managementReachable:false},{...primary(),zones:[]}])await assert.rejects(freshDnsSnapshot(old,async name=>name==='dns-windows-observations'?changed:controller()),e=>e.code==='FRESH_SOURCE_UNAVAILABLE');
 await assert.rejects(freshDnsSnapshot(old,async()=>{throw new Error('Forbidden');}),/Forbidden/);
 await assert.rejects(freshDnsSnapshot(old,async name=>name==='dns-windows-observations'?primary():{...controller(),source:{host:'replacement',address:'192.0.2.1'}}),/source changed/);
});
test('navigation capture refreshes applied server order and priority while refusing another manager identity',async()=>{
 const stateName='dns-manager-state-user-test',saved=structuredClone(old);saved.snapshotScope={managerStateName:stateName};saved.relatedConfigurations.push({id:'navigation/zones',kind:'DnsNavigation',dns:{order:['stale']}});
 const read=async name=>name==='dns-windows-observations'?primary():name==='dns-manager-observations'?controller():{stateName,state:{order:['removed']},navigation:{order:[zone]}};
 const result=await freshDnsSnapshot(saved,read);assert.deepEqual(result.current.relatedConfigurations[1].dns.order,[zone]);assert.equal(result.current.relatedConfigurations[0].dns.priority,0);assert.deepEqual(saved.relatedConfigurations[1].dns.order,['stale']);
 saved.snapshotScope.managerStateName='dns-manager-state-other';await assert.rejects(freshDnsSnapshot(saved,read),/identity changed/);
});
const credential=(ref,value='fresh-value')=>({apiVersion:'v1',kind:'Secret',type:ref.type,metadata:{name:ref.name,namespace:ref.namespace,uid:'installed-secret',resourceVersion:'2',annotations:{'kubernetes.io/service-account.name':'dns-windows-bridge','kubernetes.io/service-account.uid':'installed-account','unrelated-sensitive-annotation':'must-not-copy'}},data:Object.fromEntries(ref.keys.map(k=>[k,Buffer.from(k==='namespace'?ref.namespace:value).toString('base64')]))});
const account=()=>({apiVersion:'v1',kind:'ServiceAccount',metadata:{name:'dns-windows-bridge',namespace:'dns-system',uid:'installed-account'}});
const authenticated=()=>({apiVersion:'authentication.k8s.io/v1',kind:'SelfSubjectReview',status:{userInfo:{username:'system:serviceaccount:dns-system:dns-windows-bridge',uid:'installed-account',groups:['system:authenticated','system:serviceaccounts','system:serviceaccounts:dns-system']}}});
const dependencies=name=>name.startsWith('service-account/')?account():name.startsWith('credential-auth/')?authenticated():credential(dnsCredentialReferences.find(r=>'credential/'+r.name===name));
test('DNS credential capture reads exactly the installed identities and never uses cached values',async()=>{
 const seen=[];const read=async name=>{seen.push(name);if(name==='dns-windows-observations')return primary();if(name==='dns-manager-observations')return controller();return dependencies(name);};
 const plain=await freshDnsSnapshot({...old,credentialReferences:[{namespace:'foreign',name:'caller-selected'}]},read);assert.equal(plain.current.secretBackup.complete,false);assert.equal(seen.length,2);assert.equal(plain.current.routeManifests?.length||0,0);
 seen.length=0;const saved=await freshDnsSnapshot(old,read,Date.now(),{includeSecrets:true});assert.deepEqual(seen.filter(n=>n.startsWith('credential/')),['credential/dns-manager-engine-admin','credential/dns-windows-bridge-credential','credential/dns-windows-bridge-credential']);assert.equal(seen.filter(n=>n==='service-account/dns-windows-bridge').length,2);assert.equal(seen.filter(n=>n==='credential-auth/dns-windows-bridge-credential').length,1);assert.equal(saved.current.secretBackup.complete,true);assert.equal(saved.current.routeManifests.length,2);assert.equal(saved.current.routeManifests[0].data['admin-password'],Buffer.from('fresh-value').toString('base64'));assert.equal(saved.current.routeManifests[0].metadata.annotations,undefined);assert.equal(saved.current.routeManifests[1].metadata.annotations['unrelated-sensitive-annotation'],undefined);
 await assert.rejects(freshDnsSnapshot({...old,routeManifests:[credential(dnsCredentialReferences[0],'cached-value')]},read,Date.now(),{includeSecrets:true}),/refuses cached/);
 for(const cached of [{...old,configuration:{...old.configuration,resources:[credential(dnsCredentialReferences[0])]}},{...old,pendingChanges:[{resources:[credential(dnsCredentialReferences[0])]}]}])await assert.rejects(freshDnsSnapshot(cached,read,Date.now(),{includeSecrets:true}),/refuses cached/);
});
test('denied, replaced, malformed or incorrectly bound DNS credentials stop the entire capture',async()=>{
 for(const mutate of [s=>({...s,metadata:{...s.metadata,name:'other'}}),s=>({...s,type:'Opaque'}),s=>({...s,data:{}}),s=>({...s,data:{...s.data,token:'not base64'}}),s=>({...s,metadata:{...s.metadata,uid:''}}),s=>({...s,metadata:{...s.metadata,annotations:{}}})]){
  await assert.rejects(freshDnsSnapshot(old,async name=>name==='dns-windows-observations'?primary():name==='dns-manager-observations'?controller():name==='credential/dns-windows-bridge-credential'?mutate(credential(dnsCredentialReferences[1])):dependencies(name),Date.now(),{includeSecrets:true}),e=>e.code==='FRESH_SOURCE_UNAVAILABLE');
 }
 await assert.rejects(freshDnsSnapshot(old,async name=>name==='dns-windows-observations'?primary():name==='dns-manager-observations'?controller():Promise.reject(new Error('Forbidden')),Date.now(),{includeSecrets:true}),/credential capture failed/);
});
test('deleted or replaced service accounts and unauthenticated tokens reject encrypted capture without changing the source',async()=>{
 const invalid=[
  ['service-account/dns-windows-bridge',()=>({...account(),metadata:{...account().metadata,uid:'replacement-account'}})],
  ['service-account/dns-windows-bridge',()=>({...account(),metadata:{...account().metadata,deletionTimestamp:new Date().toISOString()}})],
  ['service-account/dns-windows-bridge',()=>({...account(),kind:'Secret'})],
  ['credential-auth/dns-windows-bridge-credential',()=>({...authenticated(),status:{userInfo:{...authenticated().status.userInfo,username:'system:anonymous'}}})],
  ['credential-auth/dns-windows-bridge-credential',()=>({...authenticated(),status:{userInfo:{...authenticated().status.userInfo,uid:'replacement-account'}}})],
  ['credential-auth/dns-windows-bridge-credential',()=>({...authenticated(),status:{userInfo:{...authenticated().status.userInfo,groups:[]}}})],
  ['credential/dns-windows-bridge-credential',()=>({...credential(dnsCredentialReferences[1]),data:{...credential(dnsCredentialReferences[1]).data,namespace:Buffer.from('other').toString('base64')}})]
 ];const baseline=structuredClone(old);
 for(const [target,replacement]of invalid){const read=async name=>name==='dns-windows-observations'?primary():name==='dns-manager-observations'?controller():name===target?replacement():dependencies(name);await assert.rejects(freshDnsSnapshot(old,read,Date.now(),{includeSecrets:true}),e=>e.code==='FRESH_SOURCE_UNAVAILABLE');assert.deepEqual(old,baseline);}
 for(const target of ['service-account/dns-windows-bridge','credential-auth/dns-windows-bridge-credential'])await assert.rejects(freshDnsSnapshot(old,async name=>{if(name===target)throw new Error('Denied');return name==='dns-windows-observations'?primary():name==='dns-manager-observations'?controller():dependencies(name);},Date.now(),{includeSecrets:true}),/credential capture failed/);
});
test('account and Secret identity changes during token authentication abort the whole encrypted capture',async()=>{
 for(const changed of ['account','secret-uid','secret-revision','secret-values']){
  let authenticatedOnce=false;
  const read=async(name,candidate)=>{
   if(name==='dns-windows-observations')return primary();if(name==='dns-manager-observations')return controller();
   if(name.startsWith('credential-auth/')){assert.equal(candidate.metadata.name,'dns-windows-bridge-credential');authenticatedOnce=true;return authenticated();}
   const value=dependencies(name);if(!authenticatedOnce)return value;
   if(changed==='account'&&name.startsWith('service-account/'))value.metadata.uid='replacement';
   if(name==='credential/dns-windows-bridge-credential'){
    if(changed==='secret-uid')value.metadata.uid='replacement';
    if(changed==='secret-revision')value.metadata.resourceVersion='3';
    if(changed==='secret-values')value.data.token=Buffer.from('rotated-value').toString('base64');
   }return value;
  };
  await assert.rejects(freshDnsSnapshot(old,read,Date.now(),{includeSecrets:true}),/credential capture failed/);
 }
});
