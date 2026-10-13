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
import { refreshMessage } from '../simple-network-manager-dev/pkg/simple-network-manager/data/page-refresh';
import {reconcileIssuerWorkspace} from '../live-management/reconcile-issuer-workspace.mjs';

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
  let refreshingIssuerState=false;
  const stop = watch(state, value => { if(!refreshingIssuerState)source.saveState(value).catch((error:Error)=>{refreshMessage.value=`Draft persistence failed: ${error.message}`;}); }, { deep: true, flush: 'sync' });
  async function refreshObservedIssuers(loaded:any){
    const current=JSON.parse(JSON.stringify({issuerProfiles,credentialReferences,accountReferences})),next=reconcileIssuerWorkspace(current,loaded);
    if(JSON.stringify(current)===JSON.stringify(next))return;
    refreshingIssuerState=true;
    try{issuerProfiles.splice(0,issuerProfiles.length,...next.issuerProfiles);credentialReferences.splice(0,credentialReferences.length,...next.credentialReferences);accountReferences.splice(0,accountReferences.length,...next.accountReferences);}finally{refreshingIssuerState=false;}
    await source.saveState(state());
  }
  return { stop, refreshObservedIssuers, canEdit: () => !editorDirty.value };
}
