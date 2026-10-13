// Both adapters expose the same normalized inventory + staged-state contract.
// Live adapters receive authenticated Rancher/backend callbacks; never browser credentials.
const copy = value => JSON.parse(JSON.stringify(value));
export function createRancherDataSource({ pluginId, read, saveState, stageChanges, testConnection, sourceAction }) {
  if (typeof read !== 'function') throw new Error('An authenticated Rancher read adapter is required.');
  let document;
  const listeners = new Set();
  const emit = () => { for (const listener of listeners) listener(source); };
  const source = {
    kind: 'rancher', pluginId,
    capabilities: { editableInventory: false, stageChanges: typeof stageChanges === 'function', testConnection: typeof testConnection === 'function', sourceManagement: typeof sourceAction === 'function' },
    get document() { return document && copy(document); },
    get status() { return document ? 'Rancher observations loaded' : 'Rancher observations unavailable'; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async reload({signal, mode = 'fresh'} = {}) {
      const result = await read({signal, mode});
      signal?.throwIfAborted();
      if (!result?.data?.inventory || !result?.data?.state || result.pluginId !== pluginId) throw new Error('The Rancher adapter returned an incompatible normalized source.');
      document = { ...result, source: { ...result.source, kind: 'rancher' } }; emit();
      return source.document;
    },
    loadState() { return copy(document?.data.state || {}); },
    async saveState(state,options={}) {
      if (!saveState) throw new Error('Authenticated draft persistence is not configured.');
      await saveState(copy(state),options);
      document.data.state = copy(state); emit();
    },
    async stageChanges(changes) {
      if (!stageChanges) throw new Error('Authenticated rollout staging is not configured.');
      return stageChanges(copy(changes));
    },
    async testConnection(settings,options={}) {
      if(!testConnection)throw new Error('Read-only source connection testing is unavailable.');
      return testConnection(copy(settings),options);
    },
    async sourceAction(input){if(!sourceAction)throw new Error('Source configuration management is unavailable.');return sourceAction(copy(input));},
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
