export interface PublishSettings {
  name: string; namespace: string; service: string; port: string;
  domainText: string; issuer: string; ingressClass: string; challenge: string;
}
const label = (value: string) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
const domain = (value: string) => value.length <= 253 && value.split('.').length >= 2 && value.split('.').every(label);
export function buildPublication(input: PublishSettings) {
  for (const value of [input.name, input.namespace, input.service]) {
    if (!label(value)) throw new Error('Route, namespace, and service names must be valid Kubernetes names.');
  }
  if (!input.issuer || !input.ingressClass) throw new Error('Select an issuer and ingress class.');
  const names = [...new Set(input.domainText.split(/[\s,;]+/).map(value => value.trim().toLowerCase()).filter(Boolean))];
  if (!names.length || names.some(value => !domain(value))) throw new Error('Enter valid domain names, separated by lines or commas.');
  const numericPort = /^\d+$/.test(input.port);
  if (numericPort ? Number(input.port) < 1 || Number(input.port) > 65535 : !label(input.port) || input.port.length > 15 || !/[a-z]/.test(input.port)) throw new Error('Enter a valid service port number or named port.');
  const secret = `${input.name}-tls`;
  return [
    { apiVersion: 'cert-manager.io/v1', kind: 'Certificate', metadata: { name: secret, namespace: input.namespace },
      spec: { secretName: secret, dnsNames: names, issuerRef: { name: input.issuer, kind: 'ClusterIssuer', group: 'cert-manager.io' } } },
    { apiVersion: 'networking.k8s.io/v1', kind: 'Ingress', metadata: { name: input.name, namespace: input.namespace },
      spec: { ingressClassName: input.ingressClass, rules: names.map(host => ({ host, http: { paths: [{ path: '/', pathType: 'Prefix', backend: { service: { name: input.service, port: numericPort ? { number: Number(input.port) } : { name: input.port } } } }] } })), tls: [{ hosts: names, secretName: secret }] } }
  ];
}
