import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const root='.local/manager-installation',file=root+'/dns-credential-usage-metadata-2026-10-13.json';assert.ok(!fs.existsSync(file),'Reconcile the existing metadata attestation.');
const response=await fetch('http://127.0.0.1:15889/api/v1/namespaces/dns-system/secrets/dns-windows-bridge-credential');assert.ok(response.ok);const secret=await response.json(),digest=createHash('sha256').update(JSON.stringify(secret.data)).digest('hex');
assert.equal(secret.metadata.labels?.['kubernetes.io/legacy-token-last-used'],'2026-10-13');
const writer=secret.metadata.managedFields.find(f=>f.manager==='kube-apiserver'&&f.operation==='Update'&&f.time==='2026-10-13T00:00:01Z'&&f.fieldsV1?.['f:metadata']?.['f:labels']?.['f:kubernetes.io/legacy-token-last-used']);assert.ok(writer);
const evidence={observedAt:new Date().toISOString(),name:secret.metadata.name,uid:secret.metadata.uid,resourceVersion:secret.metadata.resourceVersion,digest,label:{name:'kubernetes.io/legacy-token-last-used',value:'2026-10-13'},writer:{manager:writer.manager,time:writer.time},baselines:[],passed:true};
for(const name of ['dns-credential-capture-13-owned.json','dns-record-order-21-owned.json']){
 const path=root+'/'+name,ledger=JSON.parse(fs.readFileSync(path)),before=(ledger.credentials||ledger.baseline.credentials).find(s=>s.name===secret.metadata.name);assert.equal(before.uid,secret.metadata.uid);assert.equal(before.digest,digest);assert.notEqual(before.resourceVersion,secret.metadata.resourceVersion);
 evidence.baselines.push({file:name,originalResourceVersion:before.resourceVersion});ledger.credentialMetadataUpdates={...(ledger.credentialMetadataUpdates||{}),[secret.metadata.name]:{originalResourceVersion:before.resourceVersion,uid:secret.metadata.uid,digest,resourceVersion:secret.metadata.resourceVersion,evidence:file}};fs.writeFileSync(path,JSON.stringify(ledger,null,2));
}
fs.writeFileSync(file,JSON.stringify(evidence,null,2));console.log('Attested the exact API-server daily token-usage label revision; immutable original baselines, credential UIDs and values remain unchanged.');
