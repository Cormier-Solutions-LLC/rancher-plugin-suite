import { createServer, request as httpRequest } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createSsoClient } from './access-client/index.mjs';
import { createAccountStateClient } from './access-client/account-state.mjs';

const callbackPath = '/_access/callback';
const sessionCookie = '__Host-qbt-access';
const flowCookie = '__Host-qbt-access-flow';
const sessionLifetime = 8 * 60 * 60;
const token = () => randomBytes(32).toString('base64url');
const digest = value => createHash('sha256').update(value).digest('hex');
const validToken = value => /^[a-zA-Z0-9_-]{43}$/.test(value ?? '');

function cookie(req, name) {
  const matches = (req.headers.cookie ?? '').split(';').map(cookie => cookie.trim())
    .filter(value => value.startsWith(name + '='));
  return matches.length === 1 ? matches[0].slice(name.length + 1) : null;
}

function setCookie(name, value, age) {
  return [name + '=' + value, 'Path=/', 'Secure', 'HttpOnly', 'SameSite=Lax', 'Max-Age=' + age].join('; ');
}

function boundedStore(limit) {
  const records = new Map();
  return {
    get(id) {
      const record = records.get(id);
      if (record && record.expires > Date.now()) return record;
      records.delete(id);
    },
    put(id, record) {
      for (const [key, value] of records) if (value.expires <= Date.now()) records.delete(key);
      if (!records.has(id) && records.size >= limit) records.delete(records.keys().next().value);
      records.set(id, record);
    },
    delete(id) { records.delete(id); },
  };
}

function reply(res, status, text, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...headers });
  return res.end(text);
}

