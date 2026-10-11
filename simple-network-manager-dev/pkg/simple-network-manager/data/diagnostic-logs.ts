import { computed, ref } from 'vue';
import { contextMatches } from './namespace-context';
import { diagnosticIncidents, type DiagnosticRow } from '../config/diagnostic-counts';
export const diagnosticSeverity = ref('');
export const diagnosticLookback = ref(24);
export const diagnosticLoadedAt = ref(Date.now());
export const diagnosticClock = ref(Date.now());
export const diagnosticRows = ref<DiagnosticRow[]>([]);
export const diagnosticCounts = computed(() => diagnosticIncidents(diagnosticRows.value, diagnosticClock.value, contextMatches));
export function updateDiagnosticClock() { diagnosticClock.value = Date.now(); }
export function refreshDemoLogs() {
  diagnosticLoadedAt.value = Date.now();
  updateDiagnosticClock();
  diagnosticRows.value = [
    { ago: 0.05, source: 'Traefik', severity: 'INFO', message: 'Example: routing configuration refreshed.' },
    { ago: 0.2, source: 'cert-manager', severity: 'INFO', message: 'Example: certificate reconciliation started.' },
    { ago: 0.6, source: 'cert-manager', severity: 'WARN', message: 'Example: DNS challenge propagation check pending.' },
    { ago: 1.5, source: 'Traefik', severity: 'INFO', message: 'Example: service backend mapping loaded.' },
    { ago: 6, source: 'cert-manager', severity: 'ERROR', message: 'Example: challenge check failed; review issuer and DNS configuration.' },
    { ago: 25, source: 'Traefik', severity: 'INFO', message: 'Example: TCP listener configuration loaded.' }
  ].map(row => ({ time: diagnosticLoadedAt.value - row.ago * 3600000, namespace: row.source === 'cert-manager' ? 'cert-manager' : 'kube-system', source: row.source, severity: row.severity, message: row.message }));
}
refreshDemoLogs();
