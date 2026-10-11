import { watch } from 'vue';
import { navigationCounts } from './data/navigation-counts';
import { IPlugin } from '@shell/core/types';
import { GROUP, PAGES, ROOT_PAGES, routeName } from './navigation';

export function init(plugin: IPlugin, store: any) {
  const { basicType, virtualType, weightGroup, setGroupDefaultType } = plugin.DSL(store, 'explorer');
  watch(navigationCounts, counts => {
    PAGES.forEach((page, index) => {
      // The navigation renderer supports count, although the DSL options omit it.
      const navItem = {
      name: `snm-${page.name}`, label: page.label, count: counts[page.name],
      namespaced: false, weight: PAGES.length - index,
      route: { name: routeName(page.name), params: { product: 'explorer' } }
      };
      virtualType(navItem);
    });
  }, { immediate: true });
  // A dedicated overview link makes the group header navigate even when a child is active.
  const home = { name: 'snm-home', label: 'Overview', overview: true, namespaced: false, weight: PAGES.length + 1, route: { name: routeName('overview'), params: { product: 'explorer' } } };
  virtualType(home);
  basicType(['snm-home', ...ROOT_PAGES.map(page => `snm-${page.name}`)], GROUP);
  setGroupDefaultType(GROUP, 'snm-overview');
  // Weight is a placement hint; verify against installed Rancher products.
  weightGroup(GROUP, 0.5, true);
}
