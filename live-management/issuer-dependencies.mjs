export function referencesIssuer(certificate, issuer) {
 const ref=certificate.spec?.issuerRef;
 return certificate.apiVersion==='cert-manager.io/v1' && certificate.kind==='Certificate' && ref?.name===issuer.metadata?.name && (ref.group||'cert-manager.io')==='cert-manager.io' && (ref.kind||'Issuer')===issuer.kind && (issuer.kind==='ClusterIssuer'||certificate.metadata?.namespace===issuer.metadata?.namespace);
}
export function issuerCertificateReferences(resources,issuer) {
 return resources.filter(resource=>referencesIssuer(resource,issuer)).map(resource=>`${resource.metadata.namespace}/${resource.metadata.name}`);
}
// Read current references before any dry run or mutation, including references
// introduced by other proposals in this batch. A denied read must fail closed.
export async function validateIssuerDeletions(changes,call) {
 const issuers=changes.filter(change=>change.configuration?.operation==='Delete').flatMap(change=>change.resources||[]).filter(resource=>resource.apiVersion==='cert-manager.io/v1'&&['Issuer','ClusterIssuer'].includes(resource.kind));
 if(!issuers.length)return;
 const response=await call('/apis/cert-manager.io/v1/certificates');
 if(!Array.isArray(response?.items))throw new Error('Certificate dependency inventory is unavailable.');
 const certificates=response.items.map(resource=>({apiVersion:'cert-manager.io/v1',kind:'Certificate',...resource}));
 const proposed=changes.filter(change=>change.configuration?.operation!=='Delete').flatMap(change=>change.resources||[]);
 for(const issuer of issuers){const references=issuerCertificateReferences([...certificates,...proposed],issuer);if(references.length)throw new Error(`Issuer ${issuer.metadata.name} is still used by certificates: ${[...new Set(references)].join(', ')}. Reconfigure these certificates before deleting it.`);}
}
