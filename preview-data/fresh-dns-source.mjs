import {readFile} from 'node:fs/promises';import https from 'node:https';
import {dnsCredentialReferences,credentialCapture} from '../live-management/dns-credentials.mjs';
import {containsSecretValues} from '../dns-manager-dev/pkg/dns-manager/snapshot-feature/config/backup-zip.mjs';
import {currentZoneOrder} from '../live-management/dns-navigation.mjs';
import {orderedDnsRecords} from '../dns-manager-dev/pkg/dns-manager/snapshot-feature/config/dns-record-order.mjs';
const failure=message=>Object.assign(new Error(message),{status:503,code:'FRESH_SOURCE_UNAVAILABLE'});
export async function readDnsInventory(name,candidate){
 const credential=dnsCredentialReferences.find(r=>name==='credential/'+r.name),account=dnsCredentialReferences.find(r=>r.serviceAccountName&&name==='service-account/'+r.serviceAccountName),authentication=dnsCredentialReferences.find(r=>r.serviceAccountName&&name==='credential-auth/'+r.name),navigation=name==='dns-manager-navigation',stateName=process.env.SNAPSHOT_DNS_STATE_CONFIGMAP;
 if(navigation&&!/^dns-manager-state-[a-z0-9-]+$/.test(stateName||''))throw failure('The DNS navigation capture identity is unavailable.');
 if(!credential&&!account&&!authentication&&!navigation&&!['dns-windows-observations','dns-manager-observations'].includes(name))throw failure('Unsupported DNS inventory reference.');
 if(authentication&&(candidate?.metadata?.name!==authentication.name||candidate.metadata?.namespace!==authentication.namespace||!candidate.data?.token))throw failure('DNS credential authentication identity is unavailable.');
 const path=authentication?'/apis/authentication.k8s.io/v1/selfsubjectreviews':account?'/api/v1/namespaces/'+account.namespace+'/serviceaccounts/'+account.serviceAccountName:credential?'/api/v1/namespaces/'+credential.namespace+'/secrets/'+credential.name:navigation?'/api/v1/namespaces/cattle-ui-plugin-system/configmaps/'+stateName:'/api/v1/namespaces/dns-system/configmaps/'+name;
 const directory='/var/run/secrets/kubernetes.io/serviceaccount/';
 const [token,ca]=await Promise.all([readFile(directory+'token','utf8'),readFile(directory+'ca.crt')]);
 return new Promise((resolve,reject)=>{const request=https.request({host:process.env.KUBERNETES_SERVICE_HOST,port:Number(process.env.KUBERNETES_SERVICE_PORT_HTTPS||443),path,method:authentication?'POST':'GET',ca,rejectUnauthorized:true,headers:{Authorization:'Bearer '+(authentication?Buffer.from(candidate.data.token,'base64').toString('utf8'):token.trim()),...(authentication?{'Content-Type':'application/json'}:{})},timeout:10000},response=>{let body='';response.on('data',d=>{body+=d;if(body.length>2*1024*1024)request.destroy(failure('DNS inventory exceeds the capture limit.'));});response.on('end',()=>{try{if(![200,201].includes(response.statusCode))throw failure('DNS inventory or credential authentication failed. Check identity and capture permissions.');const cm=JSON.parse(body);resolve(credential||account||authentication?cm:navigation?{stateName,state:JSON.parse(cm.data['state.json']),navigation:JSON.parse(cm.data['navigation.json']||'null')}:JSON.parse(cm.data['inventory.json']));}catch(e){reject(failure(e.message));}});});request.on('timeout',()=>request.destroy(failure('DNS inventory read timed out.')));request.on('error',()=>reject(failure('DNS inventory is unavailable.')));request.end(authentication?JSON.stringify({apiVersion:'authentication.k8s.io/v1',kind:'SelfSubjectReview'}):undefined);});
}
export async function freshDnsSnapshot(saved,read=readDnsInventory,now=Date.now(),{includeSecrets=false}={}){
 if(saved?.configuration?.kind!=='DnsSource'||!saved.relatedConfigurations?.length)throw failure('A live DNS source and selected zones are required for automatic capture.');
 if(containsSecretValues(saved))throw failure('Fresh credential capture refuses cached Secret values. Use reference-only DNS configuration.');
 const [primary,controller]=await Promise.all([read('dns-windows-observations'),read('dns-manager-observations')]);
 if(!primary.managementReachable||[primary,controller].some(v=>!Number.isFinite(Date.parse(v.observedAt))||now-Date.parse(v.observedAt)>120000||Date.parse(v.observedAt)>now+5000))throw failure('DNS observations are stale or unavailable; no frozen source was captured.');
 if(saved.configuration.dns?.host!==controller.source?.host||saved.configuration.dns?.address!==controller.source?.address)throw failure('The configured DNS source changed; review the schedule scope again.');
 const current=structuredClone(saved);current.pendingChanges=[];current.credentialReferences=structuredClone(dnsCredentialReferences);current.secretBackup={complete:false,missing:dnsCredentialReferences.map(r=>r.namespace+'/'+r.name),capturedAt:null};
 current.configuration.dns=Object.fromEntries(['name','host','address','credential'].map(k=>[k,controller.source[k]]));
 let order;
 if(current.relatedConfigurations.some(c=>c.kind==='DnsNavigation')){
  const observed=await read('dns-manager-navigation');
  if(!observed?.stateName||saved.snapshotScope?.managerStateName!==observed.stateName)throw failure('The configured navigation identity changed; review the capture scope again.');
  order=currentZoneOrder(observed.navigation?.order??observed.state?.order,primary.zones);
 }
 current.relatedConfigurations=current.relatedConfigurations.map(item=>{
  if(item.kind==='DnsNavigation')return {...item,dns:{order:[...order]}};
  if(item.kind!=='DnsZone')throw failure('Automatic DNS capture contains an unsupported scope.');
  const zone=primary.zones.find(z=>z.name===item.dns?.zone?.name);
  if(!zone||!Array.isArray(primary.records[zone.id]))throw failure('A selected DNS zone is unavailable; the capture was stopped.');
  return {...item,dns:{...item.dns,zone:{id:zone.id,name:zone.name,kind:zone.kind,serial:zone.serial,...(zone.managed?{managed:true,ownerId:zone.ownerId,...(zone.parentZone?{parentZone:zone.parentZone,delegationRecords:orderedDnsRecords(zone.delegationRecords||[])}: {})}:{})},records:orderedDnsRecords(primary.records[zone.id]),...(order?{priority:order.indexOf(zone.id)}:{})}};
 });
 if(includeSecrets){
  let bytes=0;current.routeManifests=(current.routeManifests||[]).filter(r=>r.kind!=='Secret');
  for(const ref of dnsCredentialReferences){
   let captured;try{
    const secret=await read('credential/'+ref.name);let binding;
    if(ref.serviceAccountName){
     const serviceAccount=await read('service-account/'+ref.serviceAccountName),authentication=await read('credential-auth/'+ref.name,secret);
     const [confirmedAccount,confirmedSecret]=await Promise.all([read('service-account/'+ref.serviceAccountName),read('credential/'+ref.name)]);
     if(serviceAccount.metadata?.uid!==confirmedAccount.metadata?.uid||secret.metadata?.uid!==confirmedSecret.metadata?.uid||secret.metadata?.resourceVersion!==confirmedSecret.metadata?.resourceVersion||JSON.stringify(secret.data)!==JSON.stringify(confirmedSecret.data))throw new Error('Credential identity changed during verification.');
     binding={serviceAccount:confirmedAccount,authentication};
    }
    captured=credentialCapture(secret,ref,binding);
   }catch{throw failure('Fresh installed DNS credential capture failed. Check named Secret permissions, authentication and current service-account identity.');}
   bytes+=Buffer.byteLength(JSON.stringify(captured));if(bytes>2*1024*1024)throw failure('DNS credentials exceed the capture limit.');
   current.routeManifests.push(captured);
  }
  current.secretBackup={complete:true,missing:[],capturedAt:primary.observedAt};
 }
 return {current,observedAt:primary.observedAt};
}
