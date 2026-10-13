import {validatePortLinks} from '../simple-network-manager-dev/pkg/simple-network-manager/config/port-link-validation.mjs';
import {issuerCertificateReferences} from './issuer-dependencies.mjs';
const issuerKey=profile=>`${profile?.manifest?.kind}/${profile?.manifest?.metadata?.namespace||''}/${profile?.name}`;
const issuerRemoval=c=>['Delete','RemoveIssuerProfile'].includes(c.configuration?.operation)&&c.configuration?.issuerProfileTarget;
const copy=structuredClone,signature=c=>JSON.stringify([c.id,c.name,c.namespace||'',c.service||'',c.revision||0,(c.ports||[]).map(p=>[p.label,p.port,p.mode,p.action||'',p.targetLabel||''])]);
export const isCatalogChange=c=>!c.resources?.length&&(c.configuration?.operation==='RemoveIssuerProfile'||c.configuration?.operation==='DeletePublicationDraft'||[undefined,'Apply','Save'].includes(c.configuration?.operation)&&Array.isArray(c.configuration?.ports)&&c.configuration?.id||c.configuration?.operation==='Delete'&&Array.isArray(c.configuration.target?.ports)&&c.configuration.target?.id);
export function prepareCatalogOperations(changes,state,namespaces){
 const next=copy(state),operations=[],seen=new Set();next.portConfigurations||=[];
 for(const change of changes.filter(c=>isCatalogChange(c)||issuerRemoval(c))){
  if(issuerRemoval(change)){
   const target=change.configuration.issuerProfileTarget,resource=target.manifest,key=issuerKey(target),deletion=change.configuration.operation==='Delete';
   if(!resource||resource.apiVersion!=='cert-manager.io/v1'||!['Issuer','ClusterIssuer'].includes(resource.kind)||resource.metadata?.name!==target.name||resource.kind==='Issuer'&&!namespaces.includes(resource.metadata.namespace)||seen.has(`issuer:${key}`))throw new Error('Invalid or duplicate issuer profile removal.');
   if(deletion?(change.resources?.length!==1||change.resources[0].apiVersion!==resource.apiVersion||change.resources[0].kind!==resource.kind||change.resources[0].metadata?.name!==resource.metadata.name||change.resources[0].metadata?.namespace!==resource.metadata.namespace||!change.resources[0].metadata.uid||!change.resources[0].metadata.resourceVersion):change.resources?.length)throw new Error('Issuer profile removal must match the reviewed Kubernetes deletion or preserve all Kubernetes resources.');
   seen.add(`issuer:${key}`);
   const index=(next.issuerProfiles||[]).findIndex(profile=>issuerKey(profile)===key);
   if(index<0||JSON.stringify(next.issuerProfiles[index])!==JSON.stringify(target))throw new Error('The reviewed issuer profile changed. Refresh and review again.');
   const pending=(state.pendingChanges||[]).flatMap(proposal=>proposal.resources||[]);
   if(issuerCertificateReferences(pending,resource).length)throw new Error('This issuer is still used by pending certificates. Review those proposals before deleting it.');
   next.issuerProfiles.splice(index,1);
   operations.push({entity:'IssuerProfile',id:key,name:target.name,namespace:resource.metadata.namespace||'',kind:resource.kind,operation:'Delete',value:null});
   continue;
  }
  if(change.configuration.operation==='DeletePublicationDraft'){
   const target=change.configuration.target,key=`${target?.namespace}/${target?.name}`;
   if(!target?.name||!target.namespace||!namespaces.includes(target.namespace)||seen.has(`publication:${key}`))throw new Error('Invalid or duplicate publication draft removal.');
   seen.add(`publication:${key}`);
   const index=(next.publications||[]).findIndex(p=>p.namespace===target.namespace&&p.name===target.name);
   if(index<0||JSON.stringify(next.publications[index])!==JSON.stringify(target))throw new Error('The reviewed publication draft changed. Refresh and review again.');
   next.publications.splice(index,1);
   operations.push({entity:'PublicationDraft',id:key,name:target.name,namespace:target.namespace,operation:'Delete',value:null});
   continue;
  }
  const deletion=change.configuration.operation==='Delete',config=deletion?change.configuration.target:change.configuration;
  if(typeof config.id!=='string'||!/^[a-z0-9][a-z0-9.-]{0,252}$/.test(config.id)||['constructor','prototype'].includes(config.id)||typeof config.name!=='string'||!config.name.trim()||config.name.length>120||config.namespace!==undefined&&(typeof config.namespace!=='string'||config.namespace&&!namespaces.includes(config.namespace))||!Array.isArray(config.ports)||!config.ports.length||config.ports.length>1024)throw new Error('Invalid port catalog configuration or namespace.');
  if(seen.has(config.id))throw new Error('Select only one catalog change per configuration.');seen.add(config.id);
  if(config.ports.some(p=>!Number.isInteger(p.port)||p.port<1||p.port>65535||!['HTTP','HTTPS','TLS','TCP','UDP'].includes(p.mode)||typeof p.label!=='string'||!p.label.trim()))throw new Error('Invalid catalog port, transport or label.');
  const signatures=config.ports.map(p=>`${p.port}/${p.mode==='UDP'?'UDP':'TCP'}`);if(new Set(signatures).size!==signatures.length)throw new Error('A configuration cannot define the same port and transport twice.');validatePortLinks(config.ports);
  const index=next.portConfigurations.findIndex(c=>c.id===config.id),current=next.portConfigurations[index];
  if(current&&(current.namespace||'')!==(config.namespace||''))throw new Error('An existing port configuration cannot change its namespace scope.');
  if(deletion){
   if(!current||signature(current)!==signature(config))throw new Error('The reviewed catalog target changed. Refresh and review again.');
   if((next.publications||[]).some(p=>p.configurationIds?.includes(config.id)))throw new Error('This port configuration is still used by publication drafts. Remove those references before deleting it.');
   next.portConfigurations.splice(index,1);
  }else{
   if(next.portConfigurations.some(c=>c.id!==config.id&&(c.namespace||'')===(config.namespace||'')&&c.name.toLowerCase()===config.name.toLowerCase()))throw new Error('Another catalog configuration already uses this name in the same scope.');
   const value={...copy(config),source:'Saved catalog configuration'};if(index<0)next.portConfigurations.push(value);else next.portConfigurations[index]=value;
  }
  operations.push({id:config.id,name:config.name,namespace:config.namespace||'',operation:deletion?'Delete':'Save',value:deletion?null:next.portConfigurations.find(c=>c.id===config.id)});
 }
 return {next,operations};
}
export function verifyCatalogOperations(operations,state){for(const op of operations){const current=op.entity==='IssuerProfile'?state.issuerProfiles?.find(profile=>issuerKey(profile)===op.id):op.entity==='PublicationDraft'?state.publications?.find(p=>p.namespace===op.namespace&&p.name===op.name):state.portConfigurations?.find(c=>c.id===op.id);if(op.operation==='Delete'?!!current:!current||signature(current)!==signature(op.value))throw new Error('Saved catalog readback differs; refresh and reconcile the original proposals.');}}
