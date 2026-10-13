import test from 'node:test';import assert from 'node:assert/strict';import {validatePublishedListeners} from '../listener-validation.mjs';
const deployment={metadata:{name:'traefik',namespace:'traefik-system',uid:'proxy',resourceVersion:'12',generation:2},spec:{replicas:3,template:{metadata:{labels:{app:'traefik'}},spec:{containers:[{args:['--entrypoints.web.address=:8000/tcp','--entrypoints.dns.address=:15053/udp'],ports:[{name:'web',containerPort:8000},{name:'dns',containerPort:15053,protocol:'UDP'}]}]}}},status:{observedGeneration:2,updatedReplicas:3,availableReplicas:3}};
const service={apiVersion:'v1',kind:'Service',metadata:{name:'traefik',namespace:'traefik-system',uid:'service',resourceVersion:'20'},spec:{type:'LoadBalancer',selector:{app:'traefik'},ports:[{name:'web',port:80,targetPort:'web',protocol:'TCP'},{name:'dns',port:53,targetPort:'dns',protocol:'UDP'}]}};
const route={kind:'IngressRoute',metadata:{name:'test',namespace:'demo'},spec:{entryPoints:['web']}};
const observations={deployments:[deployment],services:[service]},call=async p=>p.includes('/deployments/')?deployment:service;
test('only published listeners of matching transport are accepted; route deletion still works after its listener disappears',async()=>{
 await validatePublishedListeners([{resources:[route]}],call,observations);await validatePublishedListeners([{resources:[{...route,kind:'IngressRouteUDP',spec:{entryPoints:['dns']}}]}],call,observations);
 for(const candidate of [{...route,spec:{entryPoints:['missing']}},{...route,kind:'IngressRouteUDP'},{...route,spec:{}}])await assert.rejects(validatePublishedListeners([{resources:[candidate]}],call,observations),/listener/);
 await validatePublishedListeners([{configuration:{operation:'Delete'},resources:[route]}],async()=>{throw new Error('No listener reads required for cleanup');},{deployments:[],services:[]});
});
test('proxy rollout or review changes prevent route publication',async()=>{
 for(const current of [{...deployment,metadata:{...deployment.metadata,resourceVersion:'13'}},{...deployment,status:{...deployment.status,updatedReplicas:2}}])await assert.rejects(validatePublishedListeners([{resources:[route]}],async p=>p.includes('/deployments/')?current:service,observations),/changed|rollout/);
});
