import json, subprocess, pathlib, sys, yaml, os, urllib.request, tarfile, hashlib, shutil

REPO=pathlib.Path(__file__).resolve().parents[2]
ROOT=REPO/'.local'/'yugabyte-render';ROOT.mkdir(parents=True,exist_ok=True)
HELM=os.environ.get('HELM_PATH') or shutil.which('helm') or str(REPO/'.tools/helm/windows-amd64/helm.exe')
if '--base' not in sys.argv and not (ROOT/'yugabyte/Chart.yaml').exists():
 archive=ROOT/'yugabyte-2026.1.2.tgz'
 repository=ROOT/'repositories.yaml'
 repository.write_text('apiVersion: v1\nrepositories:\n- name: yugabytedb\n  url: https://charts.yugabyte.com\n')
 cache=ROOT/'helm-cache';cache.mkdir(exist_ok=True)
 flags=['--repository-config',str(repository),'--repository-cache',str(cache)]
 subprocess.run([HELM,'repo','update']+flags,check=True,capture_output=True)
 subprocess.run([HELM,'pull','yugabytedb/yugabyte','--version','2026.1.2','--destination',str(ROOT)]+flags,check=True,capture_output=True)
 expected='bb8a12e9476e7624f98f9f63ba7867231f6379b463ffe2d4fea8d9903e7729c5'
 if hashlib.sha256(archive.read_bytes()).hexdigest()!=expected:raise RuntimeError('Chart checksum differs')
 with tarfile.open(archive) as tf:
  for member in tf.getmembers():
   if member.issym() or member.islnk() or not (ROOT/member.name).resolve().is_relative_to(ROOT.resolve()):raise RuntimeError('Unsafe chart archive entry')
  tf.extractall(ROOT)
NS='yugabyte'
HOSTS=[('07',['kubworker11','kubworker12'],'2.1','3Gi'),('08',['kubworker13'],'3.3','17Gi'),('09',['kubworker15','kubworker16'],'2.1','16Gi')]
def run(args,data=None):
 if args[0]=='kubectl':args=args[:1]+(['--server='+os.environ['KUBERNETES_SERVER']] if os.environ.get('KUBERNETES_SERVER') else [])+args[1:]
 p=subprocess.run(args,input=data,text=True,capture_output=True,encoding='utf-8')
 if p.returncode: raise RuntimeError(p.stderr[-4000:])
 return p.stdout
def apply(items,dry=False):
 args=['kubectl','apply','-f','-']
 if dry: args+=['--dry-run=server']
 return run(args,json.dumps({'apiVersion':'v1','kind':'List','items':items}))
def obj(kind,name,spec,api='v1',ns=NS):
 return {'apiVersion':api,'kind':kind,'metadata':{'name':name,**({'namespace':ns} if ns else {})},'spec':spec}
base=[{'apiVersion':'v1','kind':'Namespace','metadata':{'name':NS}},
 {'apiVersion':'storage.k8s.io/v1','kind':'StorageClass','metadata':{'name':'yugabyte-local-xfs-retain'},'provisioner':'driver.longhorn.io','allowVolumeExpansion':True,'reclaimPolicy':'Retain','volumeBindingMode':'WaitForFirstConsumer','parameters':{'numberOfReplicas':'1','dataLocality':'strict-local','diskSelector':'thin','fsType':'xfs','dataEngine':'v1','staleReplicaTimeout':'30'}},
 obj('ResourceQuota','yugabyte-budget',{'hard':{'requests.cpu':'16800m','limits.cpu':'16800m','requests.memory':'80Gi','limits.memory':'80Gi','requests.storage':'160Gi','persistentvolumeclaims':'12','pods':'12'}}),
 obj('Issuer','yugabyte-selfsigned',{'selfSigned':{}},'cert-manager.io/v1'),
 obj('Certificate','yugabyte-ca',{'isCA':True,'commonName':'Cormier YugabyteDB CA','secretName':'yugabyte-ca','duration':'87600h','privateKey':{'algorithm':'RSA','size':2048},'issuerRef':{'name':'yugabyte-selfsigned','kind':'Issuer'}},'cert-manager.io/v1'),
 obj('Issuer','yugabyte-ca',{'ca':{'secretName':'yugabyte-ca'}},'cert-manager.io/v1'),
 obj('Service','ysql',{'selector':{'database.cormiersolutions.com/role':'tserver'},'ports':[{'name':'ysql','port':5433,'targetPort':5433}]}),
 obj('NetworkPolicy','database-ingress',{'podSelector':{},'policyTypes':['Ingress'],'ingress':[{'from':[{'podSelector':{}}]},{'from':[{'namespaceSelector':{'matchExpressions':[{'key':'kubernetes.io/metadata.name','operator':'In','values':['proofing','licensing','tablelink','harbor','invoicing']} ]}}],'ports':[{'protocol':'TCP','port':5433}]}]},'networking.k8s.io/v1')]
