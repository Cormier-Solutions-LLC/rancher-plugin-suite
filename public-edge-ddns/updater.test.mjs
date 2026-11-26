import test from 'node:test';
import assert from 'node:assert/strict';
import { hostnames, publicIPv4, reconcile } from './updater.mjs';

const zone = 'example.com', hosts = ['app.example.com', 'other.example.com'];
function fixture({ ip = '24.162.105.215', secondIp = ip, initial, alias = false } = {}) {
  const db = initial ?? {
    app: [{ name: 'app', type: 'A', data: '68.203.6.96', ttl: 1200 }],
    other: [{ name: 'other', type: 'A', data: ip, ttl: 600 }],
  };
  const writes = [], calls = [];
  const fetcher = async (input, options = {}) => {
    calls.push({ input, method: options.method ?? 'GET' });
    const url = new URL(input);
    if (url.hostname === 'api.ipify.org') return new Response(ip);
    if (url.hostname === 'checkip.amazonaws.com') return new Response(secondIp);
    if (url.pathname.endsWith('/records')) return Response.json([
      ...Object.values(db).flat(), ...(alias ? [{ name: 'other', type: 'CNAME', data: 'target.example.net' }] : []),
    ]);
    const parts = url.pathname.split('/'), name = decodeURIComponent(parts.at(-1)), type = parts.at(-2);
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body); writes.push({ name, type, body });
      db[name] = body.map(record => ({ ...record, name, type }));
      return new Response(null, { status: 200 });
    }
    return Response.json(type === 'CNAME' ? (alias ? [{ name, type, data: 'target.example.net' }] : []) : (db[name] ?? []));
  };
  return { db, writes, calls, options: { hosts, zone, token: 'synthetic:credential', fetcher, log: () => {}, pause: async () => {} } };
}

