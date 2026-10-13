import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {kube,base} from './phone-acceptance-client.mjs';
const dir='.local/manager-installation/',path=dir+'vpn-kill-switch-owned.json',phase=process.argv[2]||'status';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
let l=fs.existsSync(path)?JSON.parse(fs.readFileSync(path)):null;
const save=()=>fs.writeFileSync(path,JSON.stringify(l,null,2),{mode:0o600});
const kubectl='C:/Program Files/Docker/Docker/resources/bin/kubectl.exe';
async function originals(){
 const d=await kube('/apis/apps/v1/namespaces/torrent/deployments/torrent');assert.equal(d.metadata.uid,l.productionUid);assert.equal(hash(d.spec),l.productionSpecHash);
 const pods=await kube('/api/v1/namespaces/torrent/pods?labelSelector=app.kubernetes.io%2Fname%3Dtorrent');assert.equal(pods.items.length,1);
 const p=pods.items[0];assert.equal(p.metadata.uid,l.productionPodUid);assert.ok(p.status.containerStatuses.every(c=>c.ready));assert.equal(hash(p.status.containerStatuses.map(c=>({name:c.name,restarts:c.restartCount}))),l.productionRestartsHash);
}
function probe(mode){
 const py=`import json,socket,ssl,struct,random,urllib.request,re,os
mode=${JSON.stringify(mode)}
token=re.search(r'apikey = "([^"]+)"',open('/run/acceptance/config.toml').read()).group(1)
def control(method='GET',status=None):
 req=urllib.request.Request('http://127.0.0.1:8000/v1/vpn/status',data=json.dumps({'status':status}).encode() if status else None,method=method,headers={'X-API-Key':token,'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=10) as r:
  data=r.read();return {'http':r.status,'body':json.loads(data) if data else None}
if mode in ['stop','start']:
 print(json.dumps(control('PUT','stopped' if mode=='stop' else 'running')))
elif mode=='state':print(json.dumps(control()))
else:
 out=[]
 for ip,host in [('1.1.1.1','cloudflare-dns.com'),('8.8.8.8','dns.google')]:
  s=None
  try:
   s=socket.create_connection((ip,443),5);s=ssl.create_default_context().wrap_socket(s,server_hostname=host);out.append({'type':'tcp_tls','target':ip,'connected':True,'tlsVerified':True})
  except Exception as e:out.append({'type':'tcp_tls','target':ip,'connected':False,'errorType':type(e).__name__})
  finally:
   if s:s.close()
 for ip in ['1.1.1.1','8.8.8.8']:
  s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);s.settimeout(5);ident=random.randrange(65536);q=struct.pack('!HHHHHH',ident,256,1,0,0,0)+b'\\x07example\\x03com\\x00'+struct.pack('!HH',1,1)
  try:
   s.sendto(q,(ip,53));data,peer=s.recvfrom(4096);h=struct.unpack('!HHHHHH',data[:12]);ok=h[0]==ident and h[1]&32768!=0 and h[1]&15==0 and h[3]>0 and peer[0]==ip;out.append({'type':'udp_dns','target':ip,'connected':ok})
  except Exception as e:out.append({'type':'udp_dns','target':ip,'connected':False,'errorType':type(e).__name__})
  finally:s.close()
 print(json.dumps({'probes':out,'tunPresent':os.path.exists('/sys/class/net/tun0')}))
`;
 try{return JSON.parse(execFileSync(kubectl,['--server=https://10.99.15.11:6443','--tls-server-name=kubernetes.cormierconsulting.io','-n','torrent','exec',l.name,'-c','probe','--request-timeout=45s','--','python3','-c',py],{encoding:'utf8',timeout:50000,stdio:['ignore','pipe','pipe']}));}
 catch{throw Error('Owned VPN probe failed; reconcile its existing pod without repeating a mutation');}
}
async function create(url,obj){assert.equal((await fetch(base+url+'/'+l.name)).status,404);l.nextCreateIntent={url,name:l.name,at:new Date().toISOString()};save();const r=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj),signal:AbortSignal.timeout(20000)});assert.equal(r.status,201);const v=await r.json();l.owned.push({url:url+'/'+l.name,uid:v.metadata.uid});delete l.nextCreateIntent;save();}
if(phase==='start'){
 assert.ok(!l,'Never repeat confirmed VPN fixture creation');
 const [d,pods,policies]=await Promise.all([kube('/apis/apps/v1/namespaces/torrent/deployments/torrent'),kube('/api/v1/namespaces/torrent/pods?labelSelector=app.kubernetes.io%2Fname%3Dtorrent'),kube('/apis/networking.k8s.io/v1/namespaces/torrent/networkpolicies')]);
 assert.equal(pods.items.length,1);const p=pods.items[0];assert.ok(p.status.containerStatuses.every(c=>c.ready));assert.ok(policies.items.every(n=>Object.keys(n.spec.podSelector.matchLabels||{}).length>0&&!n.spec.podSelector.matchExpressions));
 const g=structuredClone(d.spec.template.spec.containers.find(c=>c.name==='gluetun'));
 assert.ok(g&&!g.volumeMounts?.length&&!g.envFrom?.length&&!g.command&&!g.args);assert.equal(g.env.find(e=>e.name==='VPN_TYPE').value,'openvpn');assert.ok(!g.env.some(e=>['HTTP_CONTROL_SERVER_ADDRESS','HEALTH_RESTART_VPN','HTTP_CONTROL_SERVER_AUTH_CONFIG_FILEPATH','HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE'].includes(e.name)));
 const image=p.status.containerStatuses.find(c=>c.name==='gluetun').imageID.replace(/^docker-pullable:\/\//,'');assert.match(image,/@sha256:[a-f0-9]{64}$/);
 const probeImage=p.status.containerStatuses.find(c=>c.name==='qbittorrent').imageID.replace(/^docker-pullable:\/\//,'');assert.match(probeImage,/@sha256:[a-f0-9]{64}$/);
 l={id:randomUUID(),name:'manager-vpn-kill-switch-20261012',intentAt:new Date().toISOString(),productionUid:d.metadata.uid,productionSpecHash:hash(d.spec),productionPodUid:p.metadata.uid,productionRestartsHash:hash(p.status.containerStatuses.map(c=>({name:c.name,restarts:c.restartCount}))),image,productionEnvHash:hash(g.env),owned:[],observations:[]};save();
 const labels={'manager-acceptance-id':l.id},metadata={name:l.name,namespace:'torrent',labels};
 const token=randomBytes(24).toString('base64url');const auth='[[roles]]\nname = "manager-acceptance"\nroutes = ["GET /v1/vpn/status", "PUT /v1/vpn/status"]\nauth = "apikey"\napikey = "'+token+'"\n';
 await create('/api/v1/namespaces/torrent/secrets',{apiVersion:'v1',kind:'Secret',metadata,type:'Opaque',stringData:{'config.toml':auth}});
 await create('/apis/networking.k8s.io/v1/namespaces/torrent/networkpolicies',{apiVersion:'networking.k8s.io/v1',kind:'NetworkPolicy',metadata,spec:{podSelector:{matchLabels:labels},policyTypes:['Ingress'],ingress:[]}});
 g.image=image;g.env.push({name:'HTTP_CONTROL_SERVER_ADDRESS',value:'127.0.0.1:8000'},{name:'HEALTH_RESTART_VPN',value:'off'});g.volumeMounts=[{name:'auth',mountPath:'/gluetun/auth/config.toml',subPath:'config.toml',readOnly:true}];
 await create('/api/v1/namespaces/torrent/pods',{apiVersion:'v1',kind:'Pod',metadata,spec:{automountServiceAccountToken:false,restartPolicy:'Never',terminationGracePeriodSeconds:10,dnsPolicy:d.spec.template.spec.dnsPolicy,dnsConfig:d.spec.template.spec.dnsConfig,securityContext:d.spec.template.spec.securityContext,containers:[g,{name:'probe',image:probeImage,command:['python3','-c','import time; time.sleep(3600)'],resources:{requests:{cpu:'10m',memory:'32Mi'},limits:{cpu:'100m',memory:'128Mi'}},volumeMounts:[{name:'auth',mountPath:'/run/acceptance',readOnly:true}]}],volumes:[{name:'auth',secret:{secretName:l.name,defaultMode:256}}]}});
 l.createdAt=new Date().toISOString();save();console.log(JSON.stringify({created:true,productionUnchanged:true,sameVpnImageAndProviderSettings:true,ownControlLoopbackOnly:true,ingressDenied:true,noEgressNetworkPolicy:true}));
}else if(phase==='cleanup'){
 assert.ok(l);await originals();
 for(const o of [...l.owned].reverse()){const r=await fetch(base+o.url);if(r.status===404)continue;assert.equal(r.status,200);const v=await r.json();assert.equal(v.metadata.uid,o.uid);assert.equal(v.metadata.labels['manager-acceptance-id'],l.id);l.deleteIntentAt=new Date().toISOString();save();const x=await fetch(base+o.url,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiVersion:'v1',kind:'DeleteOptions',preconditions:{uid:o.uid}})});assert.ok([200,202].includes(x.status));}
 l.cleanupRequestedAt=new Date().toISOString();save();console.log(JSON.stringify({ownCleanupRequested:true}));
}else if(phase==='cleaned'){
 assert.ok(l?.cleanupRequestedAt);await originals();const statuses=await Promise.all(l.owned.map(async o=>(await fetch(base+o.url)).status));assert.ok(statuses.every(s=>s===404));l.cleanedAt=new Date().toISOString();save();const report={observedAt:l.cleanedAt,image:l.image,productionPodAndConfigurationPreserved:true,sameProviderEnvironmentVerified:true,publicTcpTlsAndUdpDnsBaseline:!!l.baselineVerifiedAt,publicTcpTlsAndUdpDnsBlockedDuringOutage:!!l.outageVerifiedAt,publicTcpTlsAndUdpDnsRecovered:!!l.recoveredAt,isolatedFixture:true,productionTunnelOutageNotInjected:true,ipv6OutageUnverified:true,ownedPodPolicyAndEphemeralAuthSecretAbsent:true,passed:!!l.baselineVerifiedAt&&!!l.outageVerifiedAt&&!!l.recoveredAt};fs.writeFileSync(dir+'vpn-kill-switch-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}else{
 assert.ok(l?.createdAt);await originals();const p=await kube('/api/v1/namespaces/torrent/pods/'+l.name);assert.equal(p.metadata.uid,l.owned.find(o=>o.url.endsWith('/pods/'+l.name)).uid);
 if(phase==='status'){console.log(JSON.stringify({phase:p.status.phase,ready:p.status.containerStatuses?.map(c=>({name:c.name,ready:c.ready,restarts:c.restartCount})),baseline:!!l.baselineVerifiedAt,outage:!!l.outageVerifiedAt,recovered:!!l.recoveredAt}));}
 else if(phase==='baseline'||phase==='recovered'){
  assert.ok(phase==='baseline'?!l.stopIntentAt:l.startReceiptAt);const state=probe('state');assert.equal(state.body.status,'running');const result=probe('traffic');l.observations.push({at:new Date().toISOString(),phase,...result});save();assert.ok(result.tunPresent&&result.probes.every(p=>p.connected),JSON.stringify(result));l[phase==='baseline'?'baselineVerifiedAt':'recoveredAt']=new Date().toISOString();save();console.log(JSON.stringify({phase,allFourPublicProbesSucceeded:true,tlsVerified:true}));
 }else if(phase==='stop'||phase==='restart'){
  assert.ok(phase==='stop'?l.baselineVerifiedAt&&!l.stopIntentAt:l.outageVerifiedAt&&!l.startIntentAt);const key=phase==='stop'?'stop':'start';l[key+'IntentAt']=new Date().toISOString();save();const result=probe(key);assert.equal(result.http,200);l[key+'ReceiptAt']=new Date().toISOString();save();console.log(JSON.stringify({phase,accepted:true}));
 }else if(phase==='outage'){
  assert.ok(l.stopReceiptAt&&!l.startIntentAt);const state=probe('state');assert.equal(state.body.status,'stopped');const result=probe('traffic');l.observations.push({at:new Date().toISOString(),phase,...result});save();assert.equal(result.tunPresent,false);assert.ok(result.probes.every(p=>!p.connected),'Public traffic escaped during VPN outage');l.outageVerifiedAt=new Date().toISOString();save();console.log(JSON.stringify({phase,allFourPublicProbesBlocked:true,tunnelAbsent:true}));
 }else throw Error('Unknown phase');
}
