import * as oidc from 'openid-client';
import { readFileSync } from 'node:fs';
import { createHash, createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
const digest = value => createHash('sha256').update(value).digest('hex');
const jsonClone = value => JSON.parse(JSON.stringify(value));
const fail = message => { throw new Error(message); };
function origin(value, allowHttp) {
  const url = new URL(value);
  if (url.origin !== value || (url.protocol !== 'https:' && !(allowHttp && url.hostname === '127.0.0.1'))) fail('An explicit HTTPS origin is required');
  return value;
}
function safeReturnTo(value) { return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/[\\\x00-\x1f]/.test(value) ? value.slice(0, 1000) : '/'; }
export function ssoOptionsFromEnv(env, defaults = {}) {
  const secret = env.CORMIER_ACCESS_CLIENT_SECRET_FILE ? readFileSync(env.CORMIER_ACCESS_CLIENT_SECRET_FILE, 'utf8').trim() : env.CORMIER_ACCESS_CLIENT_SECRET;
  const issuer = env.CORMIER_ACCESS_ISSUER;
  if (!issuer && !secret) return undefined;
  return { issuer, clientId: env.CORMIER_ACCESS_CLIENT_ID || defaults.clientId, clientSecret: secret,
    publicOrigin: env.CORMIER_ACCESS_PUBLIC_ORIGIN || defaults.publicOrigin, callbackPath: '/api/auth/sso/callback',
    licensingOrigin: env.CORMIER_LICENSING_URL || defaults.licensingOrigin, allowLocalHttpForTests: env.NODE_ENV === 'test' };
}
export function createSsoClient(config, store) {
  const allowHttp = config.allowLocalHttpForTests === true;
  const issuer = origin(config.issuer, allowHttp), publicOrigin = origin(config.publicOrigin, allowHttp), licensingOrigin = origin(config.licensingOrigin, allowHttp);
  if (typeof config.clientId !== 'string' || !config.clientId || typeof config.clientSecret !== 'string' || config.clientSecret.length < 32) fail('SSO client credentials are incomplete');
  const callbackPath = config.callbackPath || '/api/auth/sso/callback';
  if (!/^\/[a-z0-9/_.-]+$/i.test(callbackPath)) fail('Invalid SSO callback path');
  const redirectUri = publicOrigin + callbackPath;
  const key = Buffer.from(hkdfSync('sha256', config.clientSecret, issuer, 'cormier-access-state.v1:' + config.clientId, 32));
  const aad = Buffer.from(issuer + ':' + config.clientId + ':' + redirectUri);
  function seal(value) { const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key, iv); c.setAAD(aad); const bytes = Buffer.concat([c.update(JSON.stringify(value)), c.final()]); return [iv,c.getAuthTag(),bytes].map(v=>v.toString('base64url')).join('.'); }
  function open(value) { const [iv,tag,bytes] = value.split('.').map(v=>Buffer.from(v,'base64url')); const c = createDecipheriv('aes-256-gcm',key,iv); c.setAAD(aad); c.setAuthTag(tag); return JSON.parse(Buffer.concat([c.update(bytes),c.final()]).toString()); }
  let discovery;
  async function configuration() {
    if (!discovery) {
      const options = allowHttp ? { execute: [oidc.allowInsecureRequests] } : undefined;
      discovery = oidc.discovery(new URL(issuer), config.clientId, config.clientSecret, oidc.ClientSecretPost(config.clientSecret), options).then(c => { oidc.enableNonRepudiationChecks(c); return c; }).catch(error => { discovery = undefined; throw error; });
    }
    return discovery;
  }
  return {
    issuer, clientId: config.clientId, redirectUri,
    async begin({ returnTo = '/', purpose = 'login', localUserId, migration } = {}) {
      if (migration && (purpose !== 'link' || !localUserId || Object.keys(migration).some(k => !['nonce','ticket','browserBindingHash'].includes(k)) || !/^[A-Za-z0-9_-]{43}$/.test(migration.nonce || '') || !/^[A-Za-z0-9_-]{43}$/.test(migration.ticket || '') || !/^[a-f0-9]{64}$/.test(migration.browserBindingHash || ''))) fail('Only a trusted migration flow can supply its expected nonce');
      if (!['login','link'].includes(purpose) || (purpose === 'link' && !localUserId)) fail('An authenticated local account is required to link');
      const c = await configuration(), state = oidc.randomState(), nonce = migration?.nonce ?? oidc.randomNonce(), verifier = oidc.randomPKCECodeVerifier();
      const browserToken = randomBytes(32).toString('base64url'), expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
      const payload = seal({ state, nonce, verifier, returnTo: safeReturnTo(returnTo), purpose, localUserId, migration: migration ? { ticket: migration.ticket, browserBindingHash: migration.browserBindingHash } : undefined, expiresAt });
      await store.put({ stateHash: digest(state), browserHash: digest(browserToken), payload, expiresAt });
      const url = oidc.buildAuthorizationUrl(c, { redirect_uri: redirectUri, response_type: 'code', scope: 'openid profile email licensing', resource: licensingOrigin, state, nonce, code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256' });
      return { url: url.href, browserToken };
    },
    async callback({ url, browserToken }) {
      const current = new URL(url);
      if (current.origin !== publicOrigin || current.pathname !== callbackPath || typeof browserToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(browserToken)) fail('The SSO browser correlation is invalid');
      const state = current.searchParams.get('state');
      if (!state || state.length > 256) fail('The SSO state is missing');
      const record = await store.consume(digest(state), digest(browserToken));
      if (!record || Date.parse(record.expiresAt) <= Date.now()) fail('The SSO request expired or was already used');
      const saved = open(record.payload);
      if (saved.state !== state || Date.parse(saved.expiresAt) <= Date.now()) fail('The SSO state is invalid');
      const tokens = await oidc.authorizationCodeGrant(await configuration(), current, { pkceCodeVerifier: saved.verifier, expectedState: saved.state, expectedNonce: saved.nonce });
      const claims = tokens.claims();
      if (!claims || claims.iss !== issuer || typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 200 || claims.email_verified !== true || !/^urn:cormier:access:credential:[a-f0-9]{64}$/.test(claims.acr || '') || typeof claims.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email) || claims.email.length > 254 || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) fail('Access did not provide a verified identity');
      return { identity: { issuer, subject: claims.sub, email: claims.email.toLowerCase(), emailVerified: true, credentialStamp: claims.acr.slice(-64), name: typeof claims.name === 'string' ? claims.name.slice(0,200) : claims.email, god: claims.god === true, sid: typeof claims.sid === 'string' ? claims.sid : undefined, expiresAt: new Date(claims.exp * 1000).toISOString() }, accessToken: tokens.access_token, idToken: tokens.id_token, returnTo: saved.returnTo, purpose: saved.purpose, localUserId: saved.localUserId, migration: saved.migration };
    },
    async logoutUrl() { const metadata = (await configuration()).serverMetadata(); if (!metadata.end_session_endpoint) return issuer; const url = new URL(metadata.end_session_endpoint); url.searchParams.set('client_id', config.clientId); url.searchParams.set('post_logout_redirect_uri', publicOrigin + '/'); return url.href; },
  };
}
export function createProductConfigurationPoller({ licensingOrigin, productId, intervalMs = 300_000, fetcher = fetch, allowLocalHttpForTests = false }) {
  const base = origin(licensingOrigin, allowLocalHttpForTests);
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(productId)) fail('Invalid product identifier');
  let current, checkedAt, error, timer;
  async function poll() {
    try {
      const res = await fetcher(base + '/v1/products/' + productId + '/config', { headers: current ? { 'if-none-match': '"' + current.revision + '"' } : {}, redirect: 'error', signal: AbortSignal.timeout(5000) });
      if (res.status === 304 && current) { checkedAt = new Date().toISOString(); error = undefined; return snapshot(); }
      if (!res.ok || Number(res.headers.get('content-length') || 0) > 262144) fail('Product configuration is unavailable');
      const text = await res.text(); if (text.length > 262144) fail('Product configuration is too large');
      const next = JSON.parse(text);
      if (next.productId !== productId || !/^[a-f0-9]{64}$/.test(next.revision || '') || !Number.isSafeInteger(next.version) || next.version < 1 || !next.pricing || typeof next.pricing.model !== 'string' || typeof next.registrationRequired !== 'boolean' || !next.configuration || typeof next.configuration !== 'object') fail('Invalid product configuration');
      if (productId === 'realtime' && (next.pricing.model !== 'free-registration' || next.pricing.amountCents !== 0 || next.pricing.currency !== 'USD')) fail('RealtimeStack must remain free with registration');
      current = jsonClone(next); checkedAt = new Date().toISOString(); error = undefined;
    } catch { error = 'Central product configuration is unavailable; the last validated configuration is retained'; }
    return snapshot();
  }
  function snapshot() { return { configured: !!current, stale: !!error, checkedAt, error, configuration: current ? jsonClone(current) : null }; }
  return { poll, snapshot, start() { void poll(); timer ??= setInterval(() => void poll(), Math.max(30_000, intervalMs)); timer.unref?.(); }, stop() { if (timer) clearInterval(timer); timer = undefined; } };
}
export {createIntegrationSettingsClient,integrationSettingsFromEnv,IntegrationSettingsUnavailable} from './integrations.mjs';
