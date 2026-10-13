import {build} from 'vite';
await build({configFile:false,build:{ssr:'../scripts/test-live-network.ts',outDir:'../.local/manager-installation/network-tests',emptyOutDir:false,rollupOptions:{output:{entryFileNames:'test-live-network.mjs'}}}});
process.chdir('..');
await import('../../.local/manager-installation/network-tests/test-live-network.mjs');
