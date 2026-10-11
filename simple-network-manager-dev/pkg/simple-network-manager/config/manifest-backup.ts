import { inventoryDatasets } from '../data/inventory';
const dependencies = inventoryDatasets['dependency-resources-snapshot.json'];
const routes = inventoryDatasets['route-resources-snapshot.json'];
const certificates = inventoryDatasets['certificate-resources-snapshot.json'];
export function affectedRouteManifests(ids: string[]) {
  const selected = routes.resources.filter(resource => ids.includes(`${resource.kind}/${resource.metadata.namespace}/${resource.metadata.name}`));
  const neededCertificates = certificates.resources.filter(certificate => selected.some((route: any) => route.metadata.namespace === certificate.metadata.namespace && (route.spec.tls?.secretName === certificate.spec.secretName || route.spec.tls?.some?.((tls: any) => tls.secretName === certificate.spec.secretName))));
  return JSON.parse(JSON.stringify([...selected, ...neededCertificates, ...dependencies.resources]));
}
