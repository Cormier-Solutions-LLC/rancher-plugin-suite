import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { decodeBackup } from '../dns-manager-dev/pkg/dns-manager/snapshot-feature/config/backup-zip.mjs';

const root = '.local/manager-installation';
const ledgerPath = `${root}/native-changed-missing-credential-restore-owned.json`;
const retainedPath = `${root}/dns-credential-capture-13-owned.json`;
const base = 'http://127.0.0.1:15889';
const snapshotApi = '/api/v1/namespaces/manager-system/services/http:dns-manager-snapshots:8080/proxy/api';
const namespace = 'dns-system';
const engineName = 'dns-manager-engine-admin';
const bridgeName = 'dns-windows-bridge-credential';
const queuePath = `/api/v1/namespaces/${namespace}/secrets/dns-windows-recovery-request`;
const receiptPath = `/api/v1/namespaces/${namespace}/configmaps/dns-windows-recovery-receipt`;
const fixtureMarker = 'dns-manager.cormierconsulting.io/credential-recovery-acceptance';
const recoveryMarker = 'dns-manager.cormierconsulting.io/credential-recovery';
const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value || '');
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const dataDigest = (secret) => digest(Object.entries(secret?.data || {}).sort(([a], [b]) => a.localeCompare(b)));

async function request(path, init = {}) {
  const response = await fetch(base + path, { ...init, signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { status: response.status, body };
}

async function get(path) {
  const result = await request(path);
  assert.equal(result.status, 200, `GET ${path} returned ${result.status}`);
  return result.body;
}

async function readSecret(name) {
  const result = await request(`/api/v1/namespaces/${namespace}/secrets/${name}`);
  if (result.status === 404) return null;
  assert.equal(result.status, 200, `Secret ${name} read returned ${result.status}`);
  return result.body;
}

async function replaceSecret(secret) {
  const path = `/api/v1/namespaces/${namespace}/secrets/${secret.metadata.name}`;
  const result = await request(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(secret) });
  assert.equal(result.status, 200, `Secret ${secret.metadata.name} replacement returned ${result.status}`);
  return result.body;
}

async function createSecret(secret) {
  const path = `/api/v1/namespaces/${namespace}/secrets`;
  const result = await request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(secret) });
  assert.equal(result.status, 201, `Secret ${secret.metadata.name} creation returned ${result.status}`);
  return result.body;
}

async function deleteSecret(secret) {
  const path = `/api/v1/namespaces/${namespace}/secrets/${secret.metadata.name}`;
  const options = { apiVersion: 'v1', kind: 'DeleteOptions', preconditions: { uid: secret.metadata.uid, resourceVersion: secret.metadata.resourceVersion } };
  const result = await request(path, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) });
  assert.ok([200, 202].includes(result.status), `Secret ${secret.metadata.name} deletion returned ${result.status}`);
}

async function inspectWindows() {
  const installation = JSON.parse(await readFile(`${root}/windows-recovery-channel-installation.json`, 'utf8'));
  return new Promise((resolve, reject) => {
    const child = execFile('pwsh.exe', ['-NoProfile', '-NonInteractive', '-File', 'scripts/install-windows-recovery-agent.ps1', '-Phase', 'Inspect'], { maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) return reject(new Error('Windows recovery-agent inspection failed'));
      try { resolve(JSON.parse(stdout.trim())); } catch { reject(new Error('Windows recovery-agent inspection returned invalid JSON')); }
    });
    child.stdin.end(JSON.stringify({ id: installation.id }));
  });
}

