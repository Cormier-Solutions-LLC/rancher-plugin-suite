import assert from 'node:assert/strict';
import { validateChangeBatch } from '../pkg/simple-network-manager/config/change-batch.mjs';
const resource={apiVersion:'v1',kind:'Service',metadata:{name:'web',namespace:'apps'},spec:{ports:[{port:80}]}};
const change={id:'a',resources:[resource]};
assert.equal(validateChangeBatch([change])[0],change);
assert.throws(()=>validateChangeBatch([]),/Select/);
assert.throws(()=>validateChangeBatch([change,{id:'b',resources:[resource],configuration:{operation:'Delete'}}]),/Conflicting/);
assert.throws(()=>validateChangeBatch([{resources:[{apiVersion:'v1',kind:'Secret',metadata:{name:'excluded'}}]}]),/Secret/);
assert.throws(()=>validateChangeBatch([{resources:[],configuration:{operation:'Delete',dependentPublications:['apps/web']}}]),/still used/);
assert.throws(()=>validateChangeBatch([{resources:[{kind:'Ingress'}]}]),/incomplete/);
console.log('Change batch checks passed: ambiguous apply/delete conflicts, Secret exclusion, incomplete resources, and in-use configuration deletion.');

const restoredSecret={id:"restore-secret",resources:[{apiVersion:"v1",kind:"Secret",metadata:{name:"test",namespace:"apps"},data:{token:"ZmFrZQ=="}}],configuration:{restoreSecretConfirmed:true}};
assert.doesNotThrow(()=>validateChangeBatch([restoredSecret]));
assert.throws(()=>validateChangeBatch([{...restoredSecret,configuration:{operation:"Delete",restoreSecretConfirmed:true}}]),/prohibited/);
