import test from 'node:test';
import assert from 'node:assert/strict';
import { hostnames, publicIPv4, reconcile } from './updater.mjs';

const zone = 'example.com', hosts = ['app.example.com', 'other.example.com'];
function fixture({ ip = '24.162.105.215', secondIp = ip, initial, alias = false } = {}) {
  const db = initial ?? {
    app: [{ name: 'app', type: 'A', data: '68.203.6.96', ttl: 1200 }],
    other: [{ name: 'other', type: 'A', data: ip, ttl: 600 }],
  };
  const writes = [];
  const fetcher = async (input, options = {}) => {
    const url = new URL(input);
    if (url.hostname === 'api.ipify.org') return new Response(ip);
    if (url.hostname === 'checkip.amazonaws.com') return new Response(secondIp);
    const parts = url.pathname.split('/'), name = decodeURIComponent(parts.at(-1)), type = parts.at(-2);
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body); writes.push({ name, type, body });
      db[name] = body.map(record => ({ ...record, name, type }));
      return new Response(null, { status: 200 });
    }
    return Response.json(type === 'CNAME' ? (alias ? [{ name, type, data: 'target.example.net' }] : []) : (db[name] ?? []));
  };
  return { db, writes, options: { hosts, zone, token: 'synthetic:credential', fetcher, log: () => {} } };
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
  const f = fixture(); const original = f.options.fetcher;
  f.options.fetcher = (url, options) => url.endsWith('/CNAME/other') ?
    Response.json([{ name: 'other', type: 'CNAME', data: 'app.example.com.' }]) : original(url, options);
  delete f.db.other;
  const plan = await reconcile({ ...f.options, dryRun: false });
  assert.equal(plan.find(x => x.name === 'other').aliasTarget, 'app.example.com');
  assert.equal(f.writes.length, 1); assert.equal(f.writes[0].name, 'app');
});
test('CNAME cycles fail before writes', async () => {
  const f = fixture({ initial: {} }); const original = f.options.fetcher;
  f.options.fetcher = (url, options) => url.includes('/CNAME/') ? Response.json([{
    name: url.split('/').at(-1), type: 'CNAME', data: url.endsWith('/app') ? hosts[1] : hosts[0],
  }]) : original(url, options);
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
  await assert.rejects(reconcile(f.options), error => error.message === 'DNS updater network request failed');
});
test('failed read-back fails the run rather than reporting success', async () => {
  const f = fixture(); const original = f.options.fetcher;
  f.options.fetcher = (url, options) => options?.method === 'PUT' ? new Response(null, { status: 200 }) : original(url, options);
  await assert.rejects(reconcile({ ...f.options, dryRun: false }), /read-back verification failed/);
});
