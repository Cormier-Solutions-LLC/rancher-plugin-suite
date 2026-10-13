import { queueChange } from '../data/pending-rollouts';
import { configurationInNamespace, sameConfigurationScope } from './configuration-scope';
import { publications, type SavedPublication } from '../data/publications';
import { portConfigurations, configurationVersions, transportOf, type PortConfiguration } from '../data/port-presets';
import { buildMultiPublication } from './multi-publication';
import { validatePortLinks } from './port-links';
import { connectionDrafts, saveConnectionDraft } from '../data/connection-edits';
import { restorationManifest } from './restoration-manifest.mjs';
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const key = (value: { namespace: string; name: string }) => `${value.namespace}/${value.name}`;
function routeRestorationDrafts(current: any) {
  const manifests = copy(current.routeManifests || []).map(restorationManifest);
  const validResource = (resource: any) => resource && ['Ingress', 'IngressRoute', 'IngressRouteTCP', 'IngressRouteUDP', 'Certificate', 'Middleware'].includes(resource.kind) && typeof resource.apiVersion === 'string' && typeof resource.metadata?.name === 'string' && typeof resource.metadata?.namespace === 'string' && resource.spec && typeof resource.spec === 'object';
  if (!Array.isArray(manifests) || manifests.some(resource => !validResource(resource))) throw new Error('Saved routing manifest is incomplete or unsupported.');
  return manifests.filter((resource: any) => ['Ingress', 'IngressRoute', 'IngressRouteTCP', 'IngressRouteUDP'].includes(resource.kind)).map((route: any) => {
    const sourceId = `${route.kind}/${route.metadata.namespace}/${route.metadata.name}`;
    const saved = (current.editedConnections || []).find((draft: any) => draft.sourceId === sourceId);
    if (saved) {
      if (saved.namespace !== route.metadata.namespace || !Array.isArray(saved.resources) || !saved.resources.length || saved.resources.some((resource: any) => !validResource(resource))) throw new Error('Saved connection draft has invalid routing manifests.');
      return {...copy(saved),resources:saved.resources.map(restorationManifest)};
    }
    const certificates = manifests.filter((resource: any) => resource.kind === 'Certificate' && resource.metadata.namespace === route.metadata.namespace && (route.spec.tls?.secretName === resource.spec.secretName || route.spec.tls?.some?.((tls: any) => tls.secretName === resource.spec.secretName)));
    return { sourceId, name: route.metadata.name, namespace: route.metadata.namespace, resources: copy([...certificates, route]) };
  });
}
export function reviewStoredSnapshot(snapshot: any) {
  if (snapshot.schemaVersion !== 1 || !snapshot.current?.configuration || !Array.isArray(snapshot.current.localPublications)) throw new Error('This snapshot does not contain a restorable port configuration.');
  const configurations: PortConfiguration[] = copy([snapshot.current.configuration, ...(snapshot.current.relatedConfigurations || [])]);
  if (new Set(configurations.map(config => config.id)).size !== configurations.length) throw new Error('Snapshot contains duplicate configuration references.');
  for (const config of configurations) {
    if (typeof config.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,252}$/.test(config.id) || ['constructor', 'prototype'].includes(config.id) || typeof config.name !== 'string' || !config.name || !Array.isArray(config.ports) || !config.ports.length || config.ports.length > 1024) throw new Error('Snapshot configuration is incomplete.');
    const currentConfig = portConfigurations.find(current => current.id === config.id);
    if (currentConfig && !sameConfigurationScope(currentConfig, config)) throw new Error('A saved configuration cannot change its namespace scope.');
    if (config.namespace !== undefined && (typeof config.namespace !== 'string' || !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(config.namespace))) throw new Error('Snapshot namespace scope is invalid.');
    if (config.ports.some(port => !Number.isInteger(port.port) || port.port < 1 || port.port > 65535 || !['HTTP', 'HTTPS', 'TCP', 'UDP', 'TLS'].includes(port.mode) || typeof port.label !== 'string')) throw new Error('Snapshot contains invalid port mappings.');
    if (new Set(config.ports.map(port => `${port.port}/${transportOf(port)}`)).size !== config.ports.length) throw new Error('Snapshot contains duplicate ports.');
    validatePortLinks(config.ports);
    if (portConfigurations.some(current => current.id !== config.id && sameConfigurationScope(current, config) && current.name.toLowerCase() === config.name.toLowerCase())) throw new Error(`Another configuration already uses the name ${config.name}.`);
  }
  const drafts: SavedPublication[] = copy(snapshot.current.localPublications);
  if (new Set(drafts.map(key)).size !== drafts.length) throw new Error('Snapshot contains duplicate publications.');
  for (const draft of drafts) {
    if (!Array.isArray(draft.configurationIds) || !draft.configurationPorts || !draft.configurationRevisions || draft.configurationIds.some(id => !configurations.some(config => config.id === id))) throw new Error('A publication configuration dependency is missing from the snapshot.');
    if (draft.configurationIds.some(id => !configurationInNamespace(configurations.find(config => config.id === id)!, draft.namespace))) throw new Error('A saved publication uses a configuration from another namespace.');
    if (JSON.stringify(buildMultiPublication(draft)) !== JSON.stringify(draft.resources)) throw new Error('A saved publication manifest does not match its recorded configuration.');
  }
  const ids = new Set(configurations.map(config => config.id));
  if (publications.some(draft => draft.configurationIds.some(id => ids.has(id)) && !drafts.some(saved => key(saved) === key(draft)))) throw new Error('Additional local publications use these configurations. Include them in the restoration before replacing a shared configuration.');
  const routeDrafts = routeRestorationDrafts(snapshot.current);
  return { configurations, drafts, routeDrafts, current: {
    configuration: copy(portConfigurations.find(config => config.id === configurations[0].id) || null),
    relatedConfigurations: copy(configurations.slice(1).map(saved => portConfigurations.find(config => config.id === saved.id)).filter(Boolean)),
    absentConfigurationIds: configurations.filter(saved => !portConfigurations.some(current => current.id === saved.id)).map(saved => saved.id),
    localPublications: copy(publications.filter(draft => drafts.some(saved => key(saved) === key(draft)))),
    observedRoutes: snapshot.current.observedRoutes || [], observedServiceReferences: snapshot.current.observedServiceReferences || [],
    routeManifests: copy(snapshot.current.routeManifests || []),
    editedConnections: copy(connectionDrafts.filter(draft => (snapshot.current.observedRoutes || []).some((route: any) => draft.sourceId === `${route.kind}/${route.namespace}/${route.name}`)))
  } };
}
export function restoreStoredSnapshot(snapshot: any, reviewedScope: string) {
  const review = reviewStoredSnapshot(snapshot);
  if (JSON.stringify(review.current) !== reviewedScope) throw new Error('Current configuration changed during the restoration review. Review and snapshot it again.');
  // Validate the complete review before changing any local state.
  for (const config of review.configurations) {
    const index = portConfigurations.findIndex(current => current.id === config.id);
    if (index >= 0) { (configurationVersions[config.id] ||= []).push(copy(portConfigurations[index])); portConfigurations[index] = config; }
    else portConfigurations.push(config);
    queueChange({ id: `configuration:${config.id}`, category: 'Restored Port Configuration', name: config.name, namespace: config.namespace || '', resources: [], configuration: config });
  }
  for (const draft of review.drafts) {
    const index = publications.findIndex(current => key(current) === key(draft));
    if (index >= 0) publications[index] = draft;
    else publications.push(draft);
    queueChange({ id: `publication:${key(draft)}`, category: 'Restored Connection', name: draft.name, namespace: draft.namespace, resources: draft.resources });
  }
  review.routeDrafts.forEach(saveConnectionDraft);
  return review.drafts.length + review.routeDrafts.length;
}
