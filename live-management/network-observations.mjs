// Pure projection of authenticated Kubernetes observations. No fixture fallback.
export function projectNetwork(resources, observedAt = new Date().toISOString()) {
  const items = key => resources[key] || [];
  const namespaces = items('namespaces');
  const services = items('services');
  const certificates = items('certificates');
  const certificateLifecycle = c => {
    const requests=items('certificaterequests').filter(r=>r.metadata.ownerReferences?.some(o=>o.uid===c.metadata.uid)).map(r=>({name:r.metadata.name,uid:r.metadata.uid,createdAt:r.metadata.creationTimestamp,conditions:r.status?.conditions||[]}));
    const orders=items('orders').filter(o=>o.metadata.ownerReferences?.some(r=>requests.some(q=>q.uid===r.uid))).map(o=>({name:o.metadata.name,uid:o.metadata.uid,requestUid:o.metadata.ownerReferences.find(r=>requests.some(q=>q.uid===r.uid)).uid,state:o.status?.state,reason:o.status?.reason}));
    const challenges=items('challenges').filter(o=>o.metadata.ownerReferences?.some(r=>orders.some(q=>q.uid===r.uid))).map(o=>({name:o.metadata.name,orderUid:o.metadata.ownerReferences.find(r=>orders.some(q=>q.uid===r.uid)).uid,state:o.status?.state,reason:o.status?.reason}));
    return {uid:c.metadata.uid,lastFailureTime:c.status?.lastFailureTime,requests,orders,challenges};
  };
  const dependencies = [...services, ...items('middlewares'), ...items('serverstransports'), ...items('issuers'), ...items('clusterissuers')];
  const routes = [...items('ingresses'), ...items('ingressroutes'), ...items('ingressroutetcps'), ...items('ingressrouteudps')];
  const manifest = r => ({ apiVersion: r.apiVersion, kind: r.kind, metadata: { name: r.metadata.name, ...(r.metadata.namespace ? { namespace: r.metadata.namespace } : {}), ...(r.metadata.labels ? { labels: r.metadata.labels } : {}), ...(r.metadata.annotations ? { annotations: Object.fromEntries(Object.entries(r.metadata.annotations).filter(([k]) => k !== 'kubectl.kubernetes.io/last-applied-configuration')) } : {}) }, ...(r.spec ? { spec: r.spec } : {}) });
  const port = p => ({ name: p.name || '', port: p.port, targetPort: p.targetPort, protocol: p.protocol || 'TCP', appProtocol: p.appProtocol || '' });
  const bindings = r => r.kind === 'Ingress'
    ? (r.spec.rules || []).flatMap(rule => (rule.http?.paths || []).map(p => ({ service: p.backend.service?.name || '', namespace: r.metadata.namespace, backendPort: String(p.backend.service?.port?.name || p.backend.service?.port?.number || ''), mode: r.spec.tls?.length ? 'HTTPS' : 'HTTP', entryPoint: r.spec.tls?.length ? 'websecure' : 'web' })))
    : (r.spec.routes || []).flatMap(rule => (rule.services || []).map(s => ({ service: s.name, namespace: s.namespace || r.metadata.namespace, backendPort: String(s.port || ''), mode: r.kind === 'IngressRouteUDP' ? 'UDP' : r.kind === 'IngressRouteTCP' ? 'TCP' : r.spec.tls ? 'HTTPS' : 'HTTP', entryPoint: (r.spec.entryPoints || []).join(', ') })));
  const owners = Object.fromEntries(routes.map(r => [`${r.kind}/${r.metadata.namespace}/${r.metadata.name}`, { owners: r.metadata.ownerReferences || [], release: r.metadata.annotations?.['meta.helm.sh/release-name'] || '', releaseNamespace: r.metadata.annotations?.['meta.helm.sh/release-namespace'] || r.metadata.namespace }]));
  const details = routes.map(r => {
    const b = bindings(r); const tls = r.kind === 'Ingress' ? r.spec.tls?.[0] : r.spec.tls;
    const certificate = certificates.find(c => c.metadata.namespace === r.metadata.namespace && c.spec.secretName === tls?.secretName);
    const ready = certificate?.status?.conditions?.find(c => c.type === 'Ready')?.status === 'True';
    return { id: `${r.kind}/${r.metadata.namespace}/${r.metadata.name}`, name: r.metadata.name, namespace: r.metadata.namespace, kind: r.kind,
      protocol: [...new Set(b.map(s => s.mode))].join(', ') || (r.kind.endsWith('UDP') ? 'UDP' : r.kind.endsWith('TCP') ? 'TCP' : 'HTTP'),
      match: r.kind === 'Ingress' ? (r.spec.rules || []).map(x => x.host || '*').join(', ') : (r.spec.routes || []).map(x => x.match || '*').join(', '),
      entrypoint: [...new Set(b.map(s => s.entryPoint))].join(', '), service: b.map(s => `${s.namespace}/${s.service}`).join(', '), port: b.map(s => s.backendPort).join(', '),
      tls: tls?.passthrough ? 'Passthrough' : tls ? ready ? 'Certificate ready' : 'Certificate not verified' : 'None',
      certificate: certificate?.metadata.name || tls?.secretName || '', issuer: certificate?.spec.issuerRef?.name || '',
      middleware: (r.spec.routes || []).flatMap(x => (x.middlewares || []).map(m => m.name)).join(', '),
      note: `Live Kubernetes observation ${observedAt}; traffic is not measured.`, owner: owners[`${r.kind}/${r.metadata.namespace}/${r.metadata.name}`].release ? 'Helm' : r.metadata.ownerReferences?.length ? 'Controller' : 'Unmanaged' };
  });
  const entryPoints = [];
  for (const d of items('deployments').filter(d => d.metadata.namespace === 'traefik-system' && d.metadata.name === 'traefik')) {
    for (const arg of d.spec.template.spec.containers.flatMap(c => c.args || [])) {
      const m = /^--entrypoints\.([^.]+)\.address=:(\d+)(?:\/(tcp|udp))?$/i.exec(arg);
      if (m) {
        const protocol = (m[3] || 'TCP').toUpperCase();
        const containers=d.spec.template.spec.containers;
        const published = services.filter(s => s.metadata.namespace === 'traefik-system' && s.spec.type === 'LoadBalancer' && Object.keys(s.spec.selector||{}).length && Object.entries(s.spec.selector).every(([key,value])=>d.spec.template.metadata?.labels?.[key]===value))
          .flatMap(s => s.spec.ports || []).find(p => {
            const destination=typeof p.targetPort==='number'?p.targetPort:containers.flatMap(c=>c.ports||[]).find(c=>c.name===p.targetPort&&(c.protocol||'TCP')===protocol)?.containerPort;
            return (destination===Number(m[2])||p.targetPort===m[1]) && (p.protocol || 'TCP') === protocol;
          });
        entryPoints.push({ name: m[1], port: published?.port || Number(m[2]), containerPort: Number(m[2]), protocol, exposed: !!published });
      }
    }
  }
  return {
    'certificate-resources-snapshot.json': { resources: certificates.map(manifest) },
    'certificate-snapshot.json': { observedDate: observedAt, certificates: certificates.map(c => ({ name: c.metadata.name, namespace: c.metadata.namespace, secretName: c.spec.secretName, issuer: c.spec.issuerRef.name, issuerKind: c.spec.issuerRef.kind || 'Issuer', hosts: c.spec.dnsNames || [], ready: c.status?.conditions?.find(x => x.type === 'Ready')?.status || 'Unknown', revision: c.status?.revision || 0,...certificateLifecycle(c) })) },
    'dependency-resources-snapshot.json': { resources: dependencies.map(manifest) },
    'listener-snapshot.json': { observedDate: observedAt, entryPoints },
    'namespace-snapshot.json': { namespaces: namespaces.map(n => ({ name: n.metadata.name, labels: n.metadata.labels || {}, project: n.metadata.annotations?.['field.cattle.io/projectId'] || '', isSystem: n.metadata.labels?.['management.cattle.io/system-namespace'] === 'true' || /^(kube-|cattle-)/.test(n.metadata.name) })) },
    'network-address-snapshot.json': { observedAt, services: services.map(s => ({ namespace: s.metadata.namespace, name: s.metadata.name, clusterIPs: s.spec.clusterIPs || [], externalIPs: s.status?.loadBalancer?.ingress?.map(i => i.ip || i.hostname) || [], externalName: s.spec.externalName || '', ports: (s.spec.ports || []).map(port) })), endpoints: items('endpointslices').flatMap(e => (e.endpoints || []).map(x => ({ namespace: e.metadata.namespace, service: e.metadata.labels['kubernetes.io/service-name'], addresses: x.addresses, ready: x.conditions?.ready !== false, ports: (e.ports || []).map(port) }))) },
    'publication-snapshot.json': { observedDate: observedAt, namespaces: namespaces.map(n => n.metadata.name), ingressClasses: items('ingressclasses').map(x => x.metadata.name), services: services.map(s => ({ namespace: s.metadata.namespace, name: s.metadata.name, ports: (s.spec.ports || []).map(port) })) },
    'resource-owner-snapshot.json': owners,
    'route-attachment-snapshot.json': { observedDate: observedAt, routes: routes.map(r => ({ name: r.metadata.name, namespace: r.metadata.namespace, kind: r.kind, owner: details.find(d => d.id === `${r.kind}/${r.metadata.namespace}/${r.metadata.name}`).owner, bindings: bindings(r) })) },
    'route-details-snapshot.json': { observedDate: observedAt, routes: details },
    'route-resources-snapshot.json': { resources: routes.map(manifest) },
  };
}
