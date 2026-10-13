# Accepted UI implementation

Source: completed `decisions.json`, revision **94**, saved **2026-10-11T17:55:51.061Z**. All 34 choices are mapped below. The original report and saved decisions are preserved.

The common presentation runtime is `rancher-common-ui` 1.0.0 / API 1. Both manager bundles reference it through `client/index.mjs`, rather than importing its component factories or stylesheet. The independently owned Helm chart registers its UIPlugin; manager charts check that prerequisite. Shared layout variants are exported controls, selectable by each manager adapter for its information type.

## Choices

| Review item | Selected | Result |
| --- | --- | --- |
| shell-layout | dns | Common Shell supplies the DNS page structure; native mode uses Rancher chrome. |
| navigation | network | Network menu hierarchy, left alignment, active state, and right-side counts in both previews. |
| theme | blend | DNS page/form palette and spacing with Network navigation; light/dark host variables retained. |
| heading-layout | dns | Common Heading provides breadcrumbs, title, subtitle, help, and right-side actions. |
| action-style | network | Common CreateButton, PageActions, ActionIcon, and action styles preserve Network controls. |
| notifications | dns | Common Banner uses DNS strip presentation with each manager's own status and recovery action. |
| refresh | dns | Common RefreshButton with interval, countdown, and in-place refresh callbacks. |
| overview-detail | custom | Both stacked and master/detail layouts, plus boxed/inline flow variants, are exported by common UI. |
| inventory-grid | dns | Common DataGrid / DOM table helpers provide DNS spacing and accessible sorting. |
| inventory-filters | network | Common InventoryFilters and MultiFilter retain Network search/group/filter functions. |
| integration-grid | dns | Issuer and source inventories share DataGrid/table presentation; manager columns remain distinct. |
| configuration-grid | dns | Port configurations and zones share the common table presentation. |
| selection-controls | dns | Shared grid checkbox/action sizing; domain selection and bulk operations remain local. |
| editor-location | dns | Full-page editor state hides inventory controls; DNS create-zone routing opens the editor correctly. |
| editor-fields | dns | Shared two-column form layout and input theme; each manager retains its own fields and validation. |
| editor-actions | network | Network action appearance and local save/cancel/draft behavior retained. |
| pending-review | network | Structured proposal summary with explicit fields using shared reviewMarkup; manager safety review remains local. |
| pending-layout | network | Network review/queue interaction and common table/flow styling; DNS proposal data remains DNS-specific. |
| process-empty | blend | DNS table appearance with persistent search, process columns, and truthful empty state. |
| snapshot-grid | dns | Common DataGrid and SnapshotDateRange; paired calendars now fit the modal, with optional times and range validation. |
| snapshot-schedule | dns | Common ScheduleLayout for two cards, left-aligned grouped action buttons, and shared inputs. |
| snapshot-storage | dns | Common StorageSummary displays three metrics without the visible Snapshot Storage title or fit estimate. |
| snapshot-capture | network | New Snapshot and Run Now directly open shared BackupPassword options; Include Secrets defaults off. |
| snapshot-coverage | network | Common CoverageView with categorized coverage/diff review and DNS coverage navigation/banner. |
| snapshot-recovery | blend | Manager restoration and merge flows retain Network review/diffs/selection; common Modal/table/theme supply the DNS look. |
| diagnostics-count | blend | Manager-specific counts retained, using the Network placement and DNS count tone. |
| diagnostics-layout | blend | Network filter/grid structure with common table styling; DNS extra overview panel removed. |
| settings-layout | dns | Common SettingsLayout; URL first, checkbox groups beneath, preserving local preference fields. |
| settings-actions | dns | DNS Save Settings and Cancel grouping; manager-local settings persistence retained. |
| context-help | dns | Common HelpTip opens accessible shared Modal, then invokes the manager's contextual Help navigation. |
| help-page | dns | Common HelpGuide with initially collapsed topics; contextual navigation expands the selected topic. |
| overview-layout | custom | Common OverviewLayout exports stacked and master-detail variants used by the managers. |
| record-detail | custom | Common DetailLayout exports stacked and master-detail alternatives for different information. |
| snapshot-layout | dns | Common SnapshotLayout and ScheduleLayout give both managers the DNS organization with bounded scrolling. |

