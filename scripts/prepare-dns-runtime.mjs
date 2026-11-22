import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const namespace='dns-system',labels={'app.kubernetes.io/name':'dns-manager-engine'};
const tlsPort=53443;
const tlsCode=fs.readFileSync(path.join(root,'live-management/dns-engine-tls-proxy.mjs'),'utf8');
const tlsSecret='dns-engine-server-tls';
const tlsNames=[0,1,2].flatMap(i=>['svc','svc.cluster.local'].map(suffix=>`dns-manager-api-${i}.dns-system.${suffix}`));
const binaryData={};
for(const f of ['DnsReadiness.dll','DnsReadiness.deps.json','DnsReadiness.runtimeconfig.json']) binaryData[f]=fs.readFileSync(path.join(root,'dns-manager-dev/src/DnsReadiness/bin/Release/net10.0',f)).toString('base64');
const resources=[
 {apiVersion:'v1',kind:'Namespace',metadata:{name:namespace}},
 {apiVersion:'v1',kind:'ConfigMap',metadata:{name:'dns-manager-readiness',namespace},binaryData},
 {apiVersion:'v1',kind:'ConfigMap',metadata:{name:'dns-engine-tls-proxy',namespace},data:{'proxy.mjs':tlsCode}},
 {apiVersion:'cert-manager.io/v1',kind:'Issuer',metadata:{name:'dns-engine-bootstrap',namespace},spec:{selfSigned:{}}},
 {apiVersion:'cert-manager.io/v1',kind:'Certificate',metadata:{name:'dns-engine-ca',namespace},spec:{isCA:true,commonName:'DNS Engine Management CA',secretName:'dns-engine-ca',duration:'87600h',issuerRef:{name:'dns-engine-bootstrap',kind:'Issuer'}}},
 {apiVersion:'cert-manager.io/v1',kind:'Issuer',metadata:{name:'dns-engine-ca',namespace},spec:{ca:{secretName:'dns-engine-ca'}}},
 {apiVersion:'cert-manager.io/v1',kind:'Certificate',metadata:{name:tlsSecret,namespace},spec:{secretName:tlsSecret,dnsNames:tlsNames,usages:['server auth'],privateKey:{rotationPolicy:'Always'},issuerRef:{name:'dns-engine-ca',kind:'Issuer'}}},
 {apiVersion:'networking.k8s.io/v1',kind:'NetworkPolicy',metadata:{name:'dns-engine-ingress',namespace},spec:{podSelector:{matchLabels:labels},policyTypes:['Ingress'],ingress:[
  {ports:[{protocol:'TCP',port:53},{protocol:'UDP',port:53}]},
  {from:[
   {podSelector:{matchLabels:{'app.kubernetes.io/name':'dns-manager-controller'}}},
   {namespaceSelector:{matchLabels:{'kubernetes.io/metadata.name':'manager-system'}},podSelector:{matchLabels:{'app.kubernetes.io/name':'dns-manager-snapshots'}}}
  ],ports:[{protocol:'TCP',port:tlsPort}]}
 ]}},

 {apiVersion:'v1',kind:'Service',metadata:{name:'dns-manager-engine',namespace},spec:{clusterIP:'None',publishNotReadyAddresses:true,selector:labels,ports:[{name:'https-api',port:tlsPort,targetPort:'https-api'}]}},
 {apiVersion:'apps/v1',kind:'StatefulSet',metadata:{name:'dns-manager-engine',namespace},spec:{replicas:3,serviceName:'dns-manager-engine',podManagementPolicy:'Parallel',persistentVolumeClaimRetentionPolicy:{whenDeleted:'Retain',whenScaled:'Retain'},selector:{matchLabels:labels},template:{metadata:{labels},spec:{automountServiceAccountToken:false,terminationGracePeriodSeconds:30,
  affinity:{podAntiAffinity:{requiredDuringSchedulingIgnoredDuringExecution:[{labelSelector:{matchLabels:labels},topologyKey:'topology.kubernetes.io/zone'}]}},
  containers:[{name:'dns',image:'harbor.cormierconsulting.io/automation/dns-manager-engine:15.6.1-axfr1@sha256:6a8932724746c2671841d7c26039359394a30c8cf0b3c54bfcd591308303de02',env:[{name:'DNS_MANAGER_AXFR_ZONES',value:'_msdcs.cormierconsulting.com,99.10.in-addr.arpa,cormierconsulting.com,cormierconsulting.io'},{name:'DNS_SERVER_DOMAIN',value:'dns-manager.internal'},{name:'DNS_SERVER_WEB_SERVICE_LOCAL_ADDRESSES',value:'127.0.0.1'},{name:'DNS_SERVER_ADMIN_PASSWORD_FILE',value:'/run/credentials/admin-password'},{name:'DNS_SERVER_RECURSION',value:'AllowOnlyForPrivateNetworks'},{name:'DNS_SERVER_FORWARDERS',value:'8.8.8.8,8.8.4.4'},{name:'DNS_SERVER_DNSSEC_VALIDATION',value:'true'}],ports:[{name:'dns-tcp',containerPort:53,protocol:'TCP'},{name:'dns-udp',containerPort:53,protocol:'UDP'}],resources:{requests:{cpu:'100m',memory:'256Mi'},limits:{cpu:'2',memory:'1Gi'}},
   startupProbe:{httpGet:{path:'/healthz',port:tlsPort,scheme:'HTTPS'},periodSeconds:5,failureThreshold:60},livenessProbe:{httpGet:{path:'/healthz',port:tlsPort,scheme:'HTTPS'},periodSeconds:15,failureThreshold:4},readinessProbe:{exec:{command:['dotnet','/opt/readiness/DnsReadiness.dll']},periodSeconds:15,timeoutSeconds:12,failureThreshold:2},
   volumeMounts:[{name:'data',mountPath:'/etc/dns'},{name:'credentials',mountPath:'/run/credentials',readOnly:true},{name:'readiness',mountPath:'/opt/readiness',readOnly:true}]},
   {name:'api-tls',image:'node:24.20.0-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf',command:['node','/app/proxy.mjs'],ports:[{name:'https-api',containerPort:tlsPort}],
    securityContext:{runAsNonRoot:true,runAsUser:1000,runAsGroup:1000,readOnlyRootFilesystem:true,allowPrivilegeEscalation:false,capabilities:{drop:['ALL']}},
    resources:{requests:{cpu:'10m',memory:'32Mi'},limits:{cpu:'150m',memory:'96Mi'}},
    volumeMounts:[{name:'proxy-code',mountPath:'/app',readOnly:true},{name:'api-tls',mountPath:'/run/dns-engine-tls',readOnly:true}]}
  ],volumes:[{name:'proxy-code',configMap:{name:'dns-engine-tls-proxy'}},{name:'api-tls',secret:{secretName:tlsSecret}},{name:'credentials',secret:{secretName:'dns-manager-engine-admin',defaultMode:256}},{name:'readiness',configMap:{name:'dns-manager-readiness'}}]}},volumeClaimTemplates:[{metadata:{name:'data'},spec:{accessModes:['ReadWriteOnce'],storageClassName:'longhorn',resources:{requests:{storage:'2Gi'}}}}]}},
 {apiVersion:'policy/v1',kind:'PodDisruptionBudget',metadata:{name:'dns-manager-engine',namespace},spec:{minAvailable:2,selector:{matchLabels:labels}}},
 ...[0,1,2].flatMap(i=>[
  {apiVersion:'v1',kind:'Service',metadata:{name:`dns-manager-${i}`,namespace},spec:{type:'LoadBalancer',externalTrafficPolicy:'Local',selector:{...labels,'statefulset.kubernetes.io/pod-name':`dns-manager-engine-${i}`},ports:[{name:'dns-tcp',port:53,targetPort:53,protocol:'TCP'},{name:'dns-udp',port:53,targetPort:53,protocol:'UDP'}]}},
  {apiVersion:'v1',kind:'Service',metadata:{name:`dns-manager-api-${i}`,namespace},spec:{publishNotReadyAddresses:true,selector:{...labels,'statefulset.kubernetes.io/pod-name':`dns-manager-engine-${i}`},ports:[{name:'https-api',port:tlsPort,targetPort:'https-api'}]}}
 ]),
 {apiVersion:'v1',kind:'Service',metadata:{name:'dns-manager',namespace},spec:{type:'LoadBalancer',externalTrafficPolicy:'Local',selector:labels,ports:[{name:'dns-tcp',port:53,targetPort:53,protocol:'TCP'},{name:'dns-udp',port:53,targetPort:53,protocol:'UDP'}]}},
];
fs.mkdirSync(path.join(root,'.local/manager-installation'),{recursive:true});
fs.writeFileSync(path.join(root,'.local/manager-installation/dns-runtime.json'),JSON.stringify({apiVersion:'v1',kind:'List',items:resources},null,2));
console.log('DNS runtime prepared. Create its administrator Secret before applying.');
