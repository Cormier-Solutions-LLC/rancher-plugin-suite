import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createPreviewHub } from './preview-hub.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const registry = { 'network-manager': { title: 'Network Manager', folder: 'simple-network-manager-dev', port: 5173 },
  'dns-manager': { title: 'DNS Manager', folder: 'dns-manager-dev', port: 5174 } };
const selected = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(registry);
if (selected.some(id => !registry[id]) || new Set(selected).size !== selected.length) {
  console.error('Use npm run preview -- [network-manager] [dns-manager], or omit names for both.'); process.exit(1);
}
const resumeSession = process.env.RANCHER_SUITE_PREVIEW_SESSION;
const session = resumeSession ? resolve(resumeSession) : resolve(root, '.local/preview-sessions', randomUUID());
const dataDirectory = resolve(session, 'data');
await mkdir(dataDirectory, { recursive: true });
for (const id of resumeSession ? [] : selected) {
  const document = JSON.parse(await readFile(resolve(root, 'preview-data/data', `${id}.json`), 'utf8'));
  if (id === 'network-manager') {
    document.data.state.displaySettings = { ...document.data.state.displaySettings, previewMode: false };
    document.data.state.namespaceContext = [];
  }
  else {
    document.data.state.page = 'overview';
    const preferences = document.data.state.preferences || {};
    document.data.state.preferences = { ...preferences, namespaceFilters: [], banners: { ...preferences.banners, preview: false } };
  }
  await writeFile(resolve(dataDirectory, `${id}.json`), JSON.stringify(document, null, 2) + '\n');
}
const hub = createPreviewHub({ session, plugins: selected.map(id => ({ id, title: registry[id].title, url: `http://127.0.0.1:${registry[id].port}/` })) });
try {
  await new Promise((done, reject) => { hub.once('error', reject); hub.listen(5172, '127.0.0.1', done); });
} catch (error) { console.error(`Suite preview could not start on port 5172: ${error.message}`); process.exit(1); }
console.log('Suite browser: http://127.0.0.1:5172/');
console.log(`Temporary editable data: ${dataDirectory}`);
const children = []; let closing = false;
function close(code = 0) {
  if (closing) return; closing = true;
  hub.close();
  const waits = children.filter(child => child.exitCode === null).map(child => new Promise(done => {
    if (process.platform === 'win32') execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => done());
    else { child.kill('SIGTERM'); child.once('exit', done); }
  }));
  Promise.all(waits).then(() => process.exit(code));
}
for (const id of selected) {
  const { folder, port } = registry[id];
  console.log(`${id}: http://127.0.0.1:${port} (${folder})`);
  const child = spawn(process.execPath, [process.env.npm_execpath, 'run', 'preview'], {
    cwd: resolve(root, folder), env: { ...process.env, RANCHER_SUITE_PREVIEW_SESSION: session },
    stdio: ['inherit', 'pipe', 'pipe'], windowsHide: true
  });
  children.push(child);
  for (const [stream, destination] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
    stream.on('data', chunk => destination.write(`[${id}] ${chunk}`));
  }
  child.on('error', error => { console.error(`${id}: ${error.message}`); close(1); });
  child.on('exit', code => { if (!closing) close(code || 0); });
}
process.on('SIGINT', () => close()); process.on('SIGTERM', () => close());
