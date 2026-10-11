import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { createServer } from 'node:http';
import { createPreviewStore, previewDataMiddleware } from '../store.mjs';
import { createPreviewDataClient } from '../client.mjs';

async function fixture(t) {
  const dir = await mkdtemp(resolve(tmpdir(), 'rancher-preview-test-'));
  t.after(async () => { assert.ok(dir.startsWith(resolve(tmpdir()) + sep)); await rm(dir, { recursive: true, force: true }); });
  const file = resolve(dir, 'source.json');
  const initial = { schemaVersion: 1, pluginId: 'example', revision: 0,
    source: { kind: 'mock', label: 'Fixture', originalFiles: ['examples/source.json'] },
    data: { inventory: { rows: [{ id: 'first' }] }, state: { drafts: [] } } };
  await writeFile(file, JSON.stringify(initial));
  const store = createPreviewStore({ file, pluginId: 'example' });
  return { file, initial, store };
}

test('save survives a new store, preserves source provenance, and rejects stale revisions', async t => {
  const { file, initial, store } = await fixture(t);
  const next = await store.save({ revision: 0, data: { ...initial.data, state: { drafts: [{ id: 'draft' }] } }, source: { label: 'tampered' } });
  assert.equal(next.revision, 1); assert.deepEqual(next.source, initial.source);
  assert.deepEqual((await createPreviewStore({ file, pluginId: 'example' }).load()).data.state.drafts, [{ id: 'draft' }]);
  await assert.rejects(store.save({ revision: 0, data: initial.data }), error => error.status === 409);
  assert.equal(JSON.parse(await readFile(file)).revision, 1);
});

test('invalid documents and concurrent saves cannot replace valid source', async t => {
  const { initial, store } = await fixture(t);
  await assert.rejects(store.save({ revision: 0, data: null }), /Invalid preview source/);
  assert.deepEqual(await store.load(), initial);
  const results = await Promise.allSettled([store.save({ revision: 0, data: initial.data }), store.save({ revision: 0, data: initial.data })]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await store.load()).revision, 1);
});

test('HTTP writes reject cross-origin and malformed bodies; client queues edits without loss', async t => {
  const { store } = await fixture(t);
  const middleware = previewDataMiddleware({ store, pluginId: 'example' });
  const server = createServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(() => new Promise(done => server.close(done)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const url = origin + '/__preview-data/example';
  const headers = { 'Content-Type': 'application/json', 'X-Preview-Data': '1' };
  assert.equal((await fetch(url, { method: 'PUT', headers: { ...headers, Origin: 'https://other.example' }, body: '{}' })).status, 403);
  assert.equal((await fetch(url, { method: 'PUT', headers, body: '{' })).status, 400);
  assert.equal((await fetch(origin + '/__preview-data/../../other')).status, 404);
  const originalFetch = globalThis.fetch, originalWindow = globalThis.window;
  globalThis.fetch = (path, options) => originalFetch(new URL(path, origin), options);
  globalThis.window = { addEventListener() {} };
  t.after(() => { globalThis.fetch = originalFetch; globalThis.window = originalWindow; });
  const client = await createPreviewDataClient('example');
  client.saveState({ drafts: [{ id: 'one' }] });
  client.saveState({ drafts: [{ id: 'one' }, { id: 'two' }] });
  await client.flush();
  assert.equal((await store.load()).data.state.drafts.length, 2);
  const stale = await createPreviewDataClient('example');
  await store.save({ revision: client.document.revision, data: { inventory: { rows: [] }, state: { drafts: [] } } });
  stale.saveState({ drafts: [{ id: 'keep-on-conflict' }] });
  await assert.rejects(stale.flush(), /changed in another preview/);
  assert.equal(stale.document.data.state.drafts[0].id, 'keep-on-conflict');
  assert.equal((await store.load()).data.inventory.rows.length, 0);
});
