import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeBackup, decodeBackup, passwordStrength, withoutSecretValues } from '../pkg/dns-manager/snapshot-feature/config/backup-zip.mjs';
import { ZipReader, Uint8ArrayReader } from '@zip.js/zip.js';
import { assessCoverage, uncoveredEntries } from '../pkg/dns-manager/snapshot-feature/config/snapshot-coverage.mjs';
const password = 'A sufficiently long backup passphrase!';
const snapshot = { schemaVersion:1, createdAt:new Date().toISOString(), current:{configuration:{id:'source/test',name:'test'},routeManifests:[]} };
test('ZIP recovery contains both dated index and independent configuration', async () => {
  const bytes = await encodeBackup(snapshot);
  assert.deepEqual(await decodeBackup(bytes), snapshot);
  const reader = new ZipReader(new Uint8ArrayReader(bytes),{useWebWorkers:false});
  assert.deepEqual((await reader.getEntries()).map(entry=>entry.filename), ['index.json','configuration.json','manifests.yaml']);
  await reader.close();
});
test('Secret backups fail closed and use a single encrypted generic envelope', async () => {
  const secret = { kind:'Secret',apiVersion:'v1',metadata:{name:'test',namespace:'dns-system'},stringData:{token:'fixture-secret-do-not-use'} };
  const data = {...snapshot,current:{...snapshot.current,routeManifests:[secret]}};
  await assert.rejects(encodeBackup(data),/require a password/);
  const bytes = await encodeBackup(data,password);
  const reader = new ZipReader(new Uint8ArrayReader(bytes),{useWebWorkers:false});
  const entries = await reader.getEntries();
  assert.equal(entries.length,1); assert.equal(entries[0].filename,'backup.zip'); assert.equal(entries[0].encrypted,true);
  await reader.close();
  await assert.rejects(decodeBackup(bytes),/requires its password/);
  await assert.rejects(decodeBackup(bytes,'incorrect password'));
  assert.deepEqual(await decodeBackup(bytes,password),data);
  assert.ok(!Buffer.from(bytes).includes(Buffer.from(secret.stringData.token)));
  assert.deepEqual(withoutSecretValues(secret),{apiVersion:'v1',kind:'Secret',metadata:secret.metadata});
});
test('weak passwords cannot produce protected recovery files', async () => {
  assert.equal(passwordStrength('aaaaaaaaaaaaaaaaaaaa').acceptable,false);
  await assert.rejects(encodeBackup(snapshot,'weak'),/strong password/);
});
test('coverage banner checks Secret presence across rotations and age', () => {
  const now=Date.now(), id='resource/v1/Secret/dns-system/test';
  const expected=[{id,digest:'new'}];
  const stored=[{createdAt:new Date(now-20*86400000).toISOString(),coverage:[{id,capturedValues:true}]}];
  assert.equal(assessCoverage(expected,stored,now).covered,1);
  assert.deepEqual(uncoveredEntries(expected,stored,now),[]);
  assert.equal(uncoveredEntries(expected,[],now)[0].status,'Missing');
});
