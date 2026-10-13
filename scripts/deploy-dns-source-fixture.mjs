import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = '.local/manager-installation';
const file = `${root}/dns-source-fixture-owned.json`;
const base = 'http://127.0.0.1:15889';
const namespace = 'dns-system';
const mode = process.argv[2];
const name = 'dns-source-fixture';
const zone = 'fixture.manager.test';
const serial = 2026101301;
let ledger;
try { ledger = JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const save = () => writeFile(file, JSON.stringify(ledger, null, 2));
async function request(path, init = {}) {
  const response = await fetch(base + path, {...init, signal:AbortSignal.timeout(20000)});
  let body = null;
  try { body = await response.json(); } catch {}
  return {status:response.status, body};
}
async function get(path, missing = false) {
  const result = await request(path);
  if (missing && result.status === 404) return null;
  assert.equal(result.status, 200, path);
  return result.body;
}
const server = `import dgram from 'node:dgram';import net from 'node:net';
const zone='${zone}',serial=${serial},port=8053;
const name=value=>Buffer.concat([...value.split('.').map(label=>Buffer.concat([Buffer.from([Buffer.byteLength(label)]),Buffer.from(label)])),Buffer.from([0])]);
const rr=(owner,type,ttl,data)=>{const head=Buffer.alloc(10);head.writeUInt16BE(type);head.writeUInt16BE(1,2);head.writeUInt32BE(ttl,4);head.writeUInt16BE(data.length,8);return Buffer.concat([name(owner),head,data]);};
const u32=(...values)=>{const out=Buffer.alloc(values.length*4);values.forEach((value,index)=>out.writeUInt32BE(value,index*4));return out;};
const soa=()=>rr(zone,6,60,Buffer.concat([name('ns1.'+zone),name('hostmaster.'+zone),u32(serial,60,30,300,60)]));
const ns=()=>rr(zone,2,60,name('ns1.'+zone));
function question(packet){if(packet.length<17)return null;let at=12;while(at<packet.length&&packet[at]){const size=packet[at++];if(size>63||at+size>packet.length)return null;at+=size;}if(at+5>packet.length)return null;at++;const end=at+4;return{bytes:packet.subarray(12,end),type:packet.readUInt16BE(at),end};}
function answer(packet,records){const q=question(packet);if(!q)return null;const header=Buffer.alloc(12);header.writeUInt16BE(packet.readUInt16BE(0));header.writeUInt16BE(0x8400,2);header.writeUInt16BE(1,4);header.writeUInt16BE(records.length,6);return Buffer.concat([header,q.bytes,...records]);}
const udp=dgram.createSocket('udp4');udp.on('message',(packet,peer)=>{const q=question(packet);const response=q&&q.type===6?answer(packet,[soa()]):null;if(response)udp.send(response,peer.port,peer.address);});udp.bind(port,'0.0.0.0');
const tcp=net.createServer(socket=>{let pending=Buffer.alloc(0);socket.on('data',chunk=>{pending=Buffer.concat([pending,chunk]);if(pending.length<2)return;const size=pending.readUInt16BE(0);if(pending.length<size+2)return;const packet=pending.subarray(2,size+2),q=question(packet);if(!q||q.type!==252)return socket.destroy();const response=answer(packet,[soa(),ns(),soa()]),length=Buffer.alloc(2);length.writeUInt16BE(response.length);socket.end(Buffer.concat([length,response]));});});tcp.listen(port,'0.0.0.0');
const close=()=>{udp.close();tcp.close(()=>process.exit(0));};process.on('SIGTERM',close);process.on('SIGINT',close);`;
const sourceDigest = createHash('sha256').update(server).digest('hex');
const pathFor = resource => resource.kind === 'Deployment'
  ? `/apis/apps/v1/namespaces/${namespace}/deployments`
  : `/api/v1/namespaces/${namespace}/${resource.kind === 'ServiceAccount' ? 'serviceaccounts' : resource.kind === 'Service' ? 'services' : 'configmaps'}`;
function resources(owner, observedAt = new Date().toISOString()) {
  const labels = {'app.kubernetes.io/name':name, 'manager-acceptance-id':owner};
  const inventory = {observedAt, host:`${name}.${namespace}.svc.cluster.local`, managementReachable:true, credentialRecoveryGuard:{version:1,sourceDigest}, zones:[{id:zone,name:zone,kind:'Forward',serial:String(serial)}], records:{[zone]:[
    {name:zone,type:'SOA',value:`ns1.${zone} hostmaster.${zone} ${serial} 60 30 300 60`,ttl:60},
    {name:zone,type:'NS',value:`ns1.${zone}`,ttl:60},
    {name:`ns1.${zone}`,type:'A',value:'192.0.2.53',ttl:60},
  ]}};
  return [
    {apiVersion:'v1',kind:'ServiceAccount',metadata:{name,namespace,labels}},
    {apiVersion:'v1',kind:'ConfigMap',metadata:{name:`${name}-code`,namespace,labels},data:{'server.mjs':server}},
    {apiVersion:'v1',kind:'ConfigMap',metadata:{name:`${name}-observations`,namespace,labels},data:{'inventory.json':JSON.stringify(inventory)}},
    {apiVersion:'v1',kind:'ConfigMap',metadata:{name:`${name}-queue`,namespace,labels},data:{'jobs.json':'[]'}},
    {apiVersion:'v1',kind:'Service',metadata:{name,namespace,labels},spec:{selector:{'app.kubernetes.io/name':name},ports:[{name:'dns-udp',port:53,targetPort:8053,protocol:'UDP'},{name:'dns-tcp',port:53,targetPort:8053,protocol:'TCP'}]}},
    {apiVersion:'apps/v1',kind:'Deployment',metadata:{name,namespace,labels},spec:{replicas:1,selector:{matchLabels:{'app.kubernetes.io/name':name}},template:{metadata:{labels:{'app.kubernetes.io/name':name,'manager-acceptance-id':owner}},spec:{serviceAccountName:name,securityContext:{runAsUser:1000,runAsGroup:1000,runAsNonRoot:true,seccompProfile:{type:'RuntimeDefault'}},containers:[{name:'dns',image:'node:24.20.0-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf',command:['node','/app/server.mjs'],ports:[{name:'dns-udp',containerPort:8053,protocol:'UDP'},{name:'dns-tcp',containerPort:8053,protocol:'TCP'}],resources:{requests:{cpu:'5m',memory:'24Mi'},limits:{cpu:'100m',memory:'64Mi'}},securityContext:{allowPrivilegeEscalation:false,readOnlyRootFilesystem:true,capabilities:{drop:['ALL']}},readinessProbe:{tcpSocket:{port:'dns-tcp'},periodSeconds:3},livenessProbe:{tcpSocket:{port:'dns-tcp'},periodSeconds:10},volumeMounts:[{name:'code',mountPath:'/app',readOnly:true}]}],volumes:[{name:'code',configMap:{name:`${name}-code`}}]}}}},
  ];
}

if (mode === 'plan') {
  assert.ok(!ledger, 'Inspect the original fixture ledger; do not replace it.');
  const owner = randomUUID(), desired = resources(owner), admission = [];
  for (const resource of desired) {
    const collection = pathFor(resource), item = `${collection}/${resource.metadata.name}`;
    assert.equal(await get(item, true), null, item);
    const result = await request(`${collection}?dryRun=All`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(resource)});
    assert.equal(result.status, 201, `${resource.kind}/${resource.metadata.name}`);
    admission.push({kind:resource.kind,name:resource.metadata.name,status:result.status});
  }
  ledger = {id:owner, startedAt:new Date().toISOString(), status:'Fixture admission passed; no production writes', sourceDigest, zone, serial, admission, resources:desired.map(resource=>({kind:resource.kind,name:resource.metadata.name}))};
  await save(); console.log(JSON.stringify({planned:true,resources:desired.length,productionWrites:0,sourceDigest}));
} else if (mode === 'apply') {
  assert.ok(ledger?.admission && !ledger.applyIntent, 'Reconcile the original fixture apply.');
  const desired = resources(ledger.id); ledger.applyIntent = new Date().toISOString(); ledger.status = 'Fixture creation submitted; readiness pending'; await save();
  ledger.created = [];
  for (const resource of desired) {
    const result = await request(pathFor(resource), {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(resource)});
    assert.equal(result.status, 201, `${resource.kind}/${resource.metadata.name}`);
    ledger.created.push({kind:resource.kind,name:resource.metadata.name,uid:result.body.metadata.uid}); await save();
  }
  const service = await get(`/api/v1/namespaces/${namespace}/services/${name}`);
  ledger.address = service.spec.clusterIP; ledger.status = 'Fixture resources created; readiness pending'; await save();
  console.log(JSON.stringify({created:true,address:ledger.address,resources:ledger.created.length}));
} else if (mode === 'ready') {
  assert.ok(ledger?.applyIntent && ledger.address);
  const deployment = await get(`/apis/apps/v1/namespaces/${namespace}/deployments/${name}`);
  assert.equal(deployment.status.readyReplicas, 1); assert.equal(deployment.status.updatedReplicas, 1);
  for (const owned of ledger.created) {
    const collection = owned.kind === 'Deployment' ? `/apis/apps/v1/namespaces/${namespace}/deployments` : `/api/v1/namespaces/${namespace}/${owned.kind === 'ServiceAccount' ? 'serviceaccounts' : owned.kind === 'Service' ? 'services' : 'configmaps'}`;
    const current = await get(`${collection}/${owned.name}`); assert.equal(current.metadata.uid, owned.uid); assert.equal(current.metadata.labels['manager-acceptance-id'], ledger.id);
  }
  ledger.ready = true; ledger.status = 'Isolated DNS source fixture Ready; registry not changed'; ledger.readyAt = new Date().toISOString(); await save();
  console.log(JSON.stringify({ready:true,address:ledger.address,zone,sourceDigest}));
} else if (mode === 'refresh') {
  assert.ok(ledger?.ready);
  const path = `/api/v1/namespaces/${namespace}/configmaps/${name}-observations`, current = await get(path), expectedUid = ledger.created.find(item=>item.kind==='ConfigMap'&&item.name===`${name}-observations`).uid;
  assert.equal(current.metadata.uid, expectedUid); const desired = resources(ledger.id, new Date().toISOString()).find(resource=>resource.metadata.name===`${name}-observations`); desired.metadata.resourceVersion = current.metadata.resourceVersion;
  const result = await request(path, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(desired)}); assert.equal(result.status,200); ledger.lastRefreshAt = JSON.parse(result.body.data['inventory.json']).observedAt; await save();
  console.log(JSON.stringify({refreshed:true,observedAt:ledger.lastRefreshAt}));
} else throw Error('Choose plan, apply, ready, or refresh.');
