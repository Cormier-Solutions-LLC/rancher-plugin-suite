import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac, randomUUID} from 'node:crypto';
import {bridgeSnapshot} from '../dns-bridge-snapshot.mjs';

test('bridge proves the exact active job and receives only the zones required for that job', async () => {
  const token = 'unit-fixture-key';
  const now = Date.now();
  const jobId = randomUUID();
  const snapshotId = randomUUID();
  const expires = now + 30000;
  const proof = createHmac('sha256', token).update(`dns-bridge-snapshot-v1\n${jobId}\n${snapshotId}\n${expires}`).digest('hex');
  const input = {jobId, snapshotId, expires, proof};
  const job = {id: jobId, snapshotId, status: 'Running', createdAt: new Date(now).toISOString(), operations: [{zone: 'test.invalid', parentZone: 'invalid'}]};
  const readInventory = async name => name === 'dns-windows-queue' ? [job] : {data: {token: Buffer.from(token).toString('base64')}};
  const records = [{name: '@', type: 'TXT', value: 'fixture', ttl: 60}];
  let reads = 0;
  const loadSnapshot = async id => {
    assert.equal(id, snapshotId);
    reads++;
    return {createdAt: job.createdAt, current: {
      configuration: {kind: 'DnsSource', dns: {host: 'dns.test.invalid', address: '192.0.2.1', credential: 'private'}},
      routeManifests: [{kind: 'Secret'}],
      relatedConfigurations: ['test.invalid', 'invalid', 'unrelated.invalid'].map(name => ({kind: 'DnsZone', dns: {zone: {name, serial: 1}, records}}))
    }};
  };
  const options = {readInventory, loadSnapshot, now};
  await assert.rejects(bridgeSnapshot({...input, snapshotId: randomUUID()}, options), {status: 403});
  await assert.rejects(bridgeSnapshot(input, {...options, now: expires + 1}), {status: 403});
  await assert.rejects(bridgeSnapshot(input, {...options, readInventory: async name => name === 'dns-windows-queue' ? [] : readInventory(name)}), {status: 403});
  assert.equal(reads, 0);
  const result = await bridgeSnapshot(input, options);
  assert.deepEqual(result.current.relatedConfigurations.map(item => item.dns.zone.name), ['test.invalid', 'invalid']);
  assert.deepEqual(result.current.relatedConfigurations[0].dns.records, records);
  assert.equal(result.current.routeManifests, undefined);
  assert.equal(result.current.configuration.dns.credential, undefined);
});
