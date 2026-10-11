export interface IssuerSettings {
  name: string;
  email: string;
  environment: 'staging' | 'production';
  challenge: 'dns01' | 'http01';
  zone: string;
  groupName: string;
  solverName: string;
  secretName: string;
  secretKey: string;
  ingressClass: string;
  providerProduction: boolean;
  accountSecretName?: string;
}
const dnsName = (value: string) => value.length > 0 && value.length <= 253 &&
  value.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
export function parseIssuerZones(value: string) {
  const zones = [...new Set(value.split(/[\s,]+/).map(zone => zone.trim().toLowerCase()).filter(Boolean))];
  if (zones.some(zone => !dnsName(zone) || !zone.includes('.'))) throw new Error('Enter valid base domains separated by commas or new lines, without wildcards or URLs.');
  return zones;
}
export function buildIssuer(input: IssuerSettings) {
  const zones = parseIssuerZones(input.zone);
  if (!dnsName(input.name) || `${input.name}-account-key`.length > 253) throw new Error('Enter a valid Kubernetes issuer name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Enter an account email address.');
  if (!['staging', 'production'].includes(input.environment)) throw new Error('Select an ACME environment.');
  if (!['dns01', 'http01'].includes(input.challenge)) throw new Error('Select a challenge method.');
  if (input.accountSecretName && !dnsName(input.accountSecretName)) throw new Error('Select a valid account key Secret reference.');
  if (input.challenge === 'dns01') {
    if (!zones.length) throw new Error('Enter at least one DNS zone, without a wildcard or URL.');
    if (!dnsName(input.groupName) || !dnsName(input.solverName)) throw new Error('Enter the installed webhook group and solver names.');
    if (!dnsName(input.secretName) || !/^[a-zA-Z0-9._-]+$/.test(input.secretKey)) throw new Error('Enter an existing credential Secret name and key.');
  } else if (!dnsName(input.ingressClass)) throw new Error('Enter an ingress class name.');
  return {
    apiVersion: 'cert-manager.io/v1', kind: 'ClusterIssuer', metadata: { name: input.name },
    spec: { acme: {
      email: input.email,
      server: input.environment === 'staging' ? 'https://acme-staging-v02.api.letsencrypt.org/directory' : 'https://acme-v02.api.letsencrypt.org/directory',
      privateKeySecretRef: { name: input.accountSecretName || `${input.name}-account-key` },
      solvers: input.challenge === 'dns01' ? [{
        selector: { dnsZones: zones },
        dns01: { webhook: { groupName: input.groupName, solverName: input.solverName,
          config: { apiKeySecretRef: { name: input.secretName, key: input.secretKey }, production: input.providerProduction, ttl: 600 }
        } }
      }] : [{ http01: { ingress: { ingressClassName: input.ingressClass } } }]
    } }
  };
}
