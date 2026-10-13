import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { confirmedControllerCredentials } from '../live-management/dns-controller-credential-proof.mjs';

const root = '.local/manager-installation';
const base = 'http://127.0.0.1:15889';
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const load = name => readFile(`${root}/${name}`, 'utf8').then(JSON.parse);
const loadOptional = async name => {
  try { return await load(name); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};
async function get(path) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, path);
  return response.json();
}

const [
  installation,
  proof,
  poller,
  sourceObserver,
  linux,
  nativeSourceObserver,
  liveSourceApi,
  privateRepair,
  privateRestart,
  nativeSourceManagement27,
  nativeCatalogRestore,
  nativeSnapshotClock,
  sourceFixture,
  cleanup,
  runtime25,
  ui30,
  fixtureWire,
  primaryWire,
  credentialAcceptance,
  health
] = await Promise.all([
  load('windows-recovery-channel-installation.json'),
  load('dns-controller-credential-proof-owned.json'),
  load('windows-recovery-production-poller-owned.json'),
  load('dns-source-observer-owned.json'),
  load('dns-credential-recovery-linux-tests.json'),
  load('native-dns-source-observer-proof.json'),
  load('dns-source-api-live-owned.json'),
  load('dns-snapshot-private-permissions-owned.json'),
  load('dns-source-runtime-restart-24-private-owned.json'),
  load('native-dns-source-management-27-validation.json'),
  load('native-dns-source-catalog-restore-28-validation.json'),
  load('native-dns-snapshot-clock-29-validation.json'),
  load('native-dns-source-fixture-30-validation.json'),
  load('accidental-regression-cleanup-owned.json'),
  load('dns-recovery-runtime-25-owned.json'),
  load('native-dns-source-registered-binding-ui-30-owned.json'),
  load('dns-source-fixture-wire-tests.json'),
  load('installed-dns-source-wire-tests.json'),
  load('native-changed-missing-credential-restore-owned.json'),
  load('service-health-tests.json')
]);

assert.ok(installation.passed && proof.passed && poller.passed);
assert.ok(sourceObserver.passed && linux.passed && /tests 153\b/.test(linux.output));
assert.equal(nativeSourceObserver.sourceSettingsChanged, false);
assert.equal(nativeSourceObserver.dnsRecordsChanged, false);
assert.ok(liveSourceApi.passed && privateRepair.passed && privateRestart.passed);
assert.ok(nativeSourceManagement27.passed && nativeCatalogRestore.passed && nativeSnapshotClock.passed);
assert.ok(sourceFixture.passed && cleanup.passed && runtime25.passed);
assert.match(ui30.status, /DNS Manager 30 cached and Ready/);
assert.ok(fixtureWire.passed && fixtureWire.readOnly && primaryWire.passed && primaryWire.readOnly);
assert.ok(credentialAcceptance.passed);

const windows = await new Promise((resolve, reject) => {
  const child = execFile(
    'pwsh.exe',
    ['-NoProfile', '-NonInteractive', '-File', 'scripts/install-windows-recovery-agent.ps1', '-Phase', 'Inspect'],
    { maxBuffer: 1024 * 1024 },
    (error, stdout) => {
      if (error) return reject(Error('Current Windows inspection unconfirmed'));
      try { resolve(JSON.parse(stdout.trim())); } catch { reject(Error('Invalid Windows inspection response')); }
    }
  );
  child.stdin.end(JSON.stringify({ id: installation.id }));
});
assert.equal(windows.taskState, 'Running');
assert.equal(windows.exclusivePollerLockHeld, true);
assert.equal(windows.leasePresent, false);
assert.equal(windows.health.reachable, true);
assert.ok(Date.now() - Date.parse(windows.health.at) < 30000 && Date.parse(windows.health.at) <= Date.now() + 5000);
const canonical = await load('windows-recovery-canonical-helper-owned.json');
assert.ok(canonical.passed);
assert.equal(windows.credentialHash, canonical.after.credentialHash);
assert.equal(windows.configurationHash, installation.before.configurationHash);
assert.deepEqual(windows.sourceHashes, canonical.after.sourceHashes);
assert.deepEqual(windows.key, installation.windowsInstallation.key);
assert.equal(windows.agentAccountUid, installation.agentAccountUid);
assert.equal(windows.requestUid, installation.requestUid);
assert.equal(windows.receiptUid, installation.receiptUid);

