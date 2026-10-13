# Network Manager & DNS Manager — UI choices

Presentation-only comparison of the current Network Manager and DNS Manager previews, inspected at 1280 × 720 on October 11, 2026. Ignore application context, resource names/counts, domain-specific pages, fields, data, and behavior. Choices apply to shared layout, spacing, typography, colors, controls, tables, dialogs, and scrolling. Screenshots retain their original content only to show the visual treatment.

Open the interactive report with `npm run review:ui` at http://127.0.0.1:5175/. Choices and comments save to `decisions.json`. This Markdown copy is an alternate manual worksheet; edits here do not synchronize with the interactive report.

Pick one option per item. For Combine both or Custom, describe the intended result. Implementation follows completed choices.

## Application shell & navigation

Screenshots: [network-overview](evidence/network-overview.png) · [dns-overview](evidence/dns-overview.png)

### Preview shell (`shell-layout`)

**Network look:** Cluster context and Mock Data at the top of a tall left sidebar; global namespace selector above the page.

**DNS look:** Rancher top bar with cluster and namespace selector; Explorer context, icons, and Mock Data at the bottom of the sidebar.

**Choice concerns:** Choose the standalone preview shell. Native plugins must use Rancher chrome.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Navigation & counts (`navigation`)

**Network look:** Plain labels, right-aligned counts, muted blue selected row; manager group can collapse.

**DNS look:** Icon-rich labels, left-side colored counts, lavender selected row; nested zone navigation and separate zone-group expansion.

**Choice concerns:** Resource lists stay manager-specific. Select badge placement, selected-row styling, and expansion treatment.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Color & typography (`theme`)

**Network look:** Blue-gray page and lighter inset cards; bold headings. Several controls/popups use fixed dark colors.

**DNS look:** Charcoal page, darker cards, lighter-weight headings; main palette uses light-dark tokens. Snapshot subcomponents still have separate styling.

**Choice concerns:** The chosen look must still inherit Rancher light/dark themes. Neither capture proves complete theme compliance.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

Source evidence: `simple-network-manager-dev/preview/Preview.vue`, `dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue`, `simple-network-manager-dev/pkg/simple-network-manager/navigation.ts`, `dns-manager-dev/pkg/dns-manager/navigation.js`

## Shared page heading, actions & notices

Screenshots: [network-settings](evidence/network-settings.png) · [dns-settings](evidence/dns-settings.png)

### Heading layout (`heading-layout`)

**Network look:** Manager · cluster / page breadcrumb; larger bold page title with a small circled question mark; no standard subtitle.

**DNS look:** Manager / page breadcrumb; lighter title with outlined help icon and a subtitle under it.

**Choice concerns:** Select spacing, subtitle treatment, title weight, and contextual-help placement.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Action buttons (`action-style`)

**Network look:** Blue primary buttons often include a plus/save icon and descriptive labels such as New Connection or New Certificate.

**DNS look:** Bright blue primary buttons; inventories use generic Create; editor controls include explicit Cancel.

**Choice concerns:** Both put actions in the upper right beside refresh and the page count. Keep selection-dependent actions hidden until selected.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Top-of-page notifications (`notifications`)

**Network look:** Snapshot missing/outdated banner across inspected pages, including Settings and Help; snapshot coverage opens from it.

**DNS look:** Backend-unavailable banner across pages; Overview adds a management-failover banner. Counts are red when the backend is absent.

**Choice concerns:** Choose presentation only. Snapshot, backend, and read-failure semantics must remain truthful and each banner must open the relevant fix flow.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Refresh controls (`refresh`)

**Network look:** Refresh Every select, countdown, refresh icon; refresh overlay/read-failure handling lives in the Vue page shell.

**DNS look:** Same interval choices and countdown; refreshed sample-data action; request-state UI is separate.

**Choice concerns:** Visually close. Choose sizing and labels; retained drafts, loading/error/retry behavior remain mandatory.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

Source evidence: `simple-network-manager-dev/pkg/simple-network-manager/pages/Dashboard.vue`, `simple-network-manager-dev/pkg/simple-network-manager/pages/PageActions.vue`, `dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue`, `dns-manager-dev/pkg/dns-manager/ui/dns-manager.js: actions(), status()`

## Overview

Screenshots: [network-overview](evidence/network-overview.png) · [dns-overview](evidence/dns-overview.png)

