import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reconcile, publicIPv4, hostnames, fileState } from './updater.mjs';
import { authoritativeReader } from './authoritative-dns.mjs';

const zone = 'example.com', edge = `ddns_edge.${zone}`, ip = '24.162.104.154';
const hosts = ['app.example.com', 'other.example.com'];
const record = (A = [], CNAME = [], conflicts = []) => ({ A, CNAME, conflicts });
const address = (data = ip, ttl = 600) => ({ data, ttl });
function fixture(initial = {
  [edge]: record([address()]), [hosts[0]]: record([], [address(edge)]), [hosts[1]]: record([], [address(edge)]),
}) {
  const db = structuredClone(initial), calls = [], logs = []; let saved = {};
  const stateStore = { read: async () => structuredClone(saved), write: async value => { saved = structuredClone(value); } };
  const fetcher = async (url, options = {}) => {
    if (url === 'https://api.ipify.org' || url === 'https://checkip.amazonaws.com') return new Response(ip);
    assert.equal(new URL(url).hostname, 'api.godaddy.com');
    assert.notEqual(options.method ?? 'GET', 'GET', 'No GoDaddy API reads allowed');
    calls.push({ url, method: options.method, body: options.body ? JSON.parse(options.body) : null });
    const path = new URL(url).pathname.split('/'), type = path.at(-2), host = `${decodeURIComponent(path.at(-1))}.${zone}`;
    db[host] ??= record();
    if (options.method === 'DELETE') db[host][type] = [];
    else {
      if (type === 'CNAME' && db[host].A.length) return new Response(null, { status: 422 });
      db[host][type] = JSON.parse(options.body);
    }
    return new Response(null, { status: 204 });
  };
  return { db, calls, logs, saved: () => saved, options: {
    hosts, zone, token: 'synthetic:credential', dryRun: false, fetcher,
    dnsReader: async host => structuredClone(db[host] ?? record()), stateStore,
    pause: async () => {}, log: message => logs.push(message), now: () => Date.UTC(2026, 10, 25),
  } };
}
test('validates names and accepts the exact underscore edge owner', async () => {
  assert.throws(() => hostnames(['evil.example.net'], zone));
  assert.throws(() => hostnames(['*.example.com'], zone));
  const f = fixture(); await reconcile(f.options); assert.equal(f.calls.length, 0);
  await assert.rejects(reconcile({ ...f.options, edgeHost: 'outside.example.net' }), /Invalid shared edge/);
  await assert.rejects(reconcile({ ...f.options, edgeHost: hosts[0] }), /self-referencing/);
});
test('rejects private, reserved, malformed and IPv6 addresses', () => {
  for (const value of ['10.0.0.1', '192.168.1.1', '172.16.1.1', '100.64.1.1', '127.0.0.1', '169.254.1.1',
    '198.51.100.1', '203.0.113.1', '224.0.0.1', '255.255.255.255', '1.2.3.999', '::1']) assert.equal(publicIPv4(value), false);
  assert.equal(publicIPv4(ip), true);
});
test('correct topology uses zero GoDaddy requests', async () => {
  const f = fixture(); assert.deepEqual(await reconcile(f.options), []);
  assert.equal(f.calls.length, 0); assert.match(f.logs.at(-1), /zero GoDaddy requests/);
});
test('WAN changes update exactly one A owner and leave all aliases unchanged', async () => {
  const f = fixture(); f.db[edge].A = [address('68.203.6.96', 1200)]; await reconcile(f.options);
  assert.equal(f.calls.length, 1); assert.match(f.calls[0].url, /\/A\/ddns_edge$/);
  assert.deepEqual(f.calls[0].body, [address(ip, 1200)]);
});
test('creates edge before aliases and never creates application A records', async () => {
  const f = fixture({}); await reconcile(f.options);
  assert.equal(f.calls.length, 3); assert.match(f.calls[0].url, /\/A\/ddns_edge$/);
  assert.ok(f.calls.slice(1).every(c => /\/CNAME\//.test(c.url)));
});
test('converts existing A records and retargets chained aliases', async () => {
  const f = fixture(); f.db[hosts[0]] = record([address('68.203.6.96', 1200)]);
  f.db[hosts[1]] = record([], [address(hosts[0])]); await reconcile(f.options);
  assert.deepEqual(f.calls.map(c => c.method), ['DELETE', 'PUT', 'PUT']);
  assert.equal(f.db[hosts[0]].CNAME[0].ttl, 1200);
  assert.ok(hosts.every(host => !f.db[host].A.length && f.db[host].CNAME[0].data === edge));
});
test('dry run plans changes without API requests or state changes', async () => {
  const f = fixture({}); assert.equal((await reconcile({ ...f.options, dryRun: true })).length, 3);
  assert.equal(f.calls.length, 0); assert.deepEqual(f.saved(), {});
});
test('new names are detected without provider reads', async () => {
  const f = fixture(); f.options.hosts = [...hosts, 'new.example.com']; await reconcile(f.options);
  assert.equal(f.calls.length, 1); assert.match(f.calls[0].url, /\/CNAME\/new$/);
});
test('conflicting record types fail complete preflight before any writes', async () => {
  for (const type of ['AAAA', 'TXT', 'MX', 'CAA', 'NS']) {
    const f = fixture(); f.db[edge].A = [address('68.203.6.96')]; f.db[hosts[0]] = record([address()], [], [type]);
    await assert.rejects(reconcile(f.options), /Conflicting DNS/); assert.equal(f.calls.length, 0);
  }
});
test('DNS failures fail closed before API mutation', async () => {
  const f = fixture(); f.options.dnsReader = async () => { throw new Error('Authoritative DNS servers disagree'); };
  await assert.rejects(reconcile(f.options), /disagree/); assert.equal(f.calls.length, 0);
});
test('IP service disagreement prevents mutation', async () => {
  const f = fixture({}), original = f.options.fetcher;
  f.options.fetcher = (url, options) => url.includes('amazonaws') ? new Response('68.203.6.96') : original(url, options);
  await assert.rejects(reconcile(f.options), /services disagree/); assert.equal(f.calls.length, 0);
});
test('monthly quota persists cooldown, while preview remains API-free', async () => {
  const f = fixture({}), original = f.options.fetcher; let attempts = 0;
  f.options.fetcher = (url, options) => {
    if (!url.includes('godaddy')) return original(url, options);
    attempts++; return Response.json({ code: 'QUOTA_EXCEEDED', message: 'monthly quota exceeded' }, { status: 429 });
  };
  await assert.rejects(reconcile(f.options), /monthly API quota/);
  await assert.rejects(reconcile(f.options), /cooldown.*zero GoDaddy requests/);
  await reconcile({ ...f.options, dryRun: true }); assert.equal(attempts, 1);
  await assert.rejects(reconcile({ ...f.options, forceApiRetry: true }), /monthly API quota/); assert.equal(attempts, 2);
});
test('CNAME failure restores original A data and TTL and retains recovery journal', async () => {
  const f = fixture(), original = f.options.fetcher; f.db[hosts[0]] = record([address('68.203.6.96', 1200)]);
  f.options.fetcher = (url, options) => url.includes('/CNAME/app') ? new Response(null, { status: 422 }) : original(url, options);
  await assert.rejects(reconcile(f.options), /HTTP 422/);
  assert.deepEqual(f.db[hosts[0]].A, [address('68.203.6.96', 1200)]);
  assert.deepEqual(f.saved().migration.previousA, [address('68.203.6.96', 1200)]);
});
test('ambiguous CNAME writes are verified through DNS before attempting rollback', async () => {
  const f = fixture(), original = f.options.fetcher; f.db[hosts[0]] = record([address()]);
  f.options.fetcher = async (url, options) => {
    const result = await original(url, options); return url.includes('/CNAME/app') ? new Response(null, { status: 422 }) : result;
  };
  await reconcile(f.options); assert.equal(f.db[hosts[0]].A.length, 0);
});
test('failed DNS read-back is not reported as success', async () => {
  const f = fixture({}), original = f.options.fetcher;
  f.options.fetcher = (url, options) => url.includes('godaddy') ? new Response(null, { status: 204 }) : original(url, options);
  await assert.rejects(reconcile(f.options), /verification pending/);
});
test('transport failures retry safely without exposing credentials', async () => {
  const f = fixture({}), original = f.options.fetcher; let attempts = 0;
  f.options.fetcher = (url, options) => {
    if (url.includes('godaddy') && ++attempts < 3) throw new Error('synthetic:credential'); return original(url, options);
  };
  await reconcile(f.options); assert.equal(attempts, 5);
});
test('quota state survives reopening the file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ddns-edge-'));
  try { const path = join(directory, 'state.json'); await fileState(path).write({ blockedUntil: 1234 });
    assert.deepEqual(await fileState(path).read(), { blockedUntil: 1234 });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('authoritative reader bypasses split DNS and does not follow aliases for A records', async () => {
  const servers = [];
  const request = async url => {
    const u = new URL(url), name = u.searchParams.get('name'), type = Number(u.searchParams.get('type'));
    const data = type === 2 ? ['ns71.domaincontrol.com.', 'ns72.domaincontrol.com.'] : [name.includes('71') ? '8.8.8.8' : '1.1.1.1'];
    return Response.json({ Status: 0, Answer: data.map(value => ({ name, type, data: value })) });
  };
  const read = await authoritativeReader({ zone, request, publicIPv4, resolverFactory: () => ({
    setServers: value => servers.push(value), resolveCname: async () => [edge + '.'],
    resolve4: async () => { throw new Error('must not follow aliases'); },
  }) });
  assert.deepEqual((await read(hosts[0])).CNAME, [address(edge)]); assert.equal(servers.length, 2);
});
test('authoritative reader refuses conflicting delegation before contacting DNS servers', async () => {
  const request = async url => Response.json({ Status: 0, Answer: [{ name: zone, type: 2,
    data: url.includes('cloudflare') ? 'ns71.domaincontrol.com' : 'ns72.domaincontrol.com' }] });
  await assert.rejects(authoritativeReader({ zone, request, publicIPv4, resolverFactory: () => {
    throw new Error('must not construct DNS clients');
  } }), /disagree/);
});
test('authoritative reader refuses private nameserver IP addresses', async () => {
  const request = async url => {
    const u = new URL(url), name = u.searchParams.get('name'), type = Number(u.searchParams.get('type'));
    return Response.json({ Status: 0, Answer: (type === 2 ? ['ns71.domaincontrol.com', 'ns72.domaincontrol.com'] : ['10.0.0.1'])
      .map(data => ({ name, type, data })) });
  };
  await assert.rejects(authoritativeReader({ zone, request, publicIPv4 }), /Invalid authoritative/);
});
test('concurrent changes are not overwritten by an old plan', async () => {
  const f = fixture(), original = f.options.dnsReader; f.db[hosts[0]] = record([address()]); let count = 0;
  f.options.dnsReader = async (host, options) => {
    if (host === hosts[0] && ++count === 3) f.db[host].A = [address('68.203.6.96')];
    return original(host, options);
  };
  await assert.rejects(reconcile(f.options), /DNS changed during reconciliation/); assert.equal(f.calls.length, 0);
});
