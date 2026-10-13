import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { validateDnsSourceBindings } from '../live-management/dns-source-catalog.mjs';

const root = '.local/manager-installation';
const file = `${root}/dns-source-fixture-registry-owned.json`;
const fixture = JSON.parse(await readFile(`${root}/dns-source-fixture-owned.json`, 'utf8'));
assert.equal(fixture.ready, true);
const base = 'http://127.0.0.1:15889', namespace = 'dns-system', mode = process.argv[2];
const registryPath = `/api/v1/namespaces/${namespace}/configmaps/dns-manager-source-bindings`;
const registryCollection = `/api/v1/namespaces/${namespace}/configmaps`;
const rolePath = `/apis/rbac.authorization.k8s.io/v1/namespaces/${namespace}/roles/dns-manager-controller`;
const controllerPath = `/apis/apps/v1/namespaces/${namespace}/deployments/dns-manager-controller`;
const runtimePath = '/apis/apps/v1/namespaces/manager-system/statefulsets/dns-manager-snapshots';
let ledger;
try { ledger = JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const save = () => writeFile(file, JSON.stringify(ledger, null, 2));
async function request(path, init = {}) {
  const response = await fetch(base + path, {...init, signal:AbortSignal.timeout(20000)});
  let body = null; try { body = await response.json(); } catch {}
  return {status:response.status, body};
}
async function get(path) { const result = await request(path); assert.equal(result.status,200,path); return result.body; }
const clean = object => { const value = structuredClone(object); for (const key of ['uid','resourceVersion','generation','creationTimestamp','managedFields','deletionTimestamp','deletionGracePeriodSeconds']) delete value.metadata[key]; delete value.status; return value; };
const digest = value => createHash('sha256').update(value).digest('hex');
function setEnv(workload, name, value) {
  const container = workload.spec.template.spec.containers.find(item => item.name === (workload.kind === 'Deployment' ? 'controller' : 'snapshots'));
  const entry = container.env.find(item => item.name === name); assert.ok(entry, `${workload.kind} ${name}`); entry.value = value;
}

if (mode === 'plan') {
  assert.ok(!ledger, 'Inspect the existing registry rollout; do not replace it.');
  const [registry, role, controller, runtime, observation, queue, account] = await Promise.all([
    get(registryPath), get(rolePath), get(controllerPath), get(runtimePath),
    get(`/api/v1/namespaces/${namespace}/configmaps/dns-source-fixture-observations`),
    get(`/api/v1/namespaces/${namespace}/configmaps/dns-source-fixture-queue`),
    get(`/api/v1/namespaces/${namespace}/serviceaccounts/dns-source-fixture`),
  ]);
  assert.equal(registry.immutable, true); assert.equal(controller.metadata.generation, 8); assert.equal(runtime.metadata.generation, 24);
  const current = validateDnsSourceBindings(JSON.parse(registry.data['bindings.json'])); assert.equal(current.bindings.length,1);
  const binding = {id:'fixture-bridge',host:'dns-source-fixture.dns-system.svc.cluster.local',address:fixture.address,credential:'Isolated DNS acceptance bridge',namespace,observationName:observation.metadata.name,observationUid:observation.metadata.uid,queueName:queue.metadata.name,queueUid:queue.metadata.uid,accountUid:account.metadata.uid,sourceDigest:fixture.sourceDigest,writable:true};
  const next = validateDnsSourceBindings({version:1,bindings:[...current.bindings,binding]}), serialized = JSON.stringify(next), bindingDigest = digest(serialized), owner = randomUUID();
  const nextRegistry = {apiVersion:'v1',kind:'ConfigMap',metadata:{name:'dns-manager-source-bindings',namespace,labels:{...registry.metadata.labels,'manager-acceptance-id':owner}},immutable:true,data:{'bindings.json':serialized}};
  const admissionRegistry = structuredClone(nextRegistry); admissionRegistry.metadata.name = `dns-source-bindings-admission-${owner.slice(0,8)}`;
  const registryDryRun = await request(`${registryCollection}?dryRun=All`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(admissionRegistry)}); assert.equal(registryDryRun.status,201);
  const nextRole = structuredClone(role); const readRule = nextRole.rules.find(rule=>rule.verbs.includes('get')&&rule.resources.includes('configmaps')); assert.ok(readRule); assert.ok(!readRule.resourceNames.includes(observation.metadata.name)); readRule.resourceNames.push(observation.metadata.name);
  const roleDryRun = await request(`${rolePath}?dryRun=All`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(nextRole)}); assert.equal(roleDryRun.status,200);
  const nextController = structuredClone(controller); setEnv(nextController,'DNS_SOURCE_BINDINGS_UID','__NEW_REGISTRY_UID__'); setEnv(nextController,'DNS_SOURCE_BINDINGS_SHA256',bindingDigest);
  const controllerAdmission = structuredClone(nextController); setEnv(controllerAdmission,'DNS_SOURCE_BINDINGS_UID',randomUUID());
  const controllerDryRun = await request(`${controllerPath}?dryRun=All`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(controllerAdmission)}); assert.equal(controllerDryRun.status,200);
  const nextRuntime = structuredClone(runtime); setEnv(nextRuntime,'DNS_SOURCE_BINDINGS_UID','__NEW_REGISTRY_UID__'); setEnv(nextRuntime,'DNS_SOURCE_BINDINGS_SHA256',bindingDigest);
  const runtimeAdmission = structuredClone(nextRuntime); setEnv(runtimeAdmission,'DNS_SOURCE_BINDINGS_UID',randomUUID());
  const runtimeDryRun = await request(`${runtimePath}?dryRun=All`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(runtimeAdmission)}); assert.equal(runtimeDryRun.status,200);
  ledger = {id:owner,startedAt:new Date().toISOString(),status:'Registry replacement and workload pin updates passed admission; no writes',fixture:{address:fixture.address,sourceDigest:fixture.sourceDigest,observationUid:observation.metadata.uid,queueUid:queue.metadata.uid,accountUid:account.metadata.uid},binding,bindingDigest,before:{registry,role,controller,runtime},desired:{registry:nextRegistry,role:nextRole,controller:nextController,runtime:nextRuntime},admission:{registry:201,role:200,controller:200,runtime:200},productionDnsWrites:0,productionCredentialWrites:0}; await save();
  console.log(JSON.stringify({planned:true,bindingId:binding.id,address:binding.address,bindingDigest,admission:ledger.admission,productionDnsWrites:0,productionCredentialWrites:0}));
} else if (mode === 'install') {
  assert.ok(ledger?.admission && !ledger.registryReplaceIntent, 'Reconcile the existing registry install.');
  const current = await get(registryPath); assert.equal(current.metadata.uid,ledger.before.registry.metadata.uid); assert.equal(current.metadata.resourceVersion,ledger.before.registry.metadata.resourceVersion); assert.deepEqual(current.data,ledger.before.registry.data);
  ledger.registryReplaceIntent = new Date().toISOString(); ledger.status = 'Original registry replacement submitted'; await save();
  const removed = await request(registryPath,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiVersion:'v1',kind:'DeleteOptions',preconditions:{uid:current.metadata.uid,resourceVersion:current.metadata.resourceVersion}})}); assert.ok([200,202].includes(removed.status)); ledger.registryDeleteStatus=removed.status; await save();
  const created = await request(registryCollection,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ledger.desired.registry)}); assert.equal(created.status,201); ledger.registryUid=created.body.metadata.uid; ledger.registryResourceVersion=created.body.metadata.resourceVersion; await save();
  const role = structuredClone(ledger.desired.role); role.metadata.resourceVersion = ledger.before.role.metadata.resourceVersion; ledger.roleIntent=new Date().toISOString(); await save(); const roleResult=await request(rolePath,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(role)}); assert.equal(roleResult.status,200); ledger.roleResourceVersion=roleResult.body.metadata.resourceVersion; await save();
  const controller = structuredClone(ledger.desired.controller); setEnv(controller,'DNS_SOURCE_BINDINGS_UID',ledger.registryUid); controller.metadata.resourceVersion=ledger.before.controller.metadata.resourceVersion; ledger.controllerIntent=new Date().toISOString(); await save(); const controllerResult=await request(controllerPath,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(controller)}); assert.equal(controllerResult.status,200); ledger.controllerGeneration=controllerResult.body.metadata.generation; ledger.expectedControllerSpec=controllerResult.body.spec; await save();
  const runtime = structuredClone(ledger.desired.runtime); setEnv(runtime,'DNS_SOURCE_BINDINGS_UID',ledger.registryUid); runtime.metadata.resourceVersion=ledger.before.runtime.metadata.resourceVersion; ledger.runtimeIntent=new Date().toISOString(); await save(); const runtimeResult=await request(runtimePath,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(runtime)}); assert.equal(runtimeResult.status,200); ledger.runtimeGeneration=runtimeResult.body.metadata.generation; ledger.expectedRuntimeSpec=runtimeResult.body.spec; ledger.status='Registry installed; controller and runtime rollouts pending'; await save();
  console.log(JSON.stringify({installed:true,registryUid:ledger.registryUid,controllerGeneration:ledger.controllerGeneration,runtimeGeneration:ledger.runtimeGeneration}));
} else if (mode === 'ready') {
  assert.ok(ledger?.runtimeIntent);
  const [registry,role,controller,runtime] = await Promise.all([get(registryPath),get(rolePath),get(controllerPath),get(runtimePath)]);
  assert.equal(registry.metadata.uid,ledger.registryUid); assert.equal(registry.immutable,true); assert.equal(digest(registry.data['bindings.json']),ledger.bindingDigest); assert.equal(JSON.parse(registry.data['bindings.json']).bindings.length,2);
  assert.equal(role.metadata.uid,ledger.before.role.metadata.uid); assert.ok(role.rules.some(rule=>rule.resourceNames?.includes('dns-source-fixture-observations')));
  assert.equal(controller.metadata.uid,ledger.before.controller.metadata.uid); assert.equal(controller.metadata.generation,ledger.controllerGeneration); assert.deepEqual(controller.spec,ledger.expectedControllerSpec); assert.equal(controller.status.observedGeneration,controller.metadata.generation); assert.equal(controller.status.readyReplicas,1); assert.equal(controller.status.updatedReplicas,1);
  assert.equal(runtime.metadata.uid,ledger.before.runtime.metadata.uid); assert.equal(runtime.metadata.generation,ledger.runtimeGeneration); assert.deepEqual(runtime.spec,ledger.expectedRuntimeSpec); assert.equal(runtime.status.observedGeneration,runtime.metadata.generation); assert.equal(runtime.status.readyReplicas,1); assert.equal(runtime.status.currentRevision,runtime.status.updateRevision);
  const oldBinding = JSON.parse(ledger.before.registry.data['bindings.json']).bindings[0], next = JSON.parse(registry.data['bindings.json']); assert.deepEqual(next.bindings[0],oldBinding); assert.deepEqual(next.bindings[1],ledger.binding);
  ledger.ready=true; ledger.readyAt=new Date().toISOString(); ledger.status='Two-binding immutable registry Ready; existing binding and workload identities preserved'; await save();
  console.log(JSON.stringify({ready:true,registryUid:ledger.registryUid,bindings:2,controllerGeneration:ledger.controllerGeneration,runtimeGeneration:ledger.runtimeGeneration,productionDnsWrites:0,productionCredentialWrites:0}));
} else throw Error('Choose plan, install, or ready.');
