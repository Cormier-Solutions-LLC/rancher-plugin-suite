import {validateDnsSourceCatalog,sourceCatalogFingerprint} from './dns-source-catalog.mjs';
const fail=()=>Object.assign(new Error('Save a fresh server backup of the current installed source catalog before applying source changes.'),{status:409,code:'SOURCE_BACKUP_UNCONFIRMED'});
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v||'');
function identities({catalogUid,bindingUid,bindingDigest,userId}){if(!uuid(catalogUid)||!uuid(bindingUid)||!/^[a-f0-9]{64}$/.test(bindingDigest||'')||!/^user-[a-z0-9-]+$/.test(userId||''))throw fail();}
export function sourceCatalogCapture(object,registry,identity){
 identities(identity);if(object?.apiVersion!=='v1'||object.kind!=='ConfigMap'||object.metadata?.name!=='dns-manager-sources'||object.metadata.namespace!=='dns-system'||object.metadata.uid!==identity.catalogUid||!object.metadata.resourceVersion||object.metadata.deletionTimestamp)throw fail();
 let catalog;try{catalog=validateDnsSourceCatalog(JSON.parse(object.data['sources.json']),registry);}catch{throw fail();}
 return {configuration:{id:'sources/catalog',name:'DNS Sources',kind:'DnsSourceCatalog',namespace:'dns-system',dns:{catalog}},relatedConfigurations:[],routeManifests:[],pendingChanges:[],credentialReferences:[],snapshotScope:{label:'DNS Source Configuration',source:'Authenticated Rancher source catalog',...identity}};
}
export function validateSourceCatalogBackup(snapshot,catalog,registry,identity,{now=Date.now()}={}){
 identities(identity);const age=now-Date.parse(snapshot?.createdAt),current=snapshot?.current;
 if(!uuid(snapshot?.id)||snapshot.schemaVersion!==1||snapshot.format!=='DNS Manager configuration snapshot'||snapshot.encrypted===true||snapshot.includesSecretValues===true||snapshot.includesApplicationData===true||!Number.isFinite(age)||age<0||age>=86400000||!current||current.configuration?.kind!=='DnsSourceCatalog'||current.configuration.id!=='sources/catalog'||current.configuration.namespace!=='dns-system')throw fail();
 for(const key of ['catalogUid','bindingUid','bindingDigest','userId'])if(current.snapshotScope?.[key]!==identity[key])throw fail();
 if(['relatedConfigurations','routeManifests','pendingChanges','credentialReferences'].some(key=>!Array.isArray(current[key])||current[key].length))throw fail();
 const allowed=['configuration','relatedConfigurations','routeManifests','pendingChanges','credentialReferences','snapshotScope','secretBackup'];if(Object.keys(current).some(key=>!allowed.includes(key))||Object.keys(current.configuration).some(key=>!['id','name','kind','namespace','dns'].includes(key))||Object.keys(current.configuration.dns||{}).join('|')!=='catalog'||Object.keys(current.snapshotScope||{}).some(key=>!['label','source','catalogUid','bindingUid','bindingDigest','userId'].includes(key)))throw fail();
 if(current.secretBackup&&(Object.keys(current.secretBackup).some(key=>!['complete','missing'].includes(key))||typeof current.secretBackup.complete!=='boolean'||!Array.isArray(current.secretBackup.missing)||current.secretBackup.missing.length))throw fail();
 let saved,expected;try{saved=validateDnsSourceCatalog(current.configuration.dns.catalog,registry);expected=validateDnsSourceCatalog(catalog,registry);}catch{throw fail();}
 if(sourceCatalogFingerprint(saved)!==sourceCatalogFingerprint(expected))throw fail();return true;
}
