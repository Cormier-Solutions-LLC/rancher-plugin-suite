import type { IssuerSettings } from '../config/issuer';
// Non-secret configuration and Secret metadata from the October 11 inspection.
// No Secret values or private keys were exported into this preview.
export const existingIssuerSettings: IssuerSettings = {
  name: 'letsencrypt-prod', email: 'andrew@cormierconsulting.com', environment: 'production', challenge: 'dns01',
  zone: 'cormierconsulting.io', groupName: 'acme.cormierconsulting.io', solverName: 'godaddy',
  secretName: 'godaddy-api-key', secretKey: 'token', ingressClass: 'traefik', providerProduction: true,
  accountSecretName: 'letsencrypt-prod-account-key'
};
export const credentialSecretNames = ['godaddy-api-key'];
export const accountSecretNames = ['letsencrypt-prod-account-key'];
export const credentialKeyNames = ['token'];
