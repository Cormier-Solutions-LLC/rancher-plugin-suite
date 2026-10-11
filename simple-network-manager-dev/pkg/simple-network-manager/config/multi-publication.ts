import { bindRouteCertificates, type CertificateBinding } from './existing-certificate';
export interface PortMapping {
  label: string; port: number; mode: 'HTTP' | 'HTTPS' | 'TLS' | 'TCP' | 'UDP';
  entryPoint: string; backendPort: string; backendScheme: 'http' | 'https';
  action?: 'forward' | 'redirect'; targetLabel?: string; redirectPort?: number;
}
export interface MultiPublication {
  name: string; namespace: string; service: string; hosts: string[];
  issuer: string; ingressClass: string; mappings: PortMapping[];
  existingTlsSecret?: string;
  tlsCertificates?: CertificateBinding[];
  routingKind?: 'automatic' | 'Ingress' | 'IngressRoute' | 'IngressRouteTCP' | 'IngressRouteUDP';
}
const label = (value: string) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
export function buildMultiPublication(input: MultiPublication): object[] {
  if (input.tlsCertificates?.length) return bindRouteCertificates(buildMultiPublication({ ...input, tlsCertificates: undefined, existingTlsSecret: input.tlsCertificates[0].secretName }), input.tlsCertificates, input.hosts);
  if (![input.name, input.namespace, input.service].every(label)) throw new Error('Use valid route, namespace and service names.');
  if (!input.ingressClass || !input.mappings.length) throw new Error('Choose an ingress class and at least one port configuration.');
  if (!input.hosts.length || input.hosts.some(host => host.length > 253 || !host.includes('.') || !host.split('.').every(label))) throw new Error('Enter valid hostnames.');
  const encrypted = input.mappings.some(mapping => ['HTTPS', 'TLS'].includes(mapping.mode));
  if (encrypted && !input.issuer && !input.existingTlsSecret) throw new Error('Select an issuer or an existing certificate for encrypted routes.');
  if (input.existingTlsSecret && (input.existingTlsSecret.length > 253 || !input.existingTlsSecret.split('.').every(label))) throw new Error('Choose a valid existing TLS Secret reference.');
  for (const mapping of input.mappings) {
    if (!Number.isInteger(mapping.port) || mapping.port < 1 || mapping.port > 65535 || !label(mapping.entryPoint) || !['http', 'https'].includes(mapping.backendScheme)) throw new Error('Select a valid inbound port, listener and backend protocol.');
    const numeric = /^\d+$/.test(mapping.backendPort);
    if (numeric ? Number(mapping.backendPort) < 1 || Number(mapping.backendPort) > 65535 : !label(mapping.backendPort) || mapping.backendPort.length > 15 || !/[a-z]/.test(mapping.backendPort)) throw new Error('Select a valid backend service port for every mapping.');
  }
  const hosts = [...new Set(input.hosts)];
  const resources: object[] = [];
  const secretName = input.existingTlsSecret || `${input.name}-tls`;
  if (encrypted && !input.existingTlsSecret) resources.push({ apiVersion: 'cert-manager.io/v1', kind: 'Certificate', metadata: { name: secretName, namespace: input.namespace }, spec: { secretName, dnsNames: hosts, issuerRef: { name: input.issuer, kind: 'ClusterIssuer', group: 'cert-manager.io' } } });
  if (input.routingKind === 'Ingress') {
    const mapping = input.mappings[0];
    if (input.mappings.length !== 1 || !['HTTP', 'HTTPS'].includes(mapping.mode) || mapping.action) throw new Error('Ingress requires one HTTP or HTTPS mapping without a port action. Use Automatic for combined configurations.');
    if (!mapping.entryPoint || !mapping.backendPort) throw new Error('Choose a listener and destination port.');
    const port = /^\d+$/.test(mapping.backendPort) ? { number: Number(mapping.backendPort) } : { name: mapping.backendPort };
    resources.push({ apiVersion: 'networking.k8s.io/v1', kind: 'Ingress', metadata: { name: input.name, namespace: input.namespace, annotations: { 'traefik.ingress.kubernetes.io/router.entrypoints': mapping.entryPoint } }, spec: { ingressClassName: input.ingressClass, ...(mapping.mode === 'HTTPS' ? { tls: [{ hosts, secretName }] } : {}), rules: hosts.map(host => ({ host, http: { paths: [{ path: '/', pathType: 'Prefix', backend: { service: { name: input.service, port } } }] } })) } });
    return resources;
  }
  if (input.routingKind && input.routingKind !== 'automatic') {
    const expected = (mode: PortMapping['mode']) => mode === 'UDP' ? 'IngressRouteUDP' : ['TCP', 'TLS'].includes(mode) ? 'IngressRouteTCP' : 'IngressRoute';
    if (input.mappings.some(mapping => expected(mapping.mode) !== input.routingKind)) throw new Error('The routing rule is incompatible with the selected port behaviors.');
  }
  const listeners = new Set<string>();
  for (const mapping of input.mappings) {
    if (!['HTTP', 'HTTPS', 'TLS', 'TCP', 'UDP'].includes(mapping.mode) || !mapping.entryPoint || !label(mapping.entryPoint)) throw new Error('Choose a valid routing mode and listener for every port.');
    const numeric = /^\d+$/.test(mapping.backendPort);
    if (numeric ? Number(mapping.backendPort) < 1 || Number(mapping.backendPort) > 65535 : !label(mapping.backendPort) || mapping.backendPort.length > 15 || !/[a-z]/.test(mapping.backendPort)) throw new Error('Select a valid backend service port for every mapping.');
    const signature = `${mapping.mode === 'UDP' ? 'UDP' : 'TCP'}/${mapping.entryPoint}`;
    if (listeners.has(signature)) throw new Error('Two selected ports use the same listener. Choose a different listener or remove the overlapping configuration.');
    listeners.add(signature);
    const suffix = `-${mapping.mode.toLowerCase()}-${mapping.port}`;
    const name = `${input.name.slice(0, 63 - suffix.length)}${suffix}`;
    const metadata = { name, namespace: input.namespace, annotations: { 'kubernetes.io/ingress.class': input.ingressClass } };
    const port = numeric ? Number(mapping.backendPort) : mapping.backendPort;
    let middlewareName = '';
    if (mapping.action === 'redirect' || mapping.redirectPort !== undefined) {
      const target = input.mappings.find(item => item.label === mapping.targetLabel && item.port === mapping.redirectPort && item.mode === 'HTTPS' && !item.action);
      if (mapping.mode !== 'HTTP' || !target || !Number.isInteger(mapping.redirectPort) || mapping.redirectPort! < 1 || mapping.redirectPort! > 65535) throw new Error('HTTP redirect needs a selected HTTPS destination with a valid port.');
      const redirectSuffix = `${suffix}-redirect`;
      middlewareName = `${input.name.slice(0, 63 - redirectSuffix.length)}${redirectSuffix}`;
      resources.push({ apiVersion: 'traefik.io/v1alpha1', kind: 'Middleware', metadata: { name: middlewareName, namespace: input.namespace }, spec: { redirectScheme: { scheme: 'https', port: String(mapping.redirectPort), permanent: false } } });
    }
    if (mapping.mode === 'HTTP' || mapping.mode === 'HTTPS') {
      resources.push({ apiVersion: 'traefik.io/v1alpha1', kind: 'IngressRoute', metadata, spec: { entryPoints: [mapping.entryPoint], routes: [{ kind: 'Rule', match: hosts.map(host => `Host(\`${host}\`)`).join(' || '), services: [{ name: input.service, port, scheme: mapping.backendScheme }], ...(middlewareName ? { middlewares: [{ name: middlewareName }] } : {}) }], ...(mapping.mode === 'HTTPS' ? { tls: { secretName } } : {}) } });
    }
    else if (mapping.mode === 'UDP') resources.push({ apiVersion: 'traefik.io/v1alpha1', kind: 'IngressRouteUDP', metadata, spec: { entryPoints: [mapping.entryPoint], routes: [{ services: [{ name: input.service, port }] }] } });
    else resources.push({ apiVersion: 'traefik.io/v1alpha1', kind: 'IngressRouteTCP', metadata, spec: { entryPoints: [mapping.entryPoint], routes: [{ match: mapping.mode === 'TLS' ? hosts.map(host => `HostSNI(\`${host}\`)`).join(' || ') : 'HostSNI(`*`)', services: [{ name: input.service, port }] }], ...(mapping.mode === 'TLS' ? { tls: { secretName } } : {}) } });
  }
  return resources;
}
