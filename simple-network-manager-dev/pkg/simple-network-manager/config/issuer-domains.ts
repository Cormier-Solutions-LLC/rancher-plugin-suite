import type { IssuerProfile } from '../data/workspace';
import { parseIssuerZones } from './issuer';
export function issuerDomains(profile?: IssuerProfile): string[] {
  const manifest = profile?.manifest as { spec?: { acme?: { solvers?: { selector?: { dnsZones?: string[] } }[] } } } | undefined;
  const zones = manifest?.spec?.acme?.solvers?.flatMap(solver => solver.selector?.dnsZones || []) || [];
  if (!zones.length && profile?.settings?.zone) { try { zones.push(...parseIssuerZones(profile.settings.zone)); } catch { /* Invalid drafts have no selectable domains. */ } }
  return [...new Set(zones.map(zone => zone.trim().toLowerCase()).filter(Boolean))];
}
