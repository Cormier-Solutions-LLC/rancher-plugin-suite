import { runningCount } from './running-processes';
import { computed } from 'vue';
import { storedSnapshots } from './stored-snapshots';
import { inventoryDatasets } from './inventory';
const certificates = inventoryDatasets['certificate-snapshot.json'];
import { pendingChanges, pendingCount } from './pending-rollouts';
import { issuerProfiles } from './workspace';
import { portConfigurations } from './port-presets';
import { diagnosticCounts } from './diagnostic-logs';
export const navigationCounts = computed<Record<string, number>>(() => ({
  certificates: new Set([...certificates.certificates.map(cert => `${cert.namespace}/${cert.name}`), ...pendingChanges.filter(change => change.category === 'New Certificate').map(change => `${change.namespace}/${change.name}`)]).size,
  'pending-rollouts': pendingCount.value,
  'running-processes': runningCount.value,
  'issuer-profiles': issuerProfiles.length,
  'port-configurations': portConfigurations.length,
  history: storedSnapshots.value.length,
  diagnostics: diagnosticCounts.value.total
}));
