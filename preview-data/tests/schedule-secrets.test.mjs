import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {previewSecretStore,kubernetesSecretStore} from '../schedule-secrets.mjs';
test('preview passwords survive a new store instance without plaintext files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'schedule-secrets-'));try{const password='Test-only-Secret-Passphrase42!',store=previewSecretStore(dir,'network-password'),ref=await store.put(password);
 for(const file of await readdir(join(dir,'.credentials')))assert.equal((await readFile(join(dir,'.credentials',file))).includes(Buffer.from(password)),false);
 assert.equal(await previewSecretStore(dir,'network-password').get(ref),password);
 await assert.rejects(store.get({...ref,name:'../outside'}));await assert.rejects(previewSecretStore(dir,'dns-password').get(ref));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Kubernetes passwords use immutable Opaque Secrets and validate ownership',async()=>{
 const calls=[];let saved;const request=async(method,path,body)=>{calls.push({method,path});if(body){saved=body;return body;}return saved;};
 const store=kubernetesSecretStore({prefix:'network-password',namespace:'backups',request});const ref=await store.put('test-password');
 assert.equal(saved.kind,'Secret');assert.equal(saved.immutable,true);assert.equal(saved.type,'Opaque');assert.equal(ref.provider,'kubernetes');
 assert.equal(await store.get(ref),'test-password');assert.equal(calls[0].path,'/api/v1/namespaces/backups/secrets');
 await assert.rejects(store.get({...ref,namespace:'other'}));saved.metadata.labels={};await assert.rejects(store.get(ref));
});
test('production vault keeps rotation history with only named Secret reads and updates',async()=>{
 let secret={metadata:{resourceVersion:'1'},data:{}},conflict=true;const calls=[];
 const request=async(method,path,body)=>{calls.push({method,path});if(method==='GET')return structuredClone(secret);if(conflict){conflict=false;throw Object.assign(new Error('Concurrent writer'),{status:409});}assert.equal(body.metadata.resourceVersion,secret.metadata.resourceVersion);secret={...body,metadata:{...body.metadata,resourceVersion:String(Number(secret.metadata.resourceVersion)+1)}};return secret;};
 const store=kubernetesSecretStore({prefix:'network-password',namespace:'backups',vaultName:'network-vault',request});
 const first=await store.put('first'),second=await store.put('rotated');
 assert.equal(await store.get(first),'first');assert.equal(await store.get(second),'rotated');
 assert.ok(calls.every(c=>c.path==='/api/v1/namespaces/backups/secrets/network-vault'));
 assert.ok(calls.every(c=>['GET','PUT'].includes(c.method)));
 await assert.rejects(store.get({...first,name:'dns-vault'}));await assert.rejects(store.get({...first,namespace:'other'}));
});
