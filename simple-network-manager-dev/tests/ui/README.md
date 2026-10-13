# Network Manager UI standards audit tests

`npm run test:ui:contracts` tests the layout detector with passing and deliberately
misaligned fixtures. These unit tests do not themselves test the application.

`browser-audit.mjs` runs the real application through the supported Codex CUA
browser adapter. Supply an isolated tab, the browser viewport capability, sizes,
and a screenshot writer to `auditInventoryPages`. It uses locator interaction and
read-only rendered-DOM measurements; it never injects application state. Run new
captures after application changes, including hidden editors and selected actions.
Do not reuse the user's active tab or snapshot directory. Reset viewport and close
the temporary tab afterwards. The all-namespace scope is restored after viewport
changes because resizing may reload a static preview.

`npm run test:ui:audit` asserts the recorded real-browser measurements under
`docs/audit-2026-10-11`. **This replays evidence; it does not launch a fresh browser.**
It intentionally fails for current defects rather than marking known failures as
passing or weakening requirements. New browser runs must replace the measurements.
Tests check viewport containment, title/action alignment, shared button/icon
dimensions, count placement, filter baselines, text/numeric column alignment,
Overview checkbox absence, panel bottom edges, and contextual Help presence.
Responsive filter stacking is allowed; document scrolling is not.

`npm run test:audit:snapshots` contains two targeted standards regressions exposed
by the audit: namespaced issuer identity and persistent metadata differences.
They exercise the actual merge model used by the UI and must pass.

The audit report records manual visual and interaction checks separately. Browser
measurements cannot establish installed Rancher integration, live authorization,
real controller activity, light-theme contrast, or production recovery.
