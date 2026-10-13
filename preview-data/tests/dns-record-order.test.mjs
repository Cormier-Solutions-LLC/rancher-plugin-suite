import test from 'node:test';import assert from 'node:assert/strict';
import {orderedDnsRecords,normalizeDnsConfiguration} from '../../dns-manager-dev/pkg/dns-manager/snapshot-feature/config/dns-record-order.mjs';
import {coverageEntries} from '../../dns-manager-dev/pkg/dns-manager/snapshot-feature/config/snapshot-coverage.mjs';
const records=[
 {name:'same',type:'A',value:'192.0.2.2',ttl:30},{name:'same',type:'A',value:'192.0.2.1',ttl:60},
 {name:'same',type:'AAAA',value:'2001:db8::1',ttl:60},{name:'alias',type:'CNAME',value:'same.example.test',ttl:0},
 {name:'1',type:'PTR',value:'same.example.test',ttl:300},{name:'@',type:'MX',value:'10 mail.example.test',ttl:300},
 {name:'_ldap._tcp',type:'SRV',value:'0 100 389 same.example.test',ttl:600},{name:'@',type:'TXT',value:'Exact Case And Space',ttl:600}
];
const config=records=>({id:'zone/example.test',kind:'DnsZone',dns:{zone:{id:'example.test',name:'example.test',serial:'42'},records,priority:2}});
test('every rotation and reverse of a multi-value/type set has one capture order without mutation or loss',()=>{
 const before=structuredClone(records),expected=orderedDnsRecords(records);
 for(let index=0;index<records.length;index++)for(const variant of [[...records.slice(index),...records.slice(0,index)],[...records.slice(index),...records.slice(0,index)].reverse()])assert.deepEqual(orderedDnsRecords(variant),expected);
 assert.deepEqual(records,before);assert.equal(orderedDnsRecords([...records,records[0]]).length,records.length+1);
});
test('coverage ignores enumeration order but detects values, TTLs, duplicates, serial and navigation priority changes',()=>{
 const fingerprint=config=>coverageEntries({configuration:config})[0].value;
 const baseline=config(records);assert.equal(fingerprint(config([...records].reverse())),fingerprint(baseline));
 for(const changed of [{...baseline,dns:{...baseline.dns,records:[{...records[0],value:'192.0.2.9'},...records.slice(1)]}},{...baseline,dns:{...baseline.dns,records:[{...records[0],ttl:31},...records.slice(1)]}},{...baseline,dns:{...baseline.dns,records:[...records,records[0]]}},{...baseline,dns:{...baseline.dns,zone:{...baseline.dns.zone,serial:'43'}}},{...baseline,dns:{...baseline.dns,priority:1}}])assert.notEqual(fingerprint(changed),fingerprint(baseline));
});
test('delegation records are a set; source identity and navigation order remain ordered configuration',()=>{
 const baseline=config(records);baseline.dns.zone.delegationRecords=[{name:'child',type:'NS',value:'ns2.test',ttl:3600},{name:'child',type:'NS',value:'ns1.test',ttl:3600}];
 const reversed=structuredClone(baseline);reversed.dns.zone.delegationRecords.reverse();assert.deepEqual(normalizeDnsConfiguration(reversed),normalizeDnsConfiguration(baseline));
 const navigation={kind:'DnsNavigation',dns:{order:['b','a']}};assert.deepEqual(normalizeDnsConfiguration(navigation),navigation);
});
