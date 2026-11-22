import {rancherRecoveryRequest, rancherSessionHeaders} from './rancher-recovery-session.mjs';
import {networkCapturePaths} from '../preview-data/fresh-network-source.mjs';

const configMap = (namespace, name) => ({group: '', resource: 'configmaps', namespace, name});
const networkInventory = Object.values(networkCapturePaths).map(path => {
  const [, api, group, version, resource] = path.split('/');
  return api === 'api'
    ? {verb: 'list', group: '', version: group, resource: version}
    : {verb: 'list', group, version, resource};
});
const dnsInventory = ['dns-windows-observations', 'dns-manager-observations']
  .map(name => ({verb: 'get', ...configMap('dns-system', name)}));

const denied = (status = 403) => Object.assign(new Error('Snapshot access requires a Rancher session with manager and inventory permissions.'), {
  code: 'SNAPSHOT_ACCESS_DENIED', status
});

export function isSnapshotApi(path) {
  return /^\/api\/snapshot(?:s(?:\/|$)|-)/.test(path);
}

export async function authorizeSnapshot({headers, method, manager, stateName, request = rancherRecoveryRequest}) {
  const mutating = method !== 'GET' && method !== 'HEAD';
  if (!['dns', 'network'].includes(manager) || !new RegExp(`^${manager}-manager-state-[a-z0-9-]+$`).test(stateName || '')) throw denied();
  if ((mutating && !headers.origin) || headers['sec-fetch-site'] === 'cross-site') throw denied();
  // Browsers can omit Origin on same-origin GETs and download navigation.
  const origin = process.env.SNAPSHOT_ALLOWED_ORIGIN || 'https://rancher.cormierconsulting.io';
  let forwarded;
  try {
    forwarded = rancherSessionHeaders({...headers, origin: headers.origin || origin});
  } catch {
    throw denied();
  }

  async function call(path, method = 'GET', body) {
    let result;
    try {
      result = await request(path, {method, headers: forwarded, ...(body && {body: JSON.stringify(body)})});
    } catch {
      throw denied(503);
    }
    if (result.status !== 200 && result.status !== 201) throw denied(result.status >= 500 ? 503 : 403);
    return result.body;
  }

  const identity = await call('/apis/authentication.k8s.io/v1/selfsubjectreviews', 'POST', {
    apiVersion: 'authentication.k8s.io/v1', kind: 'SelfSubjectReview'
  });
  const userId = identity?.status?.userInfo?.username;
  if (identity?.apiVersion !== 'authentication.k8s.io/v1' || identity.kind !== 'SelfSubjectReview' || !/^user-[a-z0-9-]+$/.test(userId || '')) throw denied();

  const state = configMap('cattle-ui-plugin-system', stateName);
  const permissions = [{verb: 'get', ...state}, ...(manager === 'dns' ? dnsInventory : networkInventory)];
  if (mutating) permissions.push({verb: 'update', ...state});
  await Promise.all(permissions.map(async resourceAttributes => {
    const result = await call('/apis/authorization.k8s.io/v1/selfsubjectaccessreviews', 'POST', {
      apiVersion: 'authorization.k8s.io/v1', kind: 'SelfSubjectAccessReview', spec: {resourceAttributes}
    });
    if (result?.status?.allowed !== true || result.status.denied || result.status.evaluationError) throw denied();
  }));

  return {
    userId,
    readSecret(path) {
      if (!/^\/api\/v1\/namespaces\/[a-z0-9-]+\/secrets\/[a-z0-9.-]+$/.test(path)) throw denied();
      return call(path);
    }
  };
}
