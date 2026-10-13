import { coverageEntries, assessCoverage, uncoveredEntries } from '../config/snapshot-coverage.mjs';
export async function evaluateCoverage(current, snapshots) {
  const expected=await Promise.all(coverageEntries(current).map(async entry=>({...entry,digest:[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(entry.value)))].map(byte=>byte.toString(16).padStart(2,'0')).join('')})));
  return { summary:assessCoverage(expected,snapshots), gaps:uncoveredEntries(expected,snapshots) };
}
