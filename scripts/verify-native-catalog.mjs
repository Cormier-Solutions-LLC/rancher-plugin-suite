import fs from 'node:fs';import assert from 'node:assert/strict';
const phase=process.argv[2],file='.local/manager-installation/native-catalog-baseline.json',owned='custom-1791798903258-3';
assert.ok(['before','edited','draft-removed','clean','rescan','rescan-clean'].includes(phase));
async function get(path){const r=await fetch('http://127.0.0.1:15888'+path,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json();}
const state=JSON.parse((await get('/api/v1/namespaces/cattle-ui-plugin-system/configmaps/network-manager-state-user-jccb4')).data['state.json']);
const paths=['/api/v1/namespaces/manager-acceptance/services/protocol-fixture','/apis/traefik.io/v1alpha1/namespaces/manager-acceptance/ingressroutetcps/manager-protocols-tcp-15001','/apis/traefik.io/v1alpha1/namespaces/manager-acceptance/ingressrouteudps/manager-protocols-udp-15002','/apis/traefik.io/v1alpha1/namespaces/manager-acceptance/ingressroutes/manager-native-https-https-443'];
const cluster=await Promise.all(paths.map(async path=>{const r=await get(path);return {path,uid:r.metadata.uid,resourceVersion:r.metadata.resourceVersion,spec:r.spec};}));
const defaults=state.portConfigurations.filter(c=>['http','https','web'].includes(c.id)),others=state.publications.filter(p=>p.name!=='manager-native-protocols');
if(phase==='before'){assert.equal(defaults.length,3);fs.writeFileSync(file,JSON.stringify({cluster,defaults,others},null,2));console.log('Saved catalog baseline without credentials.');process.exit(0);}
const before=JSON.parse(fs.readFileSync(file));assert.deepEqual(cluster,before.cluster,'Catalog actions must not touch deployed resources.');assert.deepEqual(defaults,before.defaults);assert.deepEqual(others,before.others);
const config=state.portConfigurations.find(c=>c.id===owned);
if(phase==='edited'){assert.equal(config.name,'Native Protocol Acceptance Reviewed');assert.equal(config.revision,2);assert.equal(config.source,'Saved catalog configuration');assert.equal(state.pendingChanges.length,0);}
if(['draft-removed','clean','rescan','rescan-clean'].includes(phase))assert.ok(!state.publications.some(p=>p.name==='manager-native-protocols'));
if(['clean','rescan','rescan-clean'].includes(phase))assert.equal(config,undefined);
if(phase==='rescan')assert.ok(state.portConfigurations.some(c=>c.id==='detected-manager-acceptance-manager-native-rescan'&&c.ports.some(p=>p.port===39173&&p.mode==='TCP')));
if(phase==='rescan-clean'){assert.ok(!state.portConfigurations.some(c=>c.id==='detected-manager-acceptance-manager-native-rescan'));assert.equal(state.pendingChanges.length,0);assert.ok(!(state.editorDrafts||[]).some(d=>d.name?.includes('manager-native-rescan')));assert.equal((await fetch('http://127.0.0.1:15888/api/v1/namespaces/manager-acceptance/services/manager-native-rescan')).status,404);}
const report={phase,observedAt:new Date().toISOString(),deployedResourcesPreserved:true,otherDraftsPreserved:true,predefinedConfigurationsPreserved:true,catalogCount:state.portConfigurations.length,pendingCount:state.pendingChanges.length,passed:true};
fs.writeFileSync('.local/manager-installation/native-catalog-'+phase+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
