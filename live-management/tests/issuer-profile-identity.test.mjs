import test from 'node:test';import assert from 'node:assert/strict';
import {issuerProfileKey,findIssuerProfile} from '../issuer-profile-identity.mjs';
import {snapshotItems,itemsToCurrent} from '../../simple-network-manager-dev/pkg/simple-network-manager/config/snapshot-items.mjs';
import {coverageEntries} from '../../simple-network-manager-dev/pkg/simple-network-manager/config/snapshot-coverage.mjs';
test('same-named global and namespaced issuers remain distinct in selection and snapshots',()=>{
 const profiles=[['ClusterIssuer',''],['Issuer','one'],['Issuer','two']].map(([kind,namespace])=>({name:'shared',manifest:{apiVersion:'cert-manager.io/v1',kind,metadata:{name:'shared',...(namespace?{namespace}:{})},spec:{selfSigned:{}}}}));
 assert.equal(new Set(profiles.map(issuerProfileKey)).size,3);assert.equal(findIssuerProfile(profiles,'shared'),undefined);
 for(const profile of profiles)assert.equal(findIssuerProfile(profiles,issuerProfileKey(profile)),profile);
 assert.equal(findIssuerProfile([profiles[0]],'shared'),profiles[0]);
 const items=snapshotItems({issuerProfiles:profiles});assert.equal(items.filter(i=>i.type==='issuer').length,3);
 assert.deepEqual(itemsToCurrent(items).issuerProfiles,profiles);
 const coverage=coverageEntries({issuerProfiles:profiles}).filter(i=>i.id.startsWith('issuer-profile/'));
 assert.equal(coverage.length,3);assert.equal(coverage[0].id,'issuer-profile/shared');assert.equal(coverage[1].id,'issuer-profile/Issuer/one/shared');
});