### Overview composition (`overview-layout`)

**Network look:** Summary cards, search/filter row, selectable cards at left and detailed flow/accordions at right.

**DNS look:** Summary cards, full-width search, then stacked panels and grids across the page.

**Choice concerns:** Choose master/detail versus stacked panels. Ignore card count, data and domain-specific sections.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Resource details (`overview-detail`)

**Network look:** Status chips and compact action icons above individually boxed flow steps and accordions.

**DNS look:** Flow labels connected with arrows without individual boxes, followed by tables and detail panels.

**Choice concerns:** Select flow-step treatment, status-chip appearance and detail/accordion styling only.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

Source evidence: `simple-network-manager-dev/pkg/simple-network-manager/pages/Dashboard.vue`, `dns-manager-dev/pkg/dns-manager/ui/dns-manager.js: overview()`

## Inventory pages — TLS & Certificates / Sources

Screenshots: [network-certificates](evidence/network-certificates.png) · [dns-sources](evidence/dns-sources.png)

### Table presentation (`inventory-grid`)

**Network look:** Inset bordered grid, heavier headers, sort markers and a circled grid-help control; namespace links and certificate/secret context.

**DNS look:** Flatter full-width grid, lighter headers, source endpoint stacked under name; connection badge and icon actions.

**Choice concerns:** There is no DNS certificate page and no Network source page. Choose the reusable grid style.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Search & filters (`inventory-filters`)

**Network look:** Labeled search and multiple compact controls align in a shared row, with Group By beside search.

**DNS look:** Wide labeled search, with applicable compact filters to its right.

**Choice concerns:** Choose field dimensions, spacing and filter-row alignment. Ignore which domain filters exist.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

Source evidence: `simple-network-manager-dev/pkg/simple-network-manager/pages/CertificateLifecycle.vue`, `simple-network-manager-dev/pkg/simple-network-manager/pages/DataGrid.vue`, `dns-manager-dev/pkg/dns-manager/ui/dns-manager.js: sourceTable(), table(), decorateTables()`

## TLS Issuer Profiles / DNS Sources

Screenshots: [network-issuers](evidence/network-issuers.png) · [dns-sources](evidence/dns-sources.png)

### Integration inventory pattern (`integration-grid`)

**Network look:** Inset grid with prominent header text and clickable names; editing retains the inventory on the page.

**DNS look:** Flatter grid with compact icon actions and stacked name/address text; editing replaces the inventory body.

**Choice concerns:** Select grid and in-page versus contextual editor presentation. Ignore column content and integration type.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

Source evidence: `simple-network-manager-dev/pkg/simple-network-manager/pages/Settings.vue`, `dns-manager-dev/pkg/dns-manager/ui/dns-manager.js: sourceTable()`

## Port Configurations / Zones

Screenshots: [network-ports](evidence/network-ports.png) · [dns-zones](evidence/dns-zones.png)

### Configuration grid (`configuration-grid`)

**Network look:** Inset bordered table; prominent labels and trailing icon actions; descriptive primary action with an icon.

**DNS look:** Flatter table; lighter labels, compact trailing icon actions; generic Create primary action.

**Choice concerns:** Choose grid borders, spacing, header treatment and action styling. Ignore domain-specific columns and actions.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Selection controls (`selection-controls`)

**Network look:** Checkbox selection column and selection-dependent actions in the top toolbar.

**DNS look:** Checkbox selection column and selection-dependent actions in the top toolbar; applicable reorder mode uses row handles.

**Choice concerns:** Choose checkbox/handle appearance and toolbar alignment. Applicability of ordering is domain-specific and excluded.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

Source evidence: `simple-network-manager-dev/pkg/simple-network-manager/pages/PortPresets.vue`, `dns-manager-dev/pkg/dns-manager/ui/dns-manager.js: zoneTable(), actions()`

## Zone details & records / Route details

Screenshots: [network-overview](evidence/network-overview.png) · [dns-records](evidence/dns-records.png)

### Detail-page pattern (`record-detail`)

**Network look:** Detail remains beside the selectable item list, with collapsible subsections.

**DNS look:** Detail opens as a full page with a compact metadata panel, accordion, search/filter row and flat grid.

**Choice concerns:** Select master/detail or dedicated detail-page treatment where appropriate. Ignore resource type and metadata content.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

