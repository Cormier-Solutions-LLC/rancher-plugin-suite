// Kubernetes accepts routes with missing Service ports; Traefik then drops those routes.
// Validate every route dependency before any dry run or write in a publication batch.
export async function validateRouteDependencies(changes,call,observations) {
 const planned=new Map();
 for(const change of changes)for(const r of change.resources||[])if(r.kind==='Service')planned.set(`/api/v1/namespaces/${r.metadata.namespace}/services/${r.metadata.name}`,{resource:r,deleted:change.configuration?.operation==='Delete'});
 const loaded=new Map();
 async function service(namespace,name) {
  const path=`/api/v1/namespaces/${namespace}/services/${name}`;
  if(planned.has(path)){const item=planned.get(path);if(item.deleted)throw new Error(`Route backend is scheduled for deletion: ${namespace}/${name}`);return item.resource;}
  if(!loaded.has(path)){
   let result;try{result=await call(path);}catch(e){if(e.status===404)throw new Error(`Route backend Service is unavailable: ${namespace}/${name}`);throw e;}
   const expected=observations?.get(path);
   if(observations&&(!expected||expected.uid!==result.metadata.uid||expected.resourceVersion!==result.metadata.resourceVersion))throw new Error(`The reviewed backend changed: ${namespace}/${name}. Refresh and review again.`);
   if(result.metadata.deletionTimestamp)throw new Error(`Route backend Service is being deleted: ${namespace}/${name}`);
   loaded.set(path,result);
  }
  return loaded.get(path);
 }
 for(const change of changes){if(change.configuration?.operation==='Delete')continue;
  for(const r of change.resources||[]){
   let backends=[],protocol='TCP';
   if(r.kind==='Ingress')backends=[r.spec?.defaultBackend,...(r.spec?.rules||[]).flatMap(rule=>(rule.http?.paths||[]).map(path=>path.backend))].filter(Boolean).map(b=>{if(!b.service)throw new Error('This Ingress backend requires a supported Service reference.');return {name:b.service.name,port:b.service.port.name??b.service.port.number};});
   else if(['IngressRoute','IngressRouteTCP','IngressRouteUDP'].includes(r.kind)){backends=(r.spec?.routes||[]).flatMap(route=>route.services||[]).filter(b=>!b.name?.endsWith('@internal'));if(r.kind==='IngressRouteUDP')protocol='UDP';}
   for(const backend of backends){
    if(backend.kind&&backend.kind!=='Service')throw new Error(`Backend kind ${backend.kind} requires its own dependency validation.`);
    const namespace=backend.namespace||r.metadata.namespace;
    if(!/^[a-z0-9][a-z0-9.-]*$/.test(backend.name||'')||!/^[a-z0-9][a-z0-9-]*$/.test(namespace||''))throw new Error('Invalid backend Service identity.');
    const target=await service(namespace,backend.name);
    const matches=target.spec?.ports?.some(p=>(p.protocol||'TCP')===protocol&&(typeof backend.port==='number'?p.port===backend.port:p.name===backend.port));
    if(!matches)throw new Error(`Route backend ${namespace}/${backend.name} does not expose ${protocol} port ${backend.port}.`);
   }
  }
 }
}
