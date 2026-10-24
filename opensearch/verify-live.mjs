import assert from 'node:assert/strict';
import https from 'node:https';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const run = promisify(execFile);
const kubectl = process.env.KUBECTL || 'kubectl';
const directory = '.local/opensearch';
await mkdir(directory, { recursive: true });
async function k(...args) {
  const { stdout } = await run(kubectl, args, { maxBuffer: 8 * 1024 * 1024, timeout: 90000 });
  return stdout;
}
const object = async (...args) => JSON.parse(await k(...args, '-o', 'json'));
const secret = await object('-n', 'opensearch', 'get', 'secret', 'opensearch-admin-password');
const username = Buffer.from(secret.data.username, 'base64').toString();
const password = Buffer.from(secret.data.password, 'base64').toString();
const authorization = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
function request(path, { method = 'GET', body, authenticated = true, host = 'opensearch-api.cormierconsulting.io', ip = '10.99.15.50', httpHost } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = https.request({ hostname: host, servername: host, port: 443, path, method,
      lookup: (_host, options, callback) => options.all ? callback(null, [{ address: ip, family: 4 }]) : callback(null, ip, 4),
      headers: { ...(httpHost ? { host: httpHost } : {}), ...(authenticated ? { authorization } : {}), ...(payload ? { 'content-type': 'application/json' } : {}) },
      timeout: 20000 }, response => {
      let text = '';
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => {
        let data;
        try { data = JSON.parse(text); } catch { /* HTML, redirect or plain text */ }
        resolve({ status: response.statusCode, headers: response.headers, data });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('HTTPS request timed out')));
    req.end(payload);
  });
}
async function api(path, options) {
  const response = await request(path, options);
  assert.ok(response.status >= 200 && response.status < 300, `${options?.method || 'GET'} ${path}: HTTP ${response.status}`);
  return response.data;
}
const results = [];
function pass(check, details = {}) {
  results.push({ check, passed: true, ...details });
  console.log(`PASS: ${check}`);
}
let index;
try {
  assert.equal((await request('/', { authenticated: false })).status, 401);
  pass('Private API requires authentication and has a trusted TLS certificate');
  const ui = await request('/', { authenticated: false, host: 'opensearch.cormierconsulting.io' });
  assert.equal(ui.status, 302);
  assert.match(ui.headers.location, /\/(?:app|auth)\/login/);
  pass('Private Dashboards redirects to login over trusted TLS');
  const dashboardStatus = await request('/api/status', { host: 'opensearch.cormierconsulting.io' });
  assert.equal(dashboardStatus.status, 200, 'Authenticated Dashboards status must be accessible');
  const dashboardConfig = await object('-n', 'opensearch', 'get', 'configmap', 'opensearch-dashboards-config');
  assert.match(dashboardConfig.data['opensearch_dashboards.yml'], /opensearch.ssl.verificationMode: full/);
  pass('Authenticated Dashboards can reach OpenSearch with backend certificate verification');
  const publicControl = await request('/', { host: 'proofing.cormierconsulting.io', ip: '10.99.15.59', authenticated: false });
  assert.ok(publicControl.status >= 200 && publicControl.status < 400, 'Public gateway positive control must respond');
  const publicConfig = await object('-n', 'public-edge', 'get', 'configmap', 'public-edge-config');
  for (const host of ['opensearch.cormierconsulting.io', 'opensearch-api.cormierconsulting.io']) {
    assert.ok(!publicConfig.data['nginx.conf'].includes(host), 'OpenSearch must not be in the public allowlist');
    // NGINX deliberately drops unapproved Host headers with status 444, which
    // appears as a connection reset to clients. An HTTP denial is also acceptable.
    let denied = false;
    try {
      const response = await request('/', { host: 'proofing.cormierconsulting.io', ip: '10.99.15.59',
        httpHost: host, authenticated: false });
      denied = [403, 421].includes(response.status);
    } catch (error) {
      if (error.code !== 'ECONNRESET') throw error;
      denied = true;
    }
    assert.ok(denied, `Public gateway must deny ${host}`);
  }
  pass('Public gateway rejects both OpenSearch hostnames');
  const health = await api('/_cluster/health?wait_for_status=green&timeout=30s');
  assert.equal(health.status, 'green');
  assert.equal(health.number_of_nodes, 3);
  assert.equal(health.number_of_data_nodes, 3);
  const nodeInfo = await api('/_nodes?filter_path=nodes.*.name,nodes.*.roles,nodes.*.attributes.zone,nodes.*.version');
  const nodes = Object.values(nodeInfo.nodes);
  assert.equal(new Set(nodes.map(node => node.attributes.zone)).size, 3);
  assert.ok(nodes.every(node => node.roles.includes('data') && node.roles.includes('cluster_manager') && node.version === '3.9.0'));
  pass('Three healthy data/manager nodes on distinct physical Proxmox zones', { nodes });
  const users = await api('/_plugins/_security/api/internalusers');
  assert.deepEqual(Object.keys(users).sort(), ['admin', 'kibanaserver']);
  pass('Only randomized admin and Dashboards internal accounts exist');
  const template = await api('/_index_template/application-defaults');
  assert.equal(Number(template.index_templates[0].index_template.template.settings.index.number_of_replicas), 1);
  pass('Application index defaults preserve one search replica');
  const claims = (await object('-n', 'opensearch', 'get', 'pvc')).items;
  assert.equal(claims.length, 3);
  assert.ok(claims.every(claim => claim.status.phase === 'Bound' && claim.spec.storageClassName === 'opensearch-longhorn-retain' && claim.spec.resources.requests.storage === '30Gi'));
  const replicas = (await object('-n', 'longhorn-system', 'get', 'replicas.longhorn.io')).items;
  const volumes = (await object('-n', 'longhorn-system', 'get', 'volumes.longhorn.io')).items;
  const hosts = (await object('get', 'nodes')).items;
  const storage = claims.map(claim => {
    const volume = volumes.find(item => item.metadata.name === claim.spec.volumeName);
    assert.equal(volume.status.robustness, 'healthy');
    const copies = replicas.filter(item => item.spec.volumeName === volume.metadata.name && item.status.currentState === 'running');
    assert.equal(copies.length, 3);
    const zones = copies.map(copy => hosts.find(host => host.metadata.name === copy.spec.nodeID).metadata.labels['topology.kubernetes.io/zone']);
    assert.equal(new Set(zones).size, 3);
    return { claim: claim.metadata.name, volume: volume.metadata.name, capacity: claim.status.capacity.storage, replicaZones: zones };
  });
  pass('Dedicated 90 GiB Longhorn data storage has three healthy copies across physical zones', { storage });
  index = `opensearch-acceptance-${randomUUID()}`;
  await api(`/${index}`, { method: 'PUT', body: { settings: { number_of_shards: 1, number_of_replicas: 1 } } });
  await api(`/${index}/_doc/1?refresh=wait_for`, { method: 'PUT', body: { message: 'distributed OpenSearch storage validation', marker: index } });
  const hits = await api(`/${index}/_search`, { method: 'POST', body: { query: { match: { message: 'distributed' } } } });
  assert.equal(hits.hits.total.value, 1);
  assert.equal(hits.hits.hits[0]._source.marker, index);
  assert.equal((await api(`/_cluster/health/${index}?wait_for_status=green&timeout=30s`)).status, 'green');
  pass('Indexing, replicated shard allocation and full-text search work');
  if (process.argv.includes('--restart-one-node')) {
    const original = await object('-n', 'opensearch', 'get', 'pod', 'opensearch-nodes-0');
    const claim = claims.find(item => item.metadata.name === 'data-opensearch-nodes-0');
    await k('-n', 'opensearch', 'delete', 'pod', original.metadata.name, '--wait=false');
    const end = Date.now() + 300000;
    let replacement;
    while (Date.now() < end) {
      try {
        const candidate = await object('-n', 'opensearch', 'get', 'pod', original.metadata.name);
        if (candidate.metadata.uid !== original.metadata.uid && candidate.status.conditions?.some(condition => condition.type === 'Ready' && condition.status === 'True')) {
          replacement = candidate;
          break;
        }
      } catch { /* Replacement may not exist yet. */ }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    assert.ok(replacement, 'Replacement OpenSearch pod did not become Ready within five minutes');
    assert.equal((await object('-n', 'opensearch', 'get', 'pvc', claim.metadata.name)).metadata.uid, claim.metadata.uid);
    assert.equal((await api('/_cluster/health?wait_for_status=green&timeout=30s')).status, 'green');
    assert.equal((await api(`/${index}/_doc/1`))._source.marker, index);
    pass('One node can be recreated with its original data volume and preserved indexed data');
  }
  await writeFile(`${directory}/live-verification.json`, JSON.stringify({ verifiedAt: new Date().toISOString(), results }, null, 2));
} finally {
  // Delete only the uniquely named index created by this run.
  if (index) await api(`/${index}`, { method: 'DELETE' });
}