Source evidence: `simple-network-manager-dev/pkg/simple-network-manager/pages/Dashboard.vue`, `dns-manager-dev/pkg/dns-manager/ui/dns-manager.js: zonePage()`

## Create/Edit — connection, certificate, issuer, ports, source & record

Screenshots: [network-editor](evidence/network-editor.png) · [dns-source-editor](evidence/dns-source-editor.png) · [network-certificate-editor](evidence/network-certificate-editor.png) · [network-issuer-editor](evidence/network-issuer-editor.png) · [network-port-editor](evidence/network-port-editor.png) · [dns-record-editor](evidence/dns-record-editor.png)

### Editor location (`editor-location`)

**Network look:** Connection uses a hidden route. Certificate, issuer, and port editors appear within their inventory pages; inventory content often remains below the form.

**DNS look:** Source and record editors replace the page body with a dedicated contextual form.

**Choice concerns:** Choose consistency of editor placement.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Field layout (`editor-fields`)

**Network look:** Grouped sections and helper text; forms include a mixture of single-column fields, dependent pickers and editable tables.

**DNS look:** Compact two-column forms with full-width fields where needed, inside one bordered panel.

**Choice concerns:** Select labels, spacing, field styles, grouping, and helper-text placement. Exclude the number, identity and behavior of fields.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Editor actions (`editor-actions`)

**Network look:** Toolbar controls often combine an icon and text; action labels describe their task.

**DNS look:** Toolbar controls use compact icon/text or plain text with an explicit Cancel.

**Choice concerns:** Choose button styling, grouping and cancel placement only. Ignore domain-specific actions.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

Source evidence: `simple-network-manager-dev/pkg/simple-network-manager/pages/PublishService.vue`, `simple-network-manager-dev/pkg/simple-network-manager/pages/CertificateLifecycle.vue`, `simple-network-manager-dev/pkg/simple-network-manager/pages/Settings.vue`, `simple-network-manager-dev/pkg/simple-network-manager/pages/PortPresets.vue`, `dns-manager-dev/pkg/dns-manager/ui/dns-manager.js: editor(), actions(), render()`

## Pending Rollouts

Screenshots: [network-pending](evidence/network-pending.png) · [dns-pending](evidence/dns-pending.png)

### Rollout inventory (`pending-layout`)

**Network look:** Labeled search/grouping row and inset bordered grid with persistent headers; No Results Available.

**DNS look:** Labeled search and flatter grid with persistent headers; No Matching Items.

**Choice concerns:** Choose filter-row layout, table treatment and empty-state wording. Ignore column content; populated review flows were inspected in source.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Change review (`pending-review`)

**Network look:** Structured Vue rollout/backup review components and domain resource proposals.

**DNS look:** Review Pending Rollout modal displays a JSON proposal and disabled Apply with a backend-unavailable notice.

**Choice concerns:** Select structured review or compact modal presentation; keep before/after, scope, concurrency and backup checks. Source comparison, not a live Apply test.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

Source evidence: `simple-network-manager-dev/pkg/simple-network-manager/pages/PendingRollouts.vue`, `dns-manager-dev/pkg/dns-manager/ui/dns-manager.js: pending(), renderModal()`

## Running Processes

Screenshots: [network-processes](evidence/network-processes.png) · [dns-processes](evidence/dns-processes.png)

### Empty state & grid (`process-empty`)

**Network look:** Search, namespace grouping, and persistent Process / Namespace / Operation / Status / Progress / Started / Resources / Actions headers even with zero rows.

**DNS look:** Single No Running Processes panel explaining that no backend operation was accepted; no process table or filters.

**Choice concerns:** DNS lacks the shared empty-grid behavior required by the current standard. Choose styling while retaining the required headers and future process details.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

Source evidence: `simple-network-manager-dev/pkg/simple-network-manager/pages/RunningProcesses.vue`, `dns-manager-dev/pkg/dns-manager/ui/dns-manager.js: render()`

## Snapshots, schedule, cleanup & storage

Screenshots: [network-snapshots](evidence/network-snapshots.png) · [dns-snapshots](evidence/dns-snapshots.png)

### Page composition (`snapshot-layout`)

**Network look:** Snapshot table, two schedule cards and storage inside one surrounding scroll panel; storage is below the captured viewport.

