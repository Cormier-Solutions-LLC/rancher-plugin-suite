import fs from 'node:fs';
import {createHash} from 'node:crypto';
const controllerCode=fs.readFileSync('live-management/dns-controller.mjs','utf8');
const replicationCode=fs.readFileSync('live-management/dns-zone-replication.mjs','utf8');
const credentialCode=fs.readFileSync('live-management/dns-credentials.mjs','utf8');
const engineCode=fs.readFileSync('live-management/dns-engine-api.mjs','utf8');
const proofCode=fs.readFileSync('live-management/dns-controller-credential-proof.mjs','utf8');
const sourceCode=Object.fromEntries(['dns-source-observer.mjs','dns-source-catalog.mjs','dns-source-wire.mjs','dns-source-settings.mjs'].map(name=>[name,fs.readFileSync('live-management/'+name,'utf8')]));
const hash=createHash('sha256').update(controllerCode).update(replicationCode).update(credentialCode).update(engineCode).update(proofCode);for(const code of Object.values(sourceCode))hash.update(code);const codeHash=hash.digest('hex');
const namespace='dns-system',labels={'app.kubernetes.io/name':'dns-manager-controller'};
const items=[
 {apiVersion:'v1',kind:'ConfigMap',metadata:{name:'dns-manager-controller-code',namespace},data:{'dns-controller.mjs':controllerCode,'dns-zone-replication.mjs':replicationCode,'dns-credentials.mjs':credentialCode,'dns-engine-api.mjs':engineCode,'dns-controller-credential-proof.mjs':proofCode,...sourceCode}},
 {apiVersion:'v1',kind:'ServiceAccount',metadata:{name:'dns-manager-controller',namespace}},
 {apiVersion:'rbac.authorization.k8s.io/v1',kind:'Role',metadata:{name:'dns-manager-controller',namespace},rules:[{apiGroups:[''],resources:['configmaps'],resourceNames:['dns-manager-observations','dns-windows-observations'],verbs:['get']},{apiGroups:[''],resources:['configmaps'],resourceNames:['dns-manager-observations'],verbs:['update']}]},
 {apiVersion:'rbac.authorization.k8s.io/v1',kind:'RoleBinding',metadata:{name:'dns-manager-controller',namespace},roleRef:{apiGroup:'rbac.authorization.k8s.io',kind:'Role',name:'dns-manager-controller'},subjects:[{kind:'ServiceAccount',name:'dns-manager-controller',namespace}]},
 {apiVersion:'apps/v1',kind:'Deployment',metadata:{name:'dns-manager-controller',namespace},spec:{replicas:1,selector:{matchLabels:labels},template:{metadata:{labels,annotations:{'dns-manager/code-hash':codeHash}},spec:{serviceAccountName:'dns-manager-controller',securityContext:{runAsNonRoot:true,runAsUser:1000,runAsGroup:1000,fsGroup:1000},containers:[{name:'controller',image:'node:24.20.0-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf',command:['node','/app/dns-controller.mjs'],securityContext:{readOnlyRootFilesystem:true,allowPrivilegeEscalation:false,capabilities:{drop:['ALL']}},resources:{requests:{cpu:'10m',memory:'64Mi'},limits:{cpu:'500m',memory:'256Mi'}},livenessProbe:{httpGet:{path:'/healthz',port:8080},periodSeconds:20,failureThreshold:6},readinessProbe:{httpGet:{path:'/healthz',port:8080},periodSeconds:10},volumeMounts:[{name:'code',mountPath:'/app',readOnly:true},{name:'credentials',mountPath:'/run/credentials',readOnly:true}]}],volumes:[{name:'code',configMap:{name:'dns-manager-controller-code'}},{name:'credentials',secret:{secretName:'dns-manager-engine-admin',defaultMode:288}}]}}}},
];
fs.writeFileSync('.local/manager-installation/dns-controller.json',JSON.stringify({apiVersion:'v1',kind:'List',items},null,2));

fs.writeFileSync('.local/manager-installation/dns-controller-bootstrap.json',JSON.stringify({apiVersion:'v1',kind:'ConfigMap',metadata:{name:'dns-manager-observations',namespace},data:{'inventory.json':'{}'}},null,2));
