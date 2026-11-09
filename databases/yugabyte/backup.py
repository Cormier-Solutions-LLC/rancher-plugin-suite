"""Stream SQL backups through gzip and encryption; authenticate ciphertext.

Runs inside the pinned YugabyteDB image with Python stdlib and OpenSSL only.
No plaintext database dump or encryption key is written to the backup volume.
"""
import datetime,gzip,hashlib,hmac,json,os,pathlib,re,subprocess,sys

ROOT=pathlib.Path('/backups')
key=pathlib.Path('/secrets/backup/key').read_bytes().strip()
mac_key=hmac.new(key,b'cormier-yugabyte-backup-integrity-v1',hashlib.sha256).digest()
env=os.environ.copy()
env.update(PGHOST='ysql.yugabyte.svc.cluster.local',PGPORT='5433',PGDATABASE='yugabyte',PGUSER=pathlib.Path('/secrets/database/username').read_text().strip(),PGPASSWORD=pathlib.Path('/secrets/database/password').read_text().strip(),PGSSLMODE='verify-full',PGSSLROOTCERT='/secrets/ca/ca.crt',PGOPTIONS='-c yb_fetch_row_limit=0 -c yb_fetch_size_limit=16777216')
env['PGHOST']=os.environ.get('BACKUP_HOSTS',env['PGHOST'])
env['PGCONNECT_TIMEOUT']='10'
q="SELECT coalesce(json_agg(datname),'[]'::json) FROM pg_database WHERE NOT datistemplate AND datname NOT IN ('postgres','yugabyte','system_platform') AND datname NOT LIKE 'restorecheck%' AND datname NOT LIKE 'provider_test_%';"
p=subprocess.run(['/home/yugabyte/bin/ysqlsh','-At','-v','ON_ERROR_STOP=1','-c',q],env=env,capture_output=True,text=True,timeout=60)
if p.returncode:raise RuntimeError('Could not enumerate databases for backup')
available=json.loads(p.stdout.strip())
selected=[name.strip() for name in os.environ.get('BACKUP_DATABASES','').split(',') if name.strip()]
if selected and not set(selected).issubset(set(available)):raise RuntimeError('A configured application database is missing')
databases=sorted(set(selected or available))
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
ROOT.mkdir(parents=True,exist_ok=True)
for db in databases:
 safe=re.sub(r'[^A-Za-z0-9_.-]','_',db)
 final=ROOT/(stamp+'-'+safe+'.sql.gz.enc');temporary=final.with_suffix('.tmp')
 dump=subprocess.Popen(['/home/yugabyte/postgres/bin/ysql_dump','--format=plain','--no-owner','--dbname',db],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 plain_hash=hashlib.sha256();plain_bytes=0
 with temporary.open('wb') as output:
  cipher=subprocess.Popen(['openssl','enc','-aes-256-cbc','-salt','-pbkdf2','-iter','200000','-pass','file:/secrets/backup/key'],stdin=subprocess.PIPE,stdout=output,stderr=subprocess.PIPE)
  try:
   with gzip.GzipFile(fileobj=cipher.stdin,mode='wb',compresslevel=6,mtime=0) as compressed:
    while True:
     chunk=dump.stdout.read(1024*1024)
     if not chunk:break
     plain_hash.update(chunk);plain_bytes+=len(chunk);compressed.write(chunk)
   cipher.stdin.close()
   code=cipher.wait(timeout=120)
   dump_code=dump.wait(timeout=120)
   if code or dump_code:raise RuntimeError('SQL backup or encryption failed for '+safe)
   output.flush();os.fsync(output.fileno())
  except Exception:
   dump.kill();cipher.kill();raise
 temporary.replace(final)
 digest=hmac.new(mac_key,digestmod=hashlib.sha256)
 with final.open('rb') as encrypted:
  for chunk in iter(lambda:encrypted.read(1024*1024),b''):digest.update(chunk)
 manifest={'format':'yugabyte-sql-gzip-openssl-cbc-pbkdf2-hmac-v1','database':db,'file':final.name,'created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'plaintext_bytes':plain_bytes,'plaintext_sha256':plain_hash.hexdigest(),'ciphertext_hmac_sha256':digest.hexdigest()}
 final.with_suffix('.json').write_text(json.dumps(manifest,indent=2))
 print('Encrypted backup complete: '+safe+' ('+str(final.stat().st_size)+' bytes)',flush=True)
# Prune only this job's authenticated-backup file names, after every database
# was backed up successfully. Recovery exports outside this PVC are untouched.
cutoff=datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(days=7)
for metadata in ROOT.glob('*.sql.gz.json'):
 try:
  old=json.loads(metadata.read_text());name=old['file']
  if not re.fullmatch(r'\d{8}T\d{6}Z-[A-Za-z0-9_.-]+\.sql\.gz\.enc',name):continue
  if datetime.datetime.fromisoformat(old['created_utc'])<cutoff:
   (ROOT/name).unlink(missing_ok=True);metadata.unlink()
 except (ValueError,KeyError,OSError):continue
print('All database backups completed successfully; seven-day retention applied',flush=True)
