import { snapshotItems } from './snapshot-items.mjs';
import { compareMergedConfiguration } from './snapshot-merge.mjs';

const secret = item => item.type === 'resource' && item.value.kind === 'Secret';
function groupKey(item) {
  if (item.type === 'issuer' || ['Issuer', 'ClusterIssuer'].includes(item.value.kind)) return 'issuers';
  if (item.value.kind === 'Certificate') return 'certificates';
  if (item.type === 'configuration') return 'ports';
  if (secret(item)) return 'secrets';
  return item.type === 'resource' ? item.value.kind : item.type;
}
export function mergeSelectionGroups(items, changingIds) {
  const groups = new Map([
    ['issuers', {key:'issuers', label:'TLS Issuers', ids:[]}],
    ['certificates', {key:'certificates', label:'Certificates', ids:[]}],
    ['ports', {key:'ports', label:'Port Configurations', ids:[]}],
    ['secrets', {key:'secrets', label:'Secrets', ids:[]}]
  ]);
  const labels = {service:'Service References', publication:'Publication Drafts', connection:'Connection Drafts', proposal:'Pending Changes'};
  for (const item of items) {
    const key = groupKey(item);
    if (!groups.has(key)) groups.set(key, {key, label:labels[key] || key, ids:[]});
    groups.get(key).ids.push(item.id);
  }
  return [...groups.values()].filter(group => changingIds === undefined || group.ids.some(id=>changingIds.includes(id)));
}
// Matching items always persist, independently of the changing-item checkboxes.
// Secret selection opts into an older version; otherwise keep current credentials.
export function planMergeSelection(current, flattened, selectedIds) {
  const rows = compareMergedConfiguration(current, flattened);
  const saved = snapshotItems(flattened), present = new Map(snapshotItems(current).map(item => [item.id, item]));
  const matching = rows.filter(row => row.status === 'Unchanged').map(row => row.id);
  const secrets = saved.filter(secret);
  const preservedSecrets = secrets.filter(item => !selectedIds.includes(item.id) && present.has(item.id) && rows.some(row => row.id === item.id && row.status === 'Changed')).map(item => present.get(item.id).value);
  return {
    includedIds:[...new Set([...selectedIds, ...matching, ...secrets.map(item => item.id)])],
    preservedSecrets
  };
}
