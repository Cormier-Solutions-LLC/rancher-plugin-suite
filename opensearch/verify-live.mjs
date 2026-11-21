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
  const { stdout } = await run(kubectl, args, { maxBuffer: 16 * 1024 * 1024, timeout: 180000 });
  return stdout;
}
const object = async (...args) => JSON.parse(await k(...args, '-o', 'json'));
function quantityBytes(value) {
  const match = String(value).match(/^(\d+)(Ki|Mi|Gi|Ti|K|M|G|T)?$/);
  assert.ok(match, `Unsupported storage quantity: ${value}`);
  const factors = { Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, K: 1000, M: 1000 ** 2, G: 1000 ** 3, T: 1000 ** 4 };
  return BigInt(match[1]) * BigInt(factors[match[2]] || 1);
}

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
      timeout: 120000 }, response => {
      let text = '';
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => {
        let data;
        try { data = JSON.parse(text); } catch { /* HTML, redirect or plain text */ }
        resolve({ status: response.statusCode, headers: response.headers, data, text });
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
  pass('Private API requires authentication and presents a trusted TLS certificate');
  const ui = await request('/', { authenticated: false, host: 'opensearch.cormierconsulting.io' });
  assert.equal(ui.status, 302);
  assert.match(ui.headers.location, /\/(?:app|auth)\/login/);
  const dashboardStatus = await request('/api/status', { host: 'opensearch.cormierconsulting.io' });
  assert.equal(dashboardStatus.status, 200);
  pass('Dashboards serves the private TLS endpoint and reaches OpenSearch');

  const publicControl = await request('/', { host: 'proofing.cormierconsulting.io', ip: '10.99.15.59', authenticated: false });
  assert.ok(publicControl.status >= 200 && publicControl.status < 600);
  const publicConfig = await object('-n', 'public-edge', 'get', 'configmap', 'public-edge-config');
  for (const host of ['opensearch.cormierconsulting.io', 'opensearch-api.cormierconsulting.io']) {
    assert.ok(!publicConfig.data['nginx.conf'].includes(host));
    let denied = false;
    try {
      const response = await request('/', { host: 'proofing.cormierconsulting.io', ip: '10.99.15.59', httpHost: host, authenticated: false });
      denied = [403, 421].includes(response.status);
    } catch (error) {
      if (error.code !== 'ECONNRESET') throw error;
      denied = true;
    }
    assert.ok(denied, `Public gateway must deny ${host}`);
  }
  pass('Public gateway rejects both OpenSearch hostnames');

  const health = await api('/_cluster/health?wait_for_status=green&timeout=90s');
  assert.equal(health.status, 'green');
  assert.equal(health.number_of_nodes, 11);
  assert.equal(health.number_of_data_nodes, 8);
  const nodeInfo = await api('/_nodes?filter_path=nodes.*.name,nodes.*.roles,nodes.*.attributes.zone,nodes.*.attributes.storage_domain,nodes.*.version');
  const searchNodes = Object.values(nodeInfo.nodes);
  const managers = searchNodes.filter(node => node.roles.includes('cluster_manager'));
  const dataNodes = searchNodes.filter(node => node.roles.includes('data'));
  assert.equal(managers.length, 3);
  assert.equal(dataNodes.length, 8);
  assert.ok(managers.every(node => !node.roles.includes('data') && node.version === '3.9.0'));
  assert.ok(dataNodes.every(node => !node.roles.includes('cluster_manager') && node.roles.includes('ingest') && node.version === '3.9.0'));
  assert.ok(searchNodes.every(node => !['proxmox01', 'proxmox02'].includes(node.attributes.zone)));
  assert.equal(new Set(managers.map(node => node.attributes.zone)).size, 3);
  assert.ok(new Set(dataNodes.map(node => node.attributes.zone)).size >= 6);
  assert.deepEqual(new Set(dataNodes.map(node => node.attributes.storage_domain)), new Set(['proxmox09', 'proxmox06']));
  assert.equal(dataNodes.filter(node => node.attributes.storage_domain === 'proxmox09').length, 4);
  assert.equal(dataNodes.filter(node => node.attributes.storage_domain === 'proxmox06').length, 4);
  pass('Three manager-only nodes and eight data/ingest nodes span six zones and both storage domains', { managers, dataNodes });

  const users = await api('/_plugins/_security/api/internalusers');
  assert.ok(Object.hasOwn(users, 'admin') && Object.hasOwn(users, 'kibanaserver'));
  assert.ok(['kibanaro', 'logstash', 'readall', 'snapshotrestore'].every(user => !Object.hasOwn(users, user)));
  pass('Randomized required accounts exist and bundled demo users are absent', { internalUsers: Object.keys(users).sort() });
  const template = await api('/_index_template/application-defaults');
  const settings = template.index_templates[0].index_template.template.settings.index;
  assert.equal(Number(settings.number_of_shards), 4);
  assert.equal(Number(settings.number_of_replicas), 1);
  pass('Application defaults use four primary shards and one OpenSearch replica');

  const claims = (await object('-n', 'opensearch', 'get', 'pvc')).items;
  const poolSpecs = [
    { prefix: 'data-opensearch-managers-', count: 3, size: 30_000_000_000n, storageClass: 'opensearch-manager-longhorn-retain', diskTag: 'thin' },
    { prefix: 'data-opensearch-data-pve09-', count: 4, size: 200_000_000_000n, storageClass: 'opensearch-data-pve09-retain', diskTag: 'proxmox09-nfs' },
    { prefix: 'data-opensearch-data-pve06-', count: 4, size: 200_000_000_000n, storageClass: 'opensearch-data-pve06-retain', diskTag: 'proxmox06-nfs' },
  ];
  assert.equal(claims.length, 11);
  const volumes = (await object('-n', 'longhorn-system', 'get', 'volumes.longhorn.io')).items;
  const replicas = (await object('-n', 'longhorn-system', 'get', 'replicas.longhorn.io')).items;
  const hosts = (await object('get', 'nodes')).items;
  const longhornNodes = (await object('-n', 'longhorn-system', 'get', 'nodes.longhorn.io')).items;
  const storage = [];
  for (const spec of poolSpecs) {
    const poolClaims = claims.filter(claim => claim.metadata.name.startsWith(spec.prefix));
    assert.equal(poolClaims.length, spec.count);
    for (const claim of poolClaims) {
      assert.equal(claim.status.phase, 'Bound');
      assert.equal(claim.spec.storageClassName, spec.storageClass);
      assert.ok(quantityBytes(claim.status.capacity.storage) >= spec.size);
      const volume = volumes.find(item => item.metadata.name === claim.spec.volumeName);
      assert.equal(volume.status.robustness, 'healthy');
      assert.equal(volume.spec.dataLocality, 'best-effort');
      assert.deepEqual(volume.spec.diskSelector, [spec.diskTag]);
      const copies = replicas.filter(item => item.spec.volumeName === volume.metadata.name && item.status.currentState === 'running');
      assert.equal(copies.length, 3);
      const zones = copies.map(copy => hosts.find(host => host.metadata.name === copy.spec.nodeID).metadata.labels['topology.kubernetes.io/zone']);
      assert.equal(new Set(zones).size, 3);
      for (const copy of copies) {
        const longhornNode = longhornNodes.find(node => node.metadata.name === copy.spec.nodeID);
        const matchingDisk = Object.values(longhornNode.spec.disks).find(disk => disk.path === copy.spec.diskPath);
        assert.ok(matchingDisk?.tags?.includes(spec.diskTag), `${copy.spec.nodeID}:${copy.spec.diskPath} must be tagged ${spec.diskTag}`);
      }
      assert.ok(copies.some(copy => copy.spec.nodeID === volume.status.currentNodeID));
      storage.push({ claim: claim.metadata.name, volume: volume.metadata.name, storageClass: spec.storageClass,
        capacity: claim.status.capacity.storage, attachedNode: volume.status.currentNodeID,
        replicas: copies.map(copy => ({ node: copy.spec.nodeID, path: copy.spec.diskPath })) });
    }
  }
  pass('All eleven PVCs are healthy with three tagged, cross-zone Longhorn replicas and a local copy', { storage });

  index = `opensearch-acceptance-${randomUUID()}`;
  await api(`/${index}`, { method: 'PUT', body: { settings: { number_of_shards: 4, number_of_replicas: 1 } } });
  await api(`/${index}/_doc/1?refresh=wait_for`, { method: 'PUT', body: { message: 'tiered distributed OpenSearch validation', marker: index } });
  const hits = await api(`/${index}/_search`, { method: 'POST', body: { query: { match: { message: 'distributed' } } } });
  assert.equal(hits.hits.total.value, 1);
  assert.equal((await api(`/_cluster/health/${index}?wait_for_status=green&timeout=90s`)).status, 'green');
  const shardsResponse = await request(`/_cat/shards/${index}?format=json&h=shard,prirep,state,node`);
  assert.equal(shardsResponse.status, 200);
  const shards = shardsResponse.data;
  assert.equal(shards.length, 8);
  assert.equal(new Set(shards.map(shard => shard.node)).size, 8);
  for (const shardNumber of ['0', '1', '2', '3']) {
    const pair = shards.filter(shard => shard.shard === shardNumber);
    assert.equal(pair.length, 2);
    assert.ok(pair.every(shard => shard.state === 'STARTED'));
    const pairNodes = pair.map(shard => searchNodes.find(node => node.name === shard.node));
    assert.equal(new Set(pairNodes.map(node => node.attributes.storage_domain)).size, 2);
    assert.equal(new Set(pairNodes.map(node => node.attributes.zone)).size, 2);
  }
  pass('Four primaries and four replicas use all eight data nodes with each pair split across domain and zone', { shards });

  if (process.argv.includes('--restart-one-node')) {
    const original = await object('-n', 'opensearch', 'get', 'pod', 'opensearch-data-pve06-0');
    const claim = claims.find(item => item.metadata.name === 'data-opensearch-data-pve06-0');
    await k('-n', 'opensearch', 'delete', 'pod', original.metadata.name, '--wait=false');
    const end = Date.now() + 600000;
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
    assert.ok(replacement, 'Replacement data pod did not become Ready within ten minutes');
    assert.equal((await object('-n', 'opensearch', 'get', 'pvc', claim.metadata.name)).metadata.uid, claim.metadata.uid);
    assert.equal((await api('/_cluster/health?wait_for_status=green&timeout=90s')).status, 'green');
    assert.equal((await api(`/${index}/_doc/1`))._source.marker, index);
    pass('A data pod recreation retained its PVC identity and indexed document');
  }
  await writeFile(`${directory}/live-verification.json`, JSON.stringify({ verifiedAt: new Date().toISOString(), results }, null, 2));
} finally {
  if (index) await api(`/${index}`, { method: 'DELETE' });
}
