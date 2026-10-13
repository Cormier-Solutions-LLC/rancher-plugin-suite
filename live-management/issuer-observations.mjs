// Derive editable non-secret configuration from the authenticated issuer.
export function mergeIssuerReferences(state,resources,namespace='cert-manager') {
 state.credentialReferences ||= [];state.accountReferences ||= [];
 for(const resource of resources){
  const acme=resource.spec?.acme;if(!acme)continue;
  const account=acme.privateKeySecretRef?.name;if(account&&!state.accountReferences.includes(account))state.accountReferences.push(account);
  for(const solver of acme.solvers||[]){
   const ref=solver.dns01?.webhook?.config?.apiKeySecretRef;if(!ref?.name||!ref.key)continue;
   const existing=state.credentialReferences.find(item=>item.name===ref.name&&item.namespace===namespace);
   if(existing){if(!existing.keys.includes(ref.key))existing.keys.push(ref.key);}
   else state.credentialReferences.push({name:ref.name,namespace,keys:[ref.key],source:'Referenced by live issuer; values not read'});
  }
 }
}
export function issuerProfile(resource) {
  const acme=resource.spec?.acme, solver=acme?.solvers?.[0], webhook=solver?.dns01?.webhook;
  const settings=acme ? {
    name:resource.metadata.name,email:acme.email || '',
    environment:acme.server?.includes('staging')?'staging':'production',
    challenge:solver?.dns01?'dns01':'http01',zone:(solver?.selector?.dnsZones || []).join(', '),
    groupName:webhook?.groupName || '',solverName:webhook?.solverName || '',
    secretName:webhook?.config?.apiKeySecretRef?.name || '',secretKey:webhook?.config?.apiKeySecretRef?.key || '',
    ingressClass:solver?.http01?.ingress?.ingressClassName || '',
    providerProduction:webhook?.config?.production===true,accountSecretName:acme.privateKeySecretRef?.name,
  } : undefined;
  return {name:resource.metadata.name,environment:settings?.environment || 'Live',challenge:settings?.challenge || 'local',source:'Live Kubernetes observation',manifest:resource,settings};
}
