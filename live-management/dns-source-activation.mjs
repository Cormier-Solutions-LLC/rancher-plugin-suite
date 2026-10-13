import{sourceCatalogFingerprint}from'./dns-source-catalog.mjs';
// Evidence must be supplied by the independent installed reconciler. A caller
// cannot confirm activation by echoing the desired catalog or its write reply.
export function confirmedSourceActivation(observation,transaction,{now=Date.now()}={}){
 const at=Date.parse(observation?.observedAt);if(!Number.isFinite(at)||now-at>=120000||at>now+5000||!Array.isArray(observation?.sources)||!Array.isArray(observation?.zones)||observation.sources.some(s=>!s?.id)||new Set(observation.sources.map(s=>s.id)).size!==observation.sources.length)return false;
 const proof=observation.sourceCatalog;if(proof?.uid!==transaction.catalogUid||proof.bindingUid!==transaction.bindingUid||proof.bindingDigest!==transaction.bindingDigest||proof.revision!==transaction.next.revision||proof.fingerprint!==sourceCatalogFingerprint(transaction.next)||proof.operationId!==transaction.id)return false;
 const expected=transaction.next.sources;if(observation.sources.length!==expected.length)return false;
 for(const desired of expected){const actual=observation.sources.find(s=>s.id===desired.id);if(!actual||['id','name','type','host','address','credential','bindingId','revision'].some(k=>actual[k]!==desired[k]))return false;}
 for(const operation of transaction.operations){
  if(operation.operation==='DeleteSource'){if(observation.sources.some(s=>s.id===operation.sourceId)||observation.zones.some(z=>z.sourceId===operation.sourceId&&z.published===true))return false;continue;}
  const actual=observation.sources.find(s=>s.id===operation.sourceId),verified=Date.parse(actual?.managementObservedAt);
  if(actual?.managementReachable!==true||actual.dnsReachable!==true||!Number.isFinite(verified)||now-verified>=120000||verified>now+5000||actual.connectionCatalogRevision!==transaction.next.revision)return false;
 }
 return true;
}
