import test from 'node:test';import assert from 'node:assert/strict';
import {applyResourceChanges} from '../kubernetes-apply.mjs';
import {validateRouteDependencies} from '../route-dependencies.mjs';
const backend={apiVersion:'v1',kind:'Service',metadata:{name:'app',namespace:'test',uid:'original',resourceVersion:'4'},spec:{ports:[{name:'http',port:80},{name:'echo',port:9002,protocol:'UDP'}]}};
const route=port=>({apiVersion:'traefik.io/v1alpha1',kind:'IngressRoute',metadata:{name:'app',namespace:'test'},spec:{routes:[{services:[{name:'app',port}]}]}});
test('a missing port prevents every route dry run and write',async()=>{
 let mutations=0;await assert.rejects(applyResourceChanges([{name:'bad',resources:[route(9999)]}],async(path,init)=>{if(init)mutations++;return backend;}),/does not expose TCP port 9999/);assert.equal(mutations,0);
});
test('named TCP and UDP references resolve against the entire planned Service batch',async()=>{
 const udp={...route('echo'),kind:'IngressRouteUDP'};
 await validateRouteDependencies([{resources:[route('http'),udp,backend]}],()=>{throw new Error('Planned Service must resolve without a read');});
 await assert.rejects(validateRouteDependencies([{resources:[route('echo'),backend]}],()=>{}),/TCP port echo/);
});
test('a missing, changed or deleted backend blocks publication',async()=>{
 const changes=[{resources:[route(80)]}];
 await assert.rejects(validateRouteDependencies(changes,async()=>{throw Object.assign(new Error('Missing'),{status:404});}),/unavailable/);
 await assert.rejects(validateRouteDependencies(changes,async()=>backend,new Map()),/reviewed backend changed/);
 await assert.rejects(validateRouteDependencies([...changes,{configuration:{operation:'Delete'},resources:[backend]}],()=>{}),/scheduled for deletion/);
});
