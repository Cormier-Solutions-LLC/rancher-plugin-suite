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
export function validatePortLinks(ports: ConfigurationPort[]) {
  for (const source of ports) {
    if (!source.action) continue;
    const targets = ports.filter(port => port.label === source.targetLabel);
    if (targets.length !== 1) throw new Error(`Choose one uniquely labelled target port for ${source.label}. Targets cannot be ranges.`);
    const target = targets[0];
    if (target === source || target.action) throw new Error('Port links must point directly to a different destination without another link.');
    if (transport(source.mode) !== transport(target.mode)) throw new Error('Forwarding cannot convert TCP to UDP or UDP to TCP.');
    if (source.action === 'redirect' && (source.mode !== 'HTTP' || target.mode !== 'HTTPS')) throw new Error('HTTP-to-HTTPS redirect requires an HTTP source and HTTPS destination. Choose their web behavior under TCP.');
    if (source.action === 'forward' && source.mode !== target.mode) throw new Error('Forwarding requires matching application behavior. Use HTTP-to-HTTPS redirect to switch from HTTP to HTTPS.');
  }
}
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
