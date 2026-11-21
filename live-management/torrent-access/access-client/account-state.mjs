// Server-only: confidential credentials must never be sent to a browser.
export function createAccountStateClient({ issuer, clientId, clientSecret, fetcher = fetch, cacheMs = 30_000, maxStaleMs = 120_000, timeoutMs = 8_000, now = Date.now, allowLocalHttpForTests = false }) {
  const origin = new URL(issuer);
  if (origin.origin !== issuer || (origin.protocol !== 'https:' && !(allowLocalHttpForTests && origin.hostname === '127.0.0.1')) || !clientId || !clientSecret || cacheMs < 0 || cacheMs > 30_000 || maxStaleMs < cacheMs || maxStaleMs > 120_000) throw Error('Invalid central account-state configuration');
  const cache = new Map(), pending = new Map();
  async function refresh(subject) {
    const previous = cache.get(subject);
    try {
      const response = await fetcher(issuer + '/api/sso/account-state', { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { authorization: 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'), 'content-type': 'application/json' }, body: JSON.stringify({ subjects: [subject] }) });
      if (response.status >= 300 && response.status < 400) { cache.delete(subject); throw Object.assign(Error('Central redirects are forbidden'), { hardFailure: true }); }
      if (response.status >= 400 && response.status < 500 && response.status !== 429) { cache.delete(subject); throw Object.assign(Error('Central client request rejected'), { hardFailure: true }); }
      if (!response.ok) throw Error('Central account state unavailable');
      const hard = () => { cache.delete(subject); return Object.assign(Error('Invalid central account state'), { hardFailure: true }); };
      if (Number(response.headers.get('content-length') || 0) > 65536 || !response.body) throw hard();
      const reader = response.body.getReader(), chunks = []; let bytes = 0;
      try { for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 65536) { await reader.cancel().catch(() => {}); throw hard(); } chunks.push(Buffer.from(part.value)); } } finally { reader.releaseLock(); }
      let data; try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw hard(); }
      const state = data?.accounts?.[0];
      if (!Array.isArray(data?.accounts) || data.accounts.length !== 1 || !state || state.subject !== subject || typeof state.enabled !== 'boolean' || (state.enabled && (state.emailVerified !== true || typeof state.email !== 'string' || state.email.length > 254 || typeof state.name !== 'string' || state.name.length > 120 || !/^[a-f0-9]{64}$/.test(state.credentialStamp || '')))) { cache.delete(subject); throw Object.assign(Error('Invalid central account state'), { hardFailure: true }); }
      const entry = { ...state, fetchedAt: now(), stale: false };
      cache.delete(subject); if (cache.size >= 1000) cache.delete(cache.keys().next().value); cache.set(subject, entry); return entry;
    } catch (error) {
      if (!error.hardFailure && previous && now() - previous.fetchedAt <= maxStaleMs) return { ...previous, stale: true };
      throw Error('Central account state unavailable; sign in again when Access is reachable');
    }
  }
  async function get(subject, { fresh = false } = {}) {
    if (typeof subject !== 'string' || !subject.length || subject.length > 128) throw Error('Invalid account subject');
    const entry = cache.get(subject);
    if (!fresh && entry && now() - entry.fetchedAt < cacheMs) return { ...entry };
    if (!pending.has(subject)) pending.set(subject, refresh(subject).finally(() => pending.delete(subject)));
    const state = await pending.get(subject);
    if (fresh && state.stale) throw Error('Fresh central account state is required to sign in');
    return { ...state };
  }
  return { get, async validate(subject, credentialStamp) { const state = await get(subject); return state.enabled && state.emailVerified && typeof credentialStamp === 'string' && state.credentialStamp === credentialStamp ? state : null; }, clear(subject) { cache.delete(subject); } };
}
