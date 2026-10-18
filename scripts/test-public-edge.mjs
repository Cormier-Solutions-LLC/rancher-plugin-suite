import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import tls from 'node:tls';
import https from 'node:https';
import http2 from 'node:http2';

const helm = process.env.HELM || '.tools/helm/windows-amd64/helm.exe';
const openssl = process.env.OPENSSL || 'C:/Program Files/Git/usr/bin/openssl.exe';
const chart = 'charts/public-edge';
const hosts = ['proofing.cormierconsulting.io', 'invoicing.cormierconsulting.io'];
const image = 'nginx@sha256:970364228b1e4f932abc22d321932816782cca8a20b85a77552a7cfe9acfb3b5';
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {encoding: 'utf8', timeout: 60_000, ...options});
  assert.equal(result.status, 0, `${command} ${args[0]}: ${result.stderr || result.error}`);
  return result.stdout;
}
const passed = [];
const check = (name, value) => { assert.ok(value, name); passed.push(name); };
await mkdir('.local/public-edge', {recursive: true});
const root = await mkdtemp(path.resolve('.local/public-edge/test-'));
const tlsDir = path.join(root, 'tls');
await mkdir(tlsDir);
run(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-noenc', '-days', '2',
  '-subj', `/CN=${hosts[0]}`, '-addext', `subjectAltName=DNS:${hosts.join(',DNS:')}`,
  '-keyout', path.join(tlsDir, 'tls.key'), '-out', path.join(tlsDir, 'tls.crt')]);