function signInPage(res) {
  return reply(res, 200, '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>qBittorrent</title></head><body><main><h1>qBittorrent</h1><a href="/_access/login">Sign in with Cormier Access</a></main></body></html>',
    { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" });
}

function forward(req, res, path, config, session) {
  const headers = { host: new URL(config.origin).host, authorization: config.authorization };
  for (const name of ['accept', 'accept-encoding', 'content-type', 'content-length', 'range', 'user-agent', 'if-modified-since', 'if-none-match']) {
    if (req.headers[name] !== undefined) headers[name] = req.headers[name];
  }
  if (session.backendCookie) headers.cookie = session.backendCookie;
  if (req.headers.origin === config.origin) headers.origin = config.origin;
  if (typeof req.headers.referer === 'string' && req.headers.referer.startsWith(config.origin + '/')) headers.referer = req.headers.referer;

  const upstream = httpRequest(config.upstream, { method: req.method, path, headers, timeout: 30_000 }, response => {
    const cookies = response.headers['set-cookie'] ?? [];
    const sid = cookies.map(value => value.split(';', 1)[0]).find(value => /^QBT_SID_\d+=[\w-]+$/.test(value));
    if (sid) session.backendCookie = sid;
    const output = { 'cache-control': 'no-store' };
    for (const name of ['content-type', 'content-length', 'content-encoding', 'content-disposition', 'content-range',
      'accept-ranges', 'content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'etag', 'last-modified']) {
      if (response.headers[name] !== undefined) output[name] = response.headers[name];
    }
    if (response.headers.location) {
      let target;
      try { target = new URL(response.headers.location, config.origin); } catch {}
      if (!target || target.origin !== config.origin) {
        response.resume();
        return reply(res, 502, 'Unexpected qBittorrent redirect.');
      }
      output.location = target.pathname + target.search + target.hash;
    }
    res.writeHead(response.statusCode, output);
    response.on('error', () => res.destroy());
    response.pipe(res);
  });
  upstream.on('timeout', () => upstream.destroy());
  upstream.on('error', () => {
    if (res.headersSent) res.destroy();
    else reply(res, 502, 'qBittorrent could not be reached.');
  });
  res.on('close', () => upstream.destroy());
  req.on('error', () => upstream.destroy());
  req.pipe(upstream);
}

export function createGateway(config, dependencies) {
  const flows = boundedStore(1024);
  const sessions = boundedStore(64);
  const sso = dependencies.sso ?? createSsoClient(config.sso, {
    async put(record) { flows.put(record.stateHash, { ...record, expires: Date.parse(record.expiresAt) }); },
    async consume(hash, browser) {
      const record = flows.get(hash);
      if (record?.browserHash !== browser) return null;
      flows.delete(hash);
      return record;
    },
  });
  const accounts = dependencies.accounts ?? createAccountStateClient(config.sso);
  const host = new URL(config.origin).host;

  return createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/_access/health') return reply(res, 200, 'ok');
      if (req.headers.host !== host || !req.url.startsWith('/') || req.url.startsWith('//') ||
          /[\\\x00-\x20]/.test(req.url)) return reply(res, 400, 'Invalid request.');
      const url = new URL(config.origin + req.url);

      if (req.method === 'GET' && url.pathname === '/_access/login') {
        const flow = await sso.begin({ returnTo: url.searchParams.get('verify') === '1' ? '/_access/verify' : '/' });
        return reply(res, 303, '', { Location: flow.url, 'Set-Cookie': setCookie(flowCookie, flow.browserToken, 300) });
      }
      if (req.method === 'GET' && url.pathname === callbackPath) {
        let identity, returnTo;
        try { ({ identity, returnTo } = await sso.callback({ url: url.href, browserToken: cookie(req, flowCookie) })); }
        catch { return reply(res, 401, 'Access sign-in expired or could not be verified.', { 'Set-Cookie': setCookie(flowCookie, '', 0) }); }
        if (identity.issuer !== config.sso.issuer || identity.subject !== config.owner || identity.god !== true) {
          return reply(res, 403, 'This Web UI requires the Cormier Access God account.', { 'Set-Cookie': setCookie(flowCookie, '', 0) });
        }
        const current = await accounts.get(identity.subject, { fresh: true });
        if (!current.enabled || !current.emailVerified || current.credentialStamp !== identity.credentialStamp) {
          return reply(res, 401, 'Sign in again through Cormier Access.');
        }
        const id = token();
        sessions.put(digest(id), { stamp: identity.credentialStamp, expires: Date.now() + sessionLifetime * 1000 });
        return reply(res, 303, '', { Location: returnTo === '/_access/verify' ? '/_access/verify' : '/', 'Set-Cookie': [
          setCookie(flowCookie, '', 0), setCookie(sessionCookie, id, sessionLifetime),
        ] });
      }

      const id = cookie(req, sessionCookie);
      const key = validToken(id) ? digest(id) : null;
      const session = key && sessions.get(key);
      if (!session || !await accounts.validate(config.owner, session.stamp)) {
        if (key) sessions.delete(key);
        if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/_access/sign-in')) return signInPage(res);
        return reply(res, 401, 'Sign in with Cormier Access.');
      }
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== config.origin) {
        return reply(res, 403, 'This request must come from the qBittorrent site.');
      }
      if (req.method === 'POST' && url.pathname === '/api/v2/auth/logout') {
        sessions.delete(key);
        return reply(res, 204, '', { 'Set-Cookie': setCookie(sessionCookie, '', 0) });
      }
      if (req.method === 'GET' && url.pathname === '/_access/verify') return forward(req, res, '/api/v2/app/version', config, session);
      if (url.pathname.startsWith('/_access/') || url.pathname === '/api/v2/auth/login') return reply(res, 404, 'Not found.');
      return forward(req, res, url.pathname + url.search, config, session);
    } catch {
      if (res.headersSent) res.destroy();
      else reply(res, 503, 'The Access gateway could not verify this request.');
    }
  });
}

function configuration(env) {
  const httpsOrigin = value => {
    const url = new URL(value);
    if (url.origin !== value || url.protocol !== 'https:') throw Error('Expected an exact HTTPS origin.');
    return value;
  };
  const secret = name => readFileSync(env[name], 'utf8').trim();
  const origin = httpsOrigin(env.ACCESS_PUBLIC_ORIGIN);
  const upstream = new URL(env.QBITTORRENT_UPSTREAM);
  const owner = secret('ACCESS_OWNER_FILE');
  const password = secret('QBITTORRENT_PASSWORD_FILE');
  if (upstream.protocol !== 'http:' || upstream.href !== upstream.origin + '/' ||
      !/^usr_[A-Za-z0-9]{20,64}$/.test(owner) || password.length < 32) throw Error('Invalid gateway configuration.');
  return { origin, upstream, owner, authorization: 'Basic ' + Buffer.from('admin:' + password).toString('base64'),
    sso: { issuer: httpsOrigin(env.ACCESS_ISSUER), clientId: 'qbittorrent',
      clientSecret: secret('ACCESS_CLIENT_SECRET_FILE'), publicOrigin: origin, callbackPath,
      licensingOrigin: httpsOrigin(env.ACCESS_LICENSING_ORIGIN) } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  createGateway(configuration(process.env), {}).listen(8080, '0.0.0.0');
}
