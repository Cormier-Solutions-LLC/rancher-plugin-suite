import { ZipWriter, ZipReader, Uint8ArrayWriter, Uint8ArrayReader, TextReader, TextWriter } from '@zip.js/zip.js';
import { manifestYaml } from './manifest-yaml.mjs';

const options = { useWebWorkers: false };
const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
export function passwordStrength(password = '') {
  const unique = new Set(password).size;
  const groups = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter(pattern => pattern.test(password)).length;
  const score = password.length >= 20 && unique >= 10 ? 4 : password.length >= 14 && unique >= 8 && groups >= 3 ? 3 : password.length >= 12 && unique >= 6 ? 2 : password.length >= 8 ? 1 : 0;
  return { score, label: ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'][score], acceptable: score >= 3 };
}
export function containsSecretValues(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.kind === 'Secret' && (value.data !== undefined || value.stringData !== undefined)) return true;
  return Object.values(value).some(containsSecretValues);
}
export function withoutSecretValues(value) {
  if (Array.isArray(value)) return value.map(withoutSecretValues);
  if (!value || typeof value !== 'object') return value;
  if (value.kind === 'Secret') return { apiVersion: value.apiVersion, kind: value.kind, metadata: { name: value.metadata?.name, namespace: value.metadata?.namespace } };
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, withoutSecretValues(child)]));
}
export async function encodeBackup(snapshot, password = '') {
  if (containsSecretValues(snapshot) && !password) throw new Error('Secret-inclusive backups require a password.');
  if (password && !passwordStrength(password).acceptable) throw new Error('Use a strong password: at least 14 characters with varied characters, or a long passphrase.');
  const writer = new ZipWriter(new Uint8ArrayWriter(), options);
  await writer.add('index.json', new TextReader(JSON.stringify(snapshot, null, 2)));
  await writer.add('configuration.json', new TextReader(JSON.stringify(snapshot.current, null, 2)));
  await writer.add('manifests.yaml', new TextReader(manifestYaml(snapshot.current)));
  const payload = await writer.close();
  if (!password) return payload;
  const outer = new ZipWriter(new Uint8ArrayWriter(), options);
  await outer.add('backup.zip', new Uint8ArrayReader(payload), { password, encryptionStrength: 3, zipCrypto: false });
  return outer.close();
}
export async function decodeBackup(bytes, password = '') {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error('Backup exceeds the 8 MB import limit.');
  const reader = new ZipReader(new Uint8ArrayReader(bytes), options);
  try {
    const entries = await reader.getEntries();
    if (entries.some(entry => entry.uncompressedSize > MAX_ENTRY_BYTES)) throw new Error('Backup entry exceeds the import limit.');
    const envelope = entries.find(entry => entry.filename === 'backup.zip');
    if (envelope) {
      if (entries.length !== 1 || !envelope.encrypted || envelope.zipCrypto || !password) throw new Error('This encrypted backup requires its password.');
      const payload = await envelope.getData(new Uint8ArrayWriter(), { password, checkSignature: true });
      return decodeBackup(payload);
    }
    const index = entries.filter(entry => entry.filename === 'index.json');
    if (index.length !== 1) throw new Error('The ZIP must contain exactly one backup index.');
    const snapshot = JSON.parse(await index[0].getData(new TextWriter(), { checkSignature: true }));
    if (snapshot.schemaVersion !== 1 || !snapshot.current || !Number.isFinite(Date.parse(snapshot.createdAt))) throw new Error('Invalid DNS backup index.');
    return snapshot;
  } finally { await reader.close(); }
}