async function loadTargets() {
  const retained = JSON.parse(await readFile(retainedPath, 'utf8'));
  assert.ok(uuid(retained.nativeSnapshotId));
  assert.equal(typeof retained.password, 'string');
  const response = await request(`${snapshotApi}/snapshots/${retained.nativeSnapshotId}/backup.zip`);
  assert.equal(response.status, 200, 'Retained encrypted credential backup is unavailable');
  const bytes = Buffer.isBuffer(response.body) ? response.body : null;
  // request() parses text, so use a dedicated binary fetch for the encrypted ZIP.
  const binary = await fetch(`${base}${snapshotApi}/snapshots/${retained.nativeSnapshotId}/backup.zip`, { signal: AbortSignal.timeout(30_000) });
  assert.equal(binary.status, 200);
  const document = await decodeBackup(Buffer.from(await binary.arrayBuffer()), retained.password);
  assert.equal(document.id, retained.nativeSnapshotId);
  const targets = new Map();
  for (const name of [engineName, bridgeName]) {
    const matches = document.current.routeManifests.filter((item) => item.kind === 'Secret' && item.metadata?.namespace === namespace && item.metadata?.name === name);
    assert.equal(matches.length, 1, `Backup must contain exactly one ${name}`);
    targets.set(name, matches[0]);
  }
  return { retained, targets };
}

