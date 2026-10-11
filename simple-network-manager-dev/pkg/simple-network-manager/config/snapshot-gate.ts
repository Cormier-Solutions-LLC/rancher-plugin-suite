import { snapshotStateKey } from './snapshot-diff';
import { coverageEntries } from './snapshot-coverage.mjs';
export const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export function isRecentSnapshot(createdAt: number, now = Date.now()) {
  return Number.isFinite(createdAt) && createdAt <= now && now - createdAt <= SNAPSHOT_MAX_AGE_MS;
}
export function snapshotRequirementMet(input: { createdAt: number; scopeMatches: boolean; acknowledged: boolean }, now = Date.now()) {
  return input.scopeMatches && input.acknowledged && isRecentSnapshot(input.createdAt, now);
}
export function validateExistingSnapshot(snapshot: any, current: object, now = Date.now()) {
  validateSnapshotIndex(snapshot);
  const createdAt = Date.parse(snapshot.createdAt);
  if (!isRecentSnapshot(createdAt, now)) throw new Error('The snapshot must be within the past 24 hours, not in the future. Create a fresh snapshot.');
  const covered = new Map(coverageEntries(snapshot.current).map((entry:any) => [entry.id, entry.value]));
  const withoutSecretCapture = (state:any) => { const {secretBackup, ...rest} = state; return {...rest, ...(state.routeManifests ? {routeManifests:state.routeManifests.filter((resource:any)=>resource.kind !== 'Secret')} : {})}; };
  if (snapshotStateKey(withoutSecretCapture(snapshot.current)) !== snapshotStateKey(withoutSecretCapture(current)) || coverageEntries(current).filter((entry:any)=>!entry.incomplete).some((entry:any) => covered.get(entry.id) !== entry.value)) throw new Error('This snapshot does not match all configurations, services and routing manifests in the current review. Create a fresh snapshot for this review.');
  return createdAt;
}
export function validateSnapshotIndex(snapshot: any) {
  if (snapshot?.schemaVersion !== 1 || !snapshot.current || typeof snapshot.current !== 'object' || Array.isArray(snapshot.current) || typeof snapshot.createdAt !== 'string' || !Number.isFinite(Date.parse(snapshot.createdAt))) throw new Error('Upload a Network Manager snapshot index (JSON), including its creation time and configuration. YAML alone is for manual recovery and cannot verify this review’s snapshot requirement.');
  for (const key of ['relatedConfigurations', 'observedServiceReferences', 'observedRoutes', 'routeManifests', 'localPublications', 'editedConnections']) {
    if (snapshot.current[key] !== undefined && (!Array.isArray(snapshot.current[key]) || snapshot.current[key].some((item: any) => !item || typeof item !== 'object' || Array.isArray(item)))) throw new Error('The snapshot index has an invalid configuration list.');
  }
}
