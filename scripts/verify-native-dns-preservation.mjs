import fs from 'node:fs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:15888';
const snapshotId=process.argv[2];
assert.match(snapshotId||'',/^[a-f0-9-]{36}$/);
async function read(path){const response=await fetch(base+path,{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);return response.json();}
const snapshot=await read('/api/v1/namespaces/manager-system/services/http:dns-manager-snapshots:8080/proxy/api/snapshots/'+snapshotId);
const inventory=JSON.parse((await read('/api/v1/namespaces/dns-system/configmaps/dns-windows-observations')).data['inventory.json']);
assert.equal(inventory.managementReachable,true);
assert.ok(Date.now()-Date.parse(inventory.observedAt)<120000);
const normalize=records=>records.filter(r=>r.type!=='SOA'&&r.name!=='manager-native-dns-acceptance').map(r=>JSON.stringify([r.name,r.type,r.value,r.ttl])).sort();
const results=snapshot.current.relatedConfigurations.filter(z=>z.kind==='DnsZone').map(z=>{
 const current=inventory.records[z.dns.zone.id];assert.ok(current);
 assert.deepEqual(normalize(current),normalize(z.dns.records),'Unrelated records changed in '+z.name);
 assert.ok(!current.some(r=>r.name==='manager-native-dns-acceptance'),'Acceptance fixture was not removed.');
 return {zone:z.name,unrelatedRecords:normalize(current).length,passed:true};
});
assert.equal(results.length,4);
fs.writeFileSync('.local/manager-installation/native-dns-preservation.json',JSON.stringify({observedAt:inventory.observedAt,snapshotId,results},null,2));
console.log('All four zone record sets and TTLs match the native pre-change backup after fixture cleanup; SOA serials may advance.');
