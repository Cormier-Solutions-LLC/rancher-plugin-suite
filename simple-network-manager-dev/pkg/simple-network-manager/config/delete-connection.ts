export function connectionDeletion(resource: any, pending: any[], live: boolean) {
  const supported = new Set(['networking.k8s.io/v1/Ingress', ...['IngressRoute','IngressRouteTCP','IngressRouteUDP'].map(kind=>`traefik.io/v1alpha1/${kind}`)]);
  if (!supported.has(`${resource?.apiVersion}/${resource?.kind}`) || !resource?.metadata?.name || !resource.metadata.namespace) throw new Error('Select an observed routing resource.');
  if (live && (!resource.metadata.uid || !resource.metadata.resourceVersion)) throw new Error('Refresh the route before preparing deletion.');
  if (pending.some(change=>change.resources?.some((item:any)=>item.apiVersion===resource.apiVersion && item.kind===resource.kind && item.metadata?.name===resource.metadata.name && item.metadata?.namespace===resource.metadata.namespace))) throw new Error('Review or discard the existing proposal for this route first.');
  const metadata = Object.fromEntries(['name','namespace','uid','resourceVersion'].filter(key=>resource.metadata[key]!==undefined).map(key=>[key,resource.metadata[key]]));
  return { id:`delete:connection:${resource.kind}/${resource.metadata.namespace}/${resource.metadata.name}`,category:'Delete Connection',name:resource.metadata.name,namespace:resource.metadata.namespace,
    resources:[{apiVersion:resource.apiVersion,kind:resource.kind,metadata}],configuration:{operation:'Delete',servicesPreserved:true,certificatesPreserved:true,secretsPreserved:true} };
}
