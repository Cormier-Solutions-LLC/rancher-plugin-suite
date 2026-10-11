// Local compilation only: no publication and no cluster access.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const name = 'simple-network-manager';
const pkg = path.join(root, 'pkg', name);
const shell = path.join(root, 'node_modules', '@rancher', 'shell');
const link = path.join(pkg, '.shell');
if (fs.existsSync(link)) {
  if (fs.realpathSync(link) !== fs.realpathSync(shell)) {
    throw new Error('Existing package shell link points to a different dependency.');
  }
} else {
  fs.symlinkSync(shell, link, process.platform === 'win32' ? 'junction' : 'dir');
}
const version = require(path.join(pkg, 'package.json')).version;
const cli = require.resolve('@vue/cli-service/bin/vue-cli-service.js');
const result = spawnSync(process.execPath, [cli, 'build', '--name', `${name}-${version}`, '--target', 'lib', 'index.ts', '--dest', path.join(root, 'dist-pkg', `${name}-${version}`), '--formats', 'umd-min', '--filename', `${name}-${version}`], { cwd: pkg, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status) process.exit(result.status);
const output = path.join(root, 'dist-pkg', `${name}-${version}`);
const assets = path.join(output, 'plugin');
fs.mkdirSync(assets, { recursive: true });
const bundles = fs.readdirSync(output).filter(file => file.startsWith(`${name}-${version}.umd.min`) && file.endsWith('.js'));
for (const file of bundles) fs.copyFileSync(path.join(output, file), path.join(assets, file));
fs.writeFileSync(path.join(output, 'files.txt'), bundles.map(file => `plugin/${file}`).join('\n') + '\n');
console.log('Versioned extension assets prepared; nothing was published or installed.');
