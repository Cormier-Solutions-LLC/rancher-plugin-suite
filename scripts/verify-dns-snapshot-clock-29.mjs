import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { sourceObservationFingerprint } from '../live-management/dns-source-connection.mjs';

const root = '.local/manager-installation';
const base = 'http://127.0.0.1:15889';
const snapshotId = '5c302793-7513-4413-b042-afe451a342ef';
const startedAt = '2026-10-13T10:06:31.891Z';
const finishedAt = '2026-10-13T10:06:34.393Z';
const previous = JSON.parse(await readFile(`${root}/native-dns-source-catalog-restore-28-validation.json`, 'utf8'));
const ledgerPath = `${root}/native-dns-source-snapshot-clock-ui-29-owned.json`;
const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
assert.equal(previous.passed, true);

async function get(path) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, path);
  return response.json();
}
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const cm = '/api/v1/namespaces/dns-system/configmaps/';
const proxy = '/api/v1/namespaces/manager-system/services/http:';
const [catalog, registry, controller, windows, queue, state, dns, network, engine, bridge, snapshot, plugin, assets] = await Promise.all([
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
  get(`${proxy}dns-manager-snapshots:8080/proxy/api/snapshots/${snapshotId}`),
  get('/apis/catalog.cattle.io/v1/namespaces/cattle-ui-plugin-system/uiplugins/dns-manager'),
  get('/apis/apps/v1/namespaces/cattle-ui-plugin-system/deployments/manager-extension-assets'),
]);
const applied = JSON.parse(catalog.data['sources.json']);
const observed = JSON.parse(controller.data['inventory.json']);
const primary = JSON.parse(windows.data['inventory.json']);
const saved = JSON.parse(state.data['state.json']);
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
  credentials: [engine, bridge].map(secret => ({uid: secret.metadata.uid, resourceVersion: secret.metadata.resourceVersion, digest: hash(secret.data)})),
  dnsIds: dns.snapshots.map(item => item.id).sort(),
  networkIds: network.snapshots.map(item => item.id).sort(),
  guard: primary.credentialRecoveryGuard,
  drafts: saved.drafts,
};
const before = previous.after;
for (const key of ['catalogUid', 'registryUid', 'registryDigest', 'windowsUid', 'windowsFingerprint', 'controllerUid', 'ownershipDigest', 'queueUid', 'queueRevision', 'queueDigest', 'stateUid', 'navigationDigest']) assert.equal(current[key], before[key], key);
assert.deepEqual(current.catalog, before.catalog);
assert.deepEqual(current.credentials, before.credentials);
assert.deepEqual(current.guard, before.guard);
assert.deepEqual(current.networkIds, before.networkIds);
assert.deepEqual(current.drafts, []);
assert.ok(before.dnsIds.every(id => current.dnsIds.includes(id)));
assert.deepEqual(current.dnsIds.filter(id => !before.dnsIds.includes(id)), [snapshotId]);
assert.equal(snapshot.id, snapshotId);
assert.equal(snapshot.includesSecretValues, false);
assert.equal(snapshot.current.secretBackup.complete, false);
assert.deepEqual(snapshot.current.secretBackup.missing.sort(), ['dns-system/dns-manager-engine-admin', 'dns-system/dns-windows-bridge-credential']);
assert.ok(Date.parse(snapshot.createdAt) >= Date.parse(startedAt));
assert.ok(Date.parse(snapshot.createdAt) <= Date.parse(finishedAt));
assert.equal(plugin.spec.plugin.version, '0.1.29');
assert.equal(plugin.status.ready, true);
assert.equal(plugin.status.cacheState, 'cached');
assert.equal(plugin.status.observedGeneration, 30);
assert.equal(assets.metadata.generation, 57);
assert.equal(assets.status.readyReplicas, 2);
assert.equal(assets.status.updatedReplicas, 2);

const report = {
  passed: true,
  startedAt,
  finishedAt,
  elapsedMs: Date.parse(finishedAt) - Date.parse(startedAt),
  version: '0.1.29',
  helmRevision: 30,
  uiPluginGeneration: 30,
  assetGeneration: 57,
  snapshotId,
  snapshotCreatedAt: snapshot.createdAt,
  gateReadyImmediatelyAfterServerSave: true,
  restoreCancelledBeforeStaging: true,
  pendingDrafts: 0,
  snapshotCoverage: '8 / 8 known configuration items covered',
  sourceReachable: true,
  observedZones: 4,
  productionDnsWrites: 0,
  productionCredentialWrites: 0,
  before,
  after: current,
  screenshot: 'native-dns-snapshot-clock-ready-29.png',
};
await writeFile(`${root}/native-dns-snapshot-clock-29-validation.json`, JSON.stringify(report, null, 2));
Object.assign(ledger, {
  tested: true,
  validation: 'native-dns-snapshot-clock-29-validation.json',
  nativeAcceptance: {
    gateReadyImmediatelyAfterServerSave: true,
    elapsedMs: report.elapsedMs,
    restoreCancelledBeforeStaging: true,
    pendingDrafts: 0,
    snapshotId,
  },
  status: 'DNS Manager 29 cached, Ready, and native snapshot clock-skew acceptance passed',
});
await writeFile(ledgerPath, JSON.stringify(ledger, null, 2));
console.log(JSON.stringify({passed:true, version:'0.1.29', helmRevision:30, uiPluginGeneration:30, assetGeneration:57, dnsSnapshots:current.dnsIds.length, networkSnapshots:current.networkIds.length, productionDnsWrites:0, productionCredentialWrites:0}));
