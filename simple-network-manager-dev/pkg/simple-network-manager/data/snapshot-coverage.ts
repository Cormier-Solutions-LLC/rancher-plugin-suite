import { computed, ref, watch, watchEffect } from 'vue';
import { secretReferences } from '../config/snapshot-secrets.mjs';
import { selectSnapshotItems } from '../config/snapshot-items.mjs';
import { coverageEntries, assessCoverage, resourceCoverageId, uncoveredEntries } from '../config/snapshot-coverage.mjs';
import { captureScheduleSource } from './snapshot-schedule';
import { storedSnapshots } from './stored-snapshots';
import { observedAttachments } from './observed-attachments';
import { inventoryDatasets } from './inventory';
const resources = inventoryDatasets['route-resources-snapshot.json'];
const certificates = inventoryDatasets['certificate-resources-snapshot.json'];
import { routes, type RouteExample } from './snapshot';
const now = ref(Date.now());
export function updateCoverageClock() { now.value = Date.now(); }
watch(storedSnapshots, updateCoverageClock, { flush: 'sync' });
export const coverageGaps = computed(() => ready.value ? uncoveredEntries(expected.value,storedSnapshots.value,now.value) : []);
const expected = ref<{id:string;digest:string}[]>([]); const ready = ref(false); let revision = 0;
watchEffect(() => { const entries = coverageEntries(captureScheduleSource()); const token = ++revision; Promise.all(entries.map(async (entry: {id:string;value:string}) => ({ id:entry.id, digest:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(entry.value)))).map(value => value.toString(16).padStart(2,'0')).join('') }))).then(value => { if (token === revision) { expected.value = value; ready.value = true; } }).catch(() => { ready.value = false; }); });
export const overallSnapshotCoverage = computed(() => ready.value ? assessCoverage(expected.value, storedSnapshots.value, now.value) : { tone:'warning',label:'Checking Snapshot Coverage',covered:0,total:0,date:undefined });
function identity(route: RouteExample) { return `${route.kind}/${route.namespace}/${route.name}`; }
const dependencyIds=computed(()=>{const current=captureScheduleSource();return new Map(routes.map(route=>{const resource=resources.resources.find(r=>r.kind===route.kind&&r.metadata.namespace===route.namespace&&r.metadata.name===route.name);const selected=resource?selectSnapshotItems(current,[resourceCoverageId(resource)]).items:[]; return [route.id,[...selected.map((item:any)=>item.id),...secretReferences(selected.filter((item:any)=>item.type==='resource').map((item:any)=>item.value)).map((ref:any)=>`resource/v1/Secret/${ref.namespace}/${ref.name}`)]];}));});
function routeIds(route: RouteExample) {
 const resource = resources.resources.find(resource => resource.kind === route.kind && resource.metadata.namespace === route.namespace && resource.metadata.name === route.name);
 const ids = new Set<string>(dependencyIds.value.get(route.id) || (resource ? [resourceCoverageId(resource)] : []));
 if (expected.value.some(entry => entry.id === `issuer-profile/${route.issuer}`)) ids.add(`issuer-profile/${route.issuer}`);
 const attachment = observedAttachments.find(item => `${item.kind}/${item.namespace}/${item.name}` === identity(route));
 for (const binding of attachment?.bindings || []) ids.add(`service/${binding.namespace}/${binding.service}`);
 for (const certificate of certificates.resources.filter(item => item.metadata.namespace === route.namespace && item.spec.secretName === route.certificate)) ids.add(resourceCoverageId(certificate));
 for (const entry of expected.value) if (entry.id.startsWith('draft/') && entry.id.endsWith(`/${route.namespace}/${route.name}`)) ids.add(entry.id);
 return ids;
}
export function routeSnapshots(route: RouteExample) { const ids = routeIds(route); return storedSnapshots.value.filter(record => record.routeIds.includes(identity(route)) || record.coverage?.some(entry => ids.has(entry.id) && entry.id.startsWith('resource/') && entry.id.includes(`/${route.kind}/`))).sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt)); }
export function routeBackupStatus(route: RouteExample) { if (!ready.value) return {tone:'warning',label:'Checking Snapshot Coverage'}; const ids = routeIds(route); return assessCoverage(expected.value.filter(entry => ids.has(entry.id)),routeSnapshots(route),now.value); }