async function loadLedger() {
  try { return JSON.parse(await readFile(ledgerPath, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
const save = (ledger) => writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);

function publicSecret(secret) {
  return {
    name: secret.metadata.name,
    uid: secret.metadata.uid,
    resourceVersion: secret.metadata.resourceVersion,
    type: secret.type,
    dataDigest: dataDigest(secret),
  };
}

async function assertQueueEmpty() {
  const queue = await get(queuePath);
  assert.equal(queue.data['request.jwe'], '');
  return queue;
}

async function assertTarget(name, target, operationId, { sameUid = null } = {}) {
  const actual = await readSecret(name);
  assert.ok(actual, `${name} was not restored`);
  assert.equal(actual.type, target.type);
  assert.equal(dataDigest(actual), dataDigest(target));
  assert.equal(actual.metadata.annotations?.[recoveryMarker], `${operationId}/${name}`);
  if (sameUid === true) assert.equal(actual.metadata.uid, (await loadLedger()).before[name].uid);
  if (sameUid === false) assert.notEqual(actual.metadata.uid, (await loadLedger()).before[name].uid);
  return actual;
}

const phase = process.argv[2];
let ledger = await loadLedger();

if (phase === 'setup-changed') {
  assert.equal(ledger, null, 'Reconcile the existing changed/missing credential acceptance ledger first');
  const { retained, targets } = await loadTargets();
  const [engine, bridge, queue, snapshots, windows] = await Promise.all([
    readSecret(engineName),
    readSecret(bridgeName),
    assertQueueEmpty(),
    get(`${snapshotApi}/snapshots`),
    inspectWindows(),
  ]);
  assert.ok(engine && bridge);
  assert.equal(dataDigest(engine), dataDigest(targets.get(engineName)));
  assert.equal(dataDigest(bridge), dataDigest(targets.get(bridgeName)));
  assert.equal(windows.taskState, 'Running');
  assert.equal(windows.exclusivePollerLockHeld, true);
  assert.equal(windows.leasePresent, false);
  assert.equal(windows.health.reachable, true);
  ledger = {
    id: randomUUID(),
    startedAt: new Date().toISOString(),
    status: 'Changed engine credential fixture prepared for native Rancher review',
    snapshotId: retained.nativeSnapshotId,
    snapshotCount: snapshots.snapshots.length,
    queueUid: queue.metadata.uid,
    windowsBefore: { credentialHash: windows.credentialHash, configurationHash: windows.configurationHash, sourceHashes: windows.sourceHashes },
    before: { [engineName]: publicSecret(engine), [bridgeName]: publicSecret(bridge) },
    scenarios: {},
  };
  await save(ledger);
  const changed = structuredClone(engine);
  changed.data['admin-password'] = Buffer.from(`Owned-invalid-engine-${ledger.id}`, 'utf8').toString('base64');
  changed.metadata.annotations = { ...(changed.metadata.annotations || {}), [fixtureMarker]: ledger.id };
  const applied = await replaceSecret(changed);
  assert.equal(applied.metadata.uid, engine.metadata.uid);
  assert.notEqual(dataDigest(applied), dataDigest(targets.get(engineName)));
  ledger.scenarios.changed = { setupAt: new Date().toISOString(), fixture: publicSecret(applied), status: 'Awaiting native review' };
  await save(ledger);
  console.log(JSON.stringify({ prepared: true, scenario: 'changed', snapshotId: ledger.snapshotId, snapshotCount: ledger.snapshotCount }));
} else if (phase === 'record-review') {
  assert.ok(ledger);
  const scenario = process.argv[3];
  const operationId = process.argv[4];
  const itemMode = process.argv[5];
  assert.ok(['changed', 'missing'].includes(scenario));
  assert.ok(uuid(operationId));
  assert.equal(itemMode, scenario === 'changed' ? 'changed' : 'create');
  const current = await readSecret(scenario === 'changed' ? engineName : bridgeName);
  if (scenario === 'changed') {
    assert.ok(current);
    assert.equal(dataDigest(current), ledger.scenarios.changed.fixture.dataDigest);
  } else {
    assert.equal(current, null);
  }
  ledger.scenarios[scenario] = { ...ledger.scenarios[scenario], operationId, reviewAt: new Date().toISOString(), itemMode, status: 'Prepared in native Rancher UI' };
  ledger.status = `${scenario} credential review prepared; native Apply pending`;
  await save(ledger);
  console.log(JSON.stringify({ recorded: true, scenario, operationId, fixturePreservedDuringReview: true }));
} else if (phase === 'verify-applied') {
  assert.ok(ledger);
  const scenario = process.argv[3];
  assert.ok(['changed', 'missing'].includes(scenario));
  const record = ledger.scenarios[scenario];
  assert.ok(uuid(record?.operationId));
  const { targets } = await loadTargets();
  const name = scenario === 'changed' ? engineName : bridgeName;
  const actual = await assertTarget(name, targets.get(name), record.operationId, { sameUid: scenario === 'changed' });
  const queue = await get(queuePath);
  assert.equal(queue.metadata.uid, ledger.queueUid);
  let receipt = null;
  if (scenario === 'changed') {
    assert.equal(queue.data['request.jwe'], '');
  } else {
    assert.notEqual(queue.data['request.jwe'], '');
    receipt = JSON.parse((await get(receiptPath)).data['receipt.json']);
    assert.equal(receipt.id, record.operationId);
    assert.equal(receipt.status, 'Succeeded');
    assert.equal(receipt.transactionStatus, 'Applied');
  }
  const windows = await inspectWindows();
  assert.equal(windows.taskState, 'Running');
  assert.equal(windows.exclusivePollerLockHeld, true);
  assert.equal(windows.leasePresent, false);
  assert.equal(windows.health.reachable, true);
  ledger.scenarios[scenario] = { ...record, appliedAt: new Date().toISOString(), restored: publicSecret(actual), ...(receipt ? { agentReceipt: { id: receipt.id, action: receipt.action, status: receipt.status, transactionStatus: receipt.transactionStatus } } : { windowsChannelUsed: false }), status: 'Applied and independently verified' };
  ledger.status = `${scenario} credential restore applied; owned recovery-channel cleanup pending`;
  await save(ledger);
  console.log(JSON.stringify({ passed: true, scenario, operationId: record.operationId, restoredUid: actual.metadata.uid, dependencyConfirmed: true }));
} else if (phase === 'clear-channel') {
  assert.ok(ledger);
  const scenario = process.argv[3];
  const record = ledger.scenarios[scenario];
  assert.equal(record?.status, 'Applied and independently verified');
  const queue = await get(queuePath);
  assert.equal(queue.metadata.uid, ledger.queueUid);
  if (scenario === 'changed') {
    assert.equal(queue.data['request.jwe'], '');
  } else {
    assert.notEqual(queue.data['request.jwe'], '');
    const receipt = JSON.parse((await get(receiptPath)).data['receipt.json']);
    assert.equal(receipt.id, record.operationId);
    queue.data = { 'request.jwe': '' };
    const replaced = await replaceSecret(queue);
    assert.equal(replaced.data['request.jwe'], '');
  }
  ledger.scenarios[scenario] = { ...record, channelClearedAt: new Date().toISOString(), status: 'Applied, independently verified, and channel cleared' };
  ledger.status = `${scenario} credential restore complete`;
  await save(ledger);
  console.log(JSON.stringify({ passed: true, scenario, channelEmpty: true }));
} else if (phase === 'setup-missing') {
  assert.ok(ledger);
  assert.equal(ledger.scenarios.changed?.status, 'Applied, independently verified, and channel cleared');
  assert.ok(!ledger.scenarios.missing);
  const { targets } = await loadTargets();
  const bridge = await readSecret(bridgeName);
  assert.ok(bridge);
  assert.equal(dataDigest(bridge), dataDigest(targets.get(bridgeName)));
  assert.equal(await assertQueueEmpty().then(() => true), true);
  ledger.scenarios.missing = { setupIntentAt: new Date().toISOString(), original: publicSecret(bridge), status: 'Delete intent recorded' };
  await save(ledger);
  await deleteSecret(bridge);
  assert.equal(await readSecret(bridgeName), null);
  ledger.scenarios.missing = { ...ledger.scenarios.missing, setupAt: new Date().toISOString(), status: 'Credential absent; awaiting native review' };
  ledger.status = 'Missing bridge credential fixture prepared for native Rancher review';
  await save(ledger);
  console.log(JSON.stringify({ prepared: true, scenario: 'missing', snapshotId: ledger.snapshotId, deletedUid: bridge.metadata.uid }));
} else if (phase === 'finish') {
  assert.ok(ledger);
  for (const scenario of ['changed', 'missing']) assert.equal(ledger.scenarios[scenario]?.status, 'Applied, independently verified, and channel cleared');
  const { targets } = await loadTargets();
  const [engine, bridge, snapshots, queue, windows] = await Promise.all([readSecret(engineName), readSecret(bridgeName), get(`${snapshotApi}/snapshots`), assertQueueEmpty(), inspectWindows()]);
  assert.equal(dataDigest(engine), dataDigest(targets.get(engineName)));
  assert.equal(dataDigest(bridge), dataDigest(targets.get(bridgeName)));
  assert.equal(snapshots.snapshots.length, ledger.snapshotCount);
  assert.equal(queue.metadata.uid, ledger.queueUid);
  assert.equal(windows.taskState, 'Running');
  assert.equal(windows.exclusivePollerLockHeld, true);
  assert.equal(windows.leasePresent, false);
  assert.equal(windows.health.reachable, true);
  assert.deepEqual(windows.sourceHashes, ledger.windowsBefore.sourceHashes);
  ledger.status = 'Native changed and missing credential restoration accepted through Rancher';
  ledger.passed = true;
  ledger.finishedAt = new Date().toISOString();
  ledger.after = { [engineName]: publicSecret(engine), [bridgeName]: publicSecret(bridge), snapshotCount: snapshots.snapshots.length, queueEmpty: true };
  await save(ledger);
  console.log(JSON.stringify({ passed: true, changedRestored: true, missingRestored: true, snapshotCount: snapshots.snapshots.length, queueEmpty: true }));
} else if (phase === 'emergency-restore') {
  assert.ok(ledger, 'No owned acceptance ledger is available');
  const { targets } = await loadTargets();
  for (const name of [engineName, bridgeName]) {
    const target = structuredClone(targets.get(name));
    const current = await readSecret(name);
    if (current && dataDigest(current) === dataDigest(target)) continue;
    target.metadata = { ...target.metadata, ...(current ? { uid: current.metadata.uid, resourceVersion: current.metadata.resourceVersion } : {}) };
    if (current) await replaceSecret(target); else await createSecret(target);
  }
  console.log(JSON.stringify({ restored: true, dependencyActivationStillRequiresVerification: true }));
} else {
  throw new Error('Choose setup-changed, record-review, verify-applied, clear-channel, setup-missing, finish, or emergency-restore.');
}