const cm = '/api/v1/namespaces/dns-system/configmaps/';
const proxy = '/api/v1/namespaces/manager-system/services/http:';
const [controller, observation, queue, catalogObject, registryObject, stateObject, dns, network, engine, bridge, runtime] = await Promise.all([
  get('/apis/apps/v1/namespaces/dns-system/deployments/dns-manager-controller'),
  get(cm + 'dns-manager-observations'),
  get(cm + 'dns-windows-queue'),
  get(cm + 'dns-manager-sources'),
  get(cm + 'dns-manager-source-bindings'),
  get('/api/v1/namespaces/cattle-ui-plugin-system/configmaps/dns-manager-state-user-jccb4'),
  get(proxy + 'dns-manager-snapshots:8080/proxy/api/snapshots'),
  get(proxy + 'network-manager-snapshots:8080/proxy/api/snapshots'),
  get('/api/v1/namespaces/dns-system/secrets/dns-manager-engine-admin'),
  get('/api/v1/namespaces/dns-system/secrets/dns-windows-bridge-credential'),
  get('/apis/apps/v1/namespaces/manager-system/statefulsets/dns-manager-snapshots')
]);
const document = JSON.parse(observation.data['inventory.json']);
const catalog = JSON.parse(catalogObject.data['sources.json']);
const registry = JSON.parse(registryObject.data['bindings.json']);
const state = JSON.parse(stateObject.data['state.json']);
const queueJobs = JSON.parse(queue.data['jobs.json']);
const physicalReboot = await loadOptional('proxmox09-failure-owned.json');

assert.equal(controller.metadata.uid, proof.deploymentUid);
assert.equal(controller.metadata.generation, 9);
assert.equal(controller.status.readyReplicas, 1);
assert.ok(confirmedControllerCredentials(document, { after: sourceObserver.rolloutIntent }));
assert.equal(document.source.managementReachable, true);
assert.equal(document.sourceCatalog.uid, runtime25.sourcePins.catalogUid);
assert.equal(document.sourceCatalog.bindingUid, runtime25.sourcePins.bindingUid);
assert.equal(document.sourceCatalog.bindingDigest, runtime25.sourcePins.bindingDigest);
assert.equal(document.sourceCatalog.revision, 10);
assert.equal(document.sources.length, 1);
assert.equal(document.sources[0].id, 'windows-dns');
assert.equal(document.sources[0].managementReachable, true);
assert.equal(document.sources[0].dnsReachable, true);
assert.equal(document.sources[0].connectionCatalogRevision, 10);
assert.ok(document.zones.every(zone => zone.sourceId === 'windows-dns' && zone.published === true && zone.replication === 'Synced'));
assert.deepEqual(state.drafts, []);
const terminalQueueStatuses = new Set(['Applied', 'Rejected', 'Interrupted', 'Reconciled']);
assert.ok(
  queueJobs.every((job) => terminalQueueStatuses.has(job.status)),
  'Windows DNS queue contains an active or unknown job status',
);

assert.deepEqual(catalog, sourceFixture.after.catalog);
assert.equal(registryObject.metadata.uid, sourceFixture.after.registryUid);
assert.equal(hash(registryObject.data['bindings.json']), sourceFixture.after.registryDigest);
assert.deepEqual(registry, sourceFixture.after.registry);
const credentialDigest = secret => hash(Object.entries(secret.data).sort(([a], [b]) => a.localeCompare(b)));
assert.deepEqual(
  [engine, bridge].map(secret => ({ uid: secret.metadata.uid, resourceVersion: secret.metadata.resourceVersion, dataDigest: credentialDigest(secret) })),
  ['dns-manager-engine-admin', 'dns-windows-bridge-credential'].map(name => ({
    uid: credentialAcceptance.after[name].uid,
    resourceVersion: credentialAcceptance.after[name].resourceVersion,
    dataDigest: credentialAcceptance.after[name].dataDigest
  }))
);
assert.deepEqual(dns.snapshots.map(snapshot => snapshot.id).sort(), sourceFixture.after.dnsIds);
const networkSnapshotIds = network.snapshots.map(snapshot => snapshot.id).sort();
assert.ok(sourceFixture.after.networkIds.every(id => networkSnapshotIds.includes(id)));
assert.deepEqual(
  networkSnapshotIds.filter(id => !sourceFixture.after.networkIds.includes(id)),
  [
    '34caed27-eed5-4987-8388-82aa868fe3ba',
    '570c050f-f482-4c68-a2b9-508d14953df1',
    'd7d7655b-34f3-454b-b810-a82280180cb0'
  ].sort()
);

assert.equal(runtime.metadata.uid, runtime25.uid);
assert.equal(runtime.metadata.generation, runtime25.generation);
assert.ok(runtime.spec.template.spec.containers[0].image.includes('2026.10.13-25@sha256:'));
assert.equal(runtime.status.readyReplicas, 1);
assert.equal(runtime.spec.template.spec.securityContext.fsGroupChangePolicy, 'OnRootMismatch');
assert.equal(dns.snapshots.length, 82);
assert.equal(network.snapshots.length, 108);
if (physicalReboot) {
  assert.ok(physicalReboot.passed);
  assert.ok(physicalReboot.sawBothTargetsUnavailable);
  assert.equal(physicalReboot.minReadyNodes, 17);
  assert.equal(physicalReboot.criticalFailures.kubernetesApi, 0);
  assert.equal(physicalReboot.criticalFailures.sharedDns, 0);
}

