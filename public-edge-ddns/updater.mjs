import { readFile, realpath, writeFile, rename } from 'node:fs/promises';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';
import { authoritativeReader } from './authoritative-dns.mjs';

const apiBase = 'https://api.godaddy.com/v3/domains/zones';
const ipServices = ['https://api.ipify.org', 'https://checkip.amazonaws.com'];
const validTtl = ttl => Number.isInteger(ttl) && ttl >= 600 && ttl <= 86400;

export const validPat = token => typeof token === 'string' && /^[A-Za-z0-9._~+/-]+=*$/.test(token);

export function fileState(path) {
  return {
    async read() {
      try {
        const value = JSON.parse(await readFile(path, 'utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value) ||
          (value.blockedUntil !== undefined && !Number.isFinite(value.blockedUntil))) throw new Error('Invalid DDNS quota state');
        return value;
      } catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
    },
    async write(value) {
      const temporary = `${path}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
      await rename(temporary, path);
    },
  };
}

export function publicIPv4(value) {
  if (isIP(value) !== 4) return false;
  const [a, b, c] = value.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

export function hostnames(value, zone) {
  const validName = name => typeof name === 'string' && name.length <= 253 &&
    name.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
  if (!validName(zone) || !zone.includes('.')) throw new Error('Invalid configured DNS zone');
  if (!Array.isArray(value) || value.length > 100) throw new Error('Invalid public hostname list');
  for (const name of value) {
    if (!validName(name) || !name.endsWith(`.${zone}`)) {
      throw new Error('Public hostname list contains an invalid or out-of-zone name');
    }
  }
  return [...new Set(value)].sort();
}

export async function reconcile({ hosts, zone, token, dryRun = true, fetcher = fetch, log = console.log,
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)), stateStore,
  now = Date.now, forceApiRetry = false, dnsReader, edgeHost = `ddns_edge.${zone}` }) {
  const names = hostnames(hosts, zone);
  if (!names.length) { log('No public hostnames configured; no DNS changes'); return []; }
  if (!edgeHost.endsWith(`.${zone}`) || !edgeHost.split('.').every(label => /^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/.test(label)) || names.includes(edgeHost)) {
    throw new Error('Invalid shared edge DNS name or self-referencing public hostname');
  }
  let state = stateStore ? await stateStore.read() : {};
  const save = async patch => { state = { ...state, ...patch }; if (stateStore) await stateStore.write(state); };
  let apiReads = 0, apiWrites = 0;
  async function request(url, options = {}) {
    const { hostname, pathname } = new URL(url);
    const method = options.method ?? 'GET';
    // Replan after an ambiguous POST or DELETE instead of replaying it.
    const attempts = ['GET', 'PUT'].includes(method) ? 3 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      let response;
      try {
        if (hostname === 'api.godaddy.com') {
          if (method === 'GET') apiReads++;
          else apiWrites++;
          log(`GoDaddy v3 request ${apiReads + apiWrites}: ${method} ${pathname}`);
        }
        response = await fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
      } catch (error) {
        if (attempt + 1 < attempts) { await pause(1000 * (attempt + 1)); continue; }
        const code = error?.cause?.code;
        const safeCode = typeof code === 'string' && /^[A-Z_0-9]{1,50}$/.test(code) ? ` (${code})` : '';
        throw new Error(`DNS updater network request failed for ${hostname}${safeCode}`);
      }
      if (hostname === 'api.godaddy.com' && response.status === 429) {
        const body = await response.clone().json().catch(() => ({}));
        const code = body?.name ?? body?.code;
        if (code === 'QUOTA_EXCEEDED' && /month/i.test(body?.message ?? '')) {
          const nextMonth = new Date(now());
          const blockedUntil = Math.min(now() + 86400000,
            Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 1));
          await save({ blockedUntil });
          throw new Error('GoDaddy monthly API quota exhausted (QUOTA_EXCEEDED); restore account quota');
        }
      }
      if ((response.status === 429 || response.status >= 500) && attempt + 1 < attempts) {
        const delay = Number(response.headers.get('retry-after'));
        await pause(Number.isFinite(delay) && delay > 0 ? Math.min(delay, 10) * 1000 : (attempt + 1) * 2000);
        continue;
      }
      return response;
    }
  }
  const addresses = await Promise.all(ipServices.map(async url => {
    const response = await request(url);
    if (!response.ok) throw new Error(`Public IPv4 lookup returned HTTP ${response.status}`);
    const ip = (await response.text()).trim();
    if (!publicIPv4(ip)) throw new Error('Public IPv4 lookup returned a non-public or invalid address');
    return ip;
  }));
  if (addresses[0] !== addresses[1]) throw new Error('Public IPv4 services disagree; refusing DNS changes');
  const ip = addresses[0];
  const read = dnsReader ?? await authoritativeReader({ zone, request, publicIPv4 });
  const desired = [
    { host: edgeHost, type: 'A', data: ip },
    ...names.map(host => ({ host, type: 'CNAME', data: edgeHost })),
  ];
  const observed = await Promise.all(desired.map(async item => ({ ...item, records: await read(item.host) })));
  const correct = item => item.records[item.type].length === 1 &&
    item.records[item.type][0].data === item.data &&
    (item.type === 'A' ? item.records.CNAME.length === 0 : item.records.A.length === 0);
  const plan = observed.filter(item => !correct(item));
  if (!plan.length) {
    if (!dryRun && stateStore && state.pendingRecovery) await stateStore.write({ recovery: state.pendingRecovery });
    log(`Completed public DNS verification: ${names.length} CNAMEs -> ${edgeHost} -> ${ip}; zero GoDaddy requests`);
    return [];
  }
  // Check all names before modifying anything. Never remove unrelated record types.
  for (const item of plan) {
    item.records = await read(item.host, { conflicts: true });
    if (item.type === 'A' && (item.records.CNAME.length || item.records.A.length > 1)) {
      throw new Error(`Shared edge ${edgeHost} must have one A record and no CNAME`);
    }
    if (item.records.CNAME.length > 1 || (item.records.A.length && item.records.CNAME.length) ||
      item.records.conflicts?.length) throw new Error(`Conflicting DNS records prevent conversion for ${item.host}`);
    item.name = item.host.slice(0, -(zone.length + 1));
    item.ttl = item.records.A[0]?.ttl ?? item.records.CNAME[0]?.ttl ?? 600;
    if (!validTtl(item.ttl)) throw new Error(`Unexpected authoritative TTL for ${item.host}`);
    log(`PLAN ${item.host}: ${item.type} ${item.data}; ttl=${item.ttl}`);
  }
  if (dryRun) {
    log(`Completed dry run: ${plan.length} changes; zero GoDaddy requests`);
    return plan;
  }
  if (!validPat(token)) throw new Error('GoDaddy Domains v3 requires a Personal Access Token');
  if (!forceApiRetry && state.blockedUntil > now()) {
    throw new Error(`Public DNS needs updating; GoDaddy quota cooldown until ${new Date(state.blockedUntil).toISOString()}; zero GoDaddy requests`);
  }
  const recordsUrl = `${apiBase}/${encodeURIComponent(zone)}/dns-records`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' };
  async function goDaddy(method, url, host, body) {
    const response = await request(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) throw new Error(`GoDaddy v3 ${method} for ${host} returned HTTP ${response.status}`);
    return response;
  }
  async function currentRecords(item) {
    const records = [];
    for (let page = 1; page <= 10; page++) {
      const query = new URLSearchParams({ name: item.name, page: String(page), pageSize: '100' });
      const response = await goDaddy('GET', `${recordsUrl}?${query}`, item.host);
      const body = await response.json().catch(() => null);
      if (!Array.isArray(body?.items) || (body.links !== undefined && !Array.isArray(body.links))) {
        throw new Error(`Invalid GoDaddy v3 record list for ${item.host}`);
      }
      records.push(...body.items);
      if (!body.links?.some(link => link?.rel === 'next')) break;
      if (page === 10) throw new Error(`GoDaddy v3 record list exceeded page limit for ${item.host}`);
    }
    if (records.some(record => record?.name !== item.name || !['A', 'CNAME'].includes(record.type) ||
      typeof record.data !== 'string' || !validTtl(record.ttl) || typeof record.recordId !== 'string' || !record.recordId) ||
      new Set(records.map(record => record.recordId)).size !== records.length) {
      throw new Error(`Conflicting or invalid GoDaddy v3 records for ${item.host}`);
    }
    const observed = ['A', 'CNAME'].flatMap(type => item.records[type].map(record => `${type}:${record.data}`)).sort();
    const provider = records.map(({ type, data }) => `${type}:${data.toLowerCase().replace(/\.$/, '')}`).sort();
    if (JSON.stringify(observed) !== JSON.stringify(provider)) {
      throw new Error(`GoDaddy v3 and authoritative DNS disagree for ${item.host}; retry with a fresh plan`);
    }
    return records;
  }
  const recordUrl = record => `${recordsUrl}/${encodeURIComponent(record.recordId)}`;
  async function verify(item) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const records = await read(item.host);
      if (correct({ ...item, records })) return;
      if (attempt < 5) await pause(2000);
    }
    throw new Error(`Authoritative DNS verification pending for ${item.host}`);
  }
  // Discover IDs and check every changed owner for conflicts before the first write.
  const changes = [];
  for (const item of plan) {
    const fresh = await read(item.host, { conflicts: true });
    if (correct({ ...item, records: fresh })) {
      log(`${item.host} already has the desired ${item.type}; zero writes for this name`);
      continue;
    }
    if (JSON.stringify(fresh) !== JSON.stringify(item.records)) {
      throw new Error(`DNS changed during reconciliation for ${item.host}; retry with a fresh plan`);
    }
    const records = await currentRecords(item);
    // Keep the record already pointing to the WAN IP during any multi-A conversion.
    const previous = records.find(record => record.data === ip) ?? records[0];
    changes.push({ item, records, previous });
  }
  const originals = new Map((state.pendingRecovery?.records ?? []).map(entry => [entry.host, entry]));
  for (const { item, records } of changes) {
    if (!originals.has(item.host)) originals.set(item.host, { host: item.host, previous: records });
  }
  if (changes.length) await save({ pendingRecovery: { recordedAt: new Date(now()).toISOString(), records: [...originals.values()] } });

  // The shared A record is first: aliases are never directed to a missing target.
  for (const { item, records, previous } of changes) {
    const fresh = await read(item.host, { conflicts: true });
    if (correct({ ...item, records: fresh })) continue;
    if (JSON.stringify(fresh) !== JSON.stringify(item.records)) {
      throw new Error(`DNS changed during reconciliation for ${item.host}; retry with a fresh plan`);
    }
    const body = { name: item.name, type: item.type, ttl: previous?.ttl ?? item.ttl,
      data: item.type === 'CNAME' ? `${item.data}.` : item.data };
    // Leave one A in place until v3 replaces it with the CNAME in a single PUT.
    for (const extra of records.filter(record => record !== previous)) {
      await goDaddy('DELETE', recordUrl(extra), item.host);
    }
    await goDaddy(previous ? 'PUT' : 'POST', previous ? recordUrl(previous) : recordsUrl, item.host, body);
    await verify(item);
    log(`UPDATED ${item.host}: ${item.type} ${item.data}; verified through authoritative DNS`);
  }
  if (stateStore) await stateStore.write({ recovery: state.pendingRecovery ?? state.recovery });
  log(`Completed reconciliation: shared A ${edgeHost} -> ${ip}; ${apiReads} GoDaddy v3 reads, ${apiWrites} writes`);

  return plan;
}

// ConfigMap mounts are symlinks; compare resolved paths so the Job runs the CLI.
if (process.argv[1] && import.meta.url === pathToFileURL(await realpath(process.argv[1])).href) {
  try {
    const hosts = JSON.parse(await readFile(process.env.HOSTS_FILE ?? '/hosts/public-hosts.json', 'utf8'));
    const dryRun = process.env.DRY_RUN !== 'false';
    const token = dryRun ? undefined : (await readFile(process.env.TOKEN_FILE ?? '/credentials/token', 'utf8')).trim();
    await reconcile({ hosts, zone: process.env.DNS_ZONE ?? 'cormierconsulting.io', token,
      dryRun,
      stateStore: dryRun ? undefined : fileState(process.env.STATE_FILE ?? '/state/godaddy-v3-quota.json'),
      forceApiRetry: process.env.FORCE_API_RETRY === 'true' });
  } catch (error) {
    // Credential values and upstream response bodies must never enter logs.
    const message = error instanceof SyntaxError ? 'Invalid hostname-list JSON' :
      error.code ? 'Could not read updater configuration' : error.message;
    console.error(`ERROR: ${message}`);
    process.exitCode = 1;
  }
}
