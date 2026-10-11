export type DiagnosticRow = { time: number; namespace: string; source: string; severity: string; message: string };

// Counts are independent of the view's search, source, severity and lookback filters.
export function diagnosticIncidents(rows: DiagnosticRow[], now: number, matchesScope: (namespace: string) => boolean, hours = 24) {
  const incidents = rows.filter(row => Number.isFinite(row.time) && row.time >= now - hours * 3600000 && row.time <= now && matchesScope(row.namespace) && ['WARN', 'ERROR'].includes(row.severity));
  const errors = incidents.filter(row => row.severity === 'ERROR').length;
  const warnings = incidents.length - errors;
  return { total: incidents.length, errors, warnings, tone: errors ? 'error' : warnings ? 'warning' : '' };
}
