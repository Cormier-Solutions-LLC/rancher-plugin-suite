import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const fixture = JSON.parse(await readFile('.local/manager-installation/dns-source-fixture-owned.json', 'utf8'));
assert.equal(fixture.ready, true);
const probe = `import {dnsUdpSoa,dnsTcpAxfr} from '/app/live-management/dns-source-wire.mjs';\nconst address=${JSON.stringify(fixture.address)},zone=${JSON.stringify(fixture.zone)};try{const query=await dnsUdpSoa(address,zone),transfer=await dnsTcpAxfr(address,zone);console.log(JSON.stringify({address,zone,query,transfer,consistent:query.serial===transfer.serial}));}catch(error){console.log(JSON.stringify({address,zone,code:error.code||'SOURCE_UNCONFIRMED'}));process.exitCode=1;}`;
const result = await new Promise((resolve, reject) => {
  const child = spawn('kubectl', ['-n','manager-system','exec','-i','dns-manager-snapshots-0','--','node','--input-type=module'], {stdio:['pipe','pipe','pipe']});
  let stdout = '', stderr = '';
  const timer = setTimeout(() => { child.kill(); reject(Error('Fixture DNS probe timed out.')); }, 30000);
  child.stdout.on('data', bytes => stdout += bytes);
  child.stderr.on('data', bytes => stderr += bytes);
  child.on('error', reject);
  child.on('close', code => {
    clearTimeout(timer);
    if (code !== 0) return reject(Error(`Fixture DNS probe failed: ${stderr.trim()}`));
    try { resolve(JSON.parse(stdout)); } catch { reject(Error('Fixture DNS probe returned invalid metadata.')); }
  });
  child.stdin.end(probe);
});
assert.equal(result.query?.authoritative, true);
assert.equal(result.transfer?.complete, true);
assert.equal(result.consistent, true);
assert.equal(result.query.serial, fixture.serial);
const report = {observedAt:new Date().toISOString(),probeOrigin:'Installed DNS snapshot backend pod',readOnly:true,...result,passed:true};
await writeFile('.local/manager-installation/dns-source-fixture-wire-tests.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
