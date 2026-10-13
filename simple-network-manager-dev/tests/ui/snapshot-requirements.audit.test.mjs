import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotItems} from '../../pkg/simple-network-manager/config/snapshot-items.mjs';
import {compareMergedConfiguration} from '../../pkg/simple-network-manager/config/snapshot-merge.mjs';
test('same-name issuer profiles in different namespaces remain separate merge items',()=>{
 const issuer=namespace=>({name:'shared-name',manifest:{apiVersion:'cert-manager.io/v1',kind:'Issuer',metadata:{name:'shared-name',namespace},spec:{selfSigned:{}}}});
 const items=snapshotItems({issuerProfiles:[issuer('first'),issuer('second')]});
 assert.equal(items.filter(item=>item.type==='issuer').length,2,'Merge identities must include namespace');
});
test('a persistent resource label edit appears in merge differences',()=>{
 const source=label=>({routeManifests:[{apiVersion:'v1',kind:'Service',metadata:{name:'backend',namespace:'ai',labels:{application:label}},spec:{ports:[{port:80}]}}]});
 const rows=compareMergedConfiguration(source('before'),source('after'));
 assert.equal(rows[0].status,'Changed','Persistent labels are configuration, not transient status');
});
