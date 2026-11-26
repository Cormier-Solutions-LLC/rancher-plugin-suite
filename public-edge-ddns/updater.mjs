import { readFile, realpath, writeFile, rename } from 'node:fs/promises';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';
import { authoritativeReader } from './authoritative-dns.mjs';

const apiBase = 'https://api.godaddy.com/v1/domains';
const ipServices = ['https://api.ipify.org', 'https://checkip.amazonaws.com'];
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
  if (!token || /[\r\n]/.test(token)) throw new Error('Invalid GoDaddy credential');
  const authorization = token.startsWith('gd_pat_') ? `Bearer ${token}` : `sso-key ${token}`;
  let apiRequests = 0;
  async function request(url, options = {}) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        if (new URL(url).hostname === 'api.godaddy.com') {
          apiRequests++;
          log(`GoDaddy request ${apiRequests}: ${options.method ?? 'GET'} ${new URL(url).pathname}`);
        }
        response = await fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
      } catch (error) {
        if (attempt < 2) { await pause(1000 * (attempt + 1)); continue; }
        const code = error?.cause?.code;
        const safeCode = typeof code === 'string' && /^[A-Z_0-9]{1,50}$/.test(code) ? ` (${code})` : '';
        throw new Error(`DNS updater network request failed for ${new URL(url).hostname}${safeCode}`);
      }
      if (response.status === 429) {
        const body = await response.clone().json().catch(() => ({}));
        if (body.code === 'QUOTA_EXCEEDED' && /month/i.test(body.message ?? '')) {
          const nextMonth = new Date(now());
          const blockedUntil = Math.min(now() + 86400000,
            Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 1));
          await save({ blockedUntil });
          throw new Error('GoDaddy monthly API quota exhausted (QUOTA_EXCEEDED); restore account quota');
        }
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
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
    if (!Number.isInteger(item.ttl) || item.ttl < 600 || item.ttl > 86400) throw new Error(`Unexpected authoritative TTL for ${item.host}`);
    log(`PLAN ${item.host}: ${item.type} ${item.data}; ttl=${item.ttl}`);
  }
  if (dryRun) {
    log(`Completed dry run: ${plan.length} changes; zero GoDaddy requests`);
    return plan;
  }
  if (!forceApiRetry && state.blockedUntil > now()) {
    throw new Error(`Public DNS needs updating; GoDaddy quota cooldown until ${new Date(state.blockedUntil).toISOString()}; zero GoDaddy requests`);
  }
  await save({ recovery: { recordedAt: new Date(now()).toISOString(),
    records: plan.map(item => ({ host: item.host, previous: item.records })) } });
  const headers = { Authorization: authorization, Accept: 'application/json', 'Content-Type': 'application/json' };
  async function put(type, name, records) {
    const url = `${apiBase}/${encodeURIComponent(zone)}/records/${type}/${encodeURIComponent(name)}`;
    const response = await request(url, { method: 'PUT', headers, body: JSON.stringify(records) });
    if (!response.ok) throw new Error(`GoDaddy ${type} update returned HTTP ${response.status}`);
  }
  async function verify(item) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const records = await read(item.host);
      if (correct({ ...item, records })) return;
      if (attempt < 5) await pause(2000);
    }
    throw new Error(`Authoritative DNS verification pending for ${item.host}`);
  }
  // The shared A record is first: aliases are never directed to a missing target.
  for (const item of plan) {
    const fresh = await read(item.host, { conflicts: true });
    if (correct({ ...item, records: fresh })) {
      log(`${item.host} already has the desired ${item.type}; zero writes for this name`);
      continue;
    }
    if (JSON.stringify(fresh) !== JSON.stringify(item.records)) {
      throw new Error(`DNS changed during reconciliation for ${item.host}; retry with a fresh plan`);
    }
    if (item.type === 'CNAME' && item.records.A.length) {
      // GoDaddy cannot hold A and CNAME at the same owner. Journal the exact old
      // A records before deleting them, then restore them if CNAME creation fails.
      const previous = item.records.A.map(r => ({ data: r.data, ttl: r.ttl }));
      await save({ migration: { host: item.host, previousA: previous } });
      const url = `${apiBase}/${encodeURIComponent(zone)}/records/A/${encodeURIComponent(item.name)}`;
      const response = await request(url, { method: 'DELETE', headers });
      if (!response.ok) throw new Error(`GoDaddy A removal returned HTTP ${response.status}`);
      try { await put('CNAME', item.name, [{ data: edgeHost, ttl: item.ttl }]); }
      catch (error) {
        const current = await read(item.host);
        if (current.CNAME.length === 1 && current.CNAME[0].data === edgeHost) {
          log(`CNAME write confirmed by authoritative DNS despite API error for ${item.host}`);
        } else if (!current.CNAME.length) {
          try { await put('A', item.name, previous); log(`Restored previous A records for ${item.host}`); }
          catch { throw new Error(`CNAME migration failed for ${item.host}; saved A-record recovery is in quota state`); }
          throw error;
        } else throw error;
      }
    } else {
      await put(item.type, item.name, [{ data: item.data, ttl: item.ttl }]);
    }
    await verify(item);
    await save({ migration: null });
    log(`UPDATED ${item.host}: ${item.type} ${item.data}; verified through authoritative DNS`);
  }
  if (stateStore) await stateStore.write({ recovery: state.recovery });
  log(`Completed reconciliation: ${plan.length} changes; shared A ${edgeHost} -> ${ip}; ${apiRequests} GoDaddy write requests, zero API reads`);

  return plan;
}

// ConfigMap mounts are symlinks; compare resolved paths so the Job runs the CLI.
if (process.argv[1] && import.meta.url === pathToFileURL(await realpath(process.argv[1])).href) {
  try {
    const hosts = JSON.parse(await readFile(process.env.HOSTS_FILE ?? '/hosts/public-hosts.json', 'utf8'));
    const token = (await readFile(process.env.TOKEN_FILE ?? '/credentials/token', 'utf8')).trim();
    await reconcile({ hosts, zone: process.env.DNS_ZONE ?? 'cormierconsulting.io', token,
      dryRun: process.env.DRY_RUN !== 'false',
      stateStore: fileState(process.env.STATE_FILE ?? '/state/quota.json'),
      forceApiRetry: process.env.FORCE_API_RETRY === 'true' });
  } catch (error) {
    // Credential values and upstream response bodies must never enter logs.
    const message = error instanceof SyntaxError ? 'Invalid hostname-list JSON' :
      error.code ? 'Could not read updater configuration' : error.message;
    console.error(`ERROR: ${message}`);
    process.exitCode = 1;
  }
}