test('validates exact subdomains, rejects other zones, wildcard and path inputs', () => {
  assert.deepEqual(hostnames([hosts[0], hosts[0]], zone), [hosts[0]]);
  for (const host of ['example.com', 'example.com.evil.net', '*.example.com', 'x/../example.com', 'a..example.com']) {
    assert.throws(() => hostnames([host], zone));
  }
});
test('rejects private, reserved, malformed and IPv6 lookup results', () => {
  for (const ip of ['10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.169.254', '172.31.1.1', '192.168.1.1',
    '192.0.2.1', '198.51.100.1', '203.0.113.1', '224.1.1.1', '255.255.255.255', '1.2.3.999', '::1']) assert.equal(publicIPv4(ip), false, ip);
  assert.equal(publicIPv4('24.162.105.215'), true);
});
test('dry run returns exact change plan and never writes', async () => {
  const f = fixture(); const plan = await reconcile(f.options);
  assert.equal(plan[0].previous, '68.203.6.96'); assert.equal(plan[0].ttl, 1200); assert.equal(f.writes.length, 0);
});
test('updates only changed listed A record, preserves TTL and is idempotent', async () => {
  const f = fixture(); f.db.unrelated = [{ name: 'unrelated', type: 'TXT', data: 'preserved' }];
  await reconcile({ ...f.options, dryRun: false });
  assert.deepEqual(f.writes, [{ name: 'app', type: 'A', body: [{ data: '24.162.105.215', ttl: 1200 }] }]);
  assert.equal(f.db.unrelated[0].data, 'preserved');
  await reconcile({ ...f.options, dryRun: false }); assert.equal(f.writes.length, 1);
});
test('disagreeing public-IP services fail before any DNS writes', async () => {
  const f = fixture({ secondIp: '68.203.6.96' });
  await assert.rejects(reconcile({ ...f.options, dryRun: false }), /disagree/); assert.equal(f.writes.length, 0);
});
test('preflights all names and refuses multi-address or CNAME replacements', async () => {
  for (const alias of [true, false]) {
    const f = fixture({ alias });
    if (!alias) f.db.other.push({ ...f.db.other[0], data: '68.203.6.96' });
    await assert.rejects(reconcile({ ...f.options, dryRun: false }), /Refusing/); assert.equal(f.writes.length, 0);
  }
});
test('missing records are created with TTL 600 and verified', async () => {
  const f = fixture({ initial: {} }); await reconcile({ ...f.options, dryRun: false });
  assert.equal(f.writes.length, 2); assert.equal(f.db.app[0].ttl, 600);
});
test('preserves aliases to managed A records and updates their target', async () => {
  const f = fixture();
  f.db.other = [{ name: 'other', type: 'CNAME', data: 'app.example.com.' }];
  const plan = await reconcile({ ...f.options, dryRun: false });
  assert.equal(plan.find(x => x.name === 'other').aliasTarget, 'app.example.com');
  assert.equal(f.writes.length, 1); assert.equal(f.writes[0].name, 'app');
});
test('CNAME cycles fail before writes', async () => {
  const f = fixture({ initial: {
    app: [{ name: 'app', type: 'CNAME', data: hosts[1] }],
    other: [{ name: 'other', type: 'CNAME', data: hosts[0] }],
  } });
  await assert.rejects(reconcile({ ...f.options, dryRun: false }), /CNAME loop/); assert.equal(f.writes.length, 0);
});
test('empty allowlist makes no network calls', async () => {
  await reconcile({ hosts: [], zone, token: '', fetcher: () => { throw new Error('unexpected request'); }, log: () => {} });
});
test('HTTP failures and transport errors never expose credential or response bodies', async () => {
  const f = fixture(); const original = f.options.fetcher;
  f.options.fetcher = (url, options) => url.includes('godaddy') ? new Response('synthetic:credential', { status: 403 }) : original(url, options);
  await assert.rejects(reconcile({ ...f.options, dryRun: false }), error => /HTTP 403/.test(error.message) && !error.message.includes('credential'));
  f.options.fetcher = () => { throw new Error('synthetic:credential'); };
  await assert.rejects(reconcile(f.options), error => error.message.includes('DNS updater network request failed for') && !error.message.includes('credential'));
});
test('an unchanged zone costs one GoDaddy request regardless of hostname count', async () => {
  const f = fixture(); f.db.app[0].data = '24.162.105.215';
  await reconcile({ ...f.options, dryRun: false });
  assert.equal(f.calls.filter(c => c.input.includes('godaddy')).length, 1);
  assert.equal(f.writes.length, 0);
});
test('monthly quota exhaustion is explicit and is not retried', async () => {
  const f = fixture(), original = f.options.fetcher; let attempts = 0;
  f.options.fetcher = (url, options) => {
    if (!url.includes('godaddy')) return original(url, options);
    attempts++;
    return Response.json({ code: 'QUOTA_EXCEEDED', message: 'The monthly quota for requests has been exceeded.' }, { status: 429 });
  };
  await assert.rejects(reconcile(f.options), /monthly API quota exhausted/);
  assert.equal(attempts, 1); assert.equal(f.writes.length, 0);
});
test('transient network failures recover with bounded retries', async () => {
  const f = fixture(), original = f.options.fetcher; let attempts = 0;
  f.options.fetcher = (url, options) => {
    if (url.includes('godaddy') && ++attempts < 3) throw new Error('synthetic:credential');
    return original(url, options);
  };
  await reconcile(f.options); assert.equal(attempts, 3);
});
test('zone snapshots include later pages before validating selected names', async () => {
  const f = fixture(), original = f.options.fetcher; const offsets = [];
  f.options.fetcher = (url, options) => {
    const u = new URL(url);
    if (!u.pathname.endsWith('/records')) return original(url, options);
    offsets.push(u.searchParams.get('offset'));
    if (u.searchParams.get('offset') === '0') return Response.json(Array.from({ length: 500 }, (_, i) =>
      ({ type: 'TXT', name: `unrelated-${i}`, data: 'preserved', ttl: 600 })));
    return original(url, options);
  };
  const plan = await reconcile(f.options);
  assert.deepEqual(offsets, ['0', '500']); assert.equal(plan[0].previous, '68.203.6.96');
});
test('temporary rate limiting honors a bounded Retry-After delay', async () => {
  const f = fixture(), original = f.options.fetcher; let limited = true; const delays = [];
  f.options.pause = async ms => { delays.push(ms); };
  f.options.fetcher = (url, options) => {
    if (url.includes('godaddy') && limited) {
      limited = false;
      return Response.json({ code: 'TOO_MANY_REQUESTS' }, { status: 429, headers: { 'Retry-After': '999' } });
    }
    return original(url, options);
  };
  await reconcile(f.options); assert.deepEqual(delays, [10000]);
});
test('failed read-back fails the run rather than reporting success', async () => {
  const f = fixture(); const original = f.options.fetcher;
  f.options.fetcher = (url, options) => options?.method === 'PUT' ? new Response(null, { status: 200 }) : original(url, options);
  await assert.rejects(reconcile({ ...f.options, dryRun: false }), /read-back verification failed/);
});
