import fs from 'node:fs';import assert from 'node:assert/strict';import {randomUUID,randomBytes} from 'node:crypto';
import {createLiveDnsSource} from '../live-management/rancher-dns.mjs';
const base='http://127.0.0.1:15888',api=base+'/api/v1/namespaces/manager-system/services/http:dns-manager-snapshots:8080/proxy';
const zone='cormierconsulting.io',name='manager-fresh-'+randomUUID().slice(0,8),results=[];
const source=createLiveDnsSource('local',(url,init)=>fetch(base+url.replace('/k8s/clusters/local',''),{...init,signal:AbortSignal.timeout(15000)}),'user-jccb4');
const request=(path,body,method='POST')=>fetch(api+path,{method,headers:{'Content-Type':'application/json',Origin:'https://rancher.cormierconsulting.io'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
async function get(path){const r=await fetch(api+path,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json();}
async function inventory(){return (await source.reload()).data.inventory;}
function capture(i){return {configuration:{id:'source/windows',name:'Windows DNS',kind:'DnsSource',dns:i.source},relatedConfigurations:[{id:'zone/'+zone,name:zone,kind:'DnsZone',dns:{zone:i.zones.find(z=>z.name===zone),records:i.records[zone]}}],snapshotScope:{label:'Live fresh DNS acceptance',namespace:'manager-acceptance'},routeManifests:[]};}
async function apply(changes){const i=await inventory(),r=await request('/api/snapshots',{current:capture(i),scopeKey:'fresh-dns-acceptance'});assert.equal(r.status,201);const s=await r.json();return source.stageChanges({changes:changes.map(c=>({...c,id:randomUUID()})),snapshotId:s.id});}
const prior=await get('/api/snapshot-schedule');assert.equal(prior.enabled,false,'Do not overwrite an enabled user schedule.');assert.ok(!prior.hasSource||['Isolated manager acceptance','Live fresh DNS acceptance'].includes(prior.scope?.label),'Do not replace a user capture scope.');
const password='Test-only-'+randomBytes(24).toString('base64url')+'!';let configured=false;
try{
 await apply([{kind:'record',zone,name,type:'A',value:'192.0.2.221',ttl:10}]);
 const saved=await inventory(),current=capture(saved);current.pendingChanges=[{kind:'record',name:'unapplied-proposal'}];
 let r=await request('/api/snapshot-schedule',{enabled:true,interval:1,unit:'minutes',includeSecrets:true,password,current},'PUT');assert.equal(r.status,200,await r.text());configured=true;
 const started=new Date().toISOString(),oldRecord=saved.records[zone].find(x=>x.name===name);
 await apply([{kind:'record',zone,name,type:'A',value:'192.0.2.222',ttl:20,targetId:JSON.stringify([oldRecord.name,oldRecord.type,oldRecord.value])}]);
 const changed=await inventory();let automatic;const deadline=Date.now()+95000;
 while(Date.now()<deadline){automatic=(await get('/api/snapshots')).snapshots.find(s=>s.generation==='Automatic'&&s.createdAt>=started);if(automatic)break;await new Promise(r=>setTimeout(r,2000));}
 assert.ok(automatic,'Scheduled fresh capture did not run.');assert.equal(automatic.encrypted,true);
 r=await request('/api/snapshots/'+automatic.id+'/unlock',{password});assert.equal(r.status,200);const archive=await r.json(),captured=archive.current.relatedConfigurations[0].dns;
 assert.ok(captured.records.some(x=>x.name===name&&x.type==='A'&&x.value==='192.0.2.222'&&x.ttl===20),'Scheduled backup reused the stale saved records.');
 assert.ok(Number(captured.zone.serial)>=Number(changed.zones.find(z=>z.name===zone).serial),'Captured SOA serial predates the applied record change.');assert.notEqual(String(captured.zone.serial),String(saved.zones.find(z=>z.name===zone).serial));assert.deepEqual(archive.current.pendingChanges,[]);
 results.push({check:'Protected unattended backup refreshes Windows record, TTL and SOA serial after saved scope changes',passed:true,archive:automatic.id});console.log('Fresh scheduled DNS capture includes updated live record and excludes unapplied proposals.');
 r=await request('/api/snapshot-schedule/run',{current,password});assert.equal(r.status,201);const manual=await r.json();
 r=await request('/api/snapshots/'+manual.id+'/unlock',{password});assert.equal(r.status,200);assert.ok((await r.json()).current.relatedConfigurations[0].dns.records.some(x=>x.name===name&&x.value==='192.0.2.222'));
 const mismatched=structuredClone(current);mismatched.configuration.dns.address='192.0.2.250';
 assert.equal((await request('/api/snapshot-source',{current:mismatched},'PUT')).status,503);assert.equal((await get('/api/snapshot-schedule')).lastRun,automatic.createdAt);
 results.push({check:'Run now reads fresh records; replaced source is refused without updating the schedule',passed:true});console.log('Fresh Run now and source-change rejection passed.');
}finally{
 if(configured){const disabled=await request('/api/snapshot-schedule',{enabled:false,interval:prior.interval,unit:prior.unit,includeSecrets:false},'PUT');assert.equal(disabled.status,200,'Test schedule could not be disabled.');}
 try{const i=await inventory(),own=i.records[zone].filter(x=>x.name===name);if(own.length)await apply([{kind:'delete',zone:'zone:'+zone,items:own.map(x=>JSON.stringify([x.name,x.type,x.value]))}]);results.push({check:'Owned DNS fixture removed through reviewed queue with durable backup',passed:true});}catch(e){results.push({check:'Fixture cleanup',passed:false,error:e.message});process.exitCode=1;}
 fs.writeFileSync('.local/manager-installation/dns-fresh-snapshot-live-tests.json',JSON.stringify({name,results},null,2));
}
