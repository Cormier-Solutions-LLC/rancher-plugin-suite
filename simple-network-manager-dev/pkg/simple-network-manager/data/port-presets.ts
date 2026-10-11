import { queueChange } from './pending-rollouts';
import { reactive } from 'vue';
import { inventoryDatasets } from './inventory';
const inventory = inventoryDatasets['publication-snapshot.json'];
import { validatePortLinks } from '../config/port-links';
export type PortMode = 'HTTP' | 'HTTPS' | 'TLS' | 'TCP' | 'UDP';
export interface ConfigurationPort { label: string; port: number; mode: PortMode; action?: 'forward' | 'redirect'; targetLabel?: string }
export interface PortInputRow { label: string; expression: string; mode: PortMode; action?: 'forward' | 'redirect'; targetLabel?: string }
export interface PortConfiguration {
  id: string; name: string; ports: ConfigurationPort[]; source: string;
  namespace?: string; service?: string;
  inputRows?: PortInputRow[];
  revision?: number;
}
export const transportOf = (port: ConfigurationPort) => port.mode === 'UDP' ? 'UDP' : 'TCP';
const predefined: PortConfiguration[] = [
  { id: 'http', name: 'HTTP', ports: [{ label: 'HTTP', port: 80, mode: 'HTTP' }], source: 'Predefined' },
  { id: 'https', name: 'HTTPS', ports: [{ label: 'HTTPS', port: 443, mode: 'HTTPS' }], source: 'Predefined' },
  { id: 'web', name: 'Web · HTTP + HTTPS', ports: [{ label: 'HTTP', port: 80, mode: 'HTTP' }, { label: 'HTTPS', port: 443, mode: 'HTTPS' }], source: 'Predefined' },
  { id: 'smb', name: 'SMB', ports: [{ label: 'SMB', port: 445, mode: 'TCP' }], source: 'Predefined' },
  { id: 'tls', name: 'TLS', ports: [{ label: 'TLS termination', port: 443, mode: 'TLS' }], source: 'Predefined' },
  { id: 'dns', name: 'DNS · TCP + UDP', ports: [{ label: 'DNS TCP', port: 53, mode: 'TCP' }, { label: 'DNS UDP', port: 53, mode: 'UDP' }], source: 'Predefined' }
];
export function detectConfigurations(services: typeof inventory.services, known: PortConfiguration[]) {
  const signatures = new Set(known.flatMap(config => config.ports.map(port => `${port.port}/${transportOf(port)}`)));
  return services.flatMap(service => {
    const unmatched = service.ports.filter(port => !signatures.has(`${port.port}/${port.protocol}`));
    if (!unmatched.length) return [];
    return [{ id: `detected-${service.namespace}-${service.name}`, name: service.name, namespace: service.namespace, service: service.name, source: 'Detected at inspection',
      ports: unmatched.map(port => ({ label: port.name || `${port.protocol} ${port.port}`, port: port.port, mode: port.protocol as 'TCP' | 'UDP' })) }];
  });
}
// The preview simulates first-install discovery from a metadata-only snapshot.
export const portConfigurations = reactive<PortConfiguration[]>([...predefined, ...detectConfigurations(inventory.services, predefined)]);
export const configurationVersions = reactive<Record<string, PortConfiguration[]>>({});
export function rescanPortConfigurations(services = inventory.services) {
  let added = 0;
  for (const service of services) {
    const eligible = portConfigurations.filter(config => (!config.namespace || config.namespace === service.namespace) && (!config.service || config.service === service.name));
    for (const detected of detectConfigurations([service], eligible)) {
      let id = detected.id;
      if (portConfigurations.some(config => config.id === id)) id = `${id}-additional-${portConfigurations.length}`;
      let name = detected.name, suffix = 2;
      while (portConfigurations.some(config => (config.namespace || '') === detected.namespace && config.name.toLowerCase() === name.toLowerCase())) name = `${detected.name} (Additional ${suffix++})`;
      portConfigurations.push({ ...detected, name, id });
      added++;
    }
  }
  return { services: services.length, added };
}
export function rememberPortConfiguration(input: PortConfiguration, previousId = '') {
  const name = input.name.trim();
  if (input.namespace && !inventory.namespaces.includes(input.namespace)) throw new Error('Select a known namespace or Global.');
  const existing = portConfigurations.find(config => config.id === previousId);
  if (existing && (existing.namespace || '') !== (input.namespace || '')) throw new Error('An existing configuration keeps its namespace scope. Create another configuration to use a different scope.');
  if (!name || name.length > 120) throw new Error('Enter a configuration name of up to 120 characters.');
  if (!input.ports.length) throw new Error('Add at least one port to the configuration.');
  if (input.ports.some(port => !Number.isInteger(port.port) || port.port < 1 || port.port > 65535 || !['HTTP', 'HTTPS', 'TLS', 'TCP', 'UDP'].includes(port.mode))) throw new Error('Choose a routing mode and a port between 1 and 65535 for every row.');
  if (portConfigurations.some(config => config.id !== previousId && (config.namespace || '') === (input.namespace || '') && config.name.toLowerCase() === name.toLowerCase())) throw new Error('A configuration with that name already exists in this namespace scope.');
  const signatures = input.ports.map(port => `${port.port}/${transportOf(port)}`);
  if (new Set(signatures).size !== signatures.length) throw new Error('A configuration cannot define the same port and transport twice.');
  validatePortLinks(input.ports);
  const index = portConfigurations.findIndex(config => config.id === previousId);
  if (index >= 0) (configurationVersions[previousId] ||= []).push(JSON.parse(JSON.stringify(portConfigurations[index])));
  const value = { ...input, id: previousId || `custom-${Date.now()}-${portConfigurations.length}`, name, source: 'Local draft', revision: index >= 0 ? (portConfigurations[index].revision || 1) + 1 : 1, ports: input.ports.map(port => ({ ...port, label: port.label.trim() || `${port.mode} ${port.port}` })) };
  if (index >= 0) portConfigurations[index] = value;
  else portConfigurations.push(value);
  queueChange({ id: `configuration:${value.id}`, category: 'Port Configuration', name: value.name, namespace: value.namespace || '', resources: [], configuration: value });
  return value.id;
}
