import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validPat } from './updater.mjs';

const directory = fileURLToPath(new URL('.', import.meta.url));
const namespace = 'public-edge';
const jobName = 'public-edge-ddns';
const resources = JSON.parse(readFileSync(directory + 'resources.json', 'utf8'));
const cronSpec = resources.items.find(item => item.kind === 'CronJob').spec.jobTemplate.spec;
const scriptName = cronSpec.template.spec.volumes.find(volume => volume.name === 'script').configMap.name;
const secretName = cronSpec.template.spec.volumes.find(volume => volume.name === 'credentials').secret.secretName;
function kubectl(args, object, sensitive = false) {
  const result = spawnSync('kubectl', args, {
    encoding: 'utf8', input: object ? JSON.stringify(object) : undefined,
  });
  if (result.status !== 0) {
    throw new Error(sensitive ? 'Credential provisioning failed; inspect Secret access permissions' :
      `kubectl failed: ${result.stderr.trim()}`);
  }
  return result.stdout;
}
const apply = (object, sensitive = false) => kubectl([
  'apply', '--server-side', '--field-manager=public-edge-ddns', '-f', '-',
], object, sensitive);
const liveCron = () => JSON.parse(kubectl(['get', 'cronjob', jobName, '-n', namespace, '-o', 'json']));
const setSuspended = suspend => kubectl(['patch', 'cronjob', jobName, '-n', namespace, '--type=merge',
  '-p', JSON.stringify({ spec: { suspend } })]).trim();

function stage() {
  console.log(apply({ apiVersion: 'v1', kind: 'ConfigMap',
    metadata: { name: scriptName, namespace },
    data: {
      'updater.mjs': readFileSync(directory + 'updater.mjs', 'utf8'),
      'authoritative-dns.mjs': readFileSync(directory + 'authoritative-dns.mjs', 'utf8'),
    } }).trim());
}

function requireV3(cron) {
  if (!cron.spec.jobTemplate.spec.template.spec.volumes.some(volume => volume.configMap?.name === scriptName)) {
    throw new Error('Install the v3 CronJob before running or enabling it');
  }
}

try {
  const operation = process.argv[2];
  if (operation === 'stage') {
    stage();
  } else if (operation === 'install') {
    const key = kubectl(['get', 'secret', secretName, '-n', namespace, '--ignore-not-found', '-o', 'jsonpath={.data.token}'], null, true);
    if (!validPat(Buffer.from(key, 'base64').toString('utf8').trim())) {
      throw new Error(`Provision a GoDaddy Personal Access Token in ${namespace}/${secretName}, key token`);
    }
    stage();
    const existing = kubectl(['get', 'cronjob', jobName, '-n', namespace, '--ignore-not-found', '-o', 'name']);
    if (existing.trim()) {
      console.log(setSuspended(true));
      if (liveCron().status?.active?.length) throw new Error('Wait for the suspended CronJob’s active Job to finish, then rerun install');
    }
    console.log(apply(resources).trim());
    console.log('Installed with schedule suspended. Verify a manual run, then enable scheduling.');
  } else if (operation === 'preview' || operation === 'run') {
    const name = `${jobName}-${operation}-${Date.now()}`;
    const preview = operation === 'preview';
    const cron = preview ? undefined : liveCron();
    if (cron) {
      requireV3(cron);
      if (!cron.spec.suspend || cron.status?.active?.length) {
        throw new Error('Suspend the CronJob and wait for active Jobs before running manually');
      }
    }
    const spec = structuredClone(cron?.spec.jobTemplate.spec ?? cronSpec);
    const container = spec.template.spec.containers[0];
    container.env.find(e => e.name === 'DRY_RUN').value = preview ? 'true' : 'false';
    if (preview) {
      const omit = ['credentials', 'state'];
      spec.template.spec.volumes = spec.template.spec.volumes.filter(volume => !omit.includes(volume.name));
      container.volumeMounts = container.volumeMounts.filter(mount => !omit.includes(mount.name));
    } else if (process.argv.includes('--force-api-retry')) {
      container.env.push({ name: 'FORCE_API_RETRY', value: 'true' });
    }
    // A failed preview should not be retried while diagnosing it.
    spec.backoffLimit = 0;
    console.log(apply({ apiVersion: 'batch/v1', kind: 'Job',
      metadata: { name, namespace }, spec }).trim());
    console.log(`Inspect: kubectl logs -n public-edge job/${name}`);
    console.log(`Wait: kubectl wait -n public-edge --for=condition=complete job/${name} --timeout=200s`);
  } else if (operation === 'enable' || operation === 'suspend') {
    if (operation === 'enable') requireV3(liveCron());
    console.log(setSuspended(operation === 'suspend'));
  } else {
    throw new Error('Usage: node public-edge-ddns/manage.mjs stage|preview|install|run|enable|suspend');
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