if '--base' in sys.argv:
 base.append(obj('Service','ysql-lan',{'type':'LoadBalancer','externalTrafficPolicy':'Local','loadBalancerSourceRanges':['10.99.0.0/16'],'selector':{'database.cormiersolutions.com/role':'tserver'},'ports':[{'name':'ysql','port':5433,'targetPort':5433}]}))
 for item in base:
  if item['kind']=='NetworkPolicy':item['spec']['ingress'].append({'from':[{'ipBlock':{'cidr':'10.99.0.0/16'}}],'ports':[{'protocol':'TCP','port':5433}]})
 for role,minimum in [('master',2),('tserver',5)]:
  base.append(obj('PodDisruptionBudget',role+'-quorum',{'minAvailable':minimum,'selector':{'matchLabels':{'database.cormiersolutions.com/role':role}}},'policy/v1'))
 for h,_,_,_ in HOSTS:
  base.append({'apiVersion':'scheduling.k8s.io/v1','kind':'PriorityClass','metadata':{'name':'yugabyte-pve'+h},'value':0,'globalDefault':False,'preemptionPolicy':'Never','description':'Accounting scope for the YugabyteDB budget on proxmox'+h})
  cap={'07':('4800m','14Gi'),'08':('7200m','37Gi'),'09':('4800m','35Gi')}[h]
  base.append(obj('ResourceQuota','pve'+h+'-budget',{'hard':{'requests.cpu':cap[0],'limits.cpu':cap[0],'requests.memory':cap[1],'limits.memory':cap[1],'pods':'3'},'scopeSelector':{'matchExpressions':[{'scopeName':'PriorityClass','operator':'In','values':['yugabyte-pve'+h]}]}}))
 print(apply(base,dry='--apply' not in sys.argv));sys.exit()
