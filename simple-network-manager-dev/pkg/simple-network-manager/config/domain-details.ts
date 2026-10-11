export function routeDomains(resource: any): string[] {
  const values = resource?.kind === 'Ingress' ? (resource.spec?.rules || []).map((rule: any) => rule.host) : (resource?.spec?.routes || []).flatMap((rule: any) => [...String(rule.match || '').matchAll(/Host(?:SNI)?\(([^)]*)\)/g)].flatMap(match => [...match[1].matchAll(/[`"']([^`"']+)[`"']/g)].map(item => item[1])));
  return [...new Set<string>(values.filter((value: any) => typeof value === 'string' && value !== '*'))];
}
export function webAddress(host: string, scheme: string | null, port?: number) {
  if (!scheme || !['http', 'https'].includes(scheme) || !host || !/^[a-zA-Z0-9.:-]+$/.test(host) || port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) return null;
  const address = host.includes(':') ? `[${host}]` : host;
  try { return new URL(`${scheme}://${address}${port && port !== (scheme === 'https' ? 443 : 80) ? `:${port}` : ''}`).href; } catch { return null; }
}
export function formatAddress(host: string, port: number) { return `${host.includes(':') ? `[${host}]` : host}:${port}`; }
export function domainServices(resource: any, domain: string) {
  if (resource?.kind === 'Ingress') return (resource.spec?.rules || []).filter((rule: any) => rule.host === domain).flatMap((rule: any) => (rule.http?.paths || []).map((path: any) => ({ name: path.backend?.service?.name, namespace: resource.metadata.namespace, port: path.backend?.service?.port?.name ?? path.backend?.service?.port?.number })));
  return (resource?.spec?.routes || []).filter((rule: any) => routeDomains({ kind: resource.kind, spec: { routes: [rule] } }).includes(domain)).flatMap((rule: any) => (rule.services || []).map((service: any) => ({ name: service.name, namespace: service.namespace || resource.metadata.namespace, port: service.port })));
}
