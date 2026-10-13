import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPreviewStore, previewDataMiddleware } from './store.mjs';
import { validatePreviewData } from './validation.mjs';

// Dev-only persistence; the production/native extension never imports this server.
export function projectMockData({ pluginId, file }) {
  if (process.env.RANCHER_SUITE_PREVIEW_SESSION) file = resolve(process.env.RANCHER_SUITE_PREVIEW_SESSION, 'data', `${pluginId}.json`);
  const store = createPreviewStore({ file, pluginId, validate: data => validatePreviewData(pluginId, data) });
  const document = JSON.parse(readFileSync(file, 'utf8'));
  return {
    name: 'rancher-suite-project-mock-data',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(previewDataMiddleware({ store, pluginId }));
      // Saved state should not remount active editors through filesystem HMR.
      server.watcher.unwatch(file);
    },
    resolveId(id) {
      if (id === 'virtual:rancher-suite-source') return '\0rancher-suite-source';
    },
    load(id) {
      if (id === '\0rancher-suite-source') return `export default ${JSON.stringify(document)};`;
    }
  };
}
