// Both adapters expose the same normalized inventory + staged-state contract.
// Live adapters receive authenticated Rancher/backend callbacks; never browser credentials.
const copy = value => JSON.parse(JSON.stringify(value));
export function createRancherDataSource({ pluginId, read, saveState, stageChanges }) {
  if (typeof read !== 'function') throw new Error('An authenticated Rancher read adapter is required.');
  let document;
  const listeners = new Set();
  const emit = () => { for (const listener of listeners) listener(source); };
  const source = {
    kind: 'rancher', pluginId,
    capabilities: { editableInventory: false, stageChanges: typeof stageChanges === 'function' },
    get document() { return document && copy(document); },
    get status() { return document ? 'Rancher observations loaded' : 'Rancher observations unavailable'; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async reload() {
      const result = await read();
      if (!result?.data?.inventory || !result?.data?.state || result.pluginId !== pluginId) throw new Error('The Rancher adapter returned an incompatible normalized source.');
      document = { ...result, source: { ...result.source, kind: 'rancher' } }; emit();
      return source.document;
    },
    loadState() { return copy(document?.data.state || {}); },
    async saveState(state) {
      if (!saveState) throw new Error('Authenticated draft persistence is not configured.');
      await saveState(copy(state));
      document.data.state = copy(state); emit();
    },
    async stageChanges(changes) {
      if (!stageChanges) throw new Error('Authenticated rollout staging is not configured.');
      return stageChanges(copy(changes));
    },
    async saveData() { throw new Error('Live inventory cannot be overwritten as mock JSON. Stage reviewed changes through the backend.'); },
    async flush() {}
  };
  return source;
}

export async function initializeDataSource(source) {
  const document = source.document || await source.reload();
  globalThis.__rancherPluginData ||= {};
  globalThis.__rancherPluginData[document.pluginId] = copy(document.data);
  return document;
}
