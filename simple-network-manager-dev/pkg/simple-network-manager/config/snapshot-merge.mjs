import { snapshotItems, itemsToCurrent, selectSnapshotItems } from './snapshot-items.mjs';
import { redactSecrets, secretBackupStatus } from './snapshot-secrets.mjs';
import { coverageEntries } from './snapshot-coverage.mjs';

// The first source has the highest priority. Resolve each whole item once,
// rather than blending incompatible fields from different versions.
export function mergeInPriorityOrder(snapshots, selectedIds, preservedSecrets = []) {
  if (snapshots.length < 2 || new Set(snapshots.map(s => s.id)).size !== snapshots.length) throw new Error('Choose at least two distinct snapshots.');
  const items = new Map(), itemSources = {}, repeated = new Set();
  const observedRoutes = new Map();
  for (const snapshot of [...snapshots].reverse()) {
    for (const item of snapshotItems(snapshot.current)) {
      if (items.has(item.id)) repeated.add(item.id);
      items.set(item.id, item);
      itemSources[item.id] = { snapshotId: snapshot.id, createdAt: snapshot.current?.itemSources?.[item.id]?.createdAt || snapshot.createdAt };
    }
    for (const route of snapshot.current.observedRoutes || []) observedRoutes.set(`${route.kind}/${route.namespace}/${route.name}`, route);
  }
  const flattened = itemsToCurrent([...items.values()], {
    snapshotScope: { label: 'Merged Configuration Snapshots' },
    itemSources, mergedFrom: snapshots.map(s => s.id), priorityOrder: snapshots.map(s => s.id),
    authoritativeSnapshot: snapshots[0].id, observedRoutes: [...observedRoutes.values()]
  });
  const requested = selectedIds === undefined ? [...items.keys()] : selectedIds;
  if (!Array.isArray(requested) || !requested.length || requested.some(id => !items.has(id))) throw new Error('Select valid items from the flattened snapshots.');
  const selection = selectSnapshotItems(flattened, requested);
  const retained = new Set(selection.items.map(item => item.id));
  for (const secret of preservedSecrets) {
    const item = snapshotItems({routeManifests:[secret]})[0];
    if (!item || item.value.kind !== 'Secret' || !retained.has(item.id)) throw new Error('Preserved Secrets must be selected source items.');
    const index = selection.items.findIndex(value=>value.id===item.id);
    selection.items[index] = item;
    itemSources[item.id] = {snapshotId:'current',createdAt:new Date().toISOString()};
  }
  // Keep capture provenance, and avoid claiming coverage of unchecked routes.
  const current = itemsToCurrent(selection.items, {
    ...flattened,
    itemSources: Object.fromEntries(Object.entries(itemSources).filter(([id]) => retained.has(id))),
    observedRoutes: flattened.observedRoutes.filter(route => selection.items.some(item => item.type === 'resource' && item.value.kind === route.kind && item.name === route.name && item.namespace === route.namespace))
  });
  current.secretBackup = secretBackupStatus(current.routeManifests,current.snapshotScope?.issuerSecretNamespace);
  return { current, flattened, items: selection.items, added: selection.added, missing: selection.missing, repeated: [...repeated], omitted: items.size - retained.size };
}

// Compare configuration content, excluding transient Kubernetes status metadata.
// Current-only items are informational; merging never deletes current resources.
export function compareMergedConfiguration(current, merged) {
  const before = new Map(coverageEntries(current).filter(item=>!item.incomplete).map(item => [item.id, item.value]));
  const after = new Map(coverageEntries(merged).filter(item=>!item.incomplete).map(item => [item.id, item.value]));
  const names = new Map([...snapshotItems(current), ...snapshotItems(merged)].map(item => [item.id, item]));
  return [...new Set([...after.keys(), ...before.keys()])].map(id => ({
    id, name: names.get(id)?.name || id, namespace: names.get(id)?.namespace || '',
    type: names.get(id)?.type === 'resource' ? names.get(id).value.kind : names.get(id)?.type,
    status: !before.has(id) ? 'Added' : !after.has(id) ? 'Current Only' : before.get(id) === after.get(id) ? 'Unchanged' : 'Changed',
    current: before.has(id) ? redactSecrets(JSON.parse(before.get(id))) : undefined,
    merged: after.has(id) ? redactSecrets(JSON.parse(after.get(id))) : undefined
  }));
}
