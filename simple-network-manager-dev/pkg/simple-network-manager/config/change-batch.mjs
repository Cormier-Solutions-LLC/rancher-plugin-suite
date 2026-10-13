// Reject ambiguous proposals before handing them to an execution backend.
export function validateChangeBatch(changes) {
  if (!changes.length) throw new Error('Select at least one pending change.');
  const targets = new Map();
  for (const change of changes) {
    const operation = change.configuration?.operation || 'Apply';
    if (operation === 'DeletePublicationDraft' && change.resources?.length) throw new Error('Publication draft removal must preserve all Kubernetes resources.');
    if (operation === 'RemoveIssuerProfile' && change.resources?.length) throw new Error('Issuer profile removal must preserve all Kubernetes resources.');
    if(change.requiresSecretUnlock)throw new Error('Secret values were not retained in drafts. Unlock the encrypted backup and prepare this restoration again.');
    for (const resource of change.resources || []) {
      if (resource.kind === 'Secret' && (operation === 'Delete' || change.configuration?.restoreSecretConfirmed !== true)) throw new Error('Secret deletion is prohibited. Restoring credentials requires explicit Secret selection and confirmation.');
      if(resource.kind==='Secret'&&resource.data===undefined&&resource.stringData===undefined)throw new Error('Secret values were not retained. Unlock the encrypted backup and prepare this restoration again.');
      if (!resource.apiVersion || !resource.kind || !resource.metadata?.name) throw new Error('A proposal contains an incomplete Kubernetes resource.');
      const id = `${resource.apiVersion}/${resource.kind}/${resource.metadata.namespace || ''}/${resource.metadata.name}`;
      const prior = targets.get(id);
      if (prior && (prior.operation !== operation || JSON.stringify(prior.resource) !== JSON.stringify(resource))) throw new Error(`Conflicting proposals for ${resource.kind} ${resource.metadata.name}. Apply one reviewed version at a time.`);
      targets.set(id, { operation, resource });
    }
    if (operation === 'Delete' && change.configuration?.dependentPublications?.length) throw new Error('This port configuration is still used by publication drafts. Reconfigure or remove those references before deleting it.');
  }
  return changes;
}
