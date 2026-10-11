import { secretBackupStatus } from './snapshot-secrets.mjs';
// Serialize the JSON-compatible Kubernetes manifest subset. Quoted scalars
// preserve ports, host rules and string values without YAML implicit coercion.
const scalar = value => JSON.stringify(value).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
function lines(value, depth = 0) {
  const pad = ' '.repeat(depth);
  const nested = child => child !== null && typeof child === 'object' && Object.keys(child).length > 0;
  if (Array.isArray(value)) return value.flatMap(child => nested(child) ? [`${pad}-`, ...lines(child, depth + 2)] : [`${pad}- ${scalar(child)}`]);
  return Object.entries(value).flatMap(([key, child]) => nested(child) ? [`${pad}${scalar(key)}:`, ...lines(child, depth + 2)] : [`${pad}${scalar(key)}: ${scalar(child)}`]);
}
export function snapshotManifests(current) {
  const observed = (current.routeManifests || []).filter(resource => resource && resource.kind);
  const drafts = [...(current.localPublications || []).flatMap(draft => draft.resources || []), ...(current.editedConnections || []).flatMap(draft => draft.resources || []), ...(current.pendingChanges || []).filter(change => change.configuration?.operation !== 'Delete').flatMap(change => change.resources || [])];
  const unique = new Map();
  for (const resource of [...observed, ...drafts]) {
    if (!resource?.apiVersion || !resource.metadata?.name) throw new Error('Backup contains an invalid manifest.');
    const key = `${resource.apiVersion}/${resource.kind}/${resource.metadata.namespace || ''}/${resource.metadata.name}`;
    // The observed pre-change manifest is the recovery copy. Proposed local
    // edits to the same object remain separately available in the JSON index.
    if (!unique.has(key)) unique.set(key, resource);
  }
  return [...unique.values()];
}
export function manifestYaml(current) {
  const resources = snapshotManifests(current);
  const status = secretBackupStatus(resources,current.snapshotScope?.issuerSecretNamespace);
  const omissions = status.missing.map(id=>`# Secret Values Not Captured: ${id.replaceAll('\n',' ').replaceAll('\r',' ')}\n`).join('');
  if (!resources.length) return '# This snapshot contains no affected Kubernetes manifests.\n';
  return '# Network Manager: Kubernetes manifest export\n# Preview: inspected resource specifications and local drafts; not a fresh live-cluster backup.\n# Contains configuration and captured Secret values. Store this file securely. Application data is not included.\n' + omissions + resources.map(resource => lines(JSON.parse(JSON.stringify(resource))).join('\n')).join('\n---\n') + '\n';
}
