import { watch } from 'vue';

// Uses the same Rancher getters and mutation as Network Manager.
export function createNamespaceContext(store, onChange, initial = []) {
  let filters = [...initial];
  const normalize = values => {
    const typed = values.filter(value => value.startsWith('namespaced://'));
    return values.filter(value => !value.startsWith('namespaced://') || value === typed.at(-1));
  };
  const stop = store ? watch(
    () => store.getters.activeNamespaceFilters || store.state.namespaceFilters,
    values => { filters = normalize([...(values || [])]); onChange?.([...filters]); },
    { deep: true, immediate: true }
  ) : () => {};
  return {
    get filters() { return [...filters]; },
    get options() {
      const namespaces = store?.getters.allNamespaces || [{ name: 'dns-system', isSystem: true }];
      return [
        { value: 'all://user', label: 'Only User Namespaces' },
        { value: 'all://system', label: 'Only System Namespaces' },
        { value: 'namespaced://true', label: 'Only Namespaced Resources' },
        { value: 'namespaced://false', label: 'Global / Cluster Resources' },
        ...namespaces.map(ns => ({ value: `ns://${ns.id || ns.name || ns.metadata?.name}`, label: ns.id || ns.name || ns.metadata?.name }))
      ];
    },
    set(values) {
      filters = normalize([...new Set(values)]);
      if (store) store.commit('updateNamespaces', { filters: [...filters] });
      onChange?.([...filters]);
    },
    matches(namespace) {
      if (!filters.length) return true;
      if (filters.includes('namespaced://true') && !namespace || filters.includes('namespaced://false') && namespace) return false;
      const scopes = filters.filter(value => !value.startsWith('namespaced://'));
      if (!scopes.length || scopes.includes('all')) return true;
      if (!namespace) return !scopes.some(value => value.startsWith('ns://') || value.startsWith('project://'));
      if (store) return !!store.getters.activeNamespaceCache?.[namespace];
      const system = namespace === 'dns-system';
      return scopes.some(value => value === `ns://${namespace}` || value === 'all://system' && system || value === 'all://user' && !system);
    },
    destroy: stop
  };
}
