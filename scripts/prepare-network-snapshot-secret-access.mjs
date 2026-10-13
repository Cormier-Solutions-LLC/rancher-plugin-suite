// Grant GET only for names referenced by the current routing/certificate inventory.
// No Secret contents are read, no list/update permission is granted, and saved
// browser templates cannot select the names.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {freshNetworkSnapshot} from '../preview-data/fresh-network-source.mjs';
import {secretReferences} from '../simple-network-manager-dev/pkg/simple-network-manager/config/snapshot-secrets.mjs';
process.env.SNAPSHOT_NETWORK_STATE_CONFIGMAP='network-manager-state-user-jccb4';
async function read(path){assert.ok(!path.includes('/secrets/'));const r=await fetch('http://127.0.0.1:15888'+path,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);return r.json();}
const {current}=await freshNetworkSnapshot({snapshotScope:{namespace:'',source:'Authenticated Kubernetes inventory and saved manager configuration'}},read);
const refs=secretReferences(current.routeManifests,'cert-manager'),namespaces=[...new Set(refs.map(r=>r.namespace))].sort();
const items=namespaces.flatMap(namespace=>{
 const name='network-snapshot-referenced-secrets';
 return [{apiVersion:'rbac.authorization.k8s.io/v1',kind:'Role',metadata:{name,namespace},rules:[{apiGroups:[''],resources:['secrets'],resourceNames:refs.filter(r=>r.namespace===namespace).map(r=>r.name).sort(),verbs:['get']}]},{apiVersion:'rbac.authorization.k8s.io/v1',kind:'RoleBinding',metadata:{name,namespace},roleRef:{apiGroup:'rbac.authorization.k8s.io',kind:'Role',name},subjects:[{kind:'ServiceAccount',name:'network-manager-snapshots',namespace:'manager-system'}]}];
});
fs.writeFileSync('.local/manager-installation/network-snapshot-secret-access.json',JSON.stringify({apiVersion:'v1',kind:'List',items},null,2));
console.log(JSON.stringify({namedSecrets:refs.length,namespaces:namespaces.length,permission:'get only',readSecretValues:false}));
