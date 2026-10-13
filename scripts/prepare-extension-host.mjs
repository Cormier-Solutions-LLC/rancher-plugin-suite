// Prepare immutable, compressed extension assets for an internal Kubernetes host.
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const packages = [
  ['dns-manager', '0.1.31', 'dns-manager-dev/dist-pkg/dns-manager-0.1.31'],
  ['simple-network-manager', '0.1.26', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.26'],
  ['dns-manager', '0.1.30', 'dns-manager-dev/dist-pkg/dns-manager-0.1.30'],
  ['dns-manager', '0.1.29', 'dns-manager-dev/dist-pkg/dns-manager-0.1.29'],
  ['dns-manager', '0.1.28', 'dns-manager-dev/dist-pkg/dns-manager-0.1.28'],
  ['dns-manager', '0.1.27', 'dns-manager-dev/dist-pkg/dns-manager-0.1.27'],
  ['dns-manager', '0.1.26', 'dns-manager-dev/dist-pkg/dns-manager-0.1.26'],
  ['dns-manager', '0.1.25', 'dns-manager-dev/dist-pkg/dns-manager-0.1.25'],
  ['dns-manager', '0.1.24', 'dns-manager-dev/dist-pkg/dns-manager-0.1.24'],
  ['dns-manager', '0.1.23', 'dns-manager-dev/dist-pkg/dns-manager-0.1.23'],
  ['dns-manager', '0.1.22', 'dns-manager-dev/dist-pkg/dns-manager-0.1.22'],
  ['dns-manager', '0.1.21', 'dns-manager-dev/dist-pkg/dns-manager-0.1.21'],
  ['dns-manager', '0.1.20', 'dns-manager-dev/dist-pkg/dns-manager-0.1.20'],
  ['simple-network-manager', '0.1.25', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.25'],
  ['dns-manager', '0.1.19', 'dns-manager-dev/dist-pkg/dns-manager-0.1.19'],
  ['dns-manager', '0.1.18', 'dns-manager-dev/dist-pkg/dns-manager-0.1.18'],
  ['dns-manager', '0.1.17', 'dns-manager-dev/dist-pkg/dns-manager-0.1.17'],
  ['dns-manager', '0.1.16', 'dns-manager-dev/dist-pkg/dns-manager-0.1.16'],
  ['dns-manager', '0.1.15', 'dns-manager-dev/dist-pkg/dns-manager-0.1.15'],
  ['dns-manager', '0.1.14', 'dns-manager-dev/dist-pkg/dns-manager-0.1.14'],
  ['dns-manager', '0.1.13', 'dns-manager-dev/dist-pkg/dns-manager-0.1.13'],
  ['dns-manager', '0.1.12', 'dns-manager-dev/dist-pkg/dns-manager-0.1.12'],
  ['dns-manager', '0.1.11', 'dns-manager-dev/dist-pkg/dns-manager-0.1.11'],
  ['dns-manager', '0.1.10', 'dns-manager-dev/dist-pkg/dns-manager-0.1.10'],
  ['dns-manager', '0.1.9', 'dns-manager-dev/dist-pkg/dns-manager-0.1.9'],
  ['dns-manager', '0.1.8', 'dns-manager-dev/dist-pkg/dns-manager-0.1.8'],
  ['dns-manager', '0.1.7', 'dns-manager-dev/dist-pkg/dns-manager-0.1.7'],
  ['dns-manager', '0.1.6', 'dns-manager-dev/dist-pkg/dns-manager-0.1.6'],
  ['rancher-common-ui', '1.0.2', 'rancher-common-ui/dist/1.0.2'],
  ['rancher-common-ui', '1.0.1', 'rancher-common-ui/dist/1.0.1'],
  ['simple-network-manager', '0.1.24', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.24'],
  ['simple-network-manager', '0.1.23', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.23'],
  ['simple-network-manager', '0.1.22', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.22'],
  ['simple-network-manager', '0.1.21', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.21'],
  ['simple-network-manager', '0.1.20', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.20'],
  ['simple-network-manager', '0.1.19', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.19'],
  ['simple-network-manager', '0.1.18', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.18'],
  ['simple-network-manager', '0.1.17', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.17'],
  ['simple-network-manager', '0.1.16', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.16'],
  ['simple-network-manager', '0.1.15', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.15'],
  ['simple-network-manager', '0.1.14', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.14'],
  ['simple-network-manager', '0.1.13', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.13'],
  ['simple-network-manager', '0.1.12', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.12'],
  ['simple-network-manager', '0.1.11', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.11'],
  ['dns-manager', '0.1.5', 'dns-manager-dev/dist-pkg/dns-manager-0.1.5'],
  ['simple-network-manager', '0.1.10', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.10'],
  ['simple-network-manager', '0.1.9', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.9'],
  ['simple-network-manager', '0.1.8', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.8'],
  ['simple-network-manager', '0.1.7', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.7'],
  ['dns-manager', '0.1.4', 'dns-manager-dev/dist-pkg/dns-manager-0.1.4'],
  ['simple-network-manager', '0.1.6', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.6'],
  ['dns-manager', '0.1.3', 'dns-manager-dev/dist-pkg/dns-manager-0.1.3'],
  ['simple-network-manager', '0.1.5', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.5'],
  ['dns-manager', '0.1.2', 'dns-manager-dev/dist-pkg/dns-manager-0.1.2'],
  ['rancher-common-ui', '1.0.0', 'rancher-common-ui/dist/1.0.0'],
  ['simple-network-manager', '0.1.0', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.0'],
  ['simple-network-manager', '0.1.1', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.1'],
  ['simple-network-manager', '0.1.2', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.2'],
  ['simple-network-manager', '0.1.3', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.3'],
  ['simple-network-manager', '0.1.4', 'simple-network-manager-dev/dist-pkg/simple-network-manager-0.1.4'],
  ['dns-manager', '0.1.1', 'dns-manager-dev/dist-pkg/dns-manager-0.1.1'],
  ['dns-manager', '0.1.0', 'dns-manager-dev/dist-pkg/dns-manager-0.1.0'],
];
const assets = {};
const packageMaps=[];
for (const [name, version, directory] of packages) {
  const published=path.join(root,'.local/manager-installation/published',name,version);
  if(!fs.existsSync(published)){fs.mkdirSync(published,{recursive:true});fs.cpSync(path.join(root,directory),published,{recursive:true});}
  const files = fs.readFileSync(path.join(published, 'files.txt'), 'utf8');
  const packageAssets={};
  for (const file of ['files.txt', 'package.json', ...files.trim().split(/\r?\n/)]) {
    if (file.includes('..')) throw new Error('Unexpected asset path');
    let content = fs.readFileSync(path.join(published, file));
    if (file === 'files.txt') content = Buffer.from(content.toString('utf8').replace(/\r\n/g, '\n'));
    assets[`/${name}/${version}/${file}`] = gzipSync(content).toString('base64');
    packageAssets[`/${name}/${version}/${file}`]=assets[`/${name}/${version}/${file}`];
  }
  packageMaps.push({file:`${name}-${version}.json`,payload:JSON.stringify(packageAssets)});
}
const payload = JSON.stringify(assets);
const server = `const http=require('node:http'),fs=require('node:fs'),z=require('node:zlib');
const packed=Object.assign({},...fs.readdirSync('/assets').filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync('/assets/'+f,'utf8'))));
const files=Object.fromEntries(Object.entries(packed).map(([k,v])=>[k,z.gunzipSync(Buffer.from(v,'base64'))]));
http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname.replace(/\\/+/g,'/');if(p==='/healthz'){res.end('ok');return;}const b=files[p];if(!b){console.warn('Missing asset',p);res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':p.endsWith('.js')?'application/javascript':p.endsWith('.json')?'application/json':'text/plain','Content-Length':b.length,'Cache-Control':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff'});res.end(b);}).listen(8080,'0.0.0.0');`;
const digest = createHash('sha256').update(payload).update(server).digest('hex').slice(0, 16);
const configName = `manager-extension-assets-${digest}`;
const labels = { 'app.kubernetes.io/name': 'manager-extension-assets' };
const namespace = 'cattle-ui-plugin-system';
const assetMaps=packageMaps.map(p=>({apiVersion:'v1',kind:'ConfigMap',metadata:{name:`manager-extension-package-${createHash('sha256').update(p.payload).digest('hex').slice(0,16)}`,namespace,labels},immutable:true,data:{[p.file]:p.payload}}));
const resources = [
  ...assetMaps,
  { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: configName, namespace, labels }, immutable: true, data: { 'server.cjs': server } },
  { apiVersion: 'apps/v1', kind: 'Deployment', metadata: { name: 'manager-extension-assets', namespace, labels }, spec: {
    replicas: 2, selector: { matchLabels: labels }, strategy: { type: 'RollingUpdate', rollingUpdate: { maxUnavailable: 0, maxSurge: 1 } },
    template: { metadata: { labels }, spec: { automountServiceAccountToken: false,
      securityContext: { runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, seccompProfile: { type: 'RuntimeDefault' } },
      affinity: { podAntiAffinity: { requiredDuringSchedulingIgnoredDuringExecution: [{ labelSelector: { matchLabels: labels }, topologyKey: 'topology.kubernetes.io/zone' }] } },
      containers: [{ name: 'assets', image: 'node:24.20.0-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf', command: ['node', '/assets/server.cjs'],
        ports: [{ name: 'http', containerPort: 8080 }], securityContext: { allowPrivilegeEscalation: false, readOnlyRootFilesystem: true, capabilities: { drop: ['ALL'] } },
        resources: { requests: { cpu: '10m', memory: '32Mi' }, limits: { cpu: '250m', memory: '128Mi' } },
        readinessProbe: { httpGet: { path: '/healthz', port: 'http' }, periodSeconds: 5 }, livenessProbe: { httpGet: { path: '/healthz', port: 'http' }, periodSeconds: 10 },
        volumeMounts: [{ name: 'assets', mountPath: '/assets', readOnly: true }] }], volumes: [{ name: 'assets', projected:{sources:[...assetMaps.map(cm=>({configMap:{name:cm.metadata.name}})),{configMap:{name:configName}}]} }] } }
  } },
  { apiVersion: 'v1', kind: 'Service', metadata: { name: 'manager-extension-assets', namespace, labels }, spec: { selector: labels, ports: [{ name: 'http', port: 8080, targetPort: 'http' }] } },
  { apiVersion: 'policy/v1', kind: 'PodDisruptionBudget', metadata: { name: 'manager-extension-assets', namespace }, spec: { minAvailable: 1, selector: { matchLabels: labels } } },
];
fs.mkdirSync(path.join(root, '.local/manager-installation'), { recursive: true });
const output = path.join(root, '.local/manager-installation/extension-host.json');
fs.writeFileSync(output, JSON.stringify({ apiVersion: 'v1', kind: 'List', items: resources }, null, 2));
console.log(`Prepared ${Object.keys(assets).length} assets; ConfigMap ${configName}; ${Buffer.byteLength(payload)} bytes. ${output}`);
