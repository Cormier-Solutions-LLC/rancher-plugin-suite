import {issuerProfileKey as key} from './issuer-profile-identity.mjs';
export function reconcileIssuerWorkspace(current,loaded){
 const next=structuredClone(current);
 for(const profile of loaded.issuerProfiles||[]){
  if(profile.source!=='Live Kubernetes observation')continue;
  const index=next.issuerProfiles.findIndex(item=>key(item)===key(profile));
  if(index<0)next.issuerProfiles.push(structuredClone(profile));
  else if(next.issuerProfiles[index].source==='Live Kubernetes observation')next.issuerProfiles[index]=structuredClone(profile);
 }
 for(const ref of loaded.credentialReferences||[]){
  const existing=next.credentialReferences.find(item=>item.name===ref.name&&item.namespace===ref.namespace);
  if(existing)existing.keys=[...new Set([...existing.keys,...ref.keys])];else next.credentialReferences.push(structuredClone(ref));
 }
 next.accountReferences=[...new Set([...next.accountReferences,...(loaded.accountReferences||[])])];
 return next;
}
