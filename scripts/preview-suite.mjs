import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const registry = { 'network-manager': { folder: 'simple-network-manager-dev', port: 5173 },
  'dns-manager': { folder: 'dns-manager-dev', port: 5174 } };
const selected = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(registry);
if (selected.some(id => !registry[id]) || new Set(selected).size !== selected.length) {
  console.error('Use npm run preview -- [network-manager] [dns-manager], or omit names for both.'); process.exit(1);
}
const children = []; let closing = false;
function close(code = 0) {
  if (closing) return; closing = true;
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
    cwd: resolve(root, folder), stdio: ['inherit', 'pipe', 'pipe'], windowsHide: true
  });
  children.push(child);
  for (const [stream, destination] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
    stream.on('data', chunk => destination.write(`[${id}] ${chunk}`));
  }
  child.on('error', error => { console.error(`${id}: ${error.message}`); close(1); });
  child.on('exit', code => { if (!closing) close(code || 0); });
}
process.on('SIGINT', () => close()); process.on('SIGTERM', () => close());
