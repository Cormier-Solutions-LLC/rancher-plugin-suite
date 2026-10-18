import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import tls from 'node:tls';

// Globalping sends these requests from independently hosted internet probes.
// It cannot send missing Host headers; verify those with verify-public-edge-live.
const allowed = ['proofing.cormierconsulting.io', 'invoicing.cormierconsulting.io'];
const resources = JSON.parse(execFileSync('kubectl', ['get', 'ingress,ingressroute', '-A', '-o', 'json'], {encoding:'utf8'}));
const privateHosts = [...new Set(resources.items.flatMap(v => [
  ...(v.spec.rules || []).map(rule => rule.host),
  ...(v.spec.routes || []).flatMap(route => [...route.match.matchAll(/Host\(`([^`]+)`\)/g)].map(match => match[1]))
]).filter(Boolean))].filter(host => !allowed.includes(host));
async function json(url, options = {}) {
  const response = await fetch(url, {...options, signal:AbortSignal.timeout(20000), headers:{'User-Agent':'public-edge-acceptance/1.0', ...options.headers}});
  const body = await response.text();
  assert.ok(response.ok, `${url} HTTP ${response.status}: ${body.slice(0,200)}`);
  return JSON.parse(body);
}
const [ipify, other] = await Promise.all([
  json('https://api.ipify.org?format=json'),
  fetch('https://icanhazip.com', {signal:AbortSignal.timeout(15000)}).then(r => r.text()).then(s => s.trim())
]);
assert.equal(ipify.ip, other, 'WAN address observations disagree');
const wan = ipify.ip;
// Read the public Plex certificate to discover its plex.direct hostname. This
// discovery socket does not establish trust; the external HTTPS checks below
// must validate the certificate chain and that exact hostname independently.
const plexHost = process.env.PUBLIC_EDGE_PLEX_HOST || await new Promise((resolve,reject) => {
  const socket = tls.connect({host:wan,port:32400,rejectUnauthorized:false}, () => {
    const commonName = socket.getPeerCertificate().subject?.CN || '';
    socket.destroy();
    if (!/^\*\.[a-f0-9]+\.plex\.direct$/.test(commonName)) return reject(Error('Unexpected Plex certificate; specify PUBLIC_EDGE_PLEX_HOST'));
    resolve(wan.replaceAll('.','-')+commonName.slice(1));
  });
  socket.setTimeout(10000,()=>{socket.destroy();reject(Error('Plex certificate discovery timed out'));});
  socket.on('error',reject);
});
const prior = process.argv.includes('--resume') ? JSON.parse(await readFile('.local/public-edge/external-tests.json','utf8')) : null;
if (prior) {
  assert.equal(prior.wan,wan);
  assert.ok(Date.now()-Date.parse(prior.observedAt)<1800000,'Prior results must be less than 30 minutes old');
  assert.deepEqual(prior.privateHosts,privateHosts);
  assert.deepEqual(prior.allowed,allowed);
}
const broadLocations = [{country:'US'}, {country:'CA'}, {country:'DE'}, {country:'AU'}];
const narrowLocations = [{country:'US'}, {country:'DE'}];
const scenarios = [];
for (const host of allowed) {
  for (const protocol of ['HTTP','HTTPS']) scenarios.push({host, protocol, kind:'allowed', target:wan, locations:broadLocations});
  scenarios.push({host, protocol:'HTTPS', kind:'allowed', target:host, locations:broadLocations});
}
for (const host of [...privateHosts, wan, 'unknown.example.com']) {
  for (const protocol of ['HTTP','HTTPS']) scenarios.push({host, protocol, kind:'denied', target:wan, locations:narrowLocations});
}
scenarios.push({host:'rancher.cormierconsulting.io', protocol:'HTTP', kind:'denied', target:wan, locations:narrowLocations,
  headers:{'X-Forwarded-Host':allowed[0], 'X-Forwarded-For':'10.99.1.1'}});
scenarios.push({host:plexHost, protocol:'HTTPS', port:32400, path:'/identity', kind:'plex', target:wan, locations:broadLocations});

function outcomePassed(scenario, result) {
  const {host, protocol, kind} = scenario;
  if (kind === 'allowed') return protocol === 'HTTP'
    ? result.status === 'finished' && result.statusCode === 308 && result.rawOutput.includes(`https://${host}/`)
    : result.status === 'finished' && result.statusCode === 200 && result.tls?.authorized === true && result.rawBody?.includes(host.startsWith('proofing.') ? 'Proof Studio' : 'Ledger');
  if (kind === 'plex') return result.status === 'finished' && result.statusCode === 200 && result.tls?.authorized === true && result.rawBody?.includes('MediaContainer');
  return result.status === 'failed' && result.failureSource === 'target' && !result.statusCode && !result.rawBody
    && /(?:^other side closed$|Empty reply from server|SSL.*(?:alert|error)|TLS.*(?:alert|error)|unrecognized name|handshake failure)/i.test(result.rawOutput || '');
}
const key = v => JSON.stringify([v.host,v.protocol,v.target,v.port,v.path,v.headers,v.kind]);
async function measure(scenario) {
  const {host, protocol, target, locations, headers, path = '/', port = protocol === 'HTTP' ? 80 : 443} = scenario;
  const retained = prior?.results.find(v => key(v) === key(scenario));
  if (retained?.status === 'finished' && retained.outcomes?.length === locations.length && retained.outcomes.every(v=>outcomePassed(scenario,v))) {
    return {...retained,passed:true,outcomes:retained.outcomes.map(v=>({...v,passed:true})),retained:true};
  }
  const created = await json('https://api.globalping.io/v1/measurements', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
    type:'http', target, locations, limit:locations.length, timeout:15,
    measurementOptions:{protocol, port, request:{...(host === wan ? {} : {host}), path, method:'GET', ...(headers ? {headers} : {})}}
  })});
  let result;
  const deadline = Date.now() + 45000;
  do {
    await new Promise(resolve => setTimeout(resolve, 800));
    result = await json(`https://api.globalping.io/v1/measurements/${created.id}`);
  } while (result.status === 'in-progress' && Date.now() < deadline);
  const outcomes = result.results.map(({probe, result:r}) => {
    const passed = outcomePassed(scenario,r);
    return {country:probe.country, city:probe.city, network:probe.network, passed, ...r};
  });
  return {...scenario, id:created.id, status:result.status, passed:result.status === 'finished' && outcomes.length === locations.length && outcomes.every(v=>v.passed), outcomes};
}
const results = [];
for (let index=0; index<scenarios.length; index+=3) {
  const batch = await Promise.allSettled(scenarios.slice(index,index+3).map(measure));
  for (let i=0;i<batch.length;i++) {
    const outcome = batch[i];
    const item = outcome.status === 'fulfilled' ? outcome.value : {...scenarios[index+i],passed:false,error:outcome.reason.message};
    results.push(item);
    console.log(JSON.stringify({host:item.host, target:item.target, protocol:item.protocol, kind:item.kind, passed:item.passed, id:item.id, error:item.error}));
  }
}
const report = {observedAt:new Date().toISOString(), wan, allowed, privateHosts, scenarioCount:results.length,
  probeCount:results.reduce((sum,v)=>sum+(v.outcomes?.length||0),0), retainedMeasurements:results.filter(v=>v.retained).length, passed:results.every(v=>v.passed), results};
await mkdir('.local/public-edge',{recursive:true});
await writeFile('.local/public-edge/external-tests.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed, scenarios:report.scenarioCount, probes:report.probeCount, failed:results.filter(v=>!v.passed).map(v=>({host:v.host,protocol:v.protocol,id:v.id,error:v.error,outcomes:v.outcomes?.map(o=>({country:o.country,status:o.status,statusCode:o.statusCode,rawOutput:o.rawOutput?.slice(-500)}))}))}));
assert.ok(report.passed,'External acceptance failed; inspect .local/public-edge/external-tests.json');
