import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
export default defineConfig(({mode})=>({
  plugins: [vue()],
  resolve: { dedupe: ['vue'] },
  test: { environment: 'jsdom', include: mode==='gaps'?['tests/ui/gaps.spec.ts']:['tests/ui/source-management.spec.ts','tests/ui/source-connection.spec.ts','tests/ui/credential-restore.spec.ts','tests/ui/standards.spec.ts','tests/ui/snapshots.spec.ts','tests/ui/layout-evidence.spec.ts','tests/ui/overview-snapshots.spec.ts','tests/ui/live-zone-review.spec.ts','tests/ui/live-navigation-review.spec.ts'], setupFiles: ['tests/ui/setup.ts'],
    testTimeout: 10000, restoreMocks: true }
}));
