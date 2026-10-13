import {normalizeDnsConfiguration} from './dns-record-order.mjs';
const normalize = (value: any): any => {
  if(Array.isArray(value))return value.map(normalize);
  if(!value||typeof value!=='object')return value;
  const config=normalizeDnsConfiguration(value);
  return Object.fromEntries(Object.keys(config).sort().map(key=>[key,normalize(config[key])]));
};
export const snapshotStateKey = (value: any) => JSON.stringify(normalize(value));
function entries(state: any) {
  const rows = new Map<string, any>();
  for (const config of [state.configuration, ...(state.relatedConfigurations || [])].filter(Boolean)) rows.set(`DNS configuration · ${config.id}`, config);
  for (const service of state.observedServiceReferences || []) rows.set(`Service · ${service.namespace}/${service.name}`, service);
  for (const route of state.routeManifests || []) rows.set(`${route.kind} · ${route.metadata?.namespace}/${route.metadata?.name}`, route);
  for (const route of state.observedRoutes || []) rows.set(`Route attachment · ${route.kind}/${route.namespace}/${route.name}`, route);
  for (const draft of state.localPublications || []) rows.set(`Publication draft · ${draft.namespace}/${draft.name}`, draft);
  for (const draft of state.editedConnections || []) rows.set(`Connection draft · ${draft.sourceId}`, draft);
  return rows;
}
export function compareSnapshotStates(current: any, saved: any) {
  const left = entries(current || {}), right = entries(saved || {});
  const items = [...new Set([...left.keys(), ...right.keys()])].sort().map(name => ({ name, current: left.get(name), saved: right.get(name), status: !left.has(name) ? 'Added by restoration' : !right.has(name) ? 'Only in current configuration' : snapshotStateKey(left.get(name)) === snapshotStateKey(right.get(name)) ? 'Unchanged' : 'Changed' }));
  const matches = snapshotStateKey(current) === snapshotStateKey(saved);
  if (!matches && items.every(item => item.status === 'Unchanged')) items.push({ name: 'Other configuration metadata', current, saved, status: 'Changed' });
  return { matches, items, changes: items.filter(item => item.status !== 'Unchanged') };
}