**DNS look:** Table region, separately scrolling schedule cards, and a storage panel visible at the bottom of the captured viewport.

**Choice concerns:** Choose scroll boundaries and storage placement. Both expose manual/automatic capture and cleanup.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Snapshot grid (`snapshot-grid`)

**Network look:** Single sort marker per heading, non-sortable Actions with help icon. Group By default appears blank.

**DNS look:** Outer table decorator adds a second sort marker to snapshot headers and makes Actions? sortable. Group By explicitly says None and a second count appears above grid.

**Choice concerns:** Choose table/filter styling; ignore column names and values. Duplicate sort indicators and sortable action/help heading are defects to correct.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Schedule cards (`snapshot-schedule`)

**Network look:** Schedule/cleanup controls are side by side in the parent scroll region.

**DNS look:** Similar controls but separate internal card scrolling.

**Choice concerns:** Choose sizing, spacing and scrolling. Ignore scope option contents.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Storage summary (`snapshot-storage`)

**Network look:** Storage summary is reached by scrolling; grouped with snapshot controls.

**DNS look:** Three values in a persistent full-width panel: available space, largest snapshot, estimated exhaustion.

**Choice concerns:** Choose prominence and placement. These screenshot values are preview storage values, not verified production capacity.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

Source evidence: `simple-network-manager-dev/pkg/simple-network-manager/pages/RolloutHistory.vue`, `simple-network-manager-dev/pkg/simple-network-manager/pages/SnapshotSchedule.vue`, `dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/RolloutHistory.vue`, `dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotSchedule.vue`, `dns-manager-dev/pkg/dns-manager/ui/dns-manager.js: render(), decorateTables()`

## Snapshot Options, coverage, merge & recovery

Screenshots: [network-snapshot-options](evidence/network-snapshot-options.png) · [dns-snapshot-options](evidence/dns-snapshot-options.png) · [network-coverage](evidence/network-coverage.png) · [dns-snapshot-gate](evidence/dns-snapshot-gate.png)

### Manual capture entry (`snapshot-capture`)

**Network look:** New Snapshot immediately opens Snapshot Options modal with unchecked Include Secrets, Cancel and Create Snapshot.

**DNS look:** New Snapshot toggles Close Capture and an inline recent-backup Yes/No gate; No reveals storage/download options and Create configuration snapshot before the password/options step.

**Choice concerns:** Choose the direct modal or inline introduction. Recent-backup mutation gates must not be confused with manually creating a new backup.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Coverage navigation (`snapshot-coverage`)

**Network look:** Global coverage banner opens a dedicated Snapshot Coverage page with categorized resource grids and View Difference actions.

**DNS look:** Snapshot landing page shows backend banner; no matching global coverage entry was visible during inspection.

**Choice concerns:** Prefer a common coverage presentation with manager-specific resource categories. DNS absence is a navigation difference, not proof that snapshot adapter coverage is unsupported.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Merge, compare & restore (`snapshot-recovery`)

**Network look:** Hidden Merge Snapshots route; Vue comparison, unlock, password and restore components.

**DNS look:** Separate copies of similar Vue recovery components mounted inside the DNS snapshot host.

**Choice concerns:** Source comparison only: no snapshots existed, so populated merge/restore was not exercised. Select shared layout and retain adapters, password exclusion rules and restore review gates.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

Source evidence: `simple-network-manager-dev/pkg/simple-network-manager/pages/SnapshotOperations.vue`, `simple-network-manager-dev/pkg/simple-network-manager/pages/SnapshotCoverage.vue`, `simple-network-manager-dev/pkg/simple-network-manager/pages/MergeSnapshots.vue`, `dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotGate.vue`, `dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/MergeSnapshots.vue`

## Diagnostics

Screenshots: [network-diagnostics](evidence/network-diagnostics.png) · [dns-diagnostics](evidence/dns-diagnostics.png)

### Diagnostics layout (`diagnostics-layout`)

**Network look:** Filters immediately above a bordered log grid, with a brief scope note.

**DNS look:** Additional explanatory panel above matching filters and a flatter log grid, followed by a scope note.

**Choice concerns:** Choose spacing, optional explanatory-panel treatment, filter widths and table styling. Ignore log sources, messages and context.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Incident badge appearance (`diagnostics-count`)

