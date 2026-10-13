import { inventoryDatasets } from './inventory';
const dependencies = inventoryDatasets['dependency-resources-snapshot.json'];
import { queueChange } from './pending-rollouts';
import { reactive } from 'vue';
import type { IssuerSettings } from '../config/issuer';
import { existingIssuerSettings } from './issuer-snapshot';
import {issuerProfileKey} from '../../../../live-management/issuer-profile-identity.mjs';
export interface IssuerProfile {
  name: string;
  environment: string;
  challenge: string;
  source: string;
  manifest?: object;
  settings?: IssuerSettings;
}
// In-memory preview state only. No local storage, credentials, or API calls.
export const issuerProfiles = reactive<IssuerProfile[]>([
  { name: 'letsencrypt-prod', environment: 'production', challenge: 'dns01', source: 'Observed at cluster inspection', manifest: dependencies.resources.find(resource => resource.kind === 'ClusterIssuer' && resource.metadata.name === 'letsencrypt-prod'), settings: { ...existingIssuerSettings } }
]);
export function rememberIssuer(profile: IssuerProfile) {
  const index = issuerProfiles.findIndex(item => issuerProfileKey(item) === issuerProfileKey(profile));
  if (index >= 0) issuerProfiles[index] = profile;
  else issuerProfiles.push(profile);
  queueChange({ id: `issuer:${profile.name}`, category: 'TLS Issuer', name: profile.name, namespace: '', resources: profile.manifest ? [profile.manifest] : [], configuration: profile.settings });
}

export interface CredentialReference {
  name: string;
  namespace: string;
  keys: string[];
  source: string;
}
// Metadata only. Credential values are never collected by the static preview.
export const credentialReferences = reactive<CredentialReference[]>([
  { name: 'godaddy-api-key', namespace: 'cert-manager', keys: ['token'], source: 'Observed at cluster inspection' }
]);
export const accountReferences = reactive(['letsencrypt-prod-account-key']);
export function addCredentialReference(name: string, key: string) {
  validateSecretName(name);
  validateSecretKey(key);
  if (credentialReferences.some(item => item.name === name)) throw new Error('That Secret already exists in this preview. Select it to add a key.');
  const reference = { name, namespace: 'cert-manager', keys: [key], source: 'Local draft — credential value required when applying' };
  credentialReferences.push(reference);
  queueChange({ id: `credential:cert-manager/${name}`, category: 'Credential Reference', name, namespace: 'cert-manager', resources: [], configuration: reference });
}
export function addCredentialKey(name: string, key: string) {
  validateSecretKey(key);
  const secret = credentialReferences.find(item => item.name === name);
  if (!secret) throw new Error('Select a credential Secret first.');
  if (secret.keys.includes(key)) throw new Error('That key is already available.');
  secret.keys.push(key);
  queueChange({ id: `credential:${secret.namespace}/${name}`, category: 'Credential Reference', name, namespace: secret.namespace, resources: [], configuration: secret });
}
export function validateSecretName(name: string) {
  if (name.length > 253 || !name.split('.').every(part => part.length > 0 && part.length <= 63 && /^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/.test(part))) throw new Error('Use a valid Kubernetes Secret name.');
}
function validateSecretKey(key: string) {
  if (!key || key.length > 253 || !/^[-._a-zA-Z0-9]+$/.test(key)) throw new Error('Use a key name containing letters, numbers, dots, hyphens or underscores.');
}
