import type { ConfigurationPort } from '../data/port-presets';
import type { PortMapping } from './multi-publication';
const transport = (mode: string) => mode === 'UDP' ? 'UDP' : 'TCP';
export function mergePortConfigurations(lists: ConfigurationPort[][]) {
  const merged = new Map<string, ConfigurationPort>();
  for (const port of lists.flat()) {
    const key = `${port.mode}-${port.port}`;
    const old = merged.get(key);
    if (old && (old.action !== port.action || old.targetLabel !== port.targetLabel)) throw new Error(`Conflicting actions for ${port.mode} ${port.port}. Select configurations with matching actions.`);
    if (!old) merged.set(key, port);
  }
  return [...merged.values()];
}
export {validatePortLinks} from './port-link-validation.mjs';
import {validatePortLinks} from './port-link-validation.mjs';
export function applyPortLinks(ports: ConfigurationPort[], mappings: PortMapping[]): PortMapping[] {
  validatePortLinks(ports);
  return mappings.map(mapping => {
    const source = ports.find(port => port.mode === mapping.mode && port.port === mapping.port);
    const result = { ...mapping, redirectPort: undefined, targetLabel: undefined, action: undefined };
    if (!source?.action) return result;
    const target = ports.find(port => port.label === source.targetLabel)!;
    const destination = mappings.find(item => item.mode === target.mode && item.port === target.port);
    if (!destination) throw new Error(`Include the destination port ${target.label} in the publication.`);
    return { ...result, backendPort: destination.backendPort, backendScheme: destination.backendScheme, action: source.action, targetLabel: target.label, ...(source.action === 'redirect' ? { redirectPort: target.port } : {}) };
  });
}
