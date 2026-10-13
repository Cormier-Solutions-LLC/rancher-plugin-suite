import {readFile} from 'node:fs/promises';import https from 'node:https';
import {projectNetwork} from '../live-management/network-observations.mjs';import {issuerProfile} from '../live-management/issuer-observations.mjs';
import {containsSecretValues} from '../simple-network-manager-dev/pkg/simple-network-manager/config/backup-zip.mjs';
import {secretReferences} from '../simple-network-manager-dev/pkg/simple-network-manager/config/snapshot-secrets.mjs';
export const networkCapturePaths={services:'/api/v1/services',ingresses:'/apis/networking.k8s.io/v1/ingresses',certificates:'/apis/cert-manager.io/v1/certificates',issuers:'/apis/cert-manager.io/v1/issuers',clusterissuers:'/apis/cert-manager.io/v1/clusterissuers',ingressroutes:'/apis/traefik.io/v1alpha1/ingressroutes',ingressroutetcps:'/apis/traefik.io/v1alpha1/ingressroutetcps',ingressrouteudps:'/apis/traefik.io/v1alpha1/ingressrouteudps',middlewares:'/apis/traefik.io/v1alpha1/middlewares',serverstransports:'/apis/traefik.io/v1alpha1/serverstransports'};
const failure=message=>Object.assign(new Error(message),{code:'FRESH_SOURCE_UNAVAILABLE',status:503});
function statePath(){const name=process.env.SNAPSHOT_NETWORK_STATE_CONFIGMAP;if(!/^network-manager-state-[a-z0-9-]+$/.test(name||''))throw failure('A named manager configuration owner is required.');return '/api/v1/namespaces/cattle-ui-plugin-system/configmaps/'+name;}
export async function readNetworkSource(path){
 if(!Object.values(networkCapturePaths).includes(path)&&path!==statePath()&&!/^\/api\/v1\/namespaces\/[a-z0-9]([-a-z0-9]*[a-z0-9])?\/secrets\/[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/.test(path))throw failure('Unsupported network capture reference.');
 const directory='/var/run/secrets/kubernetes.io/serviceaccount/';let token,ca;
 try{[token,ca]=await Promise.all([readFile(directory+'token','utf8'),readFile(directory+'ca.crt')]);}catch{throw failure('The capture service credential is unavailable.');}
 return new Promise((resolve,reject)=>{const req=https.get({host:process.env.KUBERNETES_SERVICE_HOST,port:Number(process.env.KUBERNETES_SERVICE_PORT_HTTPS||443),path,ca,rejectUnauthorized:true,headers:{Authorization:'Bearer '+token.trim()},timeout:10000},res=>{let body='';res.on('data',chunk=>{body+=chunk;if(body.length>8*1024*1024)req.destroy(failure('Network capture exceeds the response limit.'));});res.on('end',()=>{try{if(res.statusCode!==200)throw failure('Network inventory read failed; check capture permissions.');resolve(JSON.parse(body));}catch(e){reject(failure(e.message));}});});req.on('timeout',()=>req.destroy(failure('Network inventory read timed out.')));req.on('error',()=>reject(failure('Network inventory is unavailable.')));});
}
export async function freshNetworkSnapshot(saved,read=readNetworkSource,now=Date.now(),{includeSecrets=false}={}){
 const scope=saved?.snapshotScope;if(scope?.source!=='Authenticated Kubernetes inventory and saved manager configuration'||typeof scope.namespace!=='string'||scope.namespace&&!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(scope.namespace))throw failure('Select a live routing scope for unattended capture.');
 if(containsSecretValues(saved))throw failure('Fresh credential capture is not authorized. Choose a schedule without captured Secret values; keep protected manual credential backups.');
 const inScope=value=>!scope.namespace||!value.namespace||value.namespace===scope.namespace;
 const [cm,entries]=await Promise.all([read(statePath()),Promise.all(Object.entries(networkCapturePaths).map(async([key,path])=>{const list=await read(path);if(!Array.isArray(list.items)||!list.kind?.endsWith('List')||!list.apiVersion)throw failure('Incomplete live network inventory.');return [key,list.items.map(item=>({apiVersion:list.apiVersion,kind:list.kind.replace(/List$/,''),...item})).filter(item=>inScope(item.metadata||{}))];}))]);
 let state;try{state=JSON.parse(cm.data['state.json']);}catch{throw failure('Saved manager configuration is unreadable.');}
 if(!Array.isArray(state.portConfigurations))throw failure('Saved manager configuration is incomplete.');
 const configs=structuredClone(state.portConfigurations.filter(inScope));
 if(!state.managerCatalogVersion)for(const template of [{id:'http',name:'HTTP',ports:[{label:'HTTP',port:80,mode:'HTTP'}],source:'Predefined'},{id:'https',name:'HTTPS',ports:[{label:'HTTPS',port:443,mode:'HTTPS'}],source:'Predefined'},{id:'web',name:'Web · HTTP + HTTPS',ports:[{label:'HTTP',port:80,mode:'HTTP'},{label:'HTTPS',port:443,mode:'HTTPS'}],source:'Predefined'}])if(!configs.some(c=>c.id===template.id))configs.push(template);
 const resources=Object.fromEntries(entries),observedAt=new Date(now).toISOString(),inventory=projectNetwork(resources,observedAt);
 const current={...structuredClone(saved),configuration:configs[0],relatedConfigurations:configs.slice(1),localPublications:structuredClone((state.publications||[]).filter(inScope)),editedConnections:structuredClone((state.connectionDrafts||[]).filter(inScope)),pendingChanges:[],routeManifests:[...inventory['route-resources-snapshot.json'].resources,...inventory['certificate-resources-snapshot.json'].resources,...inventory['dependency-resources-snapshot.json'].resources],observedRoutes:inventory['route-attachment-snapshot.json'].routes,observedServiceReferences:inventory['publication-snapshot.json'].services,issuerProfiles:[...resources.clusterissuers,...resources.issuers].map(issuerProfile),snapshotScope:{...scope,capturedFrom:'Fresh Kubernetes reads and the named saved manager configuration'}};
 current.secretBackup={complete:false,missing:[],capturedAt:null};
 if(includeSecrets){
  // References come only from fresh, scoped API observations. Never read a Secret
  // requested by a cached browser template, and never fall back to cached values.
  const refs=secretReferences(current.routeManifests,'cert-manager');
  if(refs.length>256)throw failure('Too many referenced Secrets for one capture.');
  let bytes=0;
  for(const ref of refs){
   if(!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(ref.namespace)||! /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/.test(ref.name))throw failure('Invalid live Secret reference.');
   let secret;try{secret=await read(`/api/v1/namespaces/${ref.namespace}/secrets/${ref.name}`);}catch{throw failure('Fresh referenced Secret capture failed. Check named Secret read permissions.');}
   if(secret?.apiVersion!=='v1'||secret.kind!=='Secret'||secret.metadata?.name!==ref.name||secret.metadata?.namespace!==ref.namespace||!secret.data||typeof secret.data!=='object'||Array.isArray(secret.data)||Object.values(secret.data).some(v=>typeof v!=='string'))throw failure('Fresh referenced Secret capture returned an incomplete or mismatched resource.');
   const captured={apiVersion:'v1',kind:'Secret',metadata:{name:ref.name,namespace:ref.namespace,...(secret.metadata.labels?{labels:structuredClone(secret.metadata.labels)}:{})},type:secret.type||'Opaque',data:structuredClone(secret.data)};
   bytes+=Buffer.byteLength(JSON.stringify(captured));if(bytes>2*1024*1024)throw failure('Referenced Secret values exceed the capture limit.');
   current.routeManifests.push(captured);
  }
  current.secretBackup={complete:true,missing:[],capturedAt:observedAt};
 }
 return {current,observedAt};
}
