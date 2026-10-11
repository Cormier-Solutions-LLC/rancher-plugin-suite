import { queueChange } from './pending-rollouts';
import { reactive } from 'vue';
import { configurationInNamespace } from '../config/configuration-scope';
import { buildMultiPublication, type MultiPublication, type PortMapping } from '../config/multi-publication';
import { portConfigurations, configurationVersions, transportOf, type ConfigurationPort, type PortConfiguration } from './port-presets';
import { inventoryDatasets } from './inventory';
const inventory = inventoryDatasets['publication-snapshot.json'];
const listeners = inventoryDatasets['listener-snapshot.json'];
import { applyPortLinks, mergePortConfigurations } from '../config/port-links';
export interface SavedPublication extends MultiPublication {
  configurationIds: string[];
  configurationPorts: Record<string, ConfigurationPort[]>;
  configurationRevisions: Record<string, number>;
  resources: object[];
}
export const publications = reactive<SavedPublication[]>([]);
export interface ConfigurationRollout {
  id: number; configurationId: string; configurationName: string; createdAt: number;
  beforeConfiguration: PortConfiguration; afterConfiguration: PortConfiguration;
  before: SavedPublication[]; after: SavedPublication[]; state: 'Applied' | 'Rolled back';
}
export const configurationRollouts = reactive<ConfigurationRollout[]>([]);
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const publicationKey = (publication: SavedPublication) => `${publication.namespace}/${publication.name}`;
export function rememberPublication(input: MultiPublication, configurationIds: string[]) {
  const selected = portConfigurations.filter(config => configurationIds.includes(config.id));
  if (selected.some(config => !configurationInNamespace(config, input.namespace))) throw new Error('A selected port configuration belongs to another namespace.');
  const value: SavedPublication = { ...input, hosts: [...input.hosts], mappings: input.mappings.map(mapping => ({ ...mapping })), configurationIds: [...configurationIds],
    configurationPorts: Object.fromEntries(selected.map(config => [config.id, config.ports.map(port => ({ ...port }))])),
    configurationRevisions: Object.fromEntries(selected.map(config => [config.id, config.revision || 1])), resources: buildMultiPublication(input) };
  queueChange({ id: `publication:${input.namespace}/${input.name}`, category: 'Connection', name: input.name, namespace: input.namespace, resources: value.resources });
  const index = publications.findIndex(publication => publication.name === input.name && publication.namespace === input.namespace);
  if (index >= 0) publications[index] = value;
  else publications.push(value);
}
export function reviewReconfiguration(configurationId: string) {
  const config = portConfigurations.find(config => config.id === configurationId);
  if (!config) return [];
  return publications.filter(publication => publication.configurationIds.includes(configurationId)).map(publication => {
    const changed = publication.configurationRevisions[configurationId] !== (config.revision || 1);
    const previous = publication.configurationPorts[configurationId] || [];
    const summarize = (ports: ConfigurationPort[]) => ports.map(port => `${port.mode} ${port.port}/${transportOf(port)}${port.action ? ` → ${port.action} ${port.targetLabel}` : ''}`).join(', ');
    try {
      if (!configurationInNamespace(config, publication.namespace)) throw new Error('Port configuration belongs to another namespace.');
      const service = inventory.services.find(service => service.name === publication.service && service.namespace === publication.namespace);
      if (!service) throw new Error('Destination is missing from the inventory snapshot.');
      const combined = new Map(mergePortConfigurations(publication.configurationIds.map(id => id === configurationId ? config.ports : publication.configurationPorts[id] || [])).map(port => [`${port.mode}-${port.port}`, port]));
      const baseMappings: PortMapping[] = [...combined].map(([key, port]) => {
        const transport = transportOf(port);
        const old = publication.mappings.find(mapping => `${mapping.mode}-${mapping.port}` === key);
        if (old) return { ...old, label: port.label };
        const backend = service.ports.find(candidate => candidate.protocol === transport && candidate.port === port.port) || (['HTTP', 'HTTPS'].includes(port.mode) ? service.ports.find(candidate => candidate.protocol === 'TCP' && candidate.name === 'http') : undefined);
        const listener = listeners.entryPoints.find(listener => listener.port === port.port && listener.protocol === transport);
        if (!backend && !port.action) throw new Error(`No matching ${transport} backend port for ${port.label} (${port.port}).`);
        if (!listener) throw new Error(`No published ${transport} listener for ${port.port}. Configure Traefik before applying.`);
        return { label: port.label, mode: port.mode, port: port.port, backendPort: backend ? String(backend.name || backend.port) : '', entryPoint: listener.name, backendScheme: backend?.port === 443 || backend?.name === 'https' ? 'https' : 'http' };
      });
      const mappings = applyPortLinks([...combined.values()], baseMappings);
      for (const mapping of mappings.filter(mapping => mapping.action === 'redirect')) {
        const target = mappings.find(target => target.label === mapping.targetLabel)!;
        if (listeners.entryPoints.find(listener => listener.name === target.entryPoint)?.port !== mapping.redirectPort) throw new Error('The HTTPS destination listener must expose the configured redirect port.');
      }
      const input = { ...publication, mappings };
      return { publication, changed, before: summarize(previous), after: summarize(config.ports), mappings, resources: buildMultiPublication(input), error: '' };
    }
    catch (cause) { return { publication, changed, before: summarize(previous), after: summarize(config.ports), mappings: [], resources: [], error: cause instanceof Error ? cause.message : 'Check the mappings.' }; }
  });
}
export function reconfigurePublications(configurationId: string) {
  const config = portConfigurations.find(config => config.id === configurationId);
  if (!config) throw new Error('Configuration is no longer available.');
  const changes = reviewReconfiguration(configurationId).filter(change => change.changed);
  if (changes.some(change => change.error)) throw new Error('Resolve the blocked mappings before updating publications.');
  if (!changes.length) return 0;
  const before = changes.map(change => copy(change.publication));
  const previousRevision = before[0].configurationRevisions[configurationId];
  const beforeConfiguration = configurationVersions[configurationId]?.find(version => (version.revision || 1) === previousRevision);
  if (!beforeConfiguration) throw new Error('The previous configuration version is unavailable. Regenerate the publication before reconfiguring.');
  changes.forEach(change => {
    change.publication.mappings = change.mappings;
    change.publication.resources = change.resources;
    change.publication.configurationPorts[configurationId] = config.ports.map(port => ({ ...port }));
    change.publication.configurationRevisions[configurationId] = config.revision || 1;
    queueChange({ id: `publication:${publicationKey(change.publication)}`, category: 'Reconfiguration', name: change.publication.name, namespace: change.publication.namespace, resources: change.resources });
  });
  configurationRollouts.push({ id: configurationRollouts.length + 1, configurationId, configurationName: config.name, createdAt: Date.now(), beforeConfiguration: copy(beforeConfiguration), afterConfiguration: copy(config), before, after: changes.map(change => copy(change.publication)), state: 'Applied' });
  return changes.length;
}
export function reviewRollback(id: number) {
  const rollout = configurationRollouts.find(item => item.id === id);
  if (!rollout) return { rollout: undefined, error: 'This rollout is unavailable.' };
  if (rollout.state === 'Rolled back') return { rollout, error: 'This rollout has already been rolled back.' };
  const config = portConfigurations.find(config => config.id === rollout.configurationId);
  if (JSON.stringify(config) !== JSON.stringify(rollout.afterConfiguration)) return { rollout, error: 'The shared configuration has changed since this rollout. Resolve newer changes before restoring it.' };
  for (const after of rollout.after) {
    const current = publications.find(item => publicationKey(item) === publicationKey(after));
    if (JSON.stringify(current) !== JSON.stringify(after)) return { rollout, error: `${publicationKey(after)} changed after this rollout. Its newer changes will not be overwritten.` };
  }
  const affected = new Set(rollout.after.map(publicationKey));
  if (publications.some(item => item.configurationIds.includes(rollout.configurationId) && !affected.has(publicationKey(item)))) return { rollout, error: 'Additional publications now reference this configuration. Review their dependencies before restoring the shared configuration.' };
  return { rollout, error: '' };
}
export function rollbackConfiguration(id: number) {
  const review = reviewRollback(id);
  if (review.error || !review.rollout) throw new Error(review.error || 'Rollout unavailable.');
  const rollout = review.rollout;
  // Validate the entire restoration before replacing any current state.
  rollout.before.forEach(publication => buildMultiPublication(publication));
  rollout.before.forEach(before => {
    const index = publications.findIndex(item => publicationKey(item) === publicationKey(before));
    publications[index] = copy(before);
    queueChange({ id: `publication:${publicationKey(before)}`, category: 'Rollback', name: before.name, namespace: before.namespace, resources: before.resources });
  });
  const configIndex = portConfigurations.findIndex(config => config.id === rollout.configurationId);
  portConfigurations[configIndex] = copy(rollout.beforeConfiguration);
  queueChange({ id: `configuration:${rollout.configurationId}`, category: 'Port Configuration', name: rollout.beforeConfiguration.name, namespace: rollout.beforeConfiguration.namespace || '', resources: [], configuration: rollout.beforeConfiguration });
  rollout.state = 'Rolled back';
  return rollout.before.length;
}
