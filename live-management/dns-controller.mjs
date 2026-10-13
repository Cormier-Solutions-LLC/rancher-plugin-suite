import fs from 'node:fs';
import {dnsCredentialReferences} from './dns-credentials.mjs';
import https from 'node:https';
import { Resolver } from 'node:dns/promises';
import { reconcileManagedZones } from './dns-zone-replication.mjs';
import {dnsEngineApi} from './dns-engine-api.mjs';
import {controllerCredentialProof} from './dns-controller-credential-proof.mjs';
import {dnsSourceObserver} from './dns-source-observer.mjs';
const protectedZones=['_msdcs.cormierconsulting.com','99.10.in-addr.arpa','cormierconsulting.com','cormierconsulting.io'];
const namespace='dns-system',name='dns-manager-observations';
const account='/var/run/secrets/kubernetes.io/serviceaccount/';
const ca=fs.readFileSync(account+'ca.crt');
const kubernetes=async(path,method='GET',body)=>new Promise((resolve,reject)=>{
 const request=https.request({hostname:process.env.KUBERNETES_SERVICE_HOST,port:process.env.KUBERNETES_SERVICE_PORT_HTTPS||443,path,method,ca,headers:{Authorization:'Bearer '+fs.readFileSync(account+'token','utf8').trim(),'Content-Type':'application/json'},timeout:10000},response=>{
  let data='';response.on('data',chunk=>data+=chunk);response.on('end',()=>{if(response.statusCode>=300)return reject(new Error('Kubernetes '+response.statusCode));try{resolve(JSON.parse(data));}catch(e){reject(e);}});
 });request.on('error',reject);request.on('timeout',()=>request.destroy(new Error('Kubernetes timeout')));request.end(body?JSON.stringify(body):undefined);
});
const engine=dnsEngineApi({readPassword:()=>fs.readFileSync('/run/credentials/admin-password','utf8')});
const api=(replica,path,values={})=>engine.api(replica,path,values);
const sourcePins={catalogUid:process.env.DNS_SOURCE_CATALOG_UID,bindingUid:process.env.DNS_SOURCE_BINDINGS_UID,bindingDigest:process.env.DNS_SOURCE_BINDINGS_SHA256};
const primarySourceId=process.env.DNS_PRIMARY_SOURCE_ID,primaryBindingId=process.env.DNS_PRIMARY_BINDING_ID;
const sourceManagementEnabled=Object.values(sourcePins).some(Boolean)||Boolean(primarySourceId)||Boolean(primaryBindingId);
if(sourceManagementEnabled&&(!primarySourceId||!primaryBindingId))throw new Error('The installed primary source identity is unavailable.');
const observeSources=sourceManagementEnabled?dnsSourceObserver({read:kubernetes,pins:sourcePins,publishedSources:[primarySourceId]}):null;
function value(record){const d=record.rData;if(record.type==='MX')return `${d.preference} ${d.exchange || d.mailExchange}`;if(record.type==='SRV')return `${d.priority} ${d.weight} ${d.port} ${d.target || d.domain}`;return d.ipAddress||d.cname||d.ptrName||d.nameServer||d.text||d.domain||JSON.stringify(d);}
let lastSuccess=0;
async function reconcile(){
 const path=`/api/v1/namespaces/${namespace}/configmaps/${name}`;
 let current=await kubernetes(path),previous;
 try{previous=JSON.parse(current.data['inventory.json']);}catch{}
 const ownership=JSON.parse(current.data['replica-ownership.json']||'{}');
 let windows,sourceObservation,primarySource;
 if(observeSources){
  sourceObservation=await observeSources();primarySource=sourceObservation.sources.find(source=>source.id===primarySourceId);
  // Existing published zones retain their pinned management owner. Installing
  // an additional observation source does not reroute these replicas or grant
  // it ownership of same-named Windows zones.
  if(!primarySource||primarySource.bindingId!==primaryBindingId)throw new Error('Published DNS source ownership changed; the confirmed replica inventory is retained for review.');
  windows=sourceObservation.observations.get(primarySourceId);
 }else try{const cm=await kubernetes('/api/v1/namespaces/dns-system/configmaps/dns-windows-observations');windows=JSON.parse(cm.data['inventory.json']);}catch{}
 const managementReachable=windows?.managementReachable===true && Date.now()-Date.parse(windows.observedAt)<120000;
 const desired=managementReachable?windows.zones:previous?.zones||protectedZones.map(name=>({id:name,name}));
 const zones=[...new Set([...protectedZones,...desired.map(z=>z.name)])];
 const entries=managementReachable?(windows.managedZones||[]).filter(e=>!protectedZones.includes(e.name)):[];
 // Serialize CAS writes from the three parallel API clients. Do not discard
 // ownership when a source observation expires or a replica is unavailable.
 let saveTail=Promise.resolve();
 const save=()=>{const pending=saveTail.then(async()=>{const cm=await kubernetes(path);cm.data['replica-ownership.json']=JSON.stringify(ownership);await kubernetes(path,'PUT',cm);});saveTail=pending.catch(()=>{});return pending;};
 const replicas=[],candidates=[],zoneLifecycle=[];
 const resolver=new Resolver({timeout:2000,tries:1});resolver.setServers(['10.99.3.2']);
 const serials=Object.fromEntries(await Promise.all(zones.map(async zone=>{try{return [zone,(await resolver.resolveSoa(zone)).serial];}catch{return [zone,null];}})));
 await Promise.all([0,1,2].map(async i=>{
  try{
   zoneLifecycle.push(...await reconcileManagedZones({replica:i,entries,ownership,api:(path,values)=>api(i,path,values),save,sourceAddress:'10.99.3.2'}));
   const state=await api(i,'zones/list');
   const reads=await Promise.all(zones.map(async zone=>{try{
    const data=await api(i,'zones/records/get',{domain:zone,zone,listZone:'true'});
    const serial=data.records.find(r=>r.type==='SOA')?.rData.serial;
    // Repair a missed notification only when source and retained serials differ.
    if(serials[zone]!==null && serial!==serials[zone])await api(i,'zones/resync',{zone});
    return {zone,serial,sourceSerial:serials[zone],expired:state.zones.find(z=>z.name===zone)?.isExpired,records:data.records.map(r=>({name:r.name===zone?'@':r.name.endsWith('.'+zone)?r.name.slice(0,-zone.length-1):r.name,type:r.type,value:value(r),ttl:r.ttl,rData:r.rData}))};
   }catch(e){return {zone,sourceSerial:serials[zone],expired:true,records:[],error:e.message};}}));
   candidates.push({id:i,reads});
   const credentialProof=await controllerCredentialProof(engine,i);
   replicas.push({id:i,address:`10.99.15.${55+i}`,reachable:true,...credentialProof,zones:reads.map(({records,...state})=>state)});
  }catch(e){replicas.push({id:i,address:`10.99.15.${55+i}`,reachable:false,error:e.message});}
 }));
 if(!candidates.length)throw new Error('All replica inventory reads failed; last confirmed inventory retained.');
 const selected=candidates.sort((a,b)=>a.id-b.id)[0];
 const records=managementReachable?windows.records:Object.fromEntries(selected.reads.map(r=>[r.zone,r.records]));
 const inventoryZones=selected.reads.map(r=>({...desired.find(z=>z.name===r.zone),id:r.zone,name:r.zone,kind:desired.find(z=>z.name===r.zone)?.kind||(/\.(in-addr|ip6)\.arpa$/.test(r.zone)?'Reverse':r.zone.startsWith('_msdcs.')?'AD':'Forward'),serial:String(managementReachable?windows.zones.find(z=>z.name===r.zone)?.serial:r.serial),replication:r.sourceSerial===null?'Source unavailable; retained copy':replicas.every(p=>p.reachable&&p.zones?.some(z=>z.zone===r.zone&&!z.expired&&z.serial===r.sourceSerial))?'Synced':'Catching up'}));
 const document={observedAt:new Date().toISOString(),inventoryReplica:selected.id,inventorySource:managementReachable?'Windows management bridge':'Transferred replica data',zones:inventoryZones,records,zoneLifecycle,replicas:replicas.sort((a,b)=>a.id-b.id),source:{name:'Windows DNS',host:'domain02.cormierconsulting.com',address:'10.99.3.2',credential:'Scoped Windows management bridge',credentialReferences:structuredClone(dnsCredentialReferences),reachable:Object.values(serials).every(v=>v!==null),managementReachable,managementObservedAt:windows?.observedAt},management:{kubernetesEndpoint:'10.99.15.50:6443',tlsServerName:'kubernetes.cormierconsulting.io'},limitations:managementReachable?windows.limitations:['Windows bridge is unavailable; retained replica inventory is read-only']};
 if(sourceObservation){
  document.source={...document.source,...primarySource,reachable:primarySource.dnsReachable};document.sourceCatalog=sourceObservation.sourceCatalog;document.sources=sourceObservation.sources;
  document.sourceZones=sourceObservation.zones;document.sourceRecords=sourceObservation.records;
  document.zones=document.zones.map(zone=>({...zone,sourceId:primarySourceId,bindingId:primaryBindingId,qualifiedId:`source/${primarySourceId}/zone/${zone.name}`,published:true}));
 }
 if(Buffer.byteLength(JSON.stringify(document))>750*1024)throw new Error('DNS observation storage is full; the last confirmed inventory is retained.');
 await saveTail;current=await kubernetes(path);
 current.data['inventory.json']=JSON.stringify(document);
 await kubernetes(path,'PUT',current);lastSuccess=Date.now();
 console.log(`DNS reconciliation: ${replicas.filter(r=>r.reachable).length}/3 APIs, ${inventoryZones.length} zones; source ${document.source.reachable?'reachable':'unavailable'}`);
}
import http from 'node:http';
http.createServer((req,res)=>{if(req.url!=='/healthz'){res.writeHead(404);return res.end();}res.writeHead(lastSuccess&&Date.now()-lastSuccess<120000?200:503);res.end(String(lastSuccess));}).listen(8080,'0.0.0.0');
for(;;){try{await reconcile();}catch(e){console.error(e.message);}await new Promise(resolve=>setTimeout(resolve,30000));}
