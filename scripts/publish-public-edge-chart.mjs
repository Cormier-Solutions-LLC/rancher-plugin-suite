// Publish an immutable chart through the existing private extension asset host.
// No repository authentication or additional public ingress is introduced.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const exec = promisify(execFile);
const namespace = 'cattle-ui-plugin-system';
const root = '.local/public-edge/chart';
const helm = process.env.HELM || '.tools/helm/windows-amd64/helm.exe';
const owner = 'public-edge-chart-publisher';
const ownership = 'public-edge.cormierconsulting.io/managed-by';
const digest = value => createHash('sha256').update(value).digest('hex');
async function run(command, args) {
  const {stdout} = await exec(command, args, {encoding: 'utf8', timeout: 240_000, maxBuffer: 8 * 1024 * 1024});
  return stdout;
}
const get = async args => JSON.parse(await run('kubectl', ['get', ...args, '-o', 'json', '--request-timeout=20s']));
async function apply(resource, filename) {
  const file = `${root}/${filename}.json`;
  await writeFile(file, JSON.stringify(resource));
  await run('kubectl', ['apply', '--dry-run=server', '-f', file]);
  return run('kubectl', ['apply', '-f', file]);
}
await mkdir(root, {recursive: true});
const chartText = await readFile('charts/public-edge/Chart.yaml', 'utf8');
function field(name) {
  const match = chartText.match(new RegExp(`^${name}:\\s*"?([^"\\r\\n]+)"?\\s*$`, 'm'));
  assert.ok(match, `Missing chart metadata: ${name}`);
  return match[1].trim();
}
const version = field('version');
await run(helm, ['lint', 'charts/public-edge']);
await run(helm, ['package', 'charts/public-edge', '--destination', root]);
const filename = `public-edge-${version}.tgz`;
const archive = await readFile(`${root}/${filename}`);
const archiveDigest = digest(archive);
const prefix = `/public-edge-charts/${archiveDigest}`;
const assetOrigin = 'http://manager-extension-assets.cattle-ui-plugin-system.svc.cluster.local:8080';
const url = assetOrigin + prefix;
// JSON is valid YAML; the content-addressed index can safely use immutable caching.
const metadata = {apiVersion: 'v2', name: 'public-edge', version, appVersion: field('appVersion'),
  description: field('description'), type: 'application',
  annotations: {'catalog.cattle.io/display-name': 'Public Web Access', 'catalog.cattle.io/namespace': 'public-edge',
    'catalog.cattle.io/ui-source-repo': 'public-web-access', 'catalog.cattle.io/ui-source-repo-type': 'cluster'}};
const index = Buffer.from(JSON.stringify({apiVersion: 'v1', generated: new Date().toISOString(),
  entries: {'public-edge': [{...metadata, urls: [`${url}/${filename}`], digest: archiveDigest, created: new Date().toISOString()}]}}));
const packed = {[`${prefix}/index.yaml`]: gzipSync(index).toString('base64'), [`${prefix}/${filename}`]: gzipSync(archive).toString('base64')};
const mapName = `public-edge-chart-${archiveDigest.slice(0, 16)}`;
const map = {apiVersion: 'v1', kind: 'ConfigMap', metadata: {name: mapName, namespace, annotations: {[ownership]: owner}},
  immutable: true, data: {[`${mapName}.json`]: JSON.stringify(packed)}};
if (process.argv.includes('--prepare-only')) {
  await writeFile(`${root}/prepared-assets.json`, JSON.stringify(map));
  console.log(JSON.stringify({prepared: true, version, archiveDigest, url, metadata}));
  process.exit(0);
}
const deployment = await get(['deployment', 'manager-extension-assets', '-n', namespace]);
assert.equal(deployment.status.readyReplicas, deployment.spec.replicas);
const beforeSpec = structuredClone(deployment.spec);
const sources = deployment.spec.template.spec.volumes.find(volume => volume.name === 'assets').projected.sources;
const oldNames = sources.map(source => source.configMap.name);
const oldMaps = await Promise.all(oldNames.map(name => get(['configmap', name, '-n', namespace])));
const beforeDigests = Object.fromEntries(oldMaps.map(value => [value.metadata.name, digest(JSON.stringify(value.data))]));
const ledger = {startedAt: new Date().toISOString(), archiveDigest, url, mapName, deploymentUid: deployment.metadata.uid,
  beforeSpec, beforeDigests, status: 'Prepared'};
const save = async () => writeFile('.local/public-edge/chart-publication.json', JSON.stringify(ledger, null, 2));
await save();
const existing = await run('kubectl', ['get', 'configmap', mapName, '-n', namespace, '--ignore-not-found', '-o', 'json']);
if (existing.trim()) assert.deepEqual(JSON.parse(existing).data, map.data);
else await apply(map, 'assets');
if (!oldNames.includes(mapName)) {
  // Only add this projection. Preserve all concurrently added files and runtime settings.
  const fresh = await get(['deployment', 'manager-extension-assets', '-n', namespace]);
  assert.equal(fresh.metadata.uid, deployment.metadata.uid);
  const volumes = fresh.spec.template.spec.volumes;
  volumes.find(volume => volume.name === 'assets').projected.sources.push({configMap: {name: mapName}});
  const patchFile = `${root}/asset-projection.json`;
  await writeFile(patchFile, JSON.stringify({metadata: {resourceVersion: fresh.metadata.resourceVersion}, spec: {template: {spec: {volumes}}}}));
  await run('kubectl', ['patch', 'deployment', 'manager-extension-assets', '-n', namespace, '--type=merge', '--patch-file', patchFile, '--dry-run=server']);
  await run('kubectl', ['patch', 'deployment', 'manager-extension-assets', '-n', namespace, '--type=merge', '--patch-file', patchFile]);
}
await run('kubectl', ['rollout', 'status', 'deployment/manager-extension-assets', '-n', namespace, '--timeout=180s']);
await Promise.all(Object.entries(beforeDigests).map(async ([name, expected]) => {
  assert.equal(digest(JSON.stringify((await get(['configmap', name, '-n', namespace])).data)), expected);
}));
const repo = {apiVersion: 'catalog.cattle.io/v1', kind: 'ClusterRepo', metadata: {name: 'public-web-access', annotations: {[ownership]: owner}},
  spec: {url, refreshInterval: 3600, enabled: true}};
const currentRepo = await run('kubectl', ['get', 'clusterrepo', 'public-web-access', '--ignore-not-found', '-o', 'json']);
if (currentRepo.trim()) assert.equal(JSON.parse(currentRepo).metadata.annotations?.[ownership], owner);
await apply(repo, 'repository');
ledger.status = 'Published; Rancher index readiness pending';
ledger.finishedAt = new Date().toISOString();
await save();
console.log(JSON.stringify({archiveDigest, url, mapName, originalAssetMapsPreserved: oldNames.length, status: ledger.status}));
