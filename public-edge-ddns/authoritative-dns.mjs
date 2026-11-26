import { Resolver } from 'node:dns/promises';

const normalize = value => value.toLowerCase().replace(/\.$/, '');
const canonical = values => JSON.stringify([...values].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));

// Discover public delegation over HTTPS, then query both authoritative DNS servers.
// This avoids private split DNS, recursive cache delays, and all GoDaddy API reads.
export async function authoritativeReader({ zone, request, publicIPv4, resolverFactory = () => new Resolver({ timeout: 3000, tries: 2 }) }) {
  const services = ['https://cloudflare-dns.com/dns-query', 'https://dns.google/resolve'];
  async function doh(base, name, type) {
    const response = await request(`${base}?name=${encodeURIComponent(name)}&type=${type}`, { headers: { Accept: 'application/dns-json' } });
    if (!response.ok) throw new Error(`DNS delegation lookup returned HTTP ${response.status}`);
    let body;
    try { body = await response.json(); } catch { throw new Error('Invalid public DNS delegation response'); }
    if (body.Status !== 0 || body.TC || !Array.isArray(body.Answer)) throw new Error('Public DNS delegation lookup failed');
    return body.Answer.filter(r => normalize(r.name) === name && r.type === type).map(r => normalize(r.data)).sort();
  }
  const delegation = await Promise.all(services.map(base => doh(base, zone, 2)));
  if (canonical(delegation[0]) !== canonical(delegation[1]) || delegation[0].length < 2 ||
    delegation[0].some(name => !/^ns\d+\.domaincontrol\.com$/.test(name))) {
    throw new Error('Public resolvers disagree on GoDaddy authoritative nameservers');
  }
  const resolvers = await Promise.all(delegation[0].slice(0, 2).map(async (server, index) => {
    const ips = await doh(services[index], server, 1);
    if (!ips.length || ips.some(ip => !publicIPv4(ip))) throw new Error('Invalid authoritative DNS server address');
    const resolver = resolverFactory(); resolver.setServers([ips[0]]); return resolver;
  }));
  async function query(resolver, method, name, options) {
    try { return await resolver[method](name, options); }
    catch (error) {
      if (['ENODATA', 'ENOTFOUND'].includes(error.code)) return [];
      throw new Error(`Authoritative DNS ${method} failed for ${name}`);
    }
  }
  return async function read(name, { conflicts = false } = {}) {
    const results = await Promise.all(resolvers.map(async resolver => {
      const aliases = (await query(resolver, 'resolveCname', name)).map(data => ({ data: normalize(data), ttl: 600 }));
      // resolve4 follows aliases: do not mistake the target's A records for this owner.
      const addresses = aliases.length ? [] : (await query(resolver, 'resolve4', name, { ttl: true }))
        .map(r => ({ data: r.address, ttl: r.ttl }));
      const blocked = [];
      if (conflicts && !aliases.length) {
        const types = [['AAAA', 'resolve6'], ['TXT', 'resolveTxt'], ['MX', 'resolveMx'], ['CAA', 'resolveCaa'], ['NS', 'resolveNs']];
        for (const [type, method] of types) if ((await query(resolver, method, name)).length) blocked.push(type);
      }
      return { A: JSON.parse(canonical(addresses)), CNAME: JSON.parse(canonical(aliases)), conflicts: blocked.sort() };
    }));
    if (JSON.stringify(results[0]) !== JSON.stringify(results[1])) throw new Error(`Authoritative DNS servers disagree for ${name}`);
    return results[0];
  };
}
