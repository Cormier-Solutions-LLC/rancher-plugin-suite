export interface ExistingCertificate {
  metadata: { name: string; namespace: string };
  spec: { secretName: string; dnsNames?: string[] };
}
export interface CertificateBinding { secretName: string; hosts: string[] }
export function certificateCoversHost(pattern: string, host: string) {
  pattern = pattern.toLowerCase(); host = host.toLowerCase();
  if (!pattern.startsWith('*.')) return pattern === host;
  const suffix = pattern.slice(2);
  return host.endsWith(`.${suffix}`) && host.split('.').length === suffix.split('.').length + 1;
}
export function existingCertificateSecret(certificate: ExistingCertificate | undefined, namespace: string, hosts: string[]) {
  if (!certificate || certificate.metadata.namespace !== namespace) throw new Error('Select an existing certificate in the destination namespace.');
  if (!certificate.spec.secretName) throw new Error('The certificate has no TLS Secret reference.');
  if (!hosts.length || hosts.some(host => !(certificate.spec.dnsNames || []).some(pattern => certificateCoversHost(pattern, host)))) throw new Error('The existing certificate must cover every resulting hostname. Change the hostnames or request a certificate through an issuer.');
  return certificate.spec.secretName;
}
export function existingCertificateBindings(certificates: ExistingCertificate[], namespace: string, hosts: string[]): CertificateBinding[] {
  if (!certificates.length || certificates.some(certificate => certificate.metadata.namespace !== namespace || !certificate.spec.secretName)) throw new Error('Select existing certificates in the destination namespace.');
  const bindings = new Map<string, CertificateBinding>();
  for (const host of [...new Set(hosts)]) {
    const certificate = certificates.find(certificate => (certificate.spec.dnsNames || []).some(pattern => pattern.toLowerCase() === host.toLowerCase())) || certificates.find(certificate => (certificate.spec.dnsNames || []).some(pattern => certificateCoversHost(pattern, host)));
    if (!certificate) throw new Error(`No selected certificate covers ${host}. Select another certificate or generate a new one.`);
    const secret = certificate.spec.secretName;
    if (!bindings.has(secret)) bindings.set(secret, { secretName: secret, hosts: [] });
    bindings.get(secret)!.hosts.push(host);
  }
  return [...bindings.values()];
}
export function bindRouteCertificates(resources: object[], bindings: CertificateBinding[], hosts: string[]): object[] {
  const covered = bindings.flatMap(binding => binding.hosts);
  const validName = (name: string) => name.length <= 253 && name.split('.').every(part => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part));
  if (!bindings.length || bindings.some(binding => !validName(binding.secretName) || !binding.hosts.length) || new Set(covered).size !== covered.length || hosts.some(host => !covered.includes(host)) || covered.some(host => !hosts.includes(host))) throw new Error('Certificate mappings must cover each route hostname exactly once.');
  return resources.flatMap((original: any) => {
    if (original.kind === 'Certificate') return [];
    const resource = JSON.parse(JSON.stringify(original));
    if (!resource.spec?.tls) return [resource];
    if (resource.kind === 'Ingress') { resource.spec.tls = bindings.map(binding => ({ hosts: [...binding.hosts], secretName: binding.secretName })); return [resource]; }
    if (!['IngressRoute', 'IngressRouteTCP'].includes(resource.kind)) return [resource];
    if (bindings.length === 1) { resource.spec.tls.secretName = bindings[0].secretName; return [resource]; }
    return bindings.map((binding, index) => {
      const route = JSON.parse(JSON.stringify(resource));
      const suffix = `-cert-${index + 1}`;
      route.metadata.name = `${resource.metadata.name.slice(0, 63 - suffix.length)}${suffix}`;
      route.spec.tls.secretName = binding.secretName;
      route.spec.routes = route.spec.routes.filter((rule: any) => {
        if (!rule.match || rule.match.includes('!')) throw new Error('Multiple certificates require positive hostname rules. Review complex match rules separately.');
        const names = [...rule.match.matchAll(/Host(?:SNI)?\(\s*[`"']([^`"']+)[`"']\s*\)/g)].map((match: any) => match[1]);
        return names.some((host: string) => binding.hosts.includes(host));
      }).map((rule: any) => {
        const hostRule = /(Host(?:SNI)?)\(\s*[`"']([^`"']+)[`"']\s*\)/g;
        const simple = !rule.match.replace(hostRule, '').replace(/[\s|()]/g, '');
        const match = simple ? [...rule.match.matchAll(hostRule)].filter((match: any) => binding.hosts.includes(match[2])).map((match: any) => `${match[1]}(\`${match[2]}\`)`).join(' || ') : rule.match.replace(hostRule, (original: string, kind: string, host: string) => binding.hosts.includes(host) ? original : `(${kind}(\`${host}\`) && !${kind}(\`${host}\`))`);
        return { ...rule, match };
      });
      return route;
    }).filter((route: any) => route.spec.routes.length);
  });
}
