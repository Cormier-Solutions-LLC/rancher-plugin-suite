import { inventoryDatasets } from './inventory';
const snapshot = inventoryDatasets['route-attachment-snapshot.json'];
const inventory = inventoryDatasets['publication-snapshot.json'];
const listeners = inventoryDatasets['listener-snapshot.json'];
import { portConfigurations, transportOf } from './port-presets';
// These associations are inferred from observed port mappings. They are not
// application-managed dependency links and do not authorize live changes.
export const observedAttachments = snapshot.routes.map(route => ({ ...route,
  configurationIds: portConfigurations.filter(config => route.bindings.some(binding => {
    const transport = binding.mode === 'UDP' ? 'UDP' : 'TCP';
    const listener = listeners.entryPoints.find(listener => listener.name === binding.entryPoint && listener.protocol === transport);
    const service = inventory.services.find(service => service.name === binding.service && service.namespace === binding.namespace);
    const backend = service?.ports.find(port => port.protocol === transport && (port.name === binding.backendPort || String(port.port) === binding.backendPort));
    if (config.service) return config.service === binding.service && config.namespace === binding.namespace && config.ports.some(port => port.port === backend?.port && transportOf(port) === transport);
    return config.ports.some(port => port.mode === binding.mode && port.port === listener?.port);
  })).map(config => config.id)
}));
export const attachmentsFor = (id: string) => observedAttachments.filter(route => route.configurationIds.includes(id));
export function serviceReferencesFor(id: string) {
  const config = portConfigurations.find(item => item.id === id);
  const references = new Set(attachmentsFor(id).flatMap(route => route.bindings.map(binding => `${binding.namespace}/${binding.service}`)));
  if (config?.service) references.add(`${config.namespace}/${config.service}`);
  return inventory.services.filter(service => references.has(`${service.namespace}/${service.name}`));
}