ca=json.loads(run(['kubectl','get','secret','yugabyte-ca','-n',NS,'-o','json']))['data']['tls.crt']
masters=','.join(f'yb-pve{h}-yb-master-0.yb-pve{h}-yb-masters.{NS}.svc.cluster.local:7100' for h,_,_,_ in HOSTS)
all_items=[]
for h,nodes,cpu,mem in HOSTS:
 name='yb-pve'+h
 values={'fullnameOverride':name,'oldNamingStyle':False,'isMultiAz':True,'AZ':'proxmox'+h,'masterAddresses':masters,'replicas':{'master':1,'tserver':2,'totalMasters':3},'Image':{'tag':'2026.1.2.0-b137'},'resource':{'master':{'requests':{'cpu':'0.5','memory':'1Gi'},'limits':{'cpu':'0.5','memory':'1Gi'}},'tserver':{'requests':{'cpu':cpu,'memory':mem},'limits':{'cpu':cpu,'memory':mem}}},'storage':{'master':{'count':1,'size':'5Gi','storageClass':'yugabyte-local-xfs-retain'},'tserver':{'count':1,'size':'20Gi','storageClass':'yugabyte-local-xfs-retain'}},'enableLoadBalancer':False,'serviceEndpoints':[],'yugabytedUi':{'enabled':False},'tls':{'enabled':True,'nodeToNode':True,'clientToServer':True,'insecure':False,'rootCA':{'cert':ca,'key':''},'certManager':{'enabled':True,'bootstrapSelfsigned':False,'issuer':'yugabyte-ca','certificates':{'duration':'8760h','renewBefore':'720h'}}},'gflags':{'master':{'placement_cloud':'onprem','placement_region':'lab','placement_zone':'proxmox'+h},'tserver':{'placement_cloud':'onprem','placement_region':'lab','placement_zone':'proxmox'+h,'ysql_enable_auth':True,'ysql_hba_conf_csv':'local all yugabyte trust,hostssl all all 0.0.0.0/0 md5','enable_ysql_conn_mgr':False}},'commonLabels':{'database.cormiersolutions.com/universe':'shared','database.cormiersolutions.com/physical-host':'proxmox'+h}}
 for role in ['master','tserver']:
  values['gflags'][role].update(durable_wal_write=True,require_durable_wal_write=True)
 path=ROOT/(name+'-values.json');path.write_text(json.dumps(values,indent=2))
 rendered=run([HELM,'template',name,str(ROOT/'yugabyte'),'-n',NS,'-f',str(path)])
 items=[x for x in yaml.safe_load_all(rendered) if x]
 for x in items:
  x.setdefault('metadata',{}).setdefault('namespace',NS)
  if x['kind']=='Certificate' and 'dnsNames' in x['spec'] and x['spec']['dnsNames']:
   x['spec']['dnsNames']+=['ysql','ysql.yugabyte','ysql.yugabyte.svc','ysql.yugabyte.svc.cluster.local']
  if x['kind']=='StatefulSet':
   p=x['spec']['template']; master='yb-master' in x['metadata']['name'];role='master' if master else 'tserver'
   p['spec']['priorityClassName']='yugabyte-pve'+h
   p['metadata'].setdefault('labels',{})['database.cormiersolutions.com/role']=role
   p['spec']['affinity']={'nodeAffinity':{'requiredDuringSchedulingIgnoredDuringExecution':{'nodeSelectorTerms':[{'matchExpressions':[{'key':'kubernetes.io/hostname','operator':'In','values':nodes}]}]}},'podAntiAffinity':{'preferredDuringSchedulingIgnoredDuringExecution':[{'weight':100,'podAffinityTerm':{'labelSelector':{'matchLabels':{'database.cormiersolutions.com/role':role}},'topologyKey':'kubernetes.io/hostname'}}]}}
   x['spec']['persistentVolumeClaimRetentionPolicy']={'whenDeleted':'Retain','whenScaled':'Retain'}
   for c in p['spec'].get('initContainers',[]):
    c['resources']={'requests':{'cpu':'100m','memory':'128Mi'},'limits':{'cpu':'100m','memory':'128Mi'}}
   for c in p['spec']['containers']:
    if c['name']=='yb-cleanup':
     c['resources']={'requests':{'cpu':'5m','memory':'16Mi'},'limits':{'cpu':'5m','memory':'16Mi'}}
    elif c['name'] not in ('yb-master','yb-tserver'): raise RuntimeError('Unexpected sidecar '+c['name'])
    else:
     if not master:
      c['readinessProbe']={'exec':{'command':['/home/yugabyte/bin/ysqlsh','-h','/tmp/.yb.0.0.0.0:5433','-U','yugabyte','-At','-c','SELECT 1']},'periodSeconds':5,'timeoutSeconds':5,'failureThreshold':3}
     c['startupProbe']={'tcpSocket':{'port':7100 if master else 5433},'periodSeconds':5,'timeoutSeconds':3,'failureThreshold':120}
     if c.get('livenessProbe'):c['livenessProbe'].update(timeoutSeconds=5,failureThreshold=6)
    c['image']='yugabytedb/yugabyte:2026.1.2.0-b137@sha256:b6dba322c7340e1a87affd9b4715fa938354b6ab81b0b0833b07f6b5d085e274'
   for c in p['spec'].get('initContainers',[]):c['image']='yugabytedb/yugabyte:2026.1.2.0-b137@sha256:b6dba322c7340e1a87affd9b4715fa938354b6ab81b0b0833b07f6b5d085e274'
  if x['kind']=='Job': raise RuntimeError('Unexpected chart job')
 all_items+=items
out=ROOT/'yugabyte-rendered.json';out.write_text(json.dumps({'apiVersion':'v1','kind':'List','items':all_items},indent=2))
if '--host' in sys.argv:
 selected=sys.argv[sys.argv.index('--host')+1]
 if selected not in ['07','08','09']:raise RuntimeError('Unknown physical host')
 all_items=[x for x in all_items if x['metadata']['name'].startswith('yb-pve'+selected)]
print(apply(all_items,dry='--apply' not in sys.argv))
