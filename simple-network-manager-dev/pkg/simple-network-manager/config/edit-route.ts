import { inventoryDatasets } from '../data/inventory';
const resources = inventoryDatasets['route-resources-snapshot.json'];
const certificates = inventoryDatasets['certificate-resources-snapshot.json'];
const attachments = inventoryDatasets['route-attachment-snapshot.json'];
const listeners = inventoryDatasets['listener-snapshot.json'];
import type { MultiPublication, PortMapping } from './multi-publication';
import { bindRouteCertificates } from './existing-certificate';
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export function routeEditSource(id: string) {
  const resource: any = resources.resources.find(item => `${item.kind}/${item.metadata.namespace}/${item.metadata.name}` === id);
  if (!resource) throw new Error('The inspected route specification is unavailable.');
  const attachment = attachments.routes.find(item => `${item.kind}/${item.namespace}/${item.name}` === id)!;
  const primary = attachment.bindings[0];
  if (!primary) throw new Error('The route has no editable destination mapping.');
  const secretName = resource.spec.tls?.secretName || resource.spec.tls?.[0]?.secretName;
  const certificate: any = certificates.resources.find(item => item.metadata.namespace === resource.metadata.namespace && item.spec.secretName === secretName);
  const hosts: string[] = resource.kind === 'Ingress' ? [...new Set<string>(resource.spec.rules.map((rule: any) => rule.host).filter(Boolean))] : [...new Set<string>((resource.spec.routes || []).flatMap((rule: any) => [...(rule.match || '').matchAll(/Host(?:SNI)?\(\s*[`"']([^`"']+)[`"']\s*\)/g)].map((match: any) => match[1]).filter((host: string) => host !== '*')))];
  const mappings: PortMapping[] = [];
  for (const binding of attachment.bindings.filter(binding => binding.namespace === primary.namespace && binding.service === primary.service)) {
    const mode = binding.mode as PortMapping['mode'];
    const listener = listeners.entryPoints.find(item => item.name === binding.entryPoint && item.protocol === (mode === 'UDP' ? 'UDP' : 'TCP'));
    if (!listener) throw new Error('An observed listener is not present in the listener inventory.');
    if (!mappings.some(mapping => mapping.entryPoint === binding.entryPoint && mapping.mode === mode)) {
      const service = resource.spec.routes?.flatMap((route: any) => route.services || []).find((item: any) => item.name === primary.service);
      mappings.push({ label: `${mode} ${listener.port}`, mode, port: listener.port, entryPoint: binding.entryPoint, backendPort: binding.backendPort, backendScheme: service?.scheme === 'https' ? 'https' : 'http' });
    }
  }
  return { id, resource: clone(resource), certificate: certificate ? clone(certificate) : undefined, primary, hosts, mappings, bindings: attachment.bindings };
}
export function buildRouteEdit(source: ReturnType<typeof routeEditSource>, input: MultiPublication): object[] {
  if (input.tlsCertificates?.length) return bindRouteCertificates(buildRouteEdit(source, { ...input, tlsCertificates: undefined, existingTlsSecret: input.tlsCertificates[0].secretName }), input.tlsCertificates, input.hosts);
  const resource: any = clone(source.resource);
  if (input.namespace !== source.primary.namespace) throw new Error('An existing connection cannot change namespace. Create a new publication instead.');
  if (![input.name, input.namespace, input.service].every(value => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value))) throw new Error('Use valid route, namespace and service names.');
  if (!input.mappings.length || input.mappings.some(mapping => mapping.action)) throw new Error('Edit requires an existing port mapping without a new forwarding action.');
  const modes = new Set(source.mappings.map(mapping => mapping.mode));
  if (input.mappings.some(mapping => !modes.has(mapping.mode))) throw new Error('Changing the routing behavior requires a new publication. Keep the existing behavior while editing this connection.');
  resource.metadata.name = input.name; resource.metadata.namespace = input.namespace;
  const primary = (service: any) => service.name === source.primary.service && (!service.namespace || service.namespace === source.primary.namespace);
  const mapping = input.mappings[0];
  const port = /^\d+$/.test(mapping.backendPort) ? Number(mapping.backendPort) : mapping.backendPort;
  if (resource.kind === 'Ingress') {
    if (input.mappings.length !== 1) throw new Error('An Ingress edit retains its existing single listener mapping.');
    const oldHosts = source.hosts;
    if (oldHosts.length > 1 && oldHosts.length !== input.hosts.length) throw new Error('This route has distinct host rules. Keep the hostname count to preserve their path associations.');
    const oldRules = clone(resource.spec.rules);
    resource.spec.rules = oldHosts.length <= 1 ? input.hosts.flatMap(host => oldRules.map((rule: any) => ({ ...clone(rule), host }))) : oldRules.map((rule: any) => ({ ...rule, host: input.hosts[oldHosts.indexOf(rule.host)] }));
    resource.spec.ingressClassName = input.ingressClass;
    for (const rule of resource.spec.rules) for (const path of rule.http?.paths || []) if (primary(path.backend.service)) {
      path.backend.service.name = input.service;
      path.backend.service.port = typeof port === 'number' ? { number: port } : { name: port };
    }
    if (resource.spec.tls) resource.spec.tls.forEach((tls: any) => { tls.hosts = [...input.hosts]; if (input.existingTlsSecret) tls.secretName = input.existingTlsSecret; });
  } else {
    resource.spec.entryPoints = [...new Set(input.mappings.map(mapping => mapping.entryPoint))];
    for (const route of resource.spec.routes || []) {
      if (route.match && source.hosts.length) {
        if (source.hosts.length > 1 && source.hosts.length !== input.hosts.length) throw new Error('Keep the hostname count to preserve the existing match rules.');
        route.match = route.match.replace(/(Host(?:SNI)?)\(\s*[`"']([^`"']+)[`"']\s*\)/g, (original: string, kind: string, host: string) => {
          const index = source.hosts.indexOf(host);
          if (index < 0) return original;
          const replacement = source.hosts.length === 1 ? input.hosts : [input.hosts[index]];
          return `(${replacement.map(host => `${kind}(\`${host}\`)`).join(' || ')})`;
        });
      }
      for (const service of route.services || []) if (primary(service)) {
        service.name = input.service; service.port = port;
        if (service.namespace) service.namespace = input.namespace;
        if (resource.kind === 'IngressRoute') service.scheme = mapping.backendScheme;
      }
    }
  }
  if (input.existingTlsSecret && resource.kind !== 'Ingress' && resource.spec.tls) resource.spec.tls.secretName = input.existingTlsSecret;
  const output: object[] = [resource];
  if (source.certificate && !input.existingTlsSecret) {
    const certificate: any = clone(source.certificate);
    certificate.metadata.namespace = input.namespace;
    certificate.spec.dnsNames = [...new Set([...(certificate.spec.dnsNames || []).filter((host: string) => !source.hosts.includes(host)), ...input.hosts])];
    certificate.spec.issuerRef = { ...certificate.spec.issuerRef, name: input.issuer };
    output.unshift(certificate);
  }
  return output;
}
