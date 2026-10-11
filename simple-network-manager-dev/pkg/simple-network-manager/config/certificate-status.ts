export function certificateStatus(route: { protocol: string; certificate: string; tls: string }, resource?: { spec?: { tls?: any } }) {
  if (resource?.spec?.tls?.passthrough) return { label: 'TLS Passthrough', tone: 'neutral' };
  const tls = resource?.spec?.tls;
  const required = ['HTTPS', 'TLS'].includes(route.protocol) || (!!route.certificate && route.certificate !== 'None') || (Array.isArray(tls) ? tls.length > 0 : !!tls);
  if (!required) return { label: 'Not Applicable', tone: 'neutral' };
  if (/error|fail/i.test(route.tls)) return { label: 'Certificate Error', tone: 'error' };
  if (/pending|issuing|awaiting/i.test(route.tls)) return { label: 'Issuance Pending', tone: 'pending' };
  if (!route.certificate || route.certificate === 'None') return { label: 'Certificate Missing', tone: 'error' };
  if (/ready/i.test(route.tls) && !/not ready/i.test(route.tls)) return { label: 'Certificate Ready', tone: 'ready' };
  return { label: 'Certificate Not Ready', tone: 'error' };
}
