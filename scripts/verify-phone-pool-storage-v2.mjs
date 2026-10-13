import fs from 'node:fs';
import assert from 'node:assert/strict';
import {kube} from './phone-acceptance-client.mjs';
const dir='.local/manager-installation/',pool=JSON.parse(fs.readFileSync(dir+'phone-pool-capacity-v2-owned.json'));
assert.ok(pool.ceilingVerifiedAt);
const [volumes,replicas,nodes,pods]=await Promise.all([
 kube('/apis/longhorn.io/v1beta2/namespaces/longhorn-system/volumes'),
 kube('/apis/longhorn.io/v1beta2/namespaces/longhorn-system/replicas'),
 kube('/api/v1/nodes'),
 kube('/api/v1/namespaces/automation/pods?labelSelector=app.kubernetes.io%2Fmanaged-by%3Dphone-queue-controller')]);
assert.equal(pods.items.length,10);
assert.ok(pods.items.every(p=>pool.tasks.slice(0,10).some(t=>t.id===p.metadata.labels['automation.openai.com/task-id'])&&!p.metadata.deletionTimestamp&&p.status.conditions.some(c=>c.type==='Ready'&&c.status==='True')));
const checks=pool.tasks.slice(0,10).map(t=>{
 assert.ok(t.volumeName);
 const v=volumes.items.find(v=>v.metadata.name===t.volumeName);
 assert.ok(v); assert.equal(v.spec.numberOfReplicas,3); assert.equal(v.status.robustness,'healthy'); assert.equal(v.status.cloneStatus.state,'completed');
 const r=replicas.items.filter(r=>r.spec.volumeName===t.volumeName&&r.status.currentState==='running'&&r.spec.healthyAt&&!r.spec.failedAt);
 assert.equal(r.length,3);
 const zones=r.map(r=>nodes.items.find(n=>n.metadata.name===r.spec.nodeID)?.metadata.labels['topology.kubernetes.io/zone']);
 assert.ok(zones.every(Boolean)); assert.equal(new Set(zones).size,3);
 return {index:t.index,healthyReplicas:r.length,distinctPhysicalZones:new Set(zones).size};
});
assert.ok(nodes.items.every(n=>n.status.conditions.some(c=>c.type==='Ready'&&c.status==='True')));
const report={observedAt:new Date().toISOString(),tenReadyClones:true,tenHealthyVolumes:true,threeHealthyReplicasPerClone:true,threeDistinctPhysicalZonesPerClone:true,checks,nodesReady:nodes.items.length,passed:true};
fs.writeFileSync(dir+'phone-pool-storage-v2-tests.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({observedAt:report.observedAt,healthyVolumes:10,healthyReplicas:30,physicalZonesPerVolume:3,nodesReady:report.nodesReady,passed:true}));
