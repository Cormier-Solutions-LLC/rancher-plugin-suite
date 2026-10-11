import { inventoryDatasets } from './inventory';
const inventory = inventoryDatasets['route-details-snapshot.json'];
// Routing references observed on October 11, 2026. This is not live health data.
export type RouteExample = {
  id: string; name: string; namespace: string; protocol: string;
  kind: string; match: string; entrypoint: string; service: string; port: string;
  tls: string; certificate: string; issuer: string; middleware: string;
  note: string; owner: string;
};
export const routes: RouteExample[] = inventory.routes;
