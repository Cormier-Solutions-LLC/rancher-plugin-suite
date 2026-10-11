import { watch } from 'vue';
import { portConfigurations, configurationVersions } from '../simple-network-manager-dev/pkg/simple-network-manager/data/port-presets';
import { issuerProfiles, credentialReferences, accountReferences } from '../simple-network-manager-dev/pkg/simple-network-manager/data/workspace';
import { publications, configurationRollouts } from '../simple-network-manager-dev/pkg/simple-network-manager/data/publications';
import { connectionDrafts } from '../simple-network-manager-dev/pkg/simple-network-manager/data/connection-edits';
import { pendingChanges } from '../simple-network-manager-dev/pkg/simple-network-manager/data/pending-rollouts';
import { editorDrafts, formDrafts, editorDirty } from '../simple-network-manager-dev/pkg/simple-network-manager/data/editor-session';
import { runningProcesses } from '../simple-network-manager-dev/pkg/simple-network-manager/data/running-processes';
import { displaySettings } from '../simple-network-manager-dev/pkg/simple-network-manager/data/display-settings';
import { rancherOrigin } from '../simple-network-manager-dev/pkg/simple-network-manager/data/resource-links';
import { namespaceContext } from '../simple-network-manager-dev/pkg/simple-network-manager/data/namespace-context';

export function connectNetworkState(source: any) {
  const arrays: Record<string, any[]> = { portConfigurations, issuerProfiles, credentialReferences,
    accountReferences, publications, configurationRollouts, connectionDrafts, pendingChanges, runningProcesses };
  const saved = source.loadState();
  for (const [key, target] of Object.entries(arrays)) if (Array.isArray(saved[key])) target.splice(0, target.length, ...saved[key]);
  if (Array.isArray(saved.editorDrafts)) editorDrafts.value = saved.editorDrafts;
  if (Array.isArray(saved.formDrafts)) formDrafts.value = saved.formDrafts;
  if (saved.configurationVersions) Object.assign(configurationVersions, saved.configurationVersions);
  if (saved.displaySettings) Object.assign(displaySettings, saved.displaySettings);
  if (typeof saved.rancherOrigin === 'string') rancherOrigin.value = saved.rancherOrigin;
  if (Array.isArray(saved.namespaceContext)) namespaceContext.value = saved.namespaceContext;
  const state = () => ({ ...arrays, configurationVersions, editorDrafts: editorDrafts.value,
    formDrafts: formDrafts.value, displaySettings, rancherOrigin: rancherOrigin.value,
    namespaceContext: namespaceContext.value });
  // Synchronous watch queues the complete saved state before the next user action.
  const stop = watch(state, value => source.saveState(value), { deep: true, flush: 'sync' });
  return { stop, canEdit: () => !editorDirty.value };
}