const baseline = await get(`${proxy}dns-manager-snapshots:8080/proxy/api/snapshots/9b68e6c3-e739-4050-8ec4-e7e25dcbebdb`);
const baselineRecords = Object.fromEntries(baseline.current.relatedConfigurations.filter(item => item.kind === 'DnsZone').map(item => [item.dns.zone.name, item.dns.records]));
const normalizeRecord = record => {
  const copy = { name: record.name, type: record.type, value: record.value, ttl: record.ttl };
  if (copy.type === 'SOA') {
    const fields = copy.value.split(/\s+/);
    assert.ok(fields.length >= 7);
    fields[2] = '<serial>';
    copy.value = fields.join(' ');
  }
  return JSON.stringify(copy);
};
const normalizeRecords = records => Object.fromEntries(Object.keys(records).sort().map(name => [name, records[name].map(normalizeRecord).sort()]));
assert.deepEqual(normalizeRecords(document.records), normalizeRecords(baselineRecords));

assert.ok(!health.unready.length && !health.unhealthyAttached.length && health.http.every(endpoint => endpoint.reachable));
assert.equal(health.http.length, 19);
assert.equal(health.http.filter(endpoint => endpoint.tlsVerified).length, 18);

const report = {
  observedAt: new Date().toISOString(),
  runtimeVersion: '25',
  rancherManagerVersion: '2.15.2',
  dnsManagerVersion: '0.1.31',
  networkManagerVersion: '0.1.26',
  installedAgentInspection: windows,
  controller: {
    generation: 9,
    ready: true,
    observationUid: observation.metadata.uid,
    replicas: document.replicas.map(replica => ({
      id: replica.id,
      reachable: replica.reachable,
      credentialIdentityVerified: replica.credentialIdentityVerified,
      credentialVerifiedAt: replica.credentialVerifiedAt
    }))
  },
  queueIdle: true,
  snapshotCounts: { dns: dns.snapshots.length, network: network.snapshots.length },
  health: {
    observedAt: health.observedAt,
    reachable: health.http.length,
    strictTls: health.http.filter(endpoint => endpoint.tlsVerified).length,
    unready: health.unready,
    unhealthyAttached: health.unhealthyAttached
  },
  localRegressionCounts: {
    management: { passed: 262, skipped: 1, total: 263 },
    isolatedLinux: 153,
    dnsUi: 114,
    dnsUnit: 6
  },
  sourceLifecycle: {
    complete: true,
    catalogRevision: 10,
    productionSourceCount: 1,
    registeredBindingCount: 2,
    fixtureCreateDeleteRestoreCleanup: true,
    fixtureConnectionVerified: true,
    primaryConnectionVerified: true,
    operationIds: sourceFixture.browser.operationIds,
    ownedSnapshotIds: sourceFixture.browser.ownedSnapshotIds,
    productionDnsWritesDuringAcceptance: 0,
    productionCredentialWritesDuringAcceptance: 0
  },
  credentialRecoveryAcceptance: {
    complete: true,
    changedOperationId: credentialAcceptance.scenarios.changed.operationId,
    missingOperationId: credentialAcceptance.scenarios.missing.operationId,
    changedCredentialRestoredInPlace: credentialAcceptance.scenarios.changed.restored.uid === credentialAcceptance.before['dns-manager-engine-admin'].uid,
    missingCredentialRecreated: credentialAcceptance.scenarios.missing.restored.uid !== credentialAcceptance.before['dns-windows-bridge-credential'].uid,
    recoveryChannelEmpty: credentialAcceptance.after.queueEmpty
  },
  accidentalRegressionCleanup: cleanup,
  physicalFailureDomain: physicalReboot ? {
    gracefulHostRebootObserved: true,
    operation: physicalReboot.operation,
    startedAt: physicalReboot.startedAt,
    finishedAt: physicalReboot.finishedAt,
    targetNodes: physicalReboot.targetNodes,
    sawBothTargetsUnavailable: physicalReboot.sawBothTargetsUnavailable,
    minReadyNodes: physicalReboot.minReadyNodes,
    kubernetesApiFailures: physicalReboot.criticalFailures.kubernetesApi,
    sharedDnsFailures: physicalReboot.criticalFailures.sharedDns,
    rancherFailures: physicalReboot.criticalFailures.rancher,
    fullyRecoveredAtCheckpoint: true,
    abruptPowerLossTested: false
  } : { gracefulHostRebootObserved: false, abruptPowerLossTested: false },
  remainingGates: [
    physicalReboot ? 'Abrupt ungraceful physical-host power loss' : 'Physical failure-domain reboot',
    'Client and Omada resolver cutover',
    'Public DNS and external-service acceptance'
  ],
  credentialValuesRotated: 0,
  dnsDhcpOrPublicCutoverPerformed: false,
  passed: true
};
await writeFile(`${root}/production-recovery-bootstrap-checkpoint.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  passed: true,
  controllerGeneration: report.controller.generation,
  queueIdle: true,
  snapshotCounts: report.snapshotCounts,
  reachable: report.health.reachable,
  strictTls: report.health.strictTls,
  sourceCatalogRevision: report.sourceLifecycle.catalogRevision,
  sourceLifecycleComplete: true
}));
