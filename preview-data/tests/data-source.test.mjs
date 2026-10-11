import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRancherDataSource, initializeDataSource } from '../data-source.mjs';
import { validatePreviewData } from '../validation.mjs';

test('Rancher adapter shares normalized source contract and cannot write inventory as mock JSON', async () => {
  let staged, state;
  const source = createRancherDataSource({ pluginId: 'example',
    read: async () => ({ pluginId: 'example', source: { label: 'Authenticated observations' }, data: { inventory: { rows: [] }, state: {} } }),
    saveState: async value => { state = value; }, stageChanges: async value => { staged = value; } });
  await initializeDataSource(source);
  assert.equal(source.kind, 'rancher'); assert.equal(source.capabilities.editableInventory, false);
  await source.saveState({ draft: 'example' }); await source.stageChanges([{ id: 'reviewed' }]);
  assert.equal(state.draft, 'example'); assert.equal(staged[0].id, 'reviewed');
  await assert.rejects(source.saveData({}), /cannot be overwritten/);
  assert.throws(() => createRancherDataSource({ pluginId: 'example' }), /authenticated Rancher read/);
});

test('DNS source rejects missing record collections and stale order identities', () => {
  const data = { inventory: { source: { name: 'example', host: 'example.test', address: '192.0.2.1', credential: 'reference' },
    zones: [{ id: 'example', name: 'example.test', kind: 'Forward', serial: '1' }], records: { example: [] } },
    state: { version: 1, order: ['example'], drafts: [], snapshots: [], logs: [] } };
  validatePreviewData('dns-manager', data);
  assert.throws(() => validatePreviewData('dns-manager', { ...data, state: { ...data.state, order: ['missing'] } }), /known zone IDs/);
  assert.throws(() => validatePreviewData('dns-manager', { ...data, inventory: { ...data.inventory, records: {} } }), /must be an array/);
});
