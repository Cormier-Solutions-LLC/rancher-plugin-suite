import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createLiveDnsSource } from '../live-management/rancher-dns.mjs';

// Use an authenticated local `kubectl proxy`; no credentials are saved here.
const base = process.env.KUBERNETES_PROXY_URL || 'http://127.0.0.1:18089';
const directory = '.local/opensearch';
const receiptPath = `${directory}/dns-receipt.json`;
await mkdir(directory, { recursive: true });
const request = (path, init = {}) => fetch(base + path.replace('/k8s/clusters/local', ''), {
  ...init, signal: AbortSignal.timeout(20000),
});
async function call(path, init) {
  const response = await request(path, init);
  assert.ok(response.ok, `Kubernetes API returned ${response.status}`);
  return response.json();
}
const source = createLiveDnsSource('local', request, 'opensearch-installer');
const inventory = (await source.reload()).data.inventory;
const zone = inventory.zones.find(item => item.name === 'cormierconsulting.io');
assert.ok(zone && inventory.source.managementReachable, 'Fresh DNS management inventory required');
const names = ['opensearch', 'opensearch-api'];
const records = inventory.records[zone.id];
const changes = names.flatMap(name => {
  const existing = records.filter(record => record.name === name);
  if (existing.length) {
    assert.ok(existing.length === 1 && existing[0].type === 'A' && existing[0].value === '10.99.15.50',
      `An existing DNS record conflicts with ${name}; no replacement was attempted`);
    return [];
  }
  return [{ id: randomUUID(), kind: 'record', zone: zone.id, name, type: 'A', value: '10.99.15.50', ttl: 300 }];
});
if (!changes.length) {
  console.log('Both private OpenSearch DNS records already match.');
} else {
  // Never resubmit a previous unresolved operation after a timeout.
  const previous = await readFile(receiptPath, 'utf8').then(JSON.parse).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
  assert.ok(!previous || previous.status === 'Applied', 'Reconcile the saved DNS operation before retrying');
  const current = {
    configuration: { id: `source/${inventory.source.name}`, name: inventory.source.name, kind: 'DnsSource', dns: inventory.source },
    relatedConfigurations: inventory.zones.map(item => ({ id: `zone/${item.id}`, name: item.name,
      namespace: 'dns-system', kind: 'DnsZone', dns: { zone: item, records: inventory.records[item.id] } })),
    pendingChanges: [], routeManifests: [],
    snapshotScope: { label: 'Before private OpenSearch DNS records', source: 'Authenticated DNS management observations' },
  };
  const backup = await call('/api/v1/namespaces/manager-system/services/http:dns-manager-snapshots:8080/proxy/api/snapshots', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://rancher.cormierconsulting.io' },
    body: JSON.stringify({ current, scopeKey: JSON.stringify(current) }),
  });
  await writeFile(receiptPath, JSON.stringify({ status: 'Submitting', snapshotId: backup.id, changes }, null, 2));
  try {
    const receipt = await source.stageChanges({ changes, snapshotId: backup.id });
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2));
    assert.equal(receipt.status, 'Applied');
    console.log(`Added ${changes.length} private DNS records; DNS backup ${backup.id}.`);
  } catch (error) {
    await writeFile(receiptPath, JSON.stringify({ status: 'NeedsReconciliation', snapshotId: backup.id,
      changes, jobId: error.jobId, receipt: error.receipt, error: error.message }, null, 2));
    throw error;
  }
}
