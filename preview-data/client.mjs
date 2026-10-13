const copy = value => JSON.parse(JSON.stringify(value));
export async function createPreviewDataClient(pluginId) {
  const endpoint = `/__preview-data/${pluginId}`;
  let document, pending = null, writing = null, failure = null;
  const listeners = new Set();
  const notify = () => { for (const listener of listeners) listener(client); };
  async function request(method, body, signal) {
    const response = await fetch(endpoint, { method, signal, headers: body ? { 'Content-Type': 'application/json', 'X-Preview-Data': '1' } : {}, body: body ? JSON.stringify(body) : undefined });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'Project mock data request failed.');
    return value;
  }
  const client = {
    kind: 'mock', pluginId,
    capabilities: { editableInventory: true, stageChanges: false },
    get document() { return copy({ ...document, data: pending || document.data }); },
    get status() { return failure ? failure.message : pending || writing ? 'Saving mock data…' : 'Mock data saved in project'; },
    get error() { return failure; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async reload({ discardPending = false, signal } = {}) {
      if (discardPending) { pending = null; failure = null; }
      // A refresh is a read. Retain pending edits; never retry a failed write.
      const next = await request('GET', undefined, signal); signal?.throwIfAborted();
      if (!document || next.revision >= document.revision) document = next;
      notify(); return client.document;
    },
    loadState() { return copy(pending?.state || document.data.state); },
    saveState(state) { pending = { ...copy(document.data), state: copy(state) }; notify(); void client.flush().catch(() => {}); return true; },
    async flush() {
      while (writing || pending) {
        if (writing) { await writing; continue; }
        const data = pending; pending = null; failure = null;
        writing = request('PUT', { revision: document.revision, data }).then(next => { document = next; })
          .catch(error => { failure = error; if (!pending) pending = data; throw error; })
          .finally(() => { writing = null; notify(); });
        await writing;
      }
      if (failure) throw failure;
    },
    async saveData(data) {
      await client.flush();
      document = await request('PUT', { revision: document.revision, data });
      notify();
      return client.document;
    }
  };
  document = await request('GET');
  globalThis.__rancherPluginData ||= {};
  globalThis.__rancherPluginData[pluginId] = copy(document.data);
  window.addEventListener('beforeunload', event => { if (pending || writing) { event.preventDefault(); event.returnValue = ''; } });
  return client;
}

export function createStaticPreviewDataClient(initial) {
  let document = copy(initial);
  globalThis.__rancherPluginData ||= {};
  globalThis.__rancherPluginData[document.pluginId] = copy(document.data);
  return {
    kind: 'static', pluginId: document.pluginId, capabilities: { editableInventory: false, stageChanges: false },
    get document() { return copy(document); },
    status: 'Static preview — changes stay in memory; use npm run preview to save in the project',
    subscribe() { return () => {}; },
    loadState() { return copy(document.data.state); },
    saveState(state) { document.data.state = copy(state); return true; },
    async reload() { return copy(document); }, async flush() {},
    async saveData() { throw new Error('Run npm run preview to edit project files.'); }
  };
}
