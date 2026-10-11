import { build } from 'vite';
await build({ configFile: false, build: { ssr: 'tests/namespace-context.test.ts', outDir: 'dist-preview/tests', emptyOutDir: false, rollupOptions: { output: { entryFileNames: 'namespace-context.test.mjs' } } } });
await import('../dist-preview/tests/namespace-context.test.mjs');
