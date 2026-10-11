export interface NewCertificateInput { name: string; namespace: string; secretName: string; issuer: string; hosts: string[] }
export function buildNewCertificate(input: NewCertificateInput) {
  const label = (value: string) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
  const dnsName = (value: string) => typeof value === 'string' && value.length <= 253 && value.split('.').every(label);
  if (!dnsName(input.name) || !label(input.namespace) || !dnsName(input.secretName)) throw new Error('Use valid certificate, namespace and TLS Secret names.');
  if (!input.issuer || !input.hosts.length || input.hosts.some(host => !host.includes('.') || !dnsName(host))) throw new Error('Select an issuer and valid certificate domains.');
  return { apiVersion: 'cert-manager.io/v1', kind: 'Certificate', metadata: { name: input.name, namespace: input.namespace }, spec: { secretName: input.secretName, dnsNames: [...new Set(input.hosts)], issuerRef: { name: input.issuer, kind: 'ClusterIssuer', group: 'cert-manager.io' } } };
}

export function suggestTlsSecretName(name: string, namespace: string) {
  if (!name) return '';
  let prefix = [namespace, name].filter(Boolean).join('-');
  if (prefix.split('.').some(label => label.length > 63)) prefix = [namespace, name].filter(Boolean).join('.');
  const labels = prefix.slice(0, 249).replace(/[-.]+$/, '').split('.').map(label => label.slice(0, 63).replace(/-+$/, ''));
  labels[labels.length - 1] = labels[labels.length - 1].slice(0, 59).replace(/-+$/, '');
  return `${labels.join('.')}-tls`;
}
