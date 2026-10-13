import { computed } from 'vue';
import { storedSnapshots } from './stored-snapshots';
import { inventoryDatasets } from './inventory';
const certificates = inventoryDatasets['certificate-snapshot.json'];
import { pendingChanges, pendingCount, incompleteChanges } from './pending-rollouts';
import { issuerProfiles } from './workspace';
import { portConfigurations } from './port-presets';
import { diagnosticCounts } from './diagnostic-logs';
import { contextMatches } from './namespace-context';
import { runningProcesses } from './running-processes';
import { routes } from './snapshot';
import { refreshFailed } from './page-refresh';
export const navigationCounts = computed<Record<string, number>>(() => ({
  overview: routes.filter(route=>contextMatches(route.namespace)).length,
  certificates: new Set([...certificates.certificates.filter(cert=>contextMatches(cert.namespace)).map(cert => `${cert.namespace}/${cert.name}`), ...pendingChanges.filter(change => change.category === 'New Certificate' && contextMatches(change.namespace)).map(change => `${change.namespace}/${change.name}`)]).size,
  'pending-rollouts': pendingCount.value,
  'running-processes': runningProcesses.filter(process=>contextMatches(process.namespace)).length,
  'issuer-profiles': issuerProfiles.filter(profile=>contextMatches((profile.manifest as any)?.metadata?.namespace)).length,
  'port-configurations': portConfigurations.filter(config=>contextMatches(config.namespace,true)).length,
  history: storedSnapshots.value.filter(record=>(record.namespaces || []).length ? record.namespaces!.some(namespace=>contextMatches(namespace)) : contextMatches(record.scope?.namespace)).length,
  diagnostics: diagnosticCounts.value.total
}));

export const navigationTones = computed<Record<string,string>>(() => {
  const scopedRoutes=routes.filter(route=>contextMatches(route.namespace));
  const routeTone=scopedRoutes.some(route=>/error|fail|missing/i.test(route.tls))?'error':scopedRoutes.some(route=>/pending|issuing|awaiting|not ready/i.test(route.tls))?'warning':'';
  const tones:Record<string,string>={overview:routeTone,certificates:certificates.certificates.some(cert=>contextMatches(cert.namespace)&&cert.ready!=='True')?'warning':'','pending-rollouts':incompleteChanges.value.some(change=>contextMatches(change.namespace))?'warning':''};
  for(const page of Object.keys(navigationCounts.value))tones[page]=page==='diagnostics'?diagnosticCounts.value.tone:refreshFailed.value?'error':tones[page]||'';
  return tones;
});
