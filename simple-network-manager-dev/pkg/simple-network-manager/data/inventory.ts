import { reactive } from 'vue';
import fixture0 from './certificate-resources-snapshot.json';
import fixture1 from './certificate-snapshot.json';
import fixture2 from './dependency-resources-snapshot.json';
import fixture3 from './listener-snapshot.json';
import fixture4 from './namespace-snapshot.json';
import fixture5 from './network-address-snapshot.json';
import fixture6 from './publication-snapshot.json';
import fixture7 from './resource-owner-snapshot.json';
import fixture8 from './route-attachment-snapshot.json';
import fixture9 from './route-details-snapshot.json';
import fixture10 from './route-resources-snapshot.json';

const initial = {
  'certificate-resources-snapshot.json': fixture0,
  'certificate-snapshot.json': fixture1,
  'dependency-resources-snapshot.json': fixture2,
  'listener-snapshot.json': fixture3,
  'namespace-snapshot.json': fixture4,
  'network-address-snapshot.json': fixture5,
  'publication-snapshot.json': fixture6,
  'resource-owner-snapshot.json': fixture7,
  'route-attachment-snapshot.json': fixture8,
  'route-details-snapshot.json': fixture9,
  'route-resources-snapshot.json': fixture10,
};
const loaded = (globalThis as any).__rancherPluginData?.['network-manager']?.inventory;
export const inventoryDatasets = reactive<typeof initial>(loaded || initial);

// Preserve object/array identities held by page components during source refresh.
function reconcile(target: any, value: any) {
  if (Array.isArray(target) && Array.isArray(value)) { target.splice(0, target.length, ...value); return; }
  for (const key of Object.keys(target)) if (!(key in value)) delete target[key];
  for (const [key, next] of Object.entries(value)) {
    if (target[key] && next && typeof target[key] === 'object' && typeof next === 'object') reconcile(target[key], next);
    else target[key] = next;
  }
}
export function updateNetworkInventory(inventory: typeof initial) {
  for (const key of Object.keys(initial) as (keyof typeof initial)[]) {
    if (!(key in inventory)) throw new Error(`Data source is missing ${key}.`);
  }
  reconcile(inventoryDatasets, inventory);
}