## Comments honored

DNS layout/forms with Network left menu. Both overview/detail approaches remain reusable layout options. The snapshot date picker has a viewport-bounded dialog, paired calendars, optional times, Escape dismissal, and focus return. Process and diagnostics layouts preserve Network features with DNS presentation. Snapshot restoration retains diffs, merge, selection, and review safeguards.

Removed the approximate snapshots-fit message, the enabled/saved hosting-server sentence, and the visible Snapshot Storage title. Errors remain visible. Schedule action buttons stay together on their own wrapping row and align left; action groups wrap without internal scrollbars.

## Validation and limits

- Actual common UMD tests: every exported component, late load, missing/disabled/incompatible runtime, numeric sorting, compatible upgrade changing visible controls without rebuilding a consumer, and identity-safe uninstall.
- Actual Helm against a local mock Kubernetes API: rejects missing, disabled, wrong API, and incompatible common UIPlugin; verifies separate releases and no embedded common chart. Offline lint also passes.
- Both manager preview and native extension builds pass. Native builds report bundle-size performance warnings.
- DNS UI suite: 63 passing tests across 3 files. Manager/domain snapshot, encryption, configuration, preview-data, and review persistence tests also passed during implementation.
- Browser checks: desktop 1280 × 720, tablet 768 × 720, mobile 390 × 700; neither manager overflows horizontally. Mobile pages remain scrollable. Calendar Escape dismissal returns focus to All Dates; snapshot options default Include Secrets off and cancel without capture. DNS coverage navigation opens its shared review. Both managers load common 1.0.0. Light/dark contrast checked; no fresh console errors after corrected startup. See implementation-evidence.

These checks establish local implementation and artifact behavior. No assets have been published and no Helm release has been installed or upgraded on a live Rancher cluster. Live Rancher load/cache/independent upgrade and rollback verification remains a deployment check. Existing manager-native backend limitations remain unchanged.

[Common plugin install, independent upgrade, and rollback](../../rancher-common-ui/README.md) · [Global standard](../../RANCHER-PLUGIN-DESIGN.md) · [Saved choices](decisions.json)


## User refinements after the completed report

The original revision 94 decisions are preserved. Subsequent chat choices apply
DNS breadcrumbs and grid styling to both managers, keep Overview layouts and
apply DNS colors, retain Network's rounded count palette, add dividers below
Overview and above Pending Rollouts, and show DNS zone entries without a collapse
control. Top-right counts match scoped menu totals and severity; the snapshot
grid no longer repeats its count. Network Overview counts routes and detail
accordions have space around the panels. Diagnostics uses the last 24 hours:
error red, warning yellow, no incidents green. Menu errors override warnings.

Schedule/cleanup panels and their actions have no internal scrollbars. Preview
storage uses marked mock capacity until configured quota is available. Save
Schedule/Enable open Snapshot Options like Run Now; protected schedules retain
credentials through immutable backend Secret references, encrypt their stored
source and use each archive's credential for recovery. Old ZIPs survive password
rotation. The preview uses an encrypted mock store outside committed mock data.
See [credential setup](../../preview-data/snapshot-credentials.md).

Validation: 63 DNS UI tests, common plugin tests, Network configuration checks,
protected scheduled capture/restart/rotation/recovery tests for both servers and
preview/native builds pass. Native bundles retain size warnings (Network about
794 KiB; DNS about 396 KiB). New browser evidence is under implementation-evidence.
Live installation and live Kubernetes Secret authorization remain unverified.
