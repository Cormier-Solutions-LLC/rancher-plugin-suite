# DNS Manager UI standards tests

From `dns-manager-dev` after `npm ci`:

```powershell
npm run test:ui
npm run test:ui:gaps
npm test
npm run build:preview
npm run build:extension
```

The normal suite mounts the actual Vue Dashboard/snapshot components with JSDOM and mocks only external local API responses. It tests displayed behavior, controls, guards, values and lifecycle; it does not stub out the pages under review. The current suite has 49 behavior tests plus 4 evidence-replay tests. JSDOM cannot measure pixel alignment.

The gaps suite contains 17 unmet acceptance tests. **It currently exits nonzero intentionally.** They are real failing assertions, not `skip`, `todo` or `it.fails`. A green normal suite does not establish compliance. Repair the associated finding, verify in a real browser, and move repaired tests into the normal suite while keeping their requirement references.

Real browser geometry was measured through the approved CUA browser API. `browser-layout-probe.mjs` is the reusable read-only probe for bounds, count columns, filter alignment, action dimensions, numeric alignment, dialog bounds, schedule allocation and storage columns. The dated `layout-evidence.json` is captured evidence, not a live browser run hidden behind npm. Evidence tests validate recorded assertions; they must be recaptured after UI/layout changes.

## Reproduce the visual audit

```powershell
npm run preview:audit
```

This starts `http://127.0.0.1:5194` with its own loopback snapshot API on 5195 and a fresh isolated copy under `../.local/dns-standards-audit/<session>/`. Existing 5172/5173/5174 previews and packaged seeds are unaffected. Stop with Ctrl+C. The optional DNS-engine container prototype is not needed.

Navigate every fixed page and zone entry, plus source/record/new-zone editors, draft/review/leave dialogs, snapshot capture/password/restore/delete and merge steps. Create only synthetic audit data in that isolated source. Use the real browser probe at 1280×720, 768×900 and 480×800, inspect screenshots visually and reset viewport overrides afterward. Record each returned measurement with its route/profile in the dated layout-evidence file.

The 200 px schedule usability probe is an audit threshold to expose compressed panels, not a pixel value claimed by the standard. Visual inspection must catch unusable content allocation even when outer-document overflow and control bounds pass.

The current [report](../../docs/standards-audit/2026-10-11/REPORT.md), [checklist](../../docs/standards-audit/2026-10-11/CHECKLIST.md) and [evidence](../../docs/standards-audit/2026-10-11/EVIDENCE.md) distinguish local tests, known gaps and native/live acceptance.

## Maintain the audit

```powershell
npm run audit:requirements
node scripts/render-audit.mjs
```

`audit-requirements.mjs` inventories every top-level source/rule/checklist item and preserves results only for unchanged text/IDs. `audit-analysis.mjs` contains the human-reviewed per-item dispositions. Update those after gathering new evidence; the renderer refuses missing/incorrect section lengths or a changed standard hash. It writes the full checklist, result summary, source manifest and test/evidence indexes.

Before rendering, run the normal and gaps suites with JSON reports to `../.local/dns-ui-tests.json` and `../.local/dns-ui-gaps.json`. Native Rancher installation, permissions, actual source observations, Secret reads, writes/readback, production backup volumes and DNS HA need separate authenticated integration/release evidence.
