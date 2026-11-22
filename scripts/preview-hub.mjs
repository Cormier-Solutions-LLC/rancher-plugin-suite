import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { localRequestAllowed, requestUrl } from '../preview-data/local-http.mjs';

export function createPreviewHub({ plugins, session }) {
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!localRequestAllowed(req)) { res.writeHead(403); res.end(); return; }
    const url = requestUrl(req.url);
    if (!url) { res.writeHead(400); res.end(); return; }
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    if (url.pathname === '/session') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ session, plugins })); return;
    }
    if (url.pathname !== '/') { res.writeHead(404); res.end(); return; }
    try {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(await readFile(new URL('./preview-hub.html', import.meta.url)));
    } catch { res.writeHead(500); res.end('Preview shell could not be loaded.'); }
  });
}
