import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const hostname = process.env.MANAGER_PUBLIC_HOST || 'manager-acceptance.cormierconsulting.io';
const expectedBody = process.env.MANAGER_PUBLIC_BODY || 'manager-acceptance-v1\n';
const reportOnly = process.argv.includes('--report-only');
const evidencePath = '.local/manager-installation/public-edge-acceptance.json';
const userAgent = 'rancher-plugin-suite-validation/1.0';
const locations = [{ country: 'US' }, { country: 'CA' }, { country: 'DE' }, { country: 'AU' }];

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'User-Agent': userAgent, ...options.headers },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  assert.ok(response.ok, `${url} returned HTTP ${response.status}: ${text.slice(0, 200)}`);
  return text;
}

async function fetchJson(url, options = {}) {
  return JSON.parse(await fetchText(url, options));
}

async function discoverWanAddress() {
  const values = await Promise.all([
    fetchJson('https://api.ipify.org?format=json').then(result => result.ip),
    fetchText('https://ifconfig.me/ip').then(value => value.trim()),
    fetchText('https://icanhazip.com').then(value => value.trim()),
  ]);
  assert.equal(new Set(values).size, 1, `WAN address discovery disagreed: ${values.join(', ')}`);
  assert.match(values[0], /^(?:\d{1,3}\.){3}\d{1,3}$/);
  return { address: values[0], observations: values };
}

async function resolvePublicDns() {
  const encoded = encodeURIComponent(hostname);
  const [cloudflare, google] = await Promise.all([
    fetchJson(`https://cloudflare-dns.com/dns-query?name=${encoded}&type=A&do=true`, {
      headers: { Accept: 'application/dns-json' },
    }),
    fetchJson(`https://dns.google/resolve?name=${encoded}&type=A&do=true`),
  ]);
  return { cloudflare, google };
}

async function createMeasurement(body) {
  const created = await fetchJson('https://api.globalping.io/v1/measurements', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.ok(created.id, 'Globalping did not return a measurement ID');
  const deadline = Date.now() + 45_000;
  let result;
  do {
    await new Promise(resolve => setTimeout(resolve, 600));
    result = await fetchJson(`https://api.globalping.io/v1/measurements/${created.id}`, {
      headers: { Accept: 'application/json' },
    });
  } while (result.status === 'in-progress' && Date.now() < deadline);
  assert.notEqual(result.status, 'in-progress', `Globalping measurement ${created.id} timed out`);
  return result;
}

function summarizeMeasurement(measurement) {
  return {
    id: measurement.id,
    status: measurement.status,
    probesCount: measurement.probesCount,
    results: measurement.results.map(({ probe, result }) => ({
      probe: {
        country: probe.country,
        city: probe.city,
        network: probe.network,
      },
      status: result.status,
      failureSource: result.failureSource,
      resolvedAddress: result.resolvedAddress,
      statusCode: result.statusCode,
      rawOutput: result.rawOutput,
      rawBody: result.rawBody,
      timings: result.timings,
      tls: result.tls,
    })),
  };
}

function measurementPassed(measurement) {
  return measurement.probesCount >= 4 && measurement.results.every(({ result }) =>
    result.status === 'finished'
    && result.statusCode === 200
    && result.rawBody === expectedBody
  );
}

const wan = await discoverWanAddress();
const dns = await resolvePublicDns();
const http = await createMeasurement({
  type: 'http',
  target: wan.address,
  limit: 5,
  locations,
  timeout: 15,
  measurementOptions: {
    protocol: 'HTTP',
    port: 80,
    request: { host: hostname, path: '/', method: 'GET' },
  },
});
const https = await createMeasurement({
  type: 'http',
  target: wan.address,
  locations: http.id,
  timeout: 15,
  measurementOptions: {
    protocol: 'HTTPS',
    port: 443,
    request: { host: hostname, path: '/', method: 'GET' },
  },
});

const dnsAnswers = resolver => (resolver.Answer || [])
  .filter(answer => answer.type === 1)
  .map(answer => answer.data);
const dnsReady = [dns.cloudflare, dns.google].every(resolver =>
  resolver.Status === 0 && dnsAnswers(resolver).includes(wan.address)
);
const report = {
  observedAt: new Date().toISOString(),
  hostname,
  expectedBody,
  wan,
  dns: {
    ready: dnsReady,
    cloudflare: { status: dns.cloudflare.Status, authenticatedData: dns.cloudflare.AD, answers: dnsAnswers(dns.cloudflare) },
    google: { status: dns.google.Status, authenticatedData: dns.google.AD, answers: dnsAnswers(dns.google) },
  },
  http: { ready: measurementPassed(http), ...summarizeMeasurement(http) },
  https: { ready: measurementPassed(https), ...summarizeMeasurement(https) },
};
report.passed = report.dns.ready && report.http.ready && report.https.ready;

await mkdir('.local/manager-installation', { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  observedAt: report.observedAt,
  hostname,
  wanAddress: wan.address,
  dnsReady: report.dns.ready,
  dnsStatuses: [report.dns.cloudflare.status, report.dns.google.status],
  httpReady: report.http.ready,
  httpsReady: report.https.ready,
  probes: report.http.probesCount,
  evidencePath,
  passed: report.passed,
}));

if (!reportOnly) assert.ok(report.passed, 'Public DNS and edge acceptance did not pass');
