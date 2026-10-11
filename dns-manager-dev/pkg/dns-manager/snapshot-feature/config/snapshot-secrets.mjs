export function secretReferences(resources, clusterIssuerNamespace = 'cert-manager') {
  const refs = new Map();
  for (const resource of resources) {
    if (resource.kind === 'Secret') continue;
    const namespace = resource.kind === 'ClusterIssuer' ? clusterIssuerNamespace : resource.metadata?.namespace;
    const add = name => { if (name && namespace) refs.set(`${namespace}/${name}`, { namespace, name }); };
    const walk = value => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (key === 'secretName' && typeof child === 'string') add(child);
        if (/secret(?:key)?ref$/i.test(key) && child?.name) add(child.name);
        if (key === 'secret' && child?.secretName) add(child.secretName);
        walk(child);
      }
    };
    walk(resource.spec);
  }
  return [...refs.values()];
}
export function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== 'object') return value;
  if (value.kind === 'Secret') return { ...value, ...(value.metadata ? {metadata:{...value.metadata,annotations:Object.fromEntries(Object.keys(value.metadata.annotations || {}).map(key=>[key,'[Hidden]']))}} : {}), data:Object.fromEntries(Object.keys(value.data || {}).map(key=>[key,'[Hidden]'])), stringData:Object.fromEntries(Object.keys(value.stringData || {}).map(key=>[key,'[Hidden]'])) };
  return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,redactSecrets(child)]));
}
export function secretBackupStatus(resources, issuerNamespace = 'cert-manager') {
  const captured = new Set(resources.filter(resource => resource.kind === 'Secret' && (resource.data !== undefined || resource.stringData !== undefined)).map(resource => `${resource.metadata.namespace}/${resource.metadata.name}`));
  const missing = secretReferences(resources,issuerNamespace).map(ref=>`${ref.namespace}/${ref.name}`).filter(id=>!captured.has(id));
  return {complete:missing.length === 0,missing};
}
