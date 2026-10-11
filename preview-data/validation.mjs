import { PreviewDataError } from './store.mjs';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const require = (condition, message) => { if (!condition) throw new PreviewDataError(message); };
export function validatePreviewData(pluginId, data) {
  require(object(data?.inventory) && object(data?.state), 'Mock data must contain inventory and state objects.');
  function rejectCredentials(value) {
    if (!value || typeof value !== 'object') return;
    require(!(value.kind === 'Secret' && ('data' in value || 'stringData' in value)), 'Decrypted Secret values cannot be saved in mock sources.');
    for (const [key, child] of Object.entries(value)) {
      require(!/^(password|confirmationPassword|backupPassword|passwords|secretValue|privateKey|accessToken|apiToken)$/i.test(key) || child === '' || child === null, 'Passwords and credential values cannot be saved in mock sources.');
      rejectCredentials(child);
    }
  }
  rejectCredentials(data);
  if (pluginId === 'dns-manager') {
    const { zones, records, source } = data.inventory;
    require(Array.isArray(zones) && object(records) && object(source), 'DNS inventory needs zones, records, and source.');
    require(['name', 'host', 'address', 'credential'].every(key => typeof source[key] === 'string'), 'DNS source fields must be strings.');
    require(zones.every(zone => object(zone) && ['id', 'name', 'kind', 'serial'].every(key => typeof zone[key] === 'string' && zone[key].length)), 'Each zone needs a string id, name, kind, and serial.');
    require(new Set(zones.map(zone => zone.id)).size === zones.length, 'Zone IDs must be unique.');
    for (const zone of zones) {
      require(Array.isArray(records[zone.id]), `Records for ${zone.id} must be an array.`);
      require(records[zone.id].every(record => object(record) && ['name', 'type', 'value'].every(key => typeof record[key] === 'string') && Number.isInteger(record.ttl) && record.ttl >= 0), `Records for ${zone.id} need name, type, value, and a nonnegative integer TTL.`);
    }
    require(data.state.version === 1, 'DNS state version must be 1.');
    for (const key of ['order', 'drafts', 'snapshots', 'logs']) require(Array.isArray(data.state[key]), `DNS state ${key} must be an array.`);
    require(data.state.order.every(id => zones.some(zone => zone.id === id)) && new Set(data.state.order).size === data.state.order.length, 'Saved order must contain unique known zone IDs.');
    if (data.state.source) require(object(data.state.source) && ['name', 'host', 'address', 'credential'].every(key => typeof data.state.source[key] === 'string'), 'Saved DNS source fields must be strings.');
  } else if (pluginId === 'network-manager') {
    const expected = {
      'publication-snapshot.json': ['namespaces', 'services'], 'namespace-snapshot.json': ['namespaces'],
      'listener-snapshot.json': ['entryPoints'], 'route-details-snapshot.json': ['routes'],
      'route-attachment-snapshot.json': ['routes'], 'route-resources-snapshot.json': ['resources'],
      'certificate-snapshot.json': ['certificates'], 'certificate-resources-snapshot.json': ['resources'],
      'dependency-resources-snapshot.json': ['resources']
    };
    for (const [name, keys] of Object.entries(expected)) {
      require(object(data.inventory[name]), `Missing inventory dataset ${name}.`);
      for (const key of keys) require(Array.isArray(data.inventory[name][key]), `${name}.${key} must be an array.`);
    }
    for (const key of ['portConfigurations', 'issuerProfiles', 'credentialReferences', 'accountReferences', 'publications',
      'configurationRollouts', 'connectionDrafts', 'pendingChanges', 'editorDrafts', 'formDrafts', 'runningProcesses']) {
      if (key in data.state) require(Array.isArray(data.state[key]), `Network state ${key} must be an array.`);
    }
  }
}
