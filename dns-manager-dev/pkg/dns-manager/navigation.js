import { reactive } from 'vue';
export const GROUP = 'dnsManager';
export const routeName = section => `c-cluster-explorer-dns-manager-${section}`;
export const pages = [
  ['overview','Overview'],['sources','Sources'],['zones','Zones'],['instances','Instances'],
  ['pending','Pending Rollouts'],['processes','Running Processes'],
  ['snapshots','Snapshots'],['diagnostics','Diagnostics'],['settings','Settings'],['help','Help']
];
// Populated by observations; sample zone names must never become native cluster inventory.
export const navigationState = reactive({ zones: [], counts: {}, phase:'idle', failures:{}, tones:{} });
export function routeFor(section, cluster) {
  const params = { cluster, product:'explorer' }, query = {};
  if (section.startsWith('source:')) { query.editor=section.slice(7);section='sources'; }
  else if (section==='zone:new') { query.editor='new';section='zones'; }
  else if (section.startsWith('record:')) { params.zone=section.slice(7);query.editor='record';section='zone'; }
  else if (section.startsWith('zone:')) { params.zone=section.slice(5);section='zone'; }
  return { name:routeName(section),params,query };
}