const cert = await readFile(path.join(tlsDir, 'tls.crt'));
const key = await readFile(path.join(tlsDir, 'tls.key'));
const backendHits = [];
const backend = https.createServer({cert, key}, (request, response) => {
  backendHits.push(request.headers);
  response.writeHead(200, {'content-type': 'application/json'});
  response.end(JSON.stringify({host: request.headers.host, protocol: request.headers['x-forwarded-proto']}));
});
backend.on('upgrade', (request, socket) => {
  backendHits.push(request.headers);
  socket.end('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
});
await new Promise(resolve => backend.listen(0, '0.0.0.0', resolve));
const overrides = path.join(root, 'values.json');
await writeFile(overrides, JSON.stringify({upstream: {host: 'host.docker.internal', port: backend.address().port, caBundle: '/tls/tls.crt'}}));
function render(extra = []) { return run(helm, ['template', 'public-edge', chart, '-n', 'public-edge', '-f', overrides, ...extra]).replace(/\r\n/g, '\n'); }
const rendered = render();
const extractConfig = value => value.split('  nginx.conf: |\n')[1].split(/\n---/)[0].split('\n').map(line => line.replace(/^    /, '')).join('\n');
const config = extractConfig(rendered);
await writeFile(path.join(root, 'nginx.conf'), config);
check('Staging exposes no LoadBalancer and mounts no service-account token', rendered.includes('automountServiceAccountToken: false') && !rendered.includes('type: LoadBalancer'));
for (const publicHosts of [['*.example.com'], ['good.example.com;return 200'], ['EXAMPLE.com'], ['same.example.com', 'same.example.com']]) {
  const bad = path.join(root, 'invalid.json');
  await writeFile(bad, JSON.stringify({publicHosts}));
  const result = spawnSync(helm, ['template', 'test', chart, '-f', bad], {encoding: 'utf8'});
  check(`Invalid hostname list rejected: ${JSON.stringify(publicHosts)}`, result.status !== 0);
}
const denyFile = path.join(root, 'deny.json');
await writeFile(denyFile, JSON.stringify({publicHosts: []}));
const denyAll = render(['-f', denyFile]);
check('Empty allowlist renders without a certificate or upstream', !denyAll.includes('kind: Certificate') && !denyAll.includes('upstream private_traefik'));
const longestHost = `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`;
await writeFile(path.join(root, 'nginx-long.conf'), extractConfig(render(['--set-json', `publicHosts=${JSON.stringify([longestHost])}`])));
run('docker', ['run', '--rm', '--user', '101:101', '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=32m',
  '-v', `${root}:/config:ro`, '-v', `${tlsDir}:/tls:ro`, '--entrypoint', 'nginx', image, '-c', '/config/nginx-long.conf', '-t']);
check('Maximum-length valid hostnames pass the actual Nginx parser', longestHost.length === 253);
const container = `public-edge-test-${Date.now()}`;
let started = false;
function raw({port, host, servername, version = '1.1', rawRequest, secure = false, headers = ''}) {
  return new Promise((resolve, reject) => {
    let output = '', connected = false, settled = false;
    const finish = result => { if (!settled) { settled = true; socket.destroy(); resolve(result); } };
    const options = {host: '127.0.0.1', port, ...(secure ? {servername: servername || '', ca: cert, rejectUnauthorized: !!servername} : {})};
    const socket = secure ? tls.connect(options) : net.connect(options);
    socket.setTimeout(5000, () => { socket.destroy(); reject(Error('socket timed out')); });
    socket.on(secure ? 'secureConnect' : 'connect', () => {
      connected = true;
      socket.write(rawRequest || `GET / HTTP/${version}\r\n${host === undefined ? '' : `Host: ${host}\r\n`}${headers}Connection: close\r\n\r\n`);
    });
    socket.on('data', data => { output += data; });
    socket.on('end', () => finish({output, connected}));
    socket.on('close', () => finish({output, connected}));
    socket.on('error', error => {
      if (['ECONNRESET', 'ERR_SSL_TLSV1_UNRECOGNIZED_NAME', 'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE', 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR'].includes(error.code)) finish({output, connected, error: error.code});
      else reject(error);
    });
  });
}
try {
  run('docker', ['run', '-d', '--name', container, '--user', '101:101', '--read-only', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges', '--tmpfs', '/tmp:rw,noexec,nosuid,size=32m',
    '-v', `${root}:/config:ro`, '-v', `${tlsDir}:/tls:ro`,
    '-p', '127.0.0.1::8080', '-p', '127.0.0.1::8443', '--entrypoint', 'nginx', image,
    '-c', '/config/nginx.conf', '-g', 'daemon off;']);
  started = true;
  const inspection = JSON.parse(run('docker', ['inspect', container]))[0];
  const logs = spawnSync('docker', ['logs', container], {encoding: 'utf8'});
  assert.equal(inspection.State.Running, true, logs.stdout + logs.stderr);
  const bindings = inspection.NetworkSettings.Ports;
  const httpPort = Number(bindings['8080/tcp'][0].HostPort);
  const httpsPort = Number(bindings['8443/tcp'][0].HostPort);
  for (let attempt = 0; ; attempt++) {
    try { await raw({port: httpPort, host: hosts[0]}); break; }
    catch (error) { if (attempt >= 30) throw Error(`${error.message}: ${run('docker', ['logs', container])}`); await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  for (const host of hosts) {
    const http = await raw({port: httpPort, host});
    check(`HTTP redirects approved host ${host}`, http.output.startsWith('HTTP/1.1 308') && http.output.includes(`Location: https://${host}/`));
    const secure = await raw({port: httpsPort, secure: true, host, servername: host});
    check(`HTTPS reaches approved backend ${host} with verified TLS`, secure.output.startsWith('HTTP/1.1 200') && secure.output.includes(`"host":"${host}"`));
  }
  for (const host of [undefined, '', '127.0.0.1', 'rancher.cormierconsulting.io', 'anything.example.com', `x.${hosts[0]}`, `${hosts[0]}.evil.example`, `${hosts[0]}.`, `${hosts[0]}:1234`]) {
    check(`HTTP drops ${String(host) || 'empty Host'} without a response`, (await raw({port: httpPort, host})).output === '');
  }
  check('HTTP/1.0 without Host is dropped', (await raw({port: httpPort, version: '1.0'})).output === '');
  for (const servername of [undefined, 'rancher.cormierconsulting.io', 'anything.example.com']) {
    const response = await raw({port: httpsPort, secure: true, host: hosts[0], servername});
    check(`TLS rejects ${servername || 'missing SNI'} before HTTP`, !response.connected && response.output === '');
  }
  for (const host of [undefined, '', 'rancher.cormierconsulting.io', hosts[1]]) {
    check(`HTTPS drops missing, private, or mismatched Host: ${String(host)}`, (await raw({port: httpsPort, secure: true, host, servername: hosts[0]})).output === '');
  }
  const before = backendHits.length;
  const forged = await raw({port: httpsPort, secure: true, host: 'rancher.cormierconsulting.io', servername: hosts[0], headers: `X-Forwarded-Host: ${hosts[0]}\r\nX-Forwarded-For: 10.99.1.1\r\n`});
  check('Forwarded headers cannot bypass private-host denial', forged.output === '' && backendHits.length === before);
  const allowedForged = await raw({port: httpsPort, secure: true, host: hosts[0], servername: hosts[0], headers: 'X-Forwarded-Host: rancher.cormierconsulting.io\r\nX-Forwarded-For: 10.99.1.1\r\nForwarded: host=rancher.cormierconsulting.io\r\n'});
  check('Allowed requests overwrite routing and client-IP spoofing headers', allowedForged.output.startsWith('HTTP/1.1 200') && backendHits.at(-1)['x-forwarded-host'] === hosts[0] && backendHits.at(-1)['x-forwarded-for'] !== '10.99.1.1' && !backendHits.at(-1).forwarded);
  const duplicate = await raw({port: httpPort, rawRequest: `GET / HTTP/1.1\r\nHost: ${hosts[0]}\r\nHost: rancher.cormierconsulting.io\r\nConnection: close\r\n\r\n`});
  check('Duplicate Host headers are dropped', duplicate.output === '');
  const absolute = await raw({port: httpPort, rawRequest: `GET http://rancher.cormierconsulting.io/ HTTP/1.1\r\nHost: ${hosts[0]}\r\nConnection: close\r\n\r\n`});
  check('Absolute request target cannot override the approved Host', absolute.output === '');
  async function h2(authority) {
    return new Promise((resolve, reject) => {
      let status, connected = false;
      const session = http2.connect(`https://127.0.0.1:${httpsPort}`, {servername: hosts[0], ca: cert});
      session.on('connect', () => { connected = true; });
      session.on('error', () => {});
      const timer = setTimeout(() => {session.destroy(); reject(Error('HTTP/2 timed out'));}, 5000);
      const request = session.request({':path': '/', ':authority': authority});
      request.on('response', headers => {status = headers[':status'];});
      request.on('data', () => {});
      request.on('error', () => {});
      request.on('close', () => {clearTimeout(timer); session.destroy(); resolve({status, connected});});
      request.end();
    });
  }
  check('HTTP/2 approved authority is proxied', (await h2(hosts[0])).status === 200);
  for (const authority of ['', 'rancher.cormierconsulting.io', hosts[1]]) {
    const result = await h2(authority);
    check(`HTTP/2 drops empty, private, or mismatched authority: ${authority}`, result.connected && result.status === undefined);
  }
  const websocket = await raw({port: httpsPort, secure: true, servername: hosts[0], rawRequest: `GET /ws HTTP/1.1\r\nHost: ${hosts[0]}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n`});
  check('Approved WebSocket upgrade reaches the backend', websocket.output.startsWith('HTTP/1.1 101'));
  async function reload(value) {
    await writeFile(path.join(root, 'nginx.conf'), extractConfig(value));
    run('docker', ['exec', container, 'nginx', '-c', '/config/nginx.conf', '-t']);
    run('docker', ['exec', container, 'nginx', '-c', '/config/nginx.conf', '-s', 'reload']);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  await reload(render(['--set-json', `publicHosts=${JSON.stringify([hosts[0]])}`]));
  check('Removing a hostname closes its HTTP route', (await raw({port: httpPort, host: hosts[1]})).output === '');
  check('Removing a hostname rejects its TLS handshake', !(await raw({port: httpsPort, secure: true, servername: hosts[1], host: hosts[1]})).connected);
  check('Removing one hostname preserves the other application', (await raw({port: httpsPort, secure: true, servername: hosts[0], host: hosts[0]})).output.startsWith('HTTP/1.1 200'));
  await reload(denyAll);
  check('Empty allowlist closes formerly approved HTTP', (await raw({port: httpPort, host: hosts[0]})).output === '');
  check('Empty allowlist rejects formerly approved TLS', !(await raw({port: httpsPort, secure: true, servername: hosts[0], host: hosts[0]})).connected);
  const report = {observedAt: new Date().toISOString(), image, checks: passed.length, passed, success: true};
  await writeFile('.local/public-edge/security-tests.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (started) spawnSync('docker', ['rm', '-f', container], {stdio: 'ignore', timeout: 15_000});
  backend.closeAllConnections();
  backend.close();
}
