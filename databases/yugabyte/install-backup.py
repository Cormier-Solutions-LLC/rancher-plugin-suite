"""Provision backup identity without rotating existing recovery secrets.

Requires kubectl and PyYAML. Scheduling stays suspended until a restore drill.
"""
import argparse,base64,json,os,pathlib,secrets,subprocess,yaml
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("--enable-schedule",action="store_true",help="Enable only after independent restore verification")
args=parser.parse_args()
ROOT=pathlib.Path(__file__).resolve().parent
def k(args,data=None):
 command=['kubectl']+(['--server='+os.environ['KUBERNETES_SERVER']] if os.environ.get('KUBERNETES_SERVER') else [])+args
 p=subprocess.run(command,input=data,text=True,capture_output=True,encoding='utf-8',check=True)
 return p.stdout
def apply(obj):
 print(k(['apply','-f','-'],json.dumps(obj)).strip())
def get_secret(name):
 text=k(['get','secret',name,'-n','yugabyte','--ignore-not-found','-o','json'])
 return {key:base64.b64decode(value).decode() for key,value in json.loads(text)['data'].items()} if text.strip() else None
def sql(statement):
 return k(['exec','-i','-n','yugabyte','yb-pve08-yb-tserver-1','-c','yb-tserver','--','/home/yugabyte/bin/ysqlsh','-h','/tmp/.yb.0.0.0.0:5433','-U','yugabyte','-At','-v','ON_ERROR_STOP=1'],statement)
def put(name,data):
 apply({'apiVersion':'v1','kind':'Secret','metadata':{'name':name,'namespace':'yugabyte'},'type':'Opaque','stringData':data})
credentials=get_secret('yugabyte-backup')
exists=sql("SELECT count(*) FROM pg_roles WHERE rolname='backup_reader';").strip()=='1'
if exists and not credentials:raise RuntimeError('Restore the existing backup credential Secret before continuing')
if not credentials:
 credentials={'username':'backup_reader','password':secrets.token_urlsafe(36)};put('yugabyte-backup',credentials)
if not exists:sql("CREATE ROLE backup_reader LOGIN PASSWORD '"+credentials['password'].replace("'","''")+"' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;")
sql('GRANT pg_read_all_data TO backup_reader; ALTER ROLE backup_reader SET default_transaction_read_only=on;')
if not get_secret('yugabyte-backup-encryption'):
 if k(['get','pvc','yugabyte-backups','-n','yugabyte','--ignore-not-found','-o','name']).strip():raise RuntimeError('Backup storage already exists: restore its encryption key; do not replace it')
 put('yugabyte-backup-encryption',{'key':secrets.token_urlsafe(48)})
apply({'apiVersion':'v1','kind':'ConfigMap','metadata':{'name':'yugabyte-backup-script','namespace':'yugabyte'},'data':{'backup.py':(ROOT/'backup.py').read_text()}})
existing_cron=k(['get','cronjob','yugabyte-backup','-n','yugabyte','--ignore-not-found','-o','json'])
suspended=json.loads(existing_cron)['spec'].get('suspend',False) if existing_cron.strip() else True
for obj in yaml.safe_load_all((ROOT/'backup-resources.yaml').read_text()):
 if obj['kind']=='CronJob':
  obj['spec']['suspend']=False if args.enable_schedule else suspended
  container=obj['spec']['jobTemplate']['spec']['template']['spec']['containers'][0]
  names=next(v['value'] for v in container['env'] if v['name']=='BACKUP_DATABASES').split(',')
  for name in names:
   if sql("SELECT count(*) FROM pg_database WHERE datname='"+name.replace("'","''")+"';").strip()=='1':
    sql('GRANT CONNECT ON DATABASE "'+name.replace('"','""')+'" TO backup_reader;')
 apply(obj)
pvc=json.loads(k(['get','pvc','yugabyte-backups','-n','yugabyte','-o','json']))
if pvc['spec'].get('volumeName'):
 print(k(['patch','pv',pvc['spec']['volumeName'],'--type=merge','-p',json.dumps({'spec':{'persistentVolumeReclaimPolicy':'Retain'}})]).strip())
print('Export the recovery key securely off cluster. Run an encrypted backup and independent restore before enabling the schedule.')
