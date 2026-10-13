import fs from 'node:fs';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createLiveDnsSource} from '../live-management/rancher-dns.mjs';
const base='http://127.0.0.1:15888',zone='cormierconsulting.io',name='manager-restore-'+randomUUID().slice(0,8),results=[];
const request=(url,init)=>fetch(base+url.replace('/k8s/clusters/local',''),{...init,signal:AbortSignal.timeout(15000)});
const source=createLiveDnsSource('local',request,'user-jccb4');
const identity=r=>JSON.stringify([r.name,r.type,r.value]);
async function inventory(){return (await source.reload()).data.inventory;}
async function apply(changes){
 const current=await inventory();const z=current.zones.find(z=>z.name===zone);
 const snapshotCurrent={configuration:{id:'source/windows',name:'Windows DNS'},relatedConfigurations:[{id:'zone/'+zone,name:zone,kind:'DnsZone',dns:{zone:z,records:current.records[zone]}}],snapshotScope:{label:'Selective Windows DNS restore acceptance'},routeManifests:[]};
 const response=await fetch(base+'/api/v1/namespaces/manager-system/services/http:dns-manager-snapshots:8080/proxy/api/snapshots',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://rancher.cormierconsulting.io'},body:JSON.stringify({current:snapshotCurrent,scopeKey:'dns-selective-restore'})});assert.equal(response.status,201);const snapshot=await response.json();
 return source.stageChanges({changes:changes.map(c=>({...c,id:randomUUID()})),snapshotId:snapshot.id});
}
try{
 await apply([{kind:'record',zone,name,type:'A',value:'192.0.2.211',ttl:5},{kind:'record',zone,name:name+'-unrelated',type:'TXT',value:'preserve unrelated newer record',ttl:5}]);
 const saved=await inventory(),original=saved.records[zone].find(r=>r.name===name);
 await apply([{kind:'record',zone,name,type:'A',value:'192.0.2.212',ttl:10,targetId:identity(original)}]);
 const restored=await apply([{kind:'restore',configuration:{kind:'DnsZone',dns:{zone:saved.zones.find(z=>z.name===zone),records:[original]}}}]);assert.equal(restored.receipts.length,1);
 const after=await inventory();assert.ok(after.records[zone].some(r=>r.name===name&&r.value===original.value&&r.ttl===original.ttl));assert.ok(after.records[zone].some(r=>r.name===name+'-unrelated'&&r.value==='preserve unrelated newer record'));
 results.push({check:'Live adapter selective restore updates saved record and TTL without deleting unrelated records',passed:true});
 console.log('Live Windows DNS selective restore and unrelated-record preservation passed.');
}finally{
 try{const current=await inventory(),own=current.records[zone].filter(r=>[name,name+'-unrelated'].includes(r.name));if(own.length){await apply([{kind:'delete',zone:'zone:'+zone,items:own.map(identity)}]);results.push({check:'Exact owned restore fixtures deleted with durable backup and Windows readback',passed:true});}}catch(error){results.push({check:'Fixture cleanup',passed:false,error:error.message});process.exitCode=1;}
 fs.writeFileSync('.local/manager-installation/dns-selective-restore-live-tests.json',JSON.stringify({name,results},null,2));
}
