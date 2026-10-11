import { estimateSnapshotStorage } from '../pkg/dns-manager/snapshot-feature/config/storage-estimate.mjs';
import { secretBackupStatus } from '../pkg/dns-manager/snapshot-feature/config/snapshot-secrets.mjs';
import http from 'node:http';
import { mkdir, readdir, readFile, rename, open, unlink, stat, statfs, realpath } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { manifestYaml, snapshotManifests } from '../pkg/dns-manager/snapshot-feature/config/manifest-yaml.mjs';
import { coverageEntries } from '../pkg/dns-manager/snapshot-feature/config/snapshot-coverage.mjs';
import { mergeInPriorityOrder } from '../pkg/dns-manager/snapshot-feature/config/snapshot-merge.mjs';
import { mergeSnapshots, cleanupCandidates } from '../pkg/dns-manager/snapshot-feature/config/snapshot-items.mjs';
import { encodeBackup, decodeBackup, containsSecretValues, withoutSecretValues } from '../pkg/dns-manager/snapshot-feature/config/backup-zip.mjs';
const staticRoot = resolve(process.env.STATIC_DIR || '/app/public');
const snapshotRoot = resolve(process.env.SNAPSHOT_DIR || '/var/lib/dns-manager/snapshots');
await mkdir(snapshotRoot, { recursive: true, mode: 0o700 });
const send = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
const validId = id => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
const metadata = snapshot => ({ coverage: coverageEntries(snapshot.current).filter(entry=>!entry.incomplete).map(entry => ({ id:entry.id, createdAt:snapshot.current?.itemSources?.[entry.id]?.createdAt || snapshot.createdAt, digest:createHash('sha256').update(entry.value).digest('hex') })), generation: snapshot.generation || 'Manual', scope: snapshot.scope || snapshot.current?.snapshotScope || { label: `Port Configuration: ${snapshot.current?.configuration?.name || 'Affected Configuration'}` }, sourceUpdatedAt: snapshot.sourceUpdatedAt || snapshot.createdAt, id: snapshot.id, createdAt: snapshot.createdAt, name: snapshot.current?.configuration?.name || 'Configuration snapshot', publications: snapshot.current?.localPublications?.length || 0, services: snapshot.current?.observedServiceReferences?.length || 0, routeIds: (snapshot.current?.observedRoutes || []).map(route => `${route.kind}/${route.namespace}/${route.name}`), namespaces: [...new Set([...snapshotManifests(snapshot.current).map(resource => resource.metadata?.namespace || ''), ...(snapshot.current?.observedServiceReferences || []).map(service => service.namespace || ''), ...(snapshot.current?.localPublications || []).map(publication => publication.namespace || '')])].sort(), manifests: snapshotManifests(snapshot.current).length });
async function writeAtomic(path, text) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  const handle = await open(temporary, 'wx', 0o600);
  try { await handle.writeFile(text); await handle.sync(); } finally { await handle.close(); }
  await rename(temporary, path);
}
let saveQueue = Promise.resolve();
function saveSnapshot(current, scopeKey, generation = 'Manual', sourceUpdatedAt = new Date().toISOString(), password = '') {
  const write = saveQueue.then(() => saveSnapshotFile(current, scopeKey, generation, sourceUpdatedAt, password));
  saveQueue = write.catch(() => {});
  return write;
}
async function saveSnapshotFile(current, scopeKey, generation, sourceUpdatedAt, password) {
      validateSource(current, !!password);
      current = {...current,secretBackup:{...current.secretBackup,...secretBackupStatus(snapshotManifests(current),current.snapshotScope?.issuerSecretNamespace)}};
      const snapshot = { format: 'DNS Manager configuration snapshot', schemaVersion: 1, id: randomUUID(), createdAt: new Date().toISOString(), scopeKey: scopeKey, includesSecretValues: snapshotManifests(current).some(resource=>resource.kind==='Secret'&&(resource.data!==undefined||resource.stringData!==undefined)), includesApplicationData: false, generation, scope: current.snapshotScope || { label: `Port Configuration: ${current.configuration?.name || 'Affected Configuration'}` }, sourceUpdatedAt, current };
      const bytes = await encodeBackup(snapshot, password);
      await decodeBackup(bytes, password); // Verify recoverability before committing the archive.
      if (password) {
        let rejected = false;
        try { await decodeBackup(bytes, password + '-incorrect'); } catch { rejected = true; }
        if (!rejected) throw new Error('Backup encryption verification failed.');
      }
      const info = { ...metadata({ ...snapshot, current: withoutSecretValues(snapshot.current) }), encrypted: !!password, archiveFormat: 'zip', sizeBytes: bytes.byteLength };
      const capturedSecretIds = new Set(snapshotManifests(snapshot.current).filter(resource => resource.kind==='Secret' && (resource.data!==undefined || resource.stringData!==undefined)).map(resource=>`resource/v1/Secret/${resource.metadata.namespace}/${resource.metadata.name}`));
      info.coverage = info.coverage.filter(entry=>!entry.id.startsWith('resource/v1/Secret/'));
      for (const id of capturedSecretIds) info.coverage.push({id, capturedValues:true, createdAt:snapshot.createdAt});
      info.namespaces = [...new Set([snapshot.current.configuration,...(snapshot.current.relatedConfigurations||[])].filter(Boolean).map(config=>config.namespace||'').concat(info.namespaces))];
      const indexBytes = Buffer.from(JSON.stringify(info));
      const space = await statfs(snapshotRoot);
      const used = (await Promise.all((await readdir(snapshotRoot)).map(name => stat(resolve(snapshotRoot, name))))).reduce((sum, file) => sum + (file.isFile() ? file.size : 0), 0);
      const quota = Number(process.env.SNAPSHOT_STORAGE_LIMIT_BYTES) || Infinity;
      if (bytes.byteLength + indexBytes.byteLength > Math.min(space.bavail * space.bsize, quota - used)) throw Object.assign(new Error('Snapshot storage quota exhausted.'), { status: 507 });
      await writeAtomic(resolve(snapshotRoot, `${snapshot.id}.zip`), bytes);
      try { await writeAtomic(resolve(snapshotRoot, `${snapshot.id}.meta.json`), indexBytes); }
      catch (error) { await unlink(resolve(snapshotRoot, `${snapshot.id}.zip`)); throw error; }
  return snapshot;
}
function validateSource(current, encrypted = false) {
  if(containsSecretValues(current) && !encrypted)throw new Error('Secret values require encrypted ZIP storage; plaintext backup is blocked.');
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (value.kind === 'Secret' && (value.apiVersion !== 'v1' || !value.metadata?.name || !value.metadata?.namespace || Object.values(value.data || {}).some(data => typeof data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) || Object.values(value.stringData || {}).some(data => typeof data !== 'string'))) throw new Error('Invalid Secret backup manifest.');
    Object.values(value).forEach(visit);
  };
  visit(current);
  manifestYaml(current);
}
const schedulePath = resolve(snapshotRoot, 'schedule.json');
let schedule = { enabled: false, interval: 1, unit: 'days', nextRun: null, lastRun: null, lastError: '', current: null, sourceUpdatedAt: null };
try { schedule = { ...schedule, ...JSON.parse(await readFile(schedulePath, 'utf8')) }; } catch (error) { if (error.code !== 'ENOENT') throw error; }
const nextRun = (from, interval, unit) => {
  const date = new Date(from);
  if (unit === 'months') {
    const day = date.getUTCDate(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + interval);
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate(); date.setUTCDate(Math.min(day, end));
  } else date.setTime(date.getTime() + interval * ({ minutes: 60000, hours: 3600000, days: 86400000, weeks: 604800000 })[unit]);
  return date.toISOString();
};
const scheduleInfo = () => ({ ...schedule, current: undefined, scope: schedule.current?.snapshotScope || null, hasSource: !!schedule.current });
let running = false;
async function runScheduled() {
  if (running || !schedule.current) throw new Error('Snapshot source is unavailable or already running.');
  running = true;
  try {
    const snapshot = await saveSnapshot(schedule.current, JSON.stringify(schedule.current), 'Automatic', schedule.sourceUpdatedAt);
    schedule.lastRun = snapshot.createdAt; schedule.lastError = '';
    schedule.nextRun = schedule.enabled ? nextRun(Date.now(), schedule.interval, schedule.unit) : null;
    await writeAtomic(schedulePath, JSON.stringify(schedule, null, 2)); return snapshot;
  } finally { running = false; }
}
const tick = async () => {
  if (!schedule.enabled || running || !schedule.nextRun || Date.parse(schedule.nextRun) > Date.now()) return;
  try { await runScheduled(); } catch (error) { schedule.lastError = 'Automatic snapshot failed. Check persistent storage.'; schedule.nextRun = new Date(Date.now() + 60000).toISOString(); try { await writeAtomic(schedulePath, JSON.stringify(schedule, null, 2)); } catch {} }
};
setInterval(() => { void tick(); }, 1000).unref();
const cleanupPath=resolve(snapshotRoot,'cleanup.json');
let cleanup={enabled:false,interval:1,unit:'days',retention:30,retentionUnit:'days',nextRun:null,lastRun:null,lastDeleted:0,lastError:''};
try{cleanup={...cleanup,...JSON.parse(await readFile(cleanupPath,'utf8'))};}catch(error){if(error.code!=='ENOENT')throw error;}
async function listSnapshots(){
  const list=[];
  for(const file of await readdir(snapshotRoot)){
    if (file.endsWith('.meta.json')) { const info = JSON.parse(await readFile(resolve(snapshotRoot, file), 'utf8')); if (validId(info.id)) { await stat(resolve(snapshotRoot, `${info.id}.zip`)); list.push(info); } continue; }
    const id=file.replace(/\.json$/,'');if(!validId(id))continue;
    const path=resolve(snapshotRoot,file);
    const snapshot=JSON.parse(await readFile(path,'utf8'));
    const jsonBytes=(await stat(path)).size;
    let yamlBytes=0;try{yamlBytes=(await stat(resolve(snapshotRoot,`${id}.yaml`))).size;}catch(error){if(error.code!=='ENOENT')throw error;}
    list.push({...metadata(snapshot),sizeBytes:jsonBytes+yamlBytes,jsonBytes,yamlBytes});
  }
  return list.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
async function removeSnapshots(ids){for(const id of ids){if(!validId(id))throw new Error('Invalid snapshot reference.');for(const extension of ['meta.json','zip','json','yaml'])try{await unlink(resolve(snapshotRoot,`${id}.${extension}`));}catch(error){if(error.code!=='ENOENT')throw error;}}}
async function loadSnapshot(id, password = '') {
  if (!validId(id)) throw new Error('Invalid snapshot reference.');
  try { return await decodeBackup(await readFile(resolve(snapshotRoot, `${id}.zip`)), password); }
  catch (error) { if (error.code !== 'ENOENT') throw Object.assign(error, { status: 422 }); return JSON.parse(await readFile(resolve(snapshotRoot, `${id}.json`), 'utf8')); }
}
let cleaning=false;
async function runCleanup(){if(cleaning)throw new Error('Cleanup already running.');cleaning=true;try{const list=await listSnapshots();const candidates=cleanupCandidates(list,{retention:cleanup.retention,unit:cleanup.retentionUnit});await removeSnapshots(candidates.map(record=>record.id));cleanup.lastRun=new Date().toISOString();cleanup.lastDeleted=candidates.length;cleanup.lastError='';cleanup.nextRun=cleanup.enabled?nextRun(Date.now(),cleanup.interval,cleanup.unit):null;await writeAtomic(cleanupPath,JSON.stringify(cleanup,null,2));return cleanup;}finally{cleaning=false;}}
setInterval(()=>{if(cleanup.enabled&&!cleaning&&cleanup.nextRun&&Date.parse(cleanup.nextRun)<=Date.now())void runCleanup().catch(()=>{cleanup.lastError='Cleanup failed. Check persistent storage.';cleanup.nextRun=new Date(Date.now()+60000).toISOString();void writeAtomic(cleanupPath,JSON.stringify(cleanup,null,2)).catch(()=>{});});},1000).unref();
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/') && (req.headers['sec-fetch-site']==='cross-site' || req.headers.origin && new URL(req.headers.origin).host!==req.headers.host)) return send(res,403,{error:'Same-origin request required.'});
    if (url.pathname === '/api/snapshot-storage' && req.method === 'GET') {
      const [space,records]=await Promise.all([statfs(await realpath(snapshotRoot)),listSnapshots()]);
      const quotaBytes=Number(process.env.SNAPSHOT_STORAGE_LIMIT_BYTES)||null;
      const usedBytes=(await Promise.all((await readdir(snapshotRoot)).map(name=>stat(resolve(snapshotRoot,name))))).reduce((sum,entry)=>sum+(entry.isFile()?entry.size:0),0);
      const filesystemAvailableBytes=space.bavail*space.bsize;
      const availableBytes=quotaBytes?Math.max(0,Math.min(filesystemAvailableBytes,quotaBytes-usedBytes)):filesystemAvailableBytes;
      const largestSnapshotBytes=records.filter(record=>record.archiveFormat==='zip').reduce((largest,record)=>Math.max(largest,record.sizeBytes),0);
      const totalBytes=Math.min(space.blocks*space.bsize,quotaBytes||Infinity);
      return send(res,200,{totalBytes,availableBytes,quotaBytes,usedBytes,filesystemAvailableBytes,largestSnapshotBytes,...estimateSnapshotStorage(availableBytes,largestSnapshotBytes,schedule),measuredAt:new Date().toISOString(),estimateBasis:'Largest complete ZIP; saved schedule; before cleanup or other disk usage',scheduleEnabled:schedule.enabled});
    }
    if (url.pathname === '/api/snapshot-schedule' && req.method === 'GET') return send(res, 200, scheduleInfo());
    if (['/api/snapshot-schedule', '/api/snapshot-schedule/run', '/api/snapshot-source'].includes(url.pathname) && ['PUT', 'POST'].includes(req.method)) {
      if (!req.headers['content-type']?.startsWith('application/json')) return send(res, 415, { error: 'Use JSON.' });
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host || req.headers['sec-fetch-site'] === 'cross-site') return send(res, 403, { error: 'Snapshot writes require the same origin.' });
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 2 * 1024 * 1024) return send(res, 413, { error: 'Snapshot source exceeds the 2 MiB limit.' }); chunks.push(chunk); }
      let input; try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(res, 400, { error: 'Invalid JSON.' }); }
      if (input.current) {
        if (typeof input.current !== 'object' || Array.isArray(input.current)) return send(res, 400, { error: 'Invalid snapshot source.' });
        try { validateSource(input.current, url.pathname.endsWith('/run') && !!input.password); } catch { return send(res, 400, { error: 'Invalid backup manifests or Secret values.' }); }
      }
      if (url.pathname === '/api/snapshot-schedule') {
        if (typeof input.enabled !== 'boolean' || !Number.isInteger(input.interval) || input.interval < 1 || input.interval > 365 || !['minutes', 'hours', 'days', 'weeks', 'months'].includes(input.unit)) return send(res, 400, { error: 'Choose an interval from 1 to 365 and a supported unit.' });
        if (input.enabled && !input.current && !schedule.current) return send(res, 400, { error: 'Choose a configuration scope before enabling.' });
        schedule = { ...schedule, enabled: input.enabled, interval: input.interval, unit: input.unit, nextRun: input.enabled ? nextRun(Date.now(), input.interval, input.unit) : null };
      }
      if (url.pathname === '/api/snapshot-schedule/run') {
        if (!input.current) return send(res,400,{error:'Current configuration is required.'});
        return send(res,201,await saveSnapshot(input.current,JSON.stringify(input.current),'Manual',new Date().toISOString(),input.password || ''));
      }
      if (input.current) { schedule.current = input.current; schedule.sourceUpdatedAt = new Date().toISOString(); }
      await writeAtomic(schedulePath, JSON.stringify(schedule, null, 2));
      if (url.pathname === '/api/snapshot-schedule/run') return send(res, 201, await runScheduled());
      return send(res, 200, scheduleInfo());
    }
    if(url.pathname==='/api/snapshot-cleanup'&&req.method==='GET')return send(res,200,cleanup);
    if(['/api/snapshot-cleanup','/api/snapshot-cleanup/run','/api/snapshots/merge','/api/snapshots/delete'].includes(url.pathname)&&['PUT','POST'].includes(req.method)){
      if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'Use JSON.'});
      if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host||req.headers['sec-fetch-site']==='cross-site')return send(res,403,{error:'Same-origin request required.'});
      let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024)return send(res,413,{error:'Request too large.'});chunks.push(chunk);}let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(res,400,{error:'Invalid JSON.'});}
      if(url.pathname.startsWith('/api/snapshot-cleanup')){
        if(url.pathname.endsWith('/run'))return send(res,200,await runCleanup());
        if(typeof input.enabled!=='boolean'||!Number.isInteger(input.interval)||input.interval<1||input.interval>365||!Number.isInteger(input.retention)||input.retention<1||input.retention>365||![input.unit,input.retentionUnit].every(u=>['minutes','hours','days','weeks','months'].includes(u)))return send(res,400,{error:'Invalid cleanup interval or retention.'});
        cleanup={...cleanup,enabled:input.enabled,interval:input.interval,unit:input.unit,retention:input.retention,retentionUnit:input.retentionUnit,nextRun:input.enabled?nextRun(Date.now(),input.interval,input.unit):null};await writeAtomic(cleanupPath,JSON.stringify(cleanup,null,2));return send(res,200,cleanup);
      }
      if(!Array.isArray(input.ids)||!input.ids.length||input.ids.length>100||new Set(input.ids).size!==input.ids.length||input.ids.some(id=>!validId(id)))return send(res,400,{error:'Choose valid distinct snapshots.'});
      if(url.pathname.endsWith('/merge')){
        const sources=await Promise.all(input.ids.map(id=>loadSnapshot(id, input.passwords?.[id] || '')));
        let result;
        if(input.priorityOrder){
          if(!Array.isArray(input.priorityOrder)||input.priorityOrder.length!==input.ids.length||new Set(input.priorityOrder).size!==input.ids.length||input.priorityOrder.some(id=>!input.ids.includes(id)))return send(res,400,{error:'Priority must include every selected snapshot exactly once.'});
          if(input.selectedIds!==undefined&&(!Array.isArray(input.selectedIds)||!input.selectedIds.length||input.selectedIds.some(id=>typeof id!=='string')))return send(res,400,{error:'Select items to include.'});
          try{result=mergeInPriorityOrder(input.priorityOrder.map(id=>sources.find(source=>source.id===id)),input.selectedIds,input.preservedSecrets || []);}catch(error){return send(res,400,{error:error.message});}
          if(result.missing.length)return send(res,400,{error:`Missing required dependencies: ${result.missing.join(', ')}`});
          result.current.mergeOmittedItems=result.omitted;
        }else{
          if(!input.ids.includes(input.authorityId))return send(res,400,{error:'Choose an authoritative snapshot.'});
          result=mergeSnapshots(sources,input.authorityId);
        }
        const snapshot=await saveSnapshot(result.current,JSON.stringify(result.current),'Manual',new Date().toISOString(),input.password || '');return send(res,201,snapshot);
      }
      if(!validId(input.backupId)||input.ids.includes(input.backupId))return send(res,400,{error:'Save a recovery snapshot before deleting originals.'});
      const backup=await loadSnapshot(input.backupId,input.backupPassword || '');const age=Date.now()-Date.parse(backup.createdAt);
      if(age<0||age>86400000)return send(res,400,{error:'Recovery snapshot must be less than 24 hours old.'});
      if(input.merged&&backup.current?.mergeOmittedItems)return send(res,400,{error:'Keep originals when the merged snapshot excludes items.'});
      if(input.merged&&input.ids.some(id=>!backup.current?.mergedFrom?.includes(id)))return send(res,400,{error:'Merged snapshot does not include the selected originals.'});
      await removeSnapshots(input.ids);return send(res,200,{deleted:input.ids.length});
    }
    if (url.pathname === '/healthz') return send(res, 200, { healthy: true });
    const unlock = url.pathname.match(/^\/api\/snapshots\/([^/]+)\/unlock$/);
    if (unlock && req.method === 'POST') {
      if (!validId(unlock[1]) || req.headers.origin && new URL(req.headers.origin).host !== req.headers.host || req.headers['sec-fetch-site'] === 'cross-site') return send(res, 403, { error: 'Invalid same-origin unlock request.' });
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 4096) return send(res, 413, { error: 'Unlock request exceeds the limit.' }); chunks.push(chunk); }
      const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      return send(res, 200, await loadSnapshot(unlock[1], input.password || ''));
    }
    if (url.pathname === '/api/snapshots' && req.method === 'GET') {
      return send(res, 200, { storage: snapshotRoot, snapshots: await listSnapshots() });
    }
    if (url.pathname === '/api/snapshots' && req.method === 'POST') {
      if (!req.headers['content-type']?.startsWith('application/json')) return send(res, 415, { error: 'Use a JSON snapshot.' });
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host || req.headers['sec-fetch-site'] === 'cross-site') return send(res, 403, { error: 'Snapshot writes require the same origin.' });
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 2 * 1024 * 1024) return send(res, 413, { error: 'Snapshot exceeds the 2 MiB limit.' }); chunks.push(chunk); }
      let input;
      try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(res, 400, { error: 'Invalid JSON snapshot.' }); }
      if (!input.current || typeof input.current !== 'object' || typeof input.scopeKey !== 'string') return send(res, 400, { error: 'Snapshot scope and configuration are required.' });
      try { validateSource(input.current, !!input.password); } catch { return send(res, 400, { error: 'Invalid backup manifests or unprotected Secret values.' }); }
      const snapshot = await saveSnapshot(input.current, input.scopeKey, 'Manual', new Date().toISOString(), input.password || '');
      return send(res, 201, snapshot);
    }
    if (url.pathname.startsWith('/api/snapshots/') && req.method === 'GET') {
      const zipMatch = url.pathname.match(/^\/api\/snapshots\/([^/]+)\/backup.zip$/);
      if (zipMatch) {
        if (!validId(zipMatch[1])) return send(res, 400, { error: 'Invalid snapshot reference.' });
        const bytes = await readFile(resolve(snapshotRoot, `${zipMatch[1]}.zip`));
        res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="dns-manager-backup.zip"', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        return res.end(bytes);
      }
      const yamlMatch = url.pathname.match(/^\/api\/snapshots\/([^/]+)\/manifests\.yaml$/);
      if (yamlMatch) {
        if (!validId(yamlMatch[1])) return send(res, 400, { error: 'Invalid snapshot reference.' });
        const bytes = await readFile(resolve(snapshotRoot, `${yamlMatch[1]}.yaml`));
        res.writeHead(200, { 'Content-Type': 'application/yaml; charset=utf-8', 'Content-Disposition': 'attachment; filename="routing-configuration-backup.yaml"', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        return res.end(bytes);
      }
      const id = url.pathname.slice('/api/snapshots/'.length);
      if (!validId(id)) return send(res, 400, { error: 'Invalid snapshot reference.' });
      return send(res, 200, await loadSnapshot(id));
    }
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'API endpoint unavailable.' });
    if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, { error: 'Unsupported method.' });
    let path = resolve(staticRoot, `.${decodeURIComponent(url.pathname)}`);
    if (path !== staticRoot && !path.startsWith(`${staticRoot}${sep}`)) return send(res, 403, { error: 'Invalid asset path.' });
    if (path === staticRoot) path = resolve(staticRoot, 'index.html');
    let bytes;
    try { bytes = await readFile(path); } catch (error) { if (extname(path)) throw error; path = resolve(staticRoot, 'index.html'); bytes = await readFile(path); }
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': extname(path) === '.html' ? 'no-store' : 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' }); res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch (error) { send(res, error.code === 'ENOENT' ? 404 : error.status || 500, { error: error.code === 'ENOENT' ? 'Snapshot or asset not found.' : error.status === 422 ? 'Encrypted backup requires unlocking with its password.' : error.status === 507 ? 'Snapshot storage quota exhausted.' : 'Unable to save or read the snapshot.' }); }
}).listen(Number(process.env.PORT || 8080), process.env.HOST || '127.0.0.1', () => process.send?.({ready:true}));
