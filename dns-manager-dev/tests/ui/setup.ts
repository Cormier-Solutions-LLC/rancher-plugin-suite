import { afterEach, beforeEach, vi } from 'vitest';
import { enableAutoUnmount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
const commonVersion = JSON.parse(readFileSync('../rancher-common-ui/package.json','utf8')).version;
const commonBundle = readFileSync(`../rancher-common-ui/dist/${commonVersion}/plugin/rancher-common-ui-${commonVersion}.umd.min.js`, 'utf8');
enableAutoUnmount(afterEach);
beforeEach(() => {
  // Exercise the independently built plugin rather than a bundled test-only UI implementation.
  new Function(commonBundle)();
  (globalThis as any)[`rancher-common-ui-${commonVersion}`].default({ addUninstallHook() {} });
  localStorage.clear(); sessionStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('requestAnimationFrame', (callback: any) => setTimeout(() => callback(Date.now()), 0));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  const schedule = { enabled: false, interval: 1, unit: 'days', scope: {}, nextRunAt: null };
  const cleanup = { enabled: false, interval: 1, unit: 'days', retention: 30, retentionUnit: 'days', nextRunAt: null };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const data = url.includes('snapshot-storage') ? { measuredAt: new Date().toISOString(), availableBytes: 1000000, totalBytes: 2000000, largestSnapshotBytes: 0, capacity: null, runOutAt: null, reason: 'Not Scheduled' }
      : url.includes('snapshot-cleanup') ? cleanup : url.includes('snapshot-schedule') ? schedule : { snapshots: [] };
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });
