import test from 'node:test';import assert from 'node:assert/strict';
import {applyResourceChanges,resourcePath} from '../kubernetes-apply.mjs';
const resource={apiVersion:'networking.k8s.io/v1',kind:'Ingress',metadata:{name:'fixture',namespace:'manager-acceptance'},spec:{rules:[]}};
const changes=[{name:'fixture',resources:[resource]}];
test('Certificate and issuer deletion orphan dependents while retaining UID/version preconditions in dry run and actual delete',async()=>{
 for(const kind of ['Certificate','Issuer','ClusterIssuer']){
  const target={apiVersion:'cert-manager.io/v1',kind,metadata:{name:'owned',...(kind==='ClusterIssuer'?{}:{namespace:'manager-acceptance'}),uid:'reviewed',resourceVersion:'9'}},options=[];let deleted=false;
  const result=await applyResourceChanges([{name:'owned',configuration:{operation:'Delete',secretPreserved:true},resources:[target]}],async(path,init)=>{
   if(path==='/apis/cert-manager.io/v1/certificates')return {items:[]};
   if(!init){if(deleted)throw Object.assign(new Error('Gone'),{status:404});return target;}
   const body=JSON.parse(init.body);options.push(body);assert.equal(body.propagationPolicy,'Orphan');assert.deepEqual(body.preconditions,{uid:'reviewed',resourceVersion:'9'});if(!body.dryRun)deleted=true;return {};
  });assert.equal(options.length,2);assert.deepEqual(options[0].dryRun,['All']);assert.equal(options[1].dryRun,undefined);assert.equal(result.applied[0].readBack,true);
 }
});
test('all dry runs finish before the first write; conflicts prevent every mutation',async()=>{
 const calls=[];await assert.rejects(applyResourceChanges(changes,async(path,init)=>{calls.push([path,init?.method]);if(!init)throw Object.assign(new Error('Missing'),{status:404});throw Object.assign(new Error('Field conflict'),{status:409});}),/conflict/);
 assert.equal(calls.length,2);assert.match(calls[1][0],/dryRun=All/);
});
test('resource version is required for updates and partial results identify accepted writes',async()=>{
 const batch=[...changes,{name:'second',resources:[{...resource,metadata:{name:'second',namespace:'manager-acceptance'}}]}];let writes=0;
 await assert.rejects(applyResourceChanges(batch,async(path,init)=>{if(!init)return {...resource,metadata:{...resource.metadata,uid:'owned',resourceVersion:'12'}};assert.equal(JSON.parse(init.body).metadata.resourceVersion,'12');if(path.includes('dryRun'))return {};if(++writes===2)throw new Error('Transport failure');return {metadata:{resourceVersion:'13'}};}),e=>e.applied.length===1&&/reconciliation/.test(e.message));
});
test('credentials deletion and unsupported resources never reach the API',async()=>{
 let calls=0;await assert.rejects(applyResourceChanges([{name:'secret',configuration:{operation:'Delete'},resources:[{apiVersion:'v1',kind:'Secret',metadata:{name:'credential',namespace:'test'}}]}],()=>calls++),/prohibited/);assert.equal(calls,0);
 assert.throws(()=>resourcePath({apiVersion:'rbac.authorization.k8s.io/v1',kind:'ClusterRoleBinding',metadata:{name:'unsafe'}}),/Unsupported/);
});
test('a changed or newly occupied reviewed target stops before every dry run',async()=>{
  for(const observations of [new Map(),new Map([[resourcePath(resource),{uid:'original',resourceVersion:'12'}]])]) {
    let mutations=0;
    await assert.rejects(applyResourceChanges(changes,async(path,init)=>{
      if(init){mutations++;return {};}
      return {...resource,metadata:{...resource.metadata,uid:'replacement',resourceVersion:'13'}};
    },observations),/reviewed target changed/);
    assert.equal(mutations,0);
  }
});
test('an accepted write with different API readback retains its receipt and stops the batch',async()=>{
 let writes=0;
 await assert.rejects(applyResourceChanges(changes,async(path,init)=>{
  if(!init){if(!writes)throw Object.assign(new Error('Missing'),{status:404});return {...resource,spec:{rules:[{host:'different.invalid'}]}};}
  if(path.includes('dryRun'))return {};
  writes++;return {...resource,metadata:{...resource.metadata,resourceVersion:'1'}};
 }),error=>error.applied.length===1&&error.applied[0].readBack===false&&/readback differs/.test(error.message));
 assert.equal(writes,1);
});
test('DELETE validation puts dryRun in DeleteOptions and the actual deletion omits it',async()=>{
 const writes=[];let deleted=false;
 const result=await applyResourceChanges([{name:'delete fixture',configuration:{operation:'Delete'},resources:[resource]}],async(path,init)=>{
  if(!init){if(deleted)throw Object.assign(new Error('Deleted'),{status:404});return {...resource,metadata:{...resource.metadata,uid:'owned',resourceVersion:'7'}};}
  const options=JSON.parse(init.body);writes.push(options);if(!options.dryRun)deleted=true;return {};
 });
 assert.deepEqual(writes[0].dryRun,['All']);assert.equal(writes[1].dryRun,undefined);assert.equal(result.applied[0].readBack,true);
});
