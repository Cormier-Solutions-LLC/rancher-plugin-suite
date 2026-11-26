import { readFile, realpath } from 'node:fs/promises';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';

const apiBase = 'https://api.godaddy.com/v1/domains';
const ipServices = ['https://api.ipify.org', 'https://checkip.amazonaws.com'];

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
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const names = hostnames(hosts, zone);
  if (!names.length) { log('No public hostnames configured; no DNS changes'); return []; }
  if (!token || /[\r\n]/.test(token)) throw new Error('Invalid GoDaddy credential');
  const authorization = token.startsWith('gd_pat_') ? `Bearer ${token}` : `sso-key ${token}`;
  async function request(url, options = {}) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
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
  const headers = { Authorization: authorization, Accept: 'application/json' };
  async function records(type, name) {
    const url = `${apiBase}/${encodeURIComponent(zone)}/records/${type}/${encodeURIComponent(name)}`;
    const response = await request(url, { headers });
    if (!response.ok) throw new Error(`GoDaddy ${type} read returned HTTP ${response.status}`);
    let data;
    try { data = await response.json(); } catch { throw new Error('Invalid GoDaddy DNS response'); }
    if (!Array.isArray(data) || data.some(r => r.type !== type || r.name !== name || typeof r.data !== 'string')) {
      throw new Error('Unexpected GoDaddy DNS record identity');
    }
    return data;
  }
  // One paginated zone snapshot replaces two API reads per hostname on every run.
  // An unchanged zone with fewer than 500 records costs only one GoDaddy request.
  const snapshot = [];
  for (let offset = 0; ; offset += 500) {
    const response = await request(`${apiBase}/${encodeURIComponent(zone)}/records?limit=500&offset=${offset}`, { headers });
    if (!response.ok) throw new Error(`GoDaddy zone read returned HTTP ${response.status}`);
    let page;
    try { page = await response.json(); } catch { throw new Error('Invalid GoDaddy DNS response'); }
    if (!Array.isArray(page) || page.some(r => typeof r.name !== 'string' || typeof r.type !== 'string' || typeof r.data !== 'string')) {
      throw new Error('Unexpected GoDaddy zone snapshot');
    }
    snapshot.push(...page);
    if (page.length < 500) break;
    if (offset >= 9500) throw new Error('GoDaddy zone exceeds snapshot safety limit');
  }
  // Validate every selected name before making any writes.
  const plan = [];
  for (const host of names) {
    const name = host.slice(0, -(zone.length + 1));
    const existing = snapshot.filter(r => r.type === 'A' && r.name === name);
    const aliases = snapshot.filter(r => r.type === 'CNAME' && r.name === name);
    if (aliases.length) {
      const aliasTarget = aliases[0].data.toLowerCase().replace(/\.$/, '');
      if (aliases.length !== 1 || existing.length || !names.includes(aliasTarget)) {
        throw new Error(`Refusing to replace CNAME for ${host}; target must be another managed hostname`);
      }
      plan.push({ host, name, aliasTarget });
      continue;
    }
    if (existing.length > 1) throw new Error(`Refusing to replace multiple A records for ${host}`);
    const ttl = existing[0]?.ttl ?? 600;
    if (!Number.isInteger(ttl) || ttl < 600 || ttl > 86400) throw new Error(`Unexpected DNS TTL for ${host}`);
    plan.push({ host, name, previous: existing[0]?.data ?? null, ip, ttl });
  }
  for (const item of plan.filter(item => item.aliasTarget)) {
    const seen = new Set([item.host]);
    let target = item.aliasTarget;
    while (target) {
      if (seen.has(target)) throw new Error('CNAME loop in managed public hostnames');
      seen.add(target);
      target = plan.find(candidate => candidate.host === target)?.aliasTarget;
    }
  }
  for (const item of plan) {
    if (item.aliasTarget) { log(`${item.host} preserved as CNAME -> ${item.aliasTarget} (managed target)`); continue; }
    if (item.previous === ip) { log(`${item.host} already points to ${ip}`); continue; }
    if (dryRun) { log(`DRY RUN ${item.host}: ${item.previous ?? '(missing)'} -> ${ip}; ttl=${item.ttl}`); continue; }
    // PUT atomically replaces only the A record set for this exact hostname.
    const url = `${apiBase}/${encodeURIComponent(zone)}/records/A/${encodeURIComponent(item.name)}`;
    const response = await request(url, {
      method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ data: ip, ttl: item.ttl }]),
    });
    if (!response.ok) throw new Error(`GoDaddy update for ${item.host} returned HTTP ${response.status}`);
    const verified = await records('A', item.name);
    if (verified.length !== 1 || verified[0].data !== ip || verified[0].ttl !== item.ttl) {
      throw new Error(`GoDaddy read-back verification failed for ${item.host}`);
    }
    log(`UPDATED ${item.host}: ${item.previous ?? '(missing)'} -> ${ip}; ttl=${item.ttl}; verified`);
  }
  log(`Completed ${dryRun ? 'dry run' : 'reconciliation'}: ${plan.length} hostnames, public IPv4 ${ip}`);
  return plan;
}

// ConfigMap mounts are symlinks; compare resolved paths so the Job runs the CLI.
if (process.argv[1] && import.meta.url === pathToFileURL(await realpath(process.argv[1])).href) {
  try {
    const hosts = JSON.parse(await readFile(process.env.HOSTS_FILE ?? '/hosts/public-hosts.json', 'utf8'));
    const token = (await readFile(process.env.TOKEN_FILE ?? '/credentials/token', 'utf8')).trim();
    await reconcile({ hosts, zone: process.env.DNS_ZONE ?? 'cormierconsulting.io', token,
      dryRun: process.env.DRY_RUN !== 'false' });
  } catch (error) {
    // Credential values and upstream response bodies must never enter logs.
    const message = error instanceof SyntaxError ? 'Invalid hostname-list JSON' :
      error.code ? 'Could not read updater configuration' : error.message;
    console.error(`ERROR: ${message}`);
    process.exitCode = 1;
  }
}
