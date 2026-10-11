import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { projectMockData } from '../preview-data/vite-plugin.mjs';
import { localSnapshotService } from '../preview-data/snapshot-service.mjs';
export default defineConfig({
  root: 'preview',
  define: { __SNM_PREVIEW_MODE__: JSON.stringify(process.env.SNM_PREVIEW_MODE !== 'false') },
  plugins: [projectMockData({ pluginId: 'network-manager', file: fileURLToPath(new URL('../preview-data/data/network-manager.json', import.meta.url)) }), localSnapshotService({pluginId:'network-manager',folder:'simple-network-manager-dev',port:5183}), vue()],
  resolve: { dedupe: ['vue'] },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: {'/api':{target:'http://127.0.0.1:5183'}} },
  build: { outDir: '../dist-preview', emptyOutDir: false }
});
