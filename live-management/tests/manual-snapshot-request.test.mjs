import test from 'node:test';import assert from 'node:assert/strict';
import {manualSnapshotRequest} from '../../simple-network-manager-dev/pkg/simple-network-manager/config/manual-snapshot-request.mjs';
const current={configuration:{id:'fixture',name:'Fixture'},routeManifests:[{apiVersion:'v1',kind:'Secret',metadata:{name:'fixture-key',namespace:'demo',annotations:{unsafe:'credential-metadata'}},data:{token:'synthetic-private-value'}}],snapshotScope:{namespace:'demo'}};
test('protected manual capture uses the manual archive endpoint without putting credentials in its scope key',()=>{
 const request=manualSnapshotRequest(current,{includeSecrets:true,password:'Synthetic-test-backup-passphrase-2026!'});
 assert.equal(request.path,'/api/snapshots');assert.equal(request.body.current.routeManifests[0].data.token,'synthetic-private-value');assert.notEqual(request.body.current,current);assert.ok(!request.body.scopeKey.includes('synthetic-private-value'));assert.ok(!request.body.scopeKey.includes('credential-metadata'));
 request.body.current.routeManifests[0].data.token='changed';assert.equal(current.routeManifests[0].data.token,'synthetic-private-value');
 assert.throws(()=>manualSnapshotRequest(current,{includeSecrets:true,password:'short'}),/strong backup password/);
});
test('configuration-only manual capture retains fresh unattended reads and strips cached Secret values',()=>{
 const request=manualSnapshotRequest(current);assert.equal(request.path,'/api/snapshot-schedule/run');assert.equal(request.body.password,'');assert.deepEqual(request.body.current.routeManifests[0],{apiVersion:'v1',kind:'Secret',metadata:{name:'fixture-key',namespace:'demo'}});assert.equal(current.routeManifests[0].data.token,'synthetic-private-value');
});
