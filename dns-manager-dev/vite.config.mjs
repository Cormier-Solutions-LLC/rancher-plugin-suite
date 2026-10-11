import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { projectMockData } from '../preview-data/vite-plugin.mjs';
import { localSnapshotService } from '../preview-data/snapshot-service.mjs';

export default defineConfig({
  root: 'preview', // Standalone UI, with the shared project-owned mock data source.
  plugins: [projectMockData({ pluginId: 'dns-manager', file: fileURLToPath(new URL('../preview-data/data/dns-manager.json', import.meta.url)) }), localSnapshotService({pluginId:'dns-manager',folder:'dns-manager-dev',port:5184}), vue()],
  resolve: { dedupe: ['vue'] },
  server: { host: '127.0.0.1', port: 5174, strictPort: true, proxy: { '/api': { target:'http://127.0.0.1:5184' } } },
  build: { outDir: '../dist-preview', emptyOutDir: true }
});
