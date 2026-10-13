import {managedResourceDeletion} from './delete-managed-resource';
import {issuerCertificateReferences} from '../../../../live-management/issuer-dependencies.mjs';
export function issuerProfileDeletion(profile:any,pending:any[],source?:any,preview=false){
 const resource=profile.manifest;
 if(!resource||resource.apiVersion!=='cert-manager.io/v1'||!['Issuer','ClusterIssuer'].includes(resource.kind)||resource.metadata?.name!==profile.name)throw new Error('Refresh the issuer profile before preparing deletion.');
 const references=[...(source?.issuerReferences?.(resource)||[]),...issuerCertificateReferences(pending.flatMap(change=>change.resources||[]),resource)];
 if(references.length)throw new Error(`Issuer ${profile.name} is still used by certificates: ${[...new Set(references)].join(', ')}. Reconfigure these certificates before deleting it.`);
 if(pending.some(change=>change.resources?.some((item:any)=>item.apiVersion===resource.apiVersion&&item.kind===resource.kind&&item.metadata?.name===resource.metadata.name&&item.metadata?.namespace===resource.metadata.namespace)))throw new Error('Review or discard the existing proposal for this resource first.');
 const target=JSON.parse(JSON.stringify(profile));
 if(!preview&&source?.reviewedResourceIdentity&&!source.reviewedResourceIdentity(resource))return {id:`remove-issuer-profile:${resource.kind}:${resource.metadata.namespace||''}/${profile.name}`,category:'Remove Issuer Profile',name:profile.name,namespace:resource.metadata.namespace||'',resources:[],configuration:{operation:'RemoveIssuerProfile',issuerProfileTarget:target,secretPreserved:true}};
 const change=managedResourceDeletion(resource,pending,source,preview);
 return {...change,configuration:{...change.configuration,issuerProfileTarget:target}};
}
