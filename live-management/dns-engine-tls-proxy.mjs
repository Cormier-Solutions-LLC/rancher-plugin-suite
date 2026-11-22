import http from 'node:http';
import https from 'node:https';
import {readFile} from 'node:fs/promises';

const tlsDir = '/run/dns-engine-tls';
async function credentials() {
  const [cert, key] = await Promise.all([
    readFile(tlsDir + '/tls.crt'), readFile(tlsDir + '/tls.key')
  ]);
  return {cert, key};
}

const server = https.createServer({...await credentials(), minVersion: 'TLSv1.2'}, (req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    const probe = http.get({
      hostname: '127.0.0.1', port: 5380, signal: AbortSignal.timeout(2000)
    }, response => {
      response.resume();
      res.writeHead(response.statusCode < 400 ? 200 : 503).end();
    });
    probe.on('error', () => { if (!res.headersSent) res.writeHead(503).end(); });
    return;
  }
  if (req.method !== 'POST' || !/^\/api\/[a-zA-Z]+(?:\/[a-zA-Z]+)*$/.test(req.url)) {
    res.writeHead(404).end();
    return;
  }

  const length = Number(req.headers['content-length']);
  if (!Number.isSafeInteger(length) || length < 0 || length > 256 * 1024 ||
      req.headers['content-type'] !== 'application/x-www-form-urlencoded') {
    res.writeHead(400).end();
    return;
  }

  const upstream = http.request({
    hostname: '127.0.0.1', port: 5380, method: 'POST', path: req.url,
    signal: AbortSignal.timeout(10000),
    headers: {
      'Content-Type': req.headers['content-type'],
      'Content-Length': length,
      ...(req.headers.authorization && {Authorization: req.headers.authorization})
    }
  }, response => {
    res.writeHead(response.statusCode, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
    response.on('error', () => res.destroy());
    response.pipe(res);
  });
  upstream.on('error', () => res.headersSent ? res.destroy() : res.writeHead(502).end());
  res.on('close', () => upstream.destroy());
  req.on('error', () => upstream.destroy());
  req.pipe(upstream);
});

setInterval(async () => {
  try { server.setSecureContext(await credentials()); }
  catch { console.error('Unable to reload the DNS engine TLS certificate.'); }
}, 60000).unref();

server.requestTimeout = 10000;
server.listen(53443, '0.0.0.0');
