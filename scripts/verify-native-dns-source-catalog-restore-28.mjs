import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { sourceObservationFingerprint } from '../live-management/dns-source-connection.mjs';

const root = '.local/manager-installation';
const output = `${root}/native-dns-source-catalog-restore-28-validation.json`;
const base = 'http://127.0.0.1:15889';
const previous = JSON.parse(await readFile(`${root}/native-dns-source-management-27-validation.json`, 'utf8'));
const browser = JSON.parse(await readFile(`${root}/native-dns-source-catalog-restore-28-browser.json`, 'utf8'));
assert.equal(previous.passed, true);

async function get(path) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, path);
  return response.json();
}
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const cm = '/api/v1/namespaces/dns-system/configmaps/';
const proxy = '/api/v1/namespaces/manager-system/services/http:';
const [catalog, registry, controller, windows, queue, state, dns, network, engine, bridge] = await Promise.all([
  get(cm + 'dns-manager-sources'),
  get(cm + 'dns-manager-source-bindings'),
  get(cm + 'dns-manager-observations'),
  get(cm + 'dns-windows-observations'),
  get(cm + 'dns-windows-queue'),
  get('/api/v1/namespaces/cattle-ui-plugin-system/configmaps/dns-manager-state-user-jccb4'),
  get(proxy + 'dns-manager-snapshots:8080/proxy/api/snapshots'),
  get(proxy + 'network-manager-snapshots:8080/proxy/api/snapshots'),
  get('/api/v1/namespaces/dns-system/secrets/dns-manager-engine-admin'),
  get('/api/v1/namespaces/dns-system/secrets/dns-windows-bridge-credential'),
]);
const applied = JSON.parse(catalog.data['sources.json']);
const observed = JSON.parse(controller.data['inventory.json']);
const primary = JSON.parse(windows.data['inventory.json']);
const saved = JSON.parse(state.data['state.json']);
const journal = JSON.parse(state.data['source-operations.json']);

assert.equal(primary.managementReachable, true);
assert.ok(Date.now() - Date.parse(primary.observedAt) < 120000);
assert.ok(Date.now() - Date.parse(observed.observedAt) < 120000);
assert.ok(observed.zones.every(zone => zone.replication === 'Synced'));
assert.deepEqual(saved.drafts, []);

const current = {
  catalogUid: catalog.metadata.uid,
  catalog: applied,
  registryUid: registry.metadata.uid,
  registryDigest: hash(registry.data['bindings.json']),
  windowsUid: windows.metadata.uid,
  windowsFingerprint: hash(sourceObservationFingerprint(primary)),
  controllerUid: controller.metadata.uid,
  ownershipDigest: hash(controller.data['replica-ownership.json']),
  queueUid: queue.metadata.uid,
  queueRevision: queue.metadata.resourceVersion,
  queueDigest: hash(queue.data['jobs.json']),
  stateUid: state.metadata.uid,
  navigationDigest: hash(state.data['navigation.json'] || 'null'),
  credentials: [engine, bridge].map(secret => ({
    uid: secret.metadata.uid,
    resourceVersion: secret.metadata.resourceVersion,
    digest: hash(secret.data),
  })),
  dnsIds: dns.snapshots.map(snapshot => snapshot.id).sort(),
  networkIds: network.snapshots.map(snapshot => snapshot.id).sort(),
  guard: primary.credentialRecoveryGuard,
  drafts: saved.drafts,
};
const before = previous.after;
for (const key of ['catalogUid', 'registryUid', 'registryDigest', 'windowsUid', 'windowsFingerprint', 'controllerUid', 'ownershipDigest', 'queueUid', 'queueRevision', 'queueDigest', 'stateUid', 'navigationDigest']) {
  assert.equal(current[key], before[key], key);
}
assert.deepEqual(current.credentials, before.credentials);
assert.deepEqual(current.guard, before.guard);
assert.deepEqual(current.networkIds, before.networkIds);
assert.equal(applied.revision, before.catalog.revision + 2);
assert.equal(applied.sources.length, 1);
for (const key of ['id', 'name', 'type', 'host', 'address', 'credential', 'bindingId']) {
  assert.equal(applied.sources[0][key], before.catalog.sources[0][key]);
}
assert.equal(applied.sources[0].revision, before.catalog.sources[0].revision + 2);
assert.ok(before.dnsIds.every(id => current.dnsIds.includes(id)));
const added = current.dnsIds.filter(id => !before.dnsIds.includes(id));
assert.deepEqual(added.sort(), [...browser.ownedSnapshotIds].sort());

assert.equal(journal.version, 1);
for (const id of [browser.renameOperationId, browser.restoreOperationId]) {
  const operation = journal.operations.find(record => record.id === id);
  assert.ok(operation, id);
  assert.equal(operation.phase, 'Applied');
  assert.equal(operation.receipt.status, 'Applied');
  assert.equal(operation.userId, 'user-jccb4');
  assert.ok(browser.ownedSnapshotIds.includes(operation.snapshotId));
}
const restore = journal.operations.find(record => record.id === browser.restoreOperationId);
assert.equal(restore.changes[0].id, browser.restoreDraftId);
assert.equal(restore.changes[0].expected.name, browser.temporaryName);
assert.equal(restore.changes[0].expected.revision, 6);
assert.equal(restore.changes[0].value.name, 'Windows DNS');

const report = {
  startedAt: browser.startedAt,
  finishedAt: new Date().toISOString(),
  passed: true,
  status: 'Native source-catalog snapshot restoration passed with exact source identity and independent preservation evidence',
  before,
  after: current,
  browser,
  productionDnsWrites: 0,
  productionCredentialWrites: 0,
};
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  passed: true,
  catalogRevision: applied.revision,
  sourceRevision: applied.sources[0].revision,
  dnsSnapshots: current.dnsIds.length,
  networkSnapshots: current.networkIds.length,
  productionDnsWrites: 0,
  productionCredentialWrites: 0,
}));
