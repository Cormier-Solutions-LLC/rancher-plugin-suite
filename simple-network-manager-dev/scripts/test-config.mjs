import { build } from 'vite';
await build({ configFile: false, build: { ssr: 'tests/configuration.test.ts', outDir: 'dist-preview/tests', emptyOutDir: false, rollupOptions: { output: { entryFileNames: 'configuration.test.mjs' } } } });
await import('../dist-preview/tests/configuration.test.mjs');
