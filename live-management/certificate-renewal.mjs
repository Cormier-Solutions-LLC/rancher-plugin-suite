import {resourcePath} from './kubernetes-apply.mjs';
// Match cmctl renew: set Issuing=True/ManuallyTriggered with UpdateStatus.
// https://github.com/cert-manager/cmctl/blob/main/pkg/renew/renew.go
export async function prepareCertificateRenewals(changes,call,observations,now=new Date().toISOString()){
 const prepared=[],seen=new Set();
 for(const change of changes){
  const request=change.configuration;if(request?.operation!=='RequestCertificateRenewal')continue;
  if(change.resources?.length)throw new Error('A renewal request cannot include unrelated manifests.');
  const path=resourcePath({apiVersion:'cert-manager.io/v1',kind:'Certificate',metadata:request.certificate});
  if(seen.has(path))throw new Error('Select only one renewal request per Certificate.');seen.add(path);
  const current=await call(path),expected=observations?.get(path);
  if(observations&&(!expected||expected.uid!==current.metadata.uid||expected.resourceVersion!==current.metadata.resourceVersion))throw new Error('The reviewed Certificate changed. Refresh and review again.');
  if(request.reviewedUid&&request.reviewedUid!==current.metadata.uid||Number(request.observedRevision)!==Number(current.status?.revision||0)||request.secretName!==current.spec.secretName||JSON.stringify(request.dnsNames)!==JSON.stringify(current.spec.dnsNames||[])||request.issuer?.name!==current.spec.issuerRef.name||(request.issuer.kind||'Issuer')!==(current.spec.issuerRef.kind||'Issuer'))throw new Error('The renewal identity, revision, issuer or domains changed. Refresh and prepare a new request.');
  if(current.status?.conditions?.some(c=>c.type==='Issuing'&&c.status==='True'))throw new Error('Certificate issuance is already running. Watch its existing request before retrying.');
  if(current.status?.lastFailureTime&&Date.parse(current.status.lastFailureTime)>=Date.parse(request.requestedAt))throw new Error('This renewal attempt already failed. Review cert-manager diagnostics and prepare a new request.');
  const requestId=crypto.randomUUID(),message='Network Manager manually requested certificate re-issuance: '+requestId;
  const body=structuredClone(current);body.status={...current.status,conditions:[...(current.status?.conditions||[]).filter(c=>c.type!=='Issuing'),{type:'Issuing',status:'True',reason:'ManuallyTriggered',message,lastTransitionTime:now,observedGeneration:current.metadata.generation}]};delete body.metadata.managedFields;
  const init={method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
  prepared.push({path,init,message,receipt:{identity:'Certificate/'+current.metadata.namespace+'/'+current.metadata.name,operation:'Renew',uid:current.metadata.uid,observedRevision:Number(current.status?.revision||0),requestedAt:now,requestId,readBack:false,accepted:false}});
 }
 for(const item of prepared)await call(item.path+'/status?dryRun=All',item.init);
 return prepared;
}
export async function submitCertificateRenewals(prepared,call,earlier=[]){
 const applied=[...earlier];
 for(const item of prepared){
  const receipt={...item.receipt};applied.push(receipt);
  try{
   let result,error;try{result=await call(item.path+'/status',item.init);}catch(e){error=e;}
   let current;try{current=await call(item.path);}catch(e){receipt.acceptanceUnknown=true;throw error||e;}
   const condition=current.status?.conditions?.find(c=>c.type==='Issuing'),renewed=Number(current.status?.revision||0)>receipt.observedRevision;
   if(current.metadata.uid!==receipt.uid||!renewed&&!(condition?.status==='True'&&condition.message===item.message)){if(error){receipt.acceptanceUnknown=![403,409,422].includes(error.status);throw error;}throw new Error('Renewal request was not observed; reconcile the original request before retrying.');}
   receipt.accepted=true;receipt.readBack=true;receipt.resourceVersion=result?.metadata?.resourceVersion||current.metadata.resourceVersion;
  }catch(error){error.applied=applied;error.message+=' Accepted or uncertain renewal receipts are retained; no request was replayed.';throw error;}
 }
 return {applied,completedAt:new Date().toISOString()};
}
export function reconcileCertificateRenewals(processes,certificates,now=Date.now()){
 for(const process of processes){
  const renewals=process.receipt?.applied?.filter(r=>r.operation==='Renew'&&r.accepted);if(!renewals?.length||process.progress===100)continue;
  let complete=true,failure='',waiting=[];
  for(const receipt of renewals){
   const [,namespace,name]=receipt.identity.split('/'),cert=certificates.find(c=>c.namespace===namespace&&c.name===name);
   if(!cert||cert.uid!==receipt.uid){failure='Renewal target was deleted or replaced. Review before requesting again.';break;}
   if(Number(cert.revision)>receipt.observedRevision&&cert.ready==='True'){receipt.renewedRevision=Number(cert.revision);continue;}
   complete=false;
   const attempts=(cert.requests||[]).filter(r=>Date.parse(r.createdAt)>=Date.parse(receipt.requestedAt));
   const denied=attempts.find(r=>r.conditions?.some(c=>c.type==='Denied'&&c.status==='True'||c.type==='Ready'&&c.status==='False'&&c.reason==='Failed'));
   const invalid=(cert.orders||[]).find(o=>attempts.some(r=>r.uid===o.requestUid)&&o.state==='invalid');
   if(denied||invalid||Date.parse(cert.lastFailureTime)>=Date.parse(receipt.requestedAt)){failure='Certificate renewal failed. Inspect CertificateRequest, Order and Challenge diagnostics; the current TLS Secret was preserved.';break;}
   waiting.push(`${namespace}/${name}: ${attempts.length} CertificateRequest(s), ${(cert.orders||[]).filter(o=>attempts.some(r=>r.uid===o.requestUid)).length} Order(s), ${(cert.challenges||[]).length} Challenge(s)`);
  }
  if(failure){process.status=failure;process.failed=true;process.progress=100;process.finishedAt=now;}
  else if(complete){process.status='Certificate renewal verified: new Ready revision observed.';process.progress=100;process.finishedAt=now;}
  else{process.status='Waiting for cert-manager: '+waiting.join('; ');process.progress=50;}
 }
}
