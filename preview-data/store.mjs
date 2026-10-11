import { readFile, writeFile, rename, open, unlink, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export class PreviewDataError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function validateDocument(document, pluginId) {
  if (!document || document.schemaVersion !== 1 || document.pluginId !== pluginId ||
      !Number.isSafeInteger(document.revision) || document.revision < 0 ||
      !document.source || typeof document.source !== 'object' || Array.isArray(document.source) ||
      !document.data || typeof document.data !== 'object' || Array.isArray(document.data) ||
      !document.data.inventory || typeof document.data.inventory !== 'object' || Array.isArray(document.data.inventory) ||
      !document.data.state || typeof document.data.state !== 'object' || Array.isArray(document.data.state)) {
    throw new PreviewDataError('Invalid preview source: expected schema version 1, plugin identity, revision, source, inventory, and state.');
  }
}

export function createPreviewStore({ file, pluginId, validate = () => {} }) {
  async function load() {
    const document = JSON.parse(await readFile(file, 'utf8'));
    validateDocument(document, pluginId);
    validate(document.data);
    return document;
  }
  async function save({ revision, data }) {
    let lock;
    const temp = `${file}.${randomUUID()}.tmp`;
    await mkdir(dirname(file), { recursive: true });
    try {
      try { lock = await open(`${file}.lock`, 'wx'); }
      catch (error) { if (error.code === 'EEXIST') throw new PreviewDataError('Another preview is saving this source. Retry after it finishes.', 423); throw error; }
      const current = await load();
      if (revision !== current.revision) throw new PreviewDataError('This source changed in another preview or on disk. Reload and review before saving.', 409);
      const next = { ...current, revision: current.revision + 1, updatedAt: new Date().toISOString(), data };
      validateDocument(next, pluginId);
      validate(data);
      await writeFile(temp, JSON.stringify(next, null, 2) + '\n', { flag: 'wx' });
      await rename(temp, file);
      return next;
    } finally {
      await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; });
      if (lock) { await lock.close(); await unlink(`${file}.lock`); }
    }
  }
  return { load, save };
}

export function previewDataMiddleware({ store, pluginId }) {
  const endpoint = `/__preview-data/${pluginId}`;
  return async (req, res, next) => {
    if (req.url?.split('?')[0] !== endpoint) return next();
    const json = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(value));
    };
    try {
      if (req.method === 'GET') return json(200, await store.load());
      if (req.method !== 'PUT') return json(405, { error: 'Use GET or PUT.' });
      const host = req.headers.host;
      if (req.headers['x-preview-data'] !== '1' ||
          req.headers['content-type']?.split(';')[0] !== 'application/json' ||
          req.headers.origin && req.headers.origin !== `http://${host}` && req.headers.origin !== `https://${host}` ||
          req.headers['sec-fetch-site'] === 'cross-site') {
        throw new PreviewDataError('Preview writes require a same-origin JSON request.', 403);
      }
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 8 * 1024 * 1024) throw new PreviewDataError('Preview source exceeds the 8 MiB limit.', 413);
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { throw new PreviewDataError('Enter valid JSON.'); }
      if (!body || typeof body !== 'object') throw new PreviewDataError('Expected revision and data.');
      return json(200, await store.save(body));
    } catch (error) {
      json(error instanceof PreviewDataError ? error.status : 500, {
        error: error instanceof PreviewDataError ? error.message : 'Project mock data could not be read or saved. Check the source file and filesystem permissions.'
      });
    }
  };
}
