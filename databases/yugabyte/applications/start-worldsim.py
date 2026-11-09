"""Start the existing World Simulator deployment using its shared YSQL Secret."""
import argparse,base64,json,os,pathlib,subprocess
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--base',required=True,type=pathlib.Path,help='Existing compose.yaml')
p.add_argument('--project',default='worldsim-psychohistory-test')
p.add_argument('--image',required=True,help='Existing verified local image or immutable digest')
p.add_argument('--port',default='5087')
a=p.parse_args()
def secret(name):
 cmd=['kubectl']
 if os.environ.get('KUBERNETES_SERVER'):cmd+=['--server='+os.environ['KUBERNETES_SERVER']]
 r=subprocess.run(cmd+['get','secret',name,'-n','yugabyte','-o','json'],capture_output=True,check=True)
 return {k:base64.b64decode(v).decode() for k,v in json.loads(r.stdout)['data'].items()}
s=secret('worldsim-connection');ca=secret('yugabyte-ca')['tls.crt']
# Only the public CA is written; application credentials stay in process memory.
# Docker retains bind paths for container restarts: use a stable public CA path.
stable=pathlib.Path(__file__).resolve().parents[3]/'.local/yugabyte/ca.crt'
stable.parent.mkdir(parents=True,exist_ok=True);stable.write_text(ca)
env=os.environ.copy();env.update(SETUP_PRIVATE_KEY=s['setup-private-key'],WORLDSIM_DATABASE_CONNECTION=s['connection-string'],WORLDSIM_CA_FILE=str(stable),WORLDSIM_IMAGE=a.image,WORLD_SIM_PORT=a.port,WORLD_SIM_DB_PORT='5487')
command=['docker','compose','--project-name',a.project,'-f',str(a.base.resolve()),'-f',str(pathlib.Path(__file__).with_name('worldsim.compose.yaml')),'up','-d','--no-build','--no-deps','app']
result=subprocess.run(command,env=env,capture_output=True)
if result.returncode:raise SystemExit('World Simulator start failed; inspect Docker status without printing its environment.')
print('World Simulator started with its shared YugabyteDB connection.')
