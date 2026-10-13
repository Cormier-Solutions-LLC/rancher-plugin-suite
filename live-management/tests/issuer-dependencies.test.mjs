import test from 'node:test';import assert from 'node:assert/strict';
import {referencesIssuer,validateIssuerDeletions} from '../issuer-dependencies.mjs';
import {applyResourceChanges} from '../kubernetes-apply.mjs';
const issuer={apiVersion:'cert-manager.io/v1',kind:'ClusterIssuer',metadata:{name:'owned',uid:'issuer-uid',resourceVersion:'9'}};
const certificate={apiVersion:'cert-manager.io/v1',kind:'Certificate',metadata:{name:'dependent',namespace:'demo'},spec:{issuerRef:{name:'owned',kind:'ClusterIssuer'}}};
const deletion={name:'owned',configuration:{operation:'Delete'},resources:[issuer]};
test('issuer references distinguish kind, namespace, and external issuer group',()=>{
 assert.equal(referencesIssuer(certificate,issuer),true);
 const namespaced={...issuer,kind:'Issuer',metadata:{...issuer.metadata,namespace:'demo'}};
 assert.equal(referencesIssuer({...certificate,spec:{issuerRef:{name:'owned'}}},namespaced),true);
 assert.equal(referencesIssuer({...certificate,metadata:{...certificate.metadata,namespace:'other'},spec:{issuerRef:{name:'owned'}}},namespaced),false);
 assert.equal(referencesIssuer(certificate,namespaced),false);
 assert.equal(referencesIssuer({...certificate,spec:{issuerRef:{name:'owned',kind:'ClusterIssuer',group:'external.example'}}},issuer),false);
});
test('current and proposed certificate references block all dry runs and mutations, and denied dependency reads fail closed',async()=>{
 for(const scenario of ['current','proposed','denied','malformed']){
  let writes=0;
  const call=async(path,init)=>{if(init){writes++;throw new Error('Unexpected mutation');}assert.equal(path,'/apis/cert-manager.io/v1/certificates');if(scenario==='denied')throw Object.assign(new Error('Forbidden'),{status:403});return scenario==='malformed'?{}:{items:scenario==='current'?[certificate]:[]};};
  const changes=scenario==='proposed'?[deletion,{name:'new',resources:[certificate]}]:[deletion];
  await assert.rejects(applyResourceChanges(changes,call),/still used|Forbidden|unavailable/);assert.equal(writes,0);
 }
});
test('a same-name namespaced issuer in another namespace can be deleted',async()=>{
 await validateIssuerDeletions([{...deletion,resources:[{...issuer,kind:'Issuer',metadata:{name:'owned',namespace:'other'}}]}],async()=>({items:[{...certificate,spec:{issuerRef:{name:'owned'}}}]}));
});
