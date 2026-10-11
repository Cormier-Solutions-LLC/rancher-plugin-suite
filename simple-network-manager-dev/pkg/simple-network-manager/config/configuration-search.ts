import type { PortConfiguration } from '../data/port-presets';
export function matchesConfiguration(config: PortConfiguration, query: string): boolean {
  const text = [config.name, config.source, config.namespace || 'Global', config.service,
    ...config.ports.flatMap(port => [port.label, port.port, port.mode])].join(' ').toLowerCase();
  return query.trim().toLowerCase().split(/\s+/).every(term => text.includes(term));
}
