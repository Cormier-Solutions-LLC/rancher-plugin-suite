import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const directory = fileURLToPath(new URL('.', import.meta.url));
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

try {
  const operation = process.argv[2];
  if (operation === 'install') {
    const source = JSON.parse(kubectl(['get', 'secret', 'godaddy-api-key', '-n', 'cert-manager', '-o', 'json'], null, true));
    if (!source.data?.token) throw new Error('Source GoDaddy Secret has no token key');
    // Transfer the existing credential in memory; never write it to disk or logs.
    apply({ apiVersion: 'v1', kind: 'Secret',
      metadata: { name: 'public-edge-ddns-godaddy', namespace: 'public-edge' },
      type: 'Opaque', data: { token: source.data.token } }, true);
    console.log('GoDaddy credential provisioned from cert-manager Secret (value hidden)');
    console.log(apply({ apiVersion: 'v1', kind: 'ConfigMap',
      metadata: { name: 'public-edge-ddns-script', namespace: 'public-edge' },
      data: { 'updater.mjs': readFileSync(directory + 'updater.mjs', 'utf8') } }).trim());
    console.log(apply(JSON.parse(readFileSync(directory + 'resources.json', 'utf8'))).trim());
    console.log('Installed with schedule suspended; run preview, then run, then enable');
  } else if (operation === 'preview' || operation === 'run') {
    const cron = JSON.parse(kubectl(['get', 'cronjob', 'public-edge-ddns', '-n', 'public-edge', '-o', 'json']));
    const name = `public-edge-ddns-${operation}-${Date.now()}`;
    const spec = structuredClone(cron.spec.jobTemplate.spec);
    spec.template.spec.containers[0].env.find(e => e.name === 'DRY_RUN').value = operation === 'preview' ? 'true' : 'false';
    if (process.argv.includes('--force-api-retry')) {
      spec.template.spec.containers[0].env.push({ name: 'FORCE_API_RETRY', value: 'true' });
    }
    // A failed preview should not be retried while diagnosing it.
    spec.backoffLimit = 0;
    console.log(apply({ apiVersion: 'batch/v1', kind: 'Job',
      metadata: { name, namespace: 'public-edge' }, spec }).trim());
    console.log(`Inspect: kubectl logs -n public-edge job/${name}`);
    console.log(`Wait: kubectl wait -n public-edge --for=condition=complete job/${name} --timeout=200s`);
  } else if (operation === 'enable' || operation === 'suspend') {
    console.log(kubectl(['patch', 'cronjob', 'public-edge-ddns', '-n', 'public-edge', '--type=merge',
      '-p', JSON.stringify({ spec: { suspend: operation === 'suspend' } })]).trim());
  } else {
    throw new Error('Usage: node public-edge-ddns/manage.mjs install|preview|run|enable|suspend');
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
