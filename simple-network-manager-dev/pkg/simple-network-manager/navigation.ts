export const GROUP = 'simpleNetworkManager';
export const SETTINGS_GROUP = 'simpleNetworkManagerSettings';
export interface ManagerPage { name: string; label: string; parent?: 'settings'; hidden?: boolean }
export const PAGES: ManagerPage[] = [
  { name: 'overview', label: 'Overview' },
  { name: 'publish-service', label: 'Connection editor', hidden: true },
  { name: 'certificates', label: 'TLS & Certificates' },
  { name: 'pending-rollouts', label: 'Pending Rollouts' },
  { name: 'running-processes', label: 'Running Processes' },
  { name: 'issuer-profiles', label: 'TLS Issuer Profiles' },
  { name: 'port-configurations', label: 'Port Configurations' },
  { name: 'history', label: 'Snapshots' },
  { name: 'snapshot-coverage', label: 'Snapshot Coverage', hidden: true },
  { name: 'merge-snapshots', label: 'Merge Snapshots', hidden: true },
  { name: 'diagnostics', label: 'Diagnostics' },
  { name: 'settings', label: 'Settings' },
  { name: 'help', label: 'Help' }
];
export const ROOT_PAGES = PAGES.filter(page => !page.parent && !page.hidden);
export const SETTINGS_PAGES = PAGES.filter(page => page.parent === 'settings');
export const routeName = (page: string) => `c-cluster-explorer-snm-${ page }`;
