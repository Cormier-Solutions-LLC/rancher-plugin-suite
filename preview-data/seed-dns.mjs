import { writeFile } from 'node:fs/promises';
import { defaultInventory } from '../dns-manager-dev/pkg/dns-manager/ui/default-inventory.js';
const document = {
  schemaVersion: 1, pluginId: 'dns-manager', revision: 0, updatedAt: null,
  source: { kind: 'mock', label: 'DNS design examples — sample data, not live DNS observations',
    projectFile: 'preview-data/data/dns-manager.json', originalFiles: ['dns-manager-dev/pkg/dns-manager/ui/default-inventory.js'] },
  data: { inventory: defaultInventory, state: { version: 1, revision: 0, page: 'overview',
    order: defaultInventory.zones.map(zone => zone.id), drafts: [], snapshots: [], logs: [], refreshSeconds: 300 } }
};
await writeFile(new URL('./data/dns-manager.json', import.meta.url), JSON.stringify(document, null, 2) + '\n', { flag: 'wx' });