**Network look:** Small right-aligned sidebar badge with detailed hover description.

**DNS look:** Small colored badge before the sidebar label with hover description.

**Choice concerns:** Choose placement, shape and color treatment. Counts and severity semantics are context-specific and excluded.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

Source evidence: `simple-network-manager-dev/pkg/simple-network-manager/pages/Diagnostics.vue`, `dns-manager-dev/pkg/dns-manager/ui/dns-manager.js: diagnostics()`

## Settings

Screenshots: [network-settings](evidence/network-settings.png) · [dns-settings](evidence/dns-settings.png)

### Preferences layout (`settings-layout`)

**Network look:** Checkbox preferences first, explanation, then an inline URL field. Captured URL input has a light native appearance inside the dark page.

**DNS look:** Labeled wide URL field and description first, then a checkbox-group heading and explanation; consistent themed input.

**Choice concerns:** Choose ordering, group headings, spacing and input treatment. Ignore which preferences and notification types exist.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Save & cancel (`settings-actions`)

**Network look:** Save Settings in the upper-right toolbar; no explicit Cancel in the captured settings state.

**DNS look:** Save Settings and Cancel in the toolbar.

**Choice concerns:** Select action presentation and explicit cancel behavior while preserving unsaved-change handling.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

Source evidence: `simple-network-manager-dev/pkg/simple-network-manager/pages/DisplaySettings.vue`, `dns-manager-dev/pkg/dns-manager/ui/dns-manager.js: settings(), actions()`

## Help & contextual help

Screenshots: [network-help](evidence/network-help.png) · [dns-help](evidence/dns-help.png)

### Guide page (`help-page`)

**Network look:** First section initially expanded; compact accordion list with per-section navigation links; no title help icon.

**DNS look:** Introductory paragraph and initially collapsed accordion sections with navigation links; no title help icon.

**Choice concerns:** Choose introduction placement, initial expansion, spacing and section styling. Ignore guide topics and section counts.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

### Help popup (`context-help`)

**Network look:** Anchored compact popup on pointer/focus, with Close and Open Help; fixed dark popup styling.

**DNS look:** Clicked help icons open centered modal with guide text, Close and Open Help; modal focuses a button.

**Choice concerns:** Source comparison of triggers/dialogs. Select anchored popup or centered modal; keyboard focus, Escape and focus return need validation in the final shared implementation.

- [ ] Network look
- [ ] DNS look
- [ ] Combine both
- [ ] Custom
- [ ] Either / same

Comment: ______________________________________________

Source evidence: `simple-network-manager-dev/pkg/simple-network-manager/pages/Help.vue`, `simple-network-manager-dev/pkg/simple-network-manager/pages/HelpTip.vue`, `dns-manager-dev/pkg/dns-manager/ui/dns-manager.js: helpPage(), renderModal()`

## Shared UI implementation after review

- After this report is completed, create rancher-common-ui as a separate Rancher UI plugin with its own Helm release and versioned runtime API.
- Both managers must reference the installed common plugin and obtain shared page shells, controls and layouts from it. Domain data providers, workflows and resource adapters remain manager-owned.
- A build-time package that embeds a private copy of UI into each manager does not satisfy independent Helm updates. The runtime loader and compatibility checks must be demonstrated.
- Missing, disabled, failed or incompatible common UI blocks manager interface initialization with a clear installation/recovery message. Managed routing/DNS continues operating.
- Installation, upgrades, rollback, missing dependency, supported version ranges and clean native Rancher integration must be tested. Current previews and charts do not establish those capabilities.

## Evidence and defects

- All root navigation pages were inspected visually. Contextual forms and snapshot capture/coverage entry states were opened without saving application changes.
- Merge/restore and populated rollout/process states were compared in source only because the inspected session had no snapshots, pending rollouts or accepted processes. No backups or live operations were created for the comparison.
- Create Zone currently reaches the wrong render branch. DNS snapshot gate labels contain mojibake (Yes â€” / No â€”), in addition to duplicate snapshot sort markers.
- Light theme, mobile behavior, live authorization, cluster installation, independent updates and service availability were not validated by this comparison.
- The workspace already contains uncommitted work. This report captures the current working tree; existing changes were preserved.

General comments: ______________________________________________

- [ ] Review completed; use these presentation selections to implement the shared UI plugin.
