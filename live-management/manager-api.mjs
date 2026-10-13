const endpoints = new Map();
export function configureManagerApi(pluginId, cluster) {
  endpoints.set(pluginId, `/k8s/clusters/${encodeURIComponent(cluster)}/api/v1/namespaces/manager-system/services/http:${pluginId}-snapshots:8080/proxy`);
}
export function managerApiUrl(pluginId, url) {
  const prefix = endpoints.get(pluginId);
  return prefix && typeof url === 'string' && url.startsWith('/api/') ? prefix + url : url;
}
export function managerFetch(pluginId, url, options) {
  return fetch(managerApiUrl(pluginId, url), { credentials: 'same-origin', ...options });
}
