import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorizeSnapshot, isSnapshotApi} from '../snapshot-access.mjs';

const headers = {origin: 'https://rancher.cormierconsulting.io', cookie: 'R_SESS=fixture; CSRF=fixture'};
const identity = {apiVersion: 'authentication.k8s.io/v1', kind: 'SelfSubjectReview', status: {userInfo: {username: 'user-test'}}};

function fixture({manager = 'dns', method = 'GET', allowed = () => true, username = 'user-test'} = {}) {
  const reviewed = [];
  const request = async (path, init) => {
    assert.equal(init.headers.Cookie, headers.cookie);
    if (path.endsWith('/selfsubjectreviews'))
      return {status: 201, body: {...identity, status: {userInfo: {username}}}};
    if (path.endsWith('/selfsubjectaccessreviews')) {
      const attributes = JSON.parse(init.body).spec.resourceAttributes;
      reviewed.push(attributes);
      return {status: 201, body: {status: {allowed: allowed(attributes)}}};
    }
    return {status: 403};
  };
  return {reviewed, options: {headers, method, manager, stateName: manager + '-manager-state-user-test', request}};
}

test('snapshot policy covers archive, storage, unlock and management paths', () => {
  for (const path of ['/api/snapshots', '/api/snapshots/id/unlock', '/api/snapshot-schedule/run', '/api/snapshot-cleanup', '/api/snapshot-source', '/api/snapshot-storage'])
    assert.equal(isSnapshotApi(path), true, path);
  assert.equal(isSnapshotApi('/healthz'), false);
  assert.equal(isSnapshotApi('/api/sources/test-connection'), false);
});

test('snapshot reads require the Rancher session and access to both inventory and configured state', async () => {
  const valid = fixture();
  const session = await authorizeSnapshot({...valid.options, headers: {cookie: headers.cookie}});
  assert.equal(session.userId, 'user-test');
  assert.equal(valid.reviewed.some(ref => ref.verb === 'update'), false);
  assert.equal(valid.reviewed.length, 3);
  await assert.rejects(authorizeSnapshot({...valid.options, headers: {}}), {status: 403});
  await assert.rejects(authorizeSnapshot(fixture({username: 'system:serviceaccount:dns-system:dns-windows-bridge'}).options), {status: 403});
  await assert.rejects(authorizeSnapshot(fixture({allowed: ref => ref.name !== 'dns-windows-observations'}).options), {status: 403});
});

test('network writes require same origin, state update, and all network inventory grants', async () => {
  const valid = fixture({manager: 'network', method: 'PUT'});
  const session = await authorizeSnapshot(valid.options);
  assert.ok(valid.reviewed.some(ref => ref.resource === 'services' && ref.verb === 'list' && ref.group === ''));
  assert.ok(valid.reviewed.some(ref => ref.resource === 'certificates' && ref.verb === 'list' && ref.group === 'cert-manager.io'));
  assert.ok(valid.reviewed.some(ref => ref.verb === 'update' && ref.name === 'network-manager-state-user-test'));
  await assert.rejects(authorizeSnapshot({...valid.options, headers: {cookie: headers.cookie}}), {status: 403});
  await assert.rejects(authorizeSnapshot(fixture({manager: 'network', method: 'PUT', allowed: ref => ref.verb !== 'update'}).options), {status: 403});
  await assert.rejects(session.readSecret('/api/v1/namespaces/demo/secrets/cert'), {status: 403});
});
