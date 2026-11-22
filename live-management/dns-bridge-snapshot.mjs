import {createHmac, timingSafeEqual} from 'node:crypto';
import {readDnsInventory} from '../preview-data/fresh-dns-source.mjs';

const denied = () => Object.assign(new Error('The Windows bridge could not verify this queued snapshot.'), {
  code: 'BRIDGE_SNAPSHOT_DENIED', status: 403
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function bridgeSnapshot({jobId, snapshotId, expires, proof} = {}, {
  readInventory = readDnsInventory, loadSnapshot, now = Date.now()
} = {}) {
  if (!uuid.test(jobId || '') || !uuid.test(snapshotId || '') ||
      !Number.isSafeInteger(expires) || expires < now || expires > now + 60000 ||
      typeof proof !== 'string' || !/^[0-9a-f]{64}$/.test(proof)) throw denied();

  const credential = await readInventory('credential/dns-windows-bridge-credential');
  if (!credential?.data?.token) throw denied();
  const expected = createHmac('sha256', Buffer.from(credential.data.token, 'base64'))
    .update(`dns-bridge-snapshot-v1\n${jobId}\n${snapshotId}\n${expires}`).digest();
  if (!timingSafeEqual(expected, Buffer.from(proof, 'hex'))) throw denied();

  const jobs = await readInventory('dns-windows-queue');
  const job = Array.isArray(jobs) && jobs.find(item => item.id === jobId && item.status === 'Running' && item.snapshotId === snapshotId);
  if (!job || !Array.isArray(job.operations) || !job.operations.length || job.operations.length > 50 ||
      !Number.isFinite(Date.parse(job.createdAt)) || now - Date.parse(job.createdAt) > 600000) throw denied();
  const snapshot = await loadSnapshot(snapshotId);
  if (snapshot.current?.configuration?.kind !== 'DnsSource') throw denied();
  const zones = new Set(job.operations.flatMap(({zone, parentZone}) => [zone, parentZone]).filter(Boolean));
  const {host, address} = snapshot.current.configuration.dns || {};
  return {
    createdAt: snapshot.createdAt,
    current: {
      configuration: {kind: 'DnsSource', dns: {host, address}},
      relatedConfigurations: (snapshot.current.relatedConfigurations || [])
        .filter(item => item.kind === 'DnsZone' && zones.has(item.dns?.zone?.name))
        .map(({dns}) => ({
          kind: 'DnsZone',
          dns: {
            zone: {name: dns.zone.name, serial: dns.zone.serial},
            records: (dns.records || []).map(({name, type, value, ttl}) => ({name, type, value, ttl}))
          }
        }))
    }
  };
}
