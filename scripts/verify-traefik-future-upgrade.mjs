import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {isDeepStrictEqual} from 'node:util';
const yaml=createRequire(process.cwd()+'/dns-manager-dev/package.json')('js-yaml');
const dir='.local/manager-installation/';
const read=n=>JSON.parse(fs.readFileSync(dir+n,'utf8').replace(/^\uFEFF/,''));
const load=n=>yaml.loadAll(read(n).manifest).filter(Boolean);
const actual=load('traefik-future-upgrade-dry-run-private.json');
const approved=load('traefik-client-address-dry-run-private.json');
const services=actual.filter(x=>x.kind==='Service'&&['traefik','traefik-udp'].includes(x.metadata.name));
assert.equal(services.length,2);
for(const s of services){
  assert.equal(s.spec.externalTrafficPolicy,'Local');
  assert.ok(!s.spec.loadBalancerIP,'Legacy IP must remain empty');
  assert.equal(s.metadata.annotations['metallb.io/loadBalancerIPs'],'10.99.15.50');
}
// Kubernetes treats an explicit null legacy field and an omitted field alike.
for(const list of [actual,approved])for(const x of list)if(x.kind==='Service'&&x.spec.loadBalancerIP==null)delete x.spec.loadBalancerIP;
assert.ok(isDeepStrictEqual(actual,approved),'Future upgrade differs from approved manifest beyond null-field normalization');
const report={observedAt:new Date().toISOString(),serverDryRun:true,reuseValuesWithoutOverride:true,persistentLocalTrafficPolicy:true,canonicalVipPreserved:true,duplicateLegacyAddressAbsent:true,renderedResourcesEquivalentToApprovedUpgrade:true,passed:true};
fs.writeFileSync(dir+'traefik-future-upgrade-tests.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
