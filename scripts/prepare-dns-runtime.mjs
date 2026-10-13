import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const namespace='dns-system',labels={'app.kubernetes.io/name':'dns-manager-engine'};
const binaryData={};
for(const f of ['DnsReadiness.dll','DnsReadiness.deps.json','DnsReadiness.runtimeconfig.json']) binaryData[f]=fs.readFileSync(path.join(root,'dns-manager-dev/src/DnsReadiness/bin/Release/net10.0',f)).toString('base64');
const resources=[
 {apiVersion:'v1',kind:'Namespace',metadata:{name:namespace}},
 {apiVersion:'v1',kind:'ConfigMap',metadata:{name:'dns-manager-readiness',namespace},binaryData},
 {apiVersion:'v1',kind:'Service',metadata:{name:'dns-manager-engine',namespace},spec:{clusterIP:'None',publishNotReadyAddresses:true,selector:labels,ports:[{name:'api',port:5380,targetPort:5380}]}},
 {apiVersion:'apps/v1',kind:'StatefulSet',metadata:{name:'dns-manager-engine',namespace},spec:{replicas:3,serviceName:'dns-manager-engine',podManagementPolicy:'Parallel',persistentVolumeClaimRetentionPolicy:{whenDeleted:'Retain',whenScaled:'Retain'},selector:{matchLabels:labels},template:{metadata:{labels},spec:{automountServiceAccountToken:false,terminationGracePeriodSeconds:30,
  affinity:{podAntiAffinity:{requiredDuringSchedulingIgnoredDuringExecution:[{labelSelector:{matchLabels:labels},topologyKey:'topology.kubernetes.io/zone'}]}},
  containers:[{name:'dns',image:'harbor.cormierconsulting.io/automation/dns-manager-engine:15.6.1-axfr1@sha256:6a8932724746c2671841d7c26039359394a30c8cf0b3c54bfcd591308303de02',env:[{name:'DNS_MANAGER_AXFR_ZONES',value:'_msdcs.cormierconsulting.com,99.10.in-addr.arpa,cormierconsulting.com,cormierconsulting.io'},{name:'DNS_SERVER_DOMAIN',value:'dns-manager.internal'},{name:'DNS_SERVER_ADMIN_PASSWORD_FILE',value:'/run/credentials/admin-password'},{name:'DNS_SERVER_RECURSION',value:'AllowOnlyForPrivateNetworks'},{name:'DNS_SERVER_FORWARDERS',value:'8.8.8.8,8.8.4.4'},{name:'DNS_SERVER_DNSSEC_VALIDATION',value:'true'}],ports:[{name:'dns-tcp',containerPort:53,protocol:'TCP'},{name:'dns-udp',containerPort:53,protocol:'UDP'},{name:'api',containerPort:5380}],resources:{requests:{cpu:'100m',memory:'256Mi'},limits:{cpu:'2',memory:'1Gi'}},
   startupProbe:{httpGet:{path:'/',port:'api'},periodSeconds:5,failureThreshold:60},livenessProbe:{tcpSocket:{port:'api'},periodSeconds:15,failureThreshold:4},readinessProbe:{exec:{command:['dotnet','/opt/readiness/DnsReadiness.dll']},periodSeconds:15,timeoutSeconds:12,failureThreshold:2},
   volumeMounts:[{name:'data',mountPath:'/etc/dns'},{name:'credentials',mountPath:'/run/credentials',readOnly:true},{name:'readiness',mountPath:'/opt/readiness',readOnly:true}]}],volumes:[{name:'credentials',secret:{secretName:'dns-manager-engine-admin',defaultMode:256}},{name:'readiness',configMap:{name:'dns-manager-readiness'}}]}},volumeClaimTemplates:[{metadata:{name:'data'},spec:{accessModes:['ReadWriteOnce'],storageClassName:'longhorn',resources:{requests:{storage:'2Gi'}}}}]}},
 {apiVersion:'policy/v1',kind:'PodDisruptionBudget',metadata:{name:'dns-manager-engine',namespace},spec:{minAvailable:2,selector:{matchLabels:labels}}},
 ...[0,1,2].flatMap(i=>[
  {apiVersion:'v1',kind:'Service',metadata:{name:`dns-manager-${i}`,namespace},spec:{type:'LoadBalancer',externalTrafficPolicy:'Local',selector:{...labels,'statefulset.kubernetes.io/pod-name':`dns-manager-engine-${i}`},ports:[{name:'dns-tcp',port:53,targetPort:53,protocol:'TCP'},{name:'dns-udp',port:53,targetPort:53,protocol:'UDP'}]}},
  {apiVersion:'v1',kind:'Service',metadata:{name:`dns-manager-api-${i}`,namespace},spec:{publishNotReadyAddresses:true,selector:{...labels,'statefulset.kubernetes.io/pod-name':`dns-manager-engine-${i}`},ports:[{name:'api',port:5380,targetPort:5380}]}}
 ]),
 {apiVersion:'v1',kind:'Service',metadata:{name:'dns-manager',namespace},spec:{type:'LoadBalancer',externalTrafficPolicy:'Local',selector:labels,ports:[{name:'dns-tcp',port:53,targetPort:53,protocol:'TCP'},{name:'dns-udp',port:53,targetPort:53,protocol:'UDP'}]}},
];
fs.mkdirSync(path.join(root,'.local/manager-installation'),{recursive:true});
fs.writeFileSync(path.join(root,'.local/manager-installation/dns-runtime.json'),JSON.stringify({apiVersion:'v1',kind:'List',items:resources},null,2));
console.log('DNS runtime prepared. Create its administrator Secret before applying.');
