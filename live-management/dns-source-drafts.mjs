import {prepareDnsSourceOperations,validateDnsSourceCatalog} from './dns-source-catalog.mjs';
const uuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value||'');
const settings=source=>Object.fromEntries(Object.entries(source).filter(([key])=>key!=='revision'));
const sameSettings=(left,right)=>JSON.stringify(settings(left))===JSON.stringify(settings(right));
export function sourceConfigurationDraft({id,operation,sourceId,settings,context}){
 const catalog=validateDnsSourceCatalog(context.catalog,context.registry),before=catalog.sources.find(source=>source.id===sourceId)||null;
 const value=operation==='Delete'?null:{id:sourceId,name:settings.name,type:'Windows Domain Controller',host:settings.host,address:settings.address,credential:settings.credential,bindingId:settings.bindingId};
 const change={id,operation,sourceId,value,expected:before};prepareDnsSourceOperations([change],catalog,context.registry);
 return {id,kind:'source',sourceId,name:(value||before).name,sourceChange:change};
}
export function sourceRestoreDrafts({configuration,snapshotScope,restoreSnapshotId,context,idFactory}){
 const catalog=validateDnsSourceCatalog(context.catalog,context.registry);
 if(configuration?.kind!=='DnsSourceCatalog'||configuration.id!=='sources/catalog'||configuration.namespace!=='dns-system'||!uuid(restoreSnapshotId))throw new Error('Select one saved DNS source catalog for restoration.');
 if(!snapshotScope||snapshotScope.catalogUid!==context.catalogUid||snapshotScope.bindingUid!==context.bindingUid||snapshotScope.bindingDigest!==context.bindingDigest||snapshotScope.userId!==context.userId)throw new Error('The saved source catalog belongs to another installed identity or Rancher user.');
 const saved=validateDnsSourceCatalog(configuration.dns?.catalog,context.registry),current=new Map(catalog.sources.map(source=>[source.id,source])),desired=new Map(saved.sources.map(source=>[source.id,source])),changes=[];
 // Remove obsolete owners first so a saved source can reclaim its registered
 // bridge or display name within this one reviewed, atomic catalog change.
 for(const source of catalog.sources)if(!desired.has(source.id))changes.push({id:idFactory(),operation:'Delete',sourceId:source.id,expected:source,value:null});
 for(const source of saved.sources){const before=current.get(source.id);if(before&&sameSettings(before,source))continue;changes.push({id:idFactory(),operation:before?'Update':'Restore',sourceId:source.id,expected:before||null,value:settings(source)});}
 if(!changes.length)throw new Error('The installed source catalog already matches this saved version.');
 prepareDnsSourceOperations(changes,catalog,context.registry);
 return changes.map(change=>({id:change.id,kind:'source',sourceId:change.sourceId,name:(change.value||change.expected).name,restoreSnapshotId,sourceChange:change}));
}
