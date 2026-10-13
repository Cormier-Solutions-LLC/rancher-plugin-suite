import {projectNetwork} from './network-observations.mjs';
import {resourcePath} from './kubernetes-apply.mjs';
export async function validatePublishedListeners(changes,call,observations){
 const resources=changes.filter(c=>c.configuration?.operation!=='Delete').flatMap(c=>c.resources||[]).filter(r=>['Ingress','IngressRoute','IngressRouteTCP','IngressRouteUDP'].includes(r.kind));
 if(!resources.length)return;
 const reviewed=observations.deployments.find(d=>d.metadata.namespace==='traefik-system'&&d.metadata.name==='traefik');if(!reviewed)throw new Error('The reviewed Traefik deployment is unavailable.');
 const current=await call('/apis/apps/v1/namespaces/traefik-system/deployments/traefik');
 if(current.metadata.uid!==reviewed.metadata.uid||current.metadata.resourceVersion!==reviewed.metadata.resourceVersion)throw new Error('Traefik configuration changed during review. Refresh before publishing.');
 const replicas=current.spec.replicas||1;if(current.status?.observedGeneration!==current.metadata.generation||current.status?.updatedReplicas!==replicas||current.status?.availableReplicas!==replicas)throw new Error('Traefik has not completed its listener rollout. Wait for it to become ready before publishing.');
 const labels=current.spec.template.metadata.labels;
 const services=[];for(const service of observations.services.filter(s=>s.metadata.namespace==='traefik-system'&&s.spec.type==='LoadBalancer'&&Object.keys(s.spec.selector||{}).length&&Object.entries(s.spec.selector).every(([k,v])=>labels[k]===v))){const confirmed=await call(resourcePath(service));if(confirmed.metadata.uid!==service.metadata.uid||confirmed.metadata.resourceVersion!==service.metadata.resourceVersion)throw new Error('Published listener ports changed during review. Refresh before publishing.');services.push(confirmed);}
 const listeners=projectNetwork({deployments:[current],services})['listener-snapshot.json'].entryPoints;
 for(const resource of resources){
  const names=resource.kind==='Ingress'?(resource.metadata.annotations?.['traefik.ingress.kubernetes.io/router.entrypoints']||'').split(',').map(n=>n.trim()).filter(Boolean):resource.spec.entryPoints;
  if(!Array.isArray(names)||!names.length)throw new Error('Choose explicit active Traefik listeners before publishing.');
  const protocol=resource.kind==='IngressRouteUDP'?'UDP':'TCP';
  for(const name of names)if(!listeners.some(l=>l.name===name&&l.protocol===protocol&&l.exposed))throw new Error(`Traefik listener ${name} is not published for ${protocol}. Configure an active listener before publishing this route.`);
 }
}
