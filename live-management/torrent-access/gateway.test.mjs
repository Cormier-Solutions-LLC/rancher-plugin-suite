import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { createGateway } from './gateway.mjs';

const origin = 'https://torrent.example.test';
const issuer = 'https://access.example.test';
const stamp = 'a'.repeat(64);

async function fixture(t) {
  const upstreamRequests = [];
  const upstream = createServer((req, res) => {
    upstreamRequests.push({ path: req.url, headers: req.headers });
    res.writeHead(200, { 'Set-Cookie': 'QBT_SID_8090=private_sid; HttpOnly' });
    res.end('qBittorrent');
  }).listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  let identity = { issuer, subject: 'owner', god: true, credentialStamp: stamp };
  let currentStamp = stamp;
  const gateway = createGateway({
    origin, upstream: new URL('http://127.0.0.1:' + upstream.address().port),
    owner: 'owner', authorization: 'Basic fixture', sso: { issuer },
  }, {
    sso: {
      async begin() { return { url: issuer + '/auth', browserToken: 'flow' }; },
      async callback() { return { identity, returnTo: '/' }; },
    },
    accounts: {
      async get() { return { enabled: true, emailVerified: true, credentialStamp: currentStamp }; },
      async validate(subject, supplied) { return subject === 'owner' && supplied === currentStamp; },
    },
  }).listen(0, '127.0.0.1');
  await once(gateway, 'listening');
  t.after(() => { gateway.closeAllConnections(); upstream.closeAllConnections(); gateway.close(); upstream.close(); });
  return {
    upstreamRequests,
    changeIdentity(value) { identity = { ...identity, ...value }; },
    revoke() { currentStamp = 'b'.repeat(64); },
    fetch(path, options = {}) {
      return new Promise((resolve, reject) => {
        const req = httpRequest({
          hostname: '127.0.0.1', port: gateway.address().port, path,
          method: options.method ?? 'GET', headers: { host: new URL(origin).host, ...options.headers },
        }, res => {
          const headers = new Headers();
          for (let i = 0; i < res.rawHeaders.length; i += 2) headers.append(res.rawHeaders[i], res.rawHeaders[i + 1]);
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('error', reject);
          res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers })));
        });
        req.on('error', reject);
        req.end();
      });
    },
  };
}

test('reject anonymous backend requests even with a supplied local authorization or cookie', async t => {
  const app = await fixture(t);
  assert.equal((await app.fetch('/api/v2/torrents/info', { headers: { authorization: 'Basic attacker', cookie: 'QBT_SID_8090=attacker' } })).status, 401);
  assert.match(await (await app.fetch('/')).text(), /Sign in with Cormier Access/);
  assert.equal(app.upstreamRequests.length, 0);
});

test('only the exact issuer and canonical subject with boolean God can establish a session', async t => {
  const app = await fixture(t);
  for (const identity of [
    { issuer, subject: 'ordinary', god: true },
    { issuer, subject: 'owner', god: false },
    { issuer, subject: 'owner', god: 'true' },
    { issuer: 'https://untrusted.example.test', subject: 'owner', god: true },
  ]) {
    app.changeIdentity(identity);
    assert.equal((await app.fetch('/_access/callback')).status, 403);
  }
});

test('server-side upstream auth and cookie stay private and revoked Access sessions fail closed', async t => {
  const app = await fixture(t);
  const callback = await app.fetch('/_access/callback');
  assert.equal(callback.status, 303);
  const cookie = callback.headers.getSetCookie().find(value => value.startsWith('__Host-qbt-access=')).split(';')[0];
  const first = await app.fetch('/api/v2/app/version', { headers: { cookie: cookie + '; QBT_SID_8090=attacker', authorization: 'Basic attacker' } });
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('set-cookie'), null);
  assert.equal(app.upstreamRequests[0].headers.authorization, 'Basic fixture');
  assert.equal(app.upstreamRequests[0].headers.cookie, undefined);
  const invalid = await app.fetch('/api/v2/torrents/pause', { method: 'POST', headers: { cookie, origin: 'https://untrusted.example.test' } });
  assert.equal(invalid.status, 403);
  const second = await app.fetch('/api/v2/torrents/info', { headers: { cookie } });
  assert.equal(second.status, 200);
  assert.equal(app.upstreamRequests[1].headers.cookie, 'QBT_SID_8090=private_sid');
  app.revoke();
  assert.equal((await app.fetch('/api/v2/torrents/info', { headers: { cookie } })).status, 401);
  assert.equal(app.upstreamRequests.length, 2);
});
