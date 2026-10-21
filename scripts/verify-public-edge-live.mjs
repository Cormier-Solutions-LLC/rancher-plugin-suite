import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFile, mkdir} from 'node:fs/promises';
import net from 'node:net';
import tls from 'node:tls';
import {http2Sequence} from './lib/http2-sequence.mjs';

const target = process.env.PUBLIC_EDGE_TARGET || '127.0.0.1';
const httpPort = Number(process.env.PUBLIC_EDGE_HTTP_PORT || 18080);
const httpsPort = Number(process.env.PUBLIC_EDGE_HTTPS_PORT || 18443);
const publicHosts = ['proofing.cormierconsulting.io', 'invoicing.cormierconsulting.io'];
const current = JSON.parse(execFileSync('kubectl', ['get', 'ingress,ingressroute', '-A', '-o', 'json'], {encoding: 'utf8'}));
const allHosts = [...new Set(current.items.flatMap(resource => [
  ...(resource.spec.rules || []).map(rule => rule.host),
  ...(resource.spec.routes || []).flatMap(route => [...route.match.matchAll(/Host\(`([^`]+)`\)/g)].map(match => match[1]))
]).filter(Boolean))];
const privateHosts = allHosts.filter(host => !publicHosts.includes(host));
function request({host, secure = false, servername, rawRequest, version = '1.1', headers = ''}) {
  return new Promise((resolve, reject) => {
    let output = '', connected = false, settled = false;
    const finish = result => { if (!settled) { settled = true; socket.destroy(); resolve(result); } };
    const options = {host: target, port: secure ? httpsPort : httpPort, ...(secure ? {servername: servername || ''} : {})};
    const socket = secure ? tls.connect(options) : net.connect(options);
    socket.setTimeout(10_000, () => {socket.destroy(); reject(Error('Connection timed out'));});
    socket.on(secure ? 'secureConnect' : 'connect', () => {
      connected = true;
      socket.write(rawRequest || `GET / HTTP/${version}\r\n${host === undefined ? '' : `Host: ${host}\r\n`}${headers}Connection: close\r\n\r\n`);
    });
    socket.on('data', data => output += data);
    socket.on('end', () => finish({output, connected}));
    socket.on('close', () => finish({output, connected}));
    socket.on('error', error => {
      if (['ECONNRESET', 'ERR_SSL_TLSV1_UNRECOGNIZED_NAME', 'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE'].includes(error.code)) finish({output, connected, error: error.code});
      else reject(error);
    });
  });
}
const passed = [];
const check = (name, valid) => {assert.ok(valid, name); passed.push(name);};
for (const host of publicHosts) {
  const plain = await request({host});
  check(`HTTP redirects ${host} to HTTPS`, plain.output.startsWith('HTTP/1.1 308') && plain.output.includes(`Location: https://${host}/`));
  const secure = await request({host, secure: true, servername: host});
  check(`HTTPS serves ${host} with a publicly trusted certificate`, secure.output.startsWith('HTTP/1.1 200'));
  check(`HTTPS returns the expected ${host} application`, secure.output.includes(host.startsWith('proofing.') ? 'Proof Studio' : 'Ledger'));
}
for (const host of [...privateHosts, undefined, '', target, 'unknown.example.com']) {
  check(`HTTP drops ${host || 'missing/empty Host'}`, (await request({host})).output === '');
}
for (const host of privateHosts) {
  const result = await request({host, secure: true, servername: host});
  check(`TLS rejects private hostname ${host}`, !result.connected && result.output === '');
  check(`Valid SNI cannot forward private Host ${host}`, (await request({host, secure: true, servername: publicHosts[0]})).output === '');
}
check('TLS rejects absent SNI', !(await request({host: publicHosts[0], secure: true})).connected);
check('HTTP/1.0 without Host is dropped', (await request({version: '1.0'})).output === '');
check('HTTP/1.1 without Host is dropped', (await request({})).output === '');
check('HTTPS without Host is dropped', (await request({secure: true, servername: publicHosts[0]})).output === '');
check('Approved SNI and a different approved Host are rejected', (await request({host: publicHosts[1], secure: true, servername: publicHosts[0]})).output === '');
check('Forged forwarding headers cannot expose Rancher', (await request({host: 'rancher.cormierconsulting.io', secure: true, servername: publicHosts[0], headers: `X-Forwarded-Host: ${publicHosts[0]}\r\nX-Forwarded-For: 10.99.1.1\r\n`})).output === '');
check('Duplicate Host headers are dropped', (await request({rawRequest: `GET / HTTP/1.1\r\nHost: ${publicHosts[0]}\r\nHost: rancher.cormierconsulting.io\r\n\r\n`})).output === '');
for (const servername of publicHosts) {
  const other = publicHosts.find(host => host !== servername);
  const sequence = await http2Sequence({target, port: httpsPort, servername, authorities: [servername, other, servername]});
  check(`HTTP/2 ${other} on a ${servername} connection returns 421 without a protocol error`, sequence[1].status === 421 && !sequence[1].error);
  check(`HTTP/2 ${servername} connection remains usable after a mismatched authority`, sequence[0].status === 200 && sequence[2].status === 200);
  const retry = (await http2Sequence({target, port: httpsPort, servername: other, authorities: [other]}))[0];
  check(`HTTP/2 retry to ${other} serves the expected application`, retry.status === 200 && retry.body.includes(other.startsWith('proofing.') ? 'Proof Studio' : 'Ledger'));
}
for (const authority of ['', 'rancher.cormierconsulting.io', 'unknown.example.com']) {
  const result = (await http2Sequence({target, port: httpsPort, servername: publicHosts[0], authorities: [authority]}))[0];
  check(`HTTP/2 drops missing/private/unknown authority ${authority}`, result.status === undefined);
}
const deployment = JSON.parse(execFileSync('kubectl', ['get', 'deployment', 'public-edge', '-n', 'public-edge', '-o', 'json'], {encoding: 'utf8'}));
check('All configured gateway replicas are ready', deployment.status.readyReplicas === deployment.spec.replicas && deployment.status.updatedReplicas === deployment.spec.replicas);
const report = {observedAt: new Date().toISOString(), target, httpPort, httpsPort, publicHosts, privateHosts, checks: passed.length, passed, success: true};
await mkdir('.local/public-edge', {recursive: true});
await writeFile('.local/public-edge/live-tests.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
