export function configurationInNamespace(config: { namespace?: string }, namespace: string) { return !config.namespace || config.namespace === namespace; }
export function sameConfigurationScope(left: { namespace?: string }, right: { namespace?: string }) { return (left.namespace || '') === (right.namespace || ''); }
