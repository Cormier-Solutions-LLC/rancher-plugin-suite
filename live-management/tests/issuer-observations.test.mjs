import test from 'node:test';import assert from 'node:assert/strict';
import {issuerProfile,mergeIssuerReferences} from '../issuer-observations.mjs';
test('referenced account and credential metadata populate dropdowns without Secret reads or duplicate keys',()=>{
 const state={credentialReferences:[{name:'credential',namespace:'cert-manager',keys:['existing'],source:'Saved reference'}],accountReferences:['other']};
 const resource={spec:{acme:{privateKeySecretRef:{name:'account'},solvers:[{dns01:{webhook:{config:{apiKeySecretRef:{name:'credential',key:'token'}}}}},{dns01:{webhook:{config:{apiKeySecretRef:{name:'new-reference',key:'api-key'}}}}}]}}};
 mergeIssuerReferences(state,[resource,resource]);assert.deepEqual(state.accountReferences,['other','account']);assert.deepEqual(state.credentialReferences[0].keys,['existing','token']);assert.equal(state.credentialReferences.length,2);assert.deepEqual(state.credentialReferences[1],{name:'new-reference',namespace:'cert-manager',keys:['api-key'],source:'Referenced by live issuer; values not read'});
});
test('DNS issuer profile uses observed selector and credential references',()=>{
 const p=issuerProfile({metadata:{name:'live'},spec:{acme:{server:'https://acme-staging-v02.api.letsencrypt.org/directory',email:'test@example.com',privateKeySecretRef:{name:'account'},solvers:[{selector:{dnsZones:['example.com','example.org']},dns01:{webhook:{groupName:'acme.example.com',solverName:'provider',config:{apiKeySecretRef:{name:'credential',key:'token'},production:false}}}}]}}});
 assert.equal(p.settings.zone,'example.com, example.org');assert.equal(p.settings.secretName,'credential');assert.equal(p.settings.accountSecretName,'account');assert.equal(p.settings.environment,'staging');
 assert.equal(JSON.stringify(p).includes('cormierconsulting'),false);
});
