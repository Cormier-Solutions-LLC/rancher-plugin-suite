# Requirement-by-requirement audit

Audit date: 2026-10-11. Every indexed bullet is assessed below; checked means reviewed, not passed. The pinned source is [RANCHER-PLUGIN-DESIGN.audit-source.md](RANCHER-PLUGIN-DESIGN.audit-source.md). IDs are stable audit IDs, not source section numbers. Requirement 200 was replaced during the source update by 230; 231–232 are newly added global demo-data requirements.

PASS_LOCAL = supported by the named local UI/source/test evidence, without claiming installed/live compliance. PARTIAL = implemented in part or not fully validated. FAIL = observed/reproduced deviation. NOT_VERIFIED = no adequate execution evidence. NOT_APPLICABLE = outside Network Manager semantics. APPROVED_VARIATION = explicit Network Manager standard takes precedence. REFERENCE = source pointer.

| Status | Items |
|---|---:|
| APPROVED_VARIATION | 2 |
| FAIL | 24 |
| NOT_APPLICABLE | 17 |
| NOT_VERIFIED | 13 |
| PARTIAL | 73 |
| PASS_LOCAL | 93 |
| REFERENCE | 9 |

## Indexed requirements

### 1. Purpose and source of requirements

- [x] **R1 — REFERENCE** · source line 22

  **Requirement:** [Network Manager Standards](NETWORK-MANAGER-STANDARDS.md) and [implementation notes](simple-network-manager-dev/README.md).

  **Analysis:** Source pointer inspected as context; not a behavioral acceptance requirement. DNS-only source pointers do not make DNS pages part of this Network Manager audit.

  **Evidence:** Pinned design source/reference index.

- [x] **R2 — REFERENCE** · source line 23

  **Requirement:** [Current navigation](simple-network-manager-dev/pkg/simple-network-manager/navigation.ts) and [native Rancher registration](simple-network-manager-dev/pkg/simple-network-manager/product.ts).

  **Analysis:** Source pointer inspected as context; not a behavioral acceptance requirement. DNS-only source pointers do not make DNS pages part of this Network Manager audit.

  **Evidence:** Pinned design source/reference index.

- [x] **R3 — REFERENCE** · source line 25

  **Requirement:** [Shared page shell](simple-network-manager-dev/pkg/simple-network-manager/pages/Dashboard.vue).

  **Analysis:** Source pointer inspected as context; not a behavioral acceptance requirement. DNS-only source pointers do not make DNS pages part of this Network Manager audit.

  **Evidence:** Pinned design source/reference index.

- [x] **R4 — REFERENCE** · source line 26

  **Requirement:** [Reusable page components](simple-network-manager-dev/pkg/simple-network-manager/pages/).

  **Analysis:** Source pointer inspected as context; not a behavioral acceptance requirement. DNS-only source pointers do not make DNS pages part of this Network Manager audit.

  **Evidence:** Pinned design source/reference index.

- [x] **R5 — REFERENCE** · source line 27

  **Requirement:** [Shared behavior and state](simple-network-manager-dev/pkg/simple-network-manager/data/).

  **Analysis:** Source pointer inspected as context; not a behavioral acceptance requirement. DNS-only source pointers do not make DNS pages part of this Network Manager audit.

  **Evidence:** Pinned design source/reference index.

- [x] **R6 — REFERENCE** · source line 28

  **Requirement:** [Action styling](simple-network-manager-dev/pkg/simple-network-manager/styles/actions.css) and [scrollbar styling](simple-network-manager-dev/pkg/simple-network-manager/styles/scrollbars.css).

  **Analysis:** Source pointer inspected as context; not a behavioral acceptance requirement. DNS-only source pointers do not make DNS pages part of this Network Manager audit.

  **Evidence:** Pinned design source/reference index.

- [x] **R7 — REFERENCE** · source line 30

  **Requirement:** [Manual recovery requirements](simple-network-manager-dev/RECOVERY.md).

  **Analysis:** Source pointer inspected as context; not a behavioral acceptance requirement. DNS-only source pointers do not make DNS pages part of this Network Manager audit.

  **Evidence:** Pinned design source/reference index.

- [x] **R8 — REFERENCE** · source line 31

  **Requirement:** [DNS Manager design](DNS-MANAGER-DESIGN.md) and [local prototype notes](dns-manager-dev/README.md).

  **Analysis:** Source pointer inspected as context; not a behavioral acceptance requirement. DNS-only source pointers do not make DNS pages part of this Network Manager audit.

  **Evidence:** Pinned design source/reference index.

- [x] **R9 — REFERENCE** · source line 32

  **Requirement:** [Network Manager preview evidence](simple-network-manager-dev/IMPLEMENTATION-REVIEW.md).

  **Analysis:** Source pointer inspected as context; not a behavioral acceptance requirement. DNS-only source pointers do not make DNS pages part of this Network Manager audit.

  **Evidence:** Pinned design source/reference index.

### 2. Native integration and navigation

- [x] **R10 — PARTIAL** · source line 59

  **Requirement:** Register a native UI extension in the selected cluster's Explorer navigation.

  **Analysis:** Native registration exists in source; installed Explorer registration and authenticated access were not exercised.

  **Evidence:** navigation.ts/product.ts.

- [x] **R11 — PASS_LOCAL** · source line 60

  **Requirement:** Use an expandable manager group with the application's name. Its label opens Overview and reveals the group, including when another child is active; keep disclosure controls distinct from route labels and follow native menu behavior.

  **Analysis:** Manager label opens Overview independently of its disclosure control in the preview.

  **Evidence:** overview screenshots; Preview.vue.

- [x] **R12 — PARTIAL** · source line 63

  **Requirement:** Make Overview the default page and clearly indicate the active page.

  **Analysis:** Visible pages highlight correctly; hidden editor/merge/coverage pages lose the owning active entry.

  **Evidence:** all page screenshots; F06.

- [x] **R13 — PASS_LOCAL** · source line 64

  **Requirement:** Every manager ends with Pending Rollouts, Running Processes, Snapshots, Diagnostics, Settings, Help, in that order. Inventory pages and their dynamic resource entries precede this shared group. These common pages are specified here.

  **Analysis:** Required six-page tail is in the specified order.

  **Evidence:** navigation.ts; sidebar screenshots.

- [x] **R14 — PASS_LOCAL** · source line 67

  **Requirement:** Prefer useful flat inventory pages; use nested expandable resource groups where relevant. Avoid redundant inventories. Create/Edit routes remain hidden from the sidebar and are reached through contextual actions.

  **Analysis:** Inventories are flat; editor, merge and coverage routes are hidden.

  **Evidence:** navigation.ts.

- [x] **R15 — NOT_APPLICABLE** · source line 70

  **Requirement:** Dynamic resource entries use stable identities, meaningful resource labels, and the active user's access, rather than positional indexes.

  **Analysis:** Network Manager has no dynamic per-zone/resource navigation collection; authorization of installed static routes still needs native testing.

  **Evidence:** navigation.ts.

- [x] **R16 — APPROVED_VARIATION** · source line 72

  **Requirement:** Use compact reactive count badges in a fixed left-hand column before menu labels. Align this column across top-level and nested entries; reserve blank space when there is no count. Disclosure arrows occupy a separate slot without shifting counts. Zone/domain entries show scoped record counts. An unavailable inventory is not zero.

  **Analysis:** Network Manager explicitly uses native Rancher right-side navigation counts; the shared left-column proposal does not override this approved variation.

  **Evidence:** NETWORK-MANAGER-STANDARDS.md:27.

- [x] **R17 — PARTIAL** · source line 76

  **Requirement:** Relevant page header, navigation, and Overview counts share the same scoped data; header counts sit immediately after Refresh. Example values are not fixed requirements.

  **Analysis:** Shared totals exist, but counts wrap away from Refresh at 800px and merge verification initially reports zero sources.

  **Evidence:** F02/F25; responsive/workflow measurements.

- [x] **R18 — PARTIAL** · source line 78

  **Requirement:** Keep cluster identity visible and honor Rancher's cluster and namespace context.

  **Analysis:** Preview cluster label and global picker are present; real host-store synchronization is not proven by preview interaction.

  **Evidence:** NamespaceSelector.vue; all-namespace captures.

- [x] **R19 — NOT_VERIFIED** · source line 79

  **Requirement:** Treat placement near Compliance as the Network Manager reference; validate ordering in the installed Rancher version rather than assuming a weight guarantees placement.

  **Analysis:** Installed placement near Compliance requires the target Rancher instance; preview ordering is not installation evidence.

  **Evidence:** product.ts; release plan.

- [x] **R20 — NOT_VERIFIED** · source line 81

  **Requirement:** Target the recorded Rancher 2.15.x / Extensions API 3 environment initially; recheck compatibility when Rancher or the extension SDK changes.

  **Analysis:** Recorded target versions are declared; no fresh installed compatibility test was performed.

  **Evidence:** package.json; release plan.

- [x] **R21 — PARTIAL** · source line 83

  **Requirement:** Embedded pages inherit Rancher's active color scheme, theme tokens, typography, host viewport, and native left navigation. Use supported extension registration and routing rather than a second sidebar or global CSS overrides. Groups, nested entries, disclosure controls, selected routes, and namespace context follow the installed Rancher's menu behavior. Preview chrome is standalone-only. Validate requested count placement and loading indicators against native menu capabilities; a preview demonstration alone does not prove native navigation support.

  **Analysis:** Native route reuses pages, but hardcoded dark colors remain and native typography/light theme were not visually verified.

  **Evidence:** F20; native Dashboard.vue.

- [x] **R22 — APPROVED_VARIATION** · source line 90

  **Requirement:** Display counts only when they represent a relevant inventory or operation. Help and Settings have no counts. Reuse compact left-column navigation badges for domain/zone record counts, header counts, and other relevant inventories.

  **Analysis:** Neither page has an inventory count. Network Manager's approved right-side host count placement applies elsewhere.

  **Evidence:** Settings/Help screenshots; NETWORK-MANAGER-STANDARDS.md:27.

- [x] **R23 — FAIL** · source line 93

  **Requirement:** Use the DNS breadcrumb pattern: clickable manager name returns to Overview, followed by the current page; add clickable ancestors for nested editors where relevant. The manager title always opens Overview. Breadcrumbs and page headings use the same current route identity.

  **Analysis:** Breadcrumb has manager/current page but no clickable Snapshot ancestor for merge/coverage and no owning ancestor for the connection editor.

  **Evidence:** F06; hidden route screenshots.

- [x] **R24 — NOT_APPLICABLE** · source line 96

  **Requirement:** Zones is expandable/collapsible, with zone entries nested beneath it and record-count badges. Clicking its label opens the inventory; a separate arrow toggles children. Preserve active page, persisted order, counts, and expansion preference. Other inventory groups may use the same relevant pattern.

  **Analysis:** Zones and nested record counts are DNS-specific and absent from Network Manager.

  **Evidence:** navigation.ts.

- [x] **R25 — FAIL** · source line 100

  **Requirement:** Every page-changing interaction synchronizes the active navigation item, including metric cards, grid/resource links, breadcrumbs, contextual Help, and editor actions. Hidden Create/Edit routes select their owning visible inventory item. Navigating to a child reveals its menu group; manual collapse may highlight the owning group while retaining the active child page. Do not highlight multiple unrelated items.

  **Analysis:** Hidden page transitions leave no owning sidebar item active; visible page navigation does work.

  **Evidence:** F06; connection-editor/merge-priority/snapshot-coverage screenshots.

- [x] **R26 — FAIL** · source line 105

  **Requirement:** A count badge is red whenever a required dependency in that inventory/page scope is missing, unconfigured, unavailable, or failing. Explain the concrete blocking condition in its accessible description and tooltip, even when the item count is zero. Preserve the count's original meaning; do not substitute an incident total for a zone/record/item count. Optional or merely pending verification retains its appropriate separate state. Hiding a banner must not hide this required-failure indication. Diagnostics retains its warning/error event-count meaning.

  **Analysis:** Counts do not consistently expose missing required dependencies in the inventory's own scope.

  **Evidence:** F12; PageSummary.vue/navigation-counts.ts.

- [x] **R27 — FAIL** · source line 112

  **Requirement:** Loading is a separate count-badge state: show a small spinner in the fixed count slot while the associated data is pending, rather than temporarily marking it red because readiness is not yet known. Preserve the last known count in its accessible description. Once the request resolves, show the actual count and health severity; a timeout/confirmed required failure is red. Keep the spinner aligned with other count badges and respect reduced-motion preferences.

  **Analysis:** Page count uses shared refresh state immediately, not a scoped delayed read; native count loading was not proven.

  **Evidence:** F12; PageSummary.vue.

### 3. Page shell, layout, and styling

- [x] **R28 — PARTIAL** · source line 121

  **Requirement:** The user's Network Manager screenshots define the shared layout, spacing, color, and presentation reference for every plugin page: [inventory grid](docs/design-reference/network-manager-port-configurations.png) and [Overview master/detail](docs/design-reference/network-manager-overview.png). Use the grid pattern for inventories and the master/detail pattern where useful; retain their common heading, status area, filters, panels, and aligned bottom edge. Screenshot data/counts are examples, not requirements to reproduce those values.

  **Analysis:** Desktop largely matches the reference, but responsive shell, forms and header consistency remain uneven.

  **Evidence:** F01/F02/F07; screenshots.

- [x] **R29 — PASS_LOCAL** · source line 127

  **Requirement:** Reuse one page shell across pages and across the standalone preview/native extension.

  **Analysis:** One Dashboard shell is shared by all preview pages and registered native route components.

  **Evidence:** Dashboard.vue; all screenshots.

- [x] **R30 — PASS_LOCAL** · source line 128

  **Requirement:** Show manager name and cluster context, a clear page heading, a compact Help control, page-level actions, refresh controls, and an item count where useful.

  **Analysis:** Manager/cluster, heading, Help, actions, refresh and relevant count are present; Help/Settings omit counts intentionally.

  **Evidence:** primary-page screenshots.

- [x] **R31 — FAIL** · source line 130

  **Requirement:** Put all page actions, including Save/Save Draft, Test Connection, Cancel, selection-dependent actions, and manual refresh, in the top-right heading action row beside Refresh Every and its countdown. Modal confirmation controls remain within their dialog. Buttons in a group share width/height, padding, icon sizing, and alignment. Do not duplicate the page title inside its panel; retain distinct section headings where they communicate a separate subject.

  **Analysis:** Merge navigation, restore preparation and review actions remain in panel/footer content rather than the page action area.

  **Evidence:** F04; workflow measurements.

- [x] **R32 — PASS_LOCAL** · source line 135

  **Requirement:** Top-right actions that operate without a grid selection may appear whenever applicable. Any action that requires selected grid items stays hidden until items are explicitly selected; hide it again immediately when selection is cleared. This applies to Reorder, Delete, and every other selection-dependent operation, including applicable Merge, Apply, Reconfigure, Rescan, or Snapshot actions. Do not show a disabled button merely because no items are selected. Once items are selected, other unmet prerequisites may disable the action with an explanation. Create/New, Refresh, and editor actions use their own applicable context when they do not require grid selection.

  **Analysis:** Delete is hidden until selection and disappears after clearing. Merge requires two sources; preview Apply requires valid selection.

  **Evidence:** certificates-selected screenshot; merge source.

- [x] **R33 — FAIL** · source line 144

  **Requirement:** Align heading actions with the primary title. New, Merge, Apply, and conditional red Delete share one font, icon size, and button height. The Network Manager reference uses 14 px text, 18 px SVGs, and 40 px buttons; Refresh stays icon-only.

  **Analysis:** Rescan uses 12px instead of the shared 14px text; editor actions can occupy two rows instead of the title row.

  **Evidence:** F02/F03; UI-006/UI-018.

- [x] **R34 — FAIL** · source line 147

  **Requirement:** Buttons within the same action group share dimensions, icon size, padding, font, border radius, and alignment. Use a common width for adjacent labeled actions sized for the longest label; changing primary/danger/secondary styling must not change geometry. Icon-only groups use consistent square hit areas, and their icons and controls align with neighboring actions.

  **Analysis:** Rescan and New Configuration widths differ within the same group. Certificate Delete/New dimensions match in the measured state.

  **Evidence:** F03; UI-008.

- [x] **R35 — PARTIAL** · source line 152

  **Requirement:** Match Network Manager's shared buttons and refresh controls exactly by reusing its components and styles. Place Refresh Every, countdown, manual Refresh, and item count in the top-right heading action area, never in the filter/content row.

  **Analysis:** Shared components exist but Rescan and several workflow actions bypass their shared presentation/placement.

  **Evidence:** SharedCreate/SharedRefresh/PageActions; F03/F04.

- [x] **R36 — PARTIAL** · source line 155

  **Requirement:** Position the item count immediately right of Refresh. Hover/focus help must render above navigation and avoid clipping; use a body overlay with bounded placement rather than click-only explanations.

  **Analysis:** Help hover overlay clears navigation at z-index 2147483647. Count position fails at narrow widths.

  **Evidence:** F02; help-popup screenshot.

- [x] **R37 — PASS_LOCAL** · source line 158

  **Requirement:** Contextual Help/More Info uses an accessible circled question mark immediately beside its title, field, column, or status. Open a popup with Close and Open Help; reuse the relevant Help section. Open Help navigates to and expands that section. The Help page itself has no question-mark controls.

  **Analysis:** Hover and focus open contextual help; content is portaled above navigation with Close/Open Help controls.

  **Evidence:** help-popup screenshot; HelpTip.vue.

- [x] **R38 — PASS_LOCAL** · source line 162

  **Requirement:** Keep the heading, status information, and filters outside the scrolling content area.

  **Analysis:** Primary heading, banners and filters remain outside desktop panel scrolling. Whole-document scrolling at 600px is separately recorded.

  **Evidence:** primary measurements.

- [x] **R39 — FAIL** · source line 163

  **Requirement:** Fill the available viewport. Panels extend to the available bottom edge instead of stopping at an arbitrary content height.

  **Analysis:** At 600px every page expands beyond the viewport. Desktop primary panels reach the shared available bottom edge.

  **Evidence:** F01; UI-002/UI-003.

- [x] **R40 — FAIL** · source line 165

  **Requirement:** The available viewport height is also the outer shell's maximum height. Account for Rancher's host chrome in native mode and the preview chrome in standalone mode; additional content must not expand the document into vertical page scrolling.

  **Analysis:** Mobile breakpoint explicitly enables automatic shell height and visible overflow, defeating viewport containment.

  **Evidence:** F01; Preview.vue:32.

- [x] **R41 — PARTIAL** · source line 168

  **Requirement:** Use internal panel scrolling. In a master/detail view, align both panels to the same bottom edge; the list scrolls independently, and details scroll when content exceeds the panel.

  **Analysis:** Desktop route/detail bottoms align and list scrolls internally. Snapshot operations can produce adjacent nested scrollbars.

  **Evidence:** overview measurement; F24.

- [x] **R42 — PARTIAL** · source line 170

  **Requirement:** Bound overflowing inventories, forms, and detail content to the remaining panel height and use the shared custom scrollbar styling. Keep headings, actions, and filters visible while that content scrolls.

  **Analysis:** Desktop inventories/forms are bounded, but very little usable detail height remains at 720px and the mobile shell scrolls externally.

  **Evidence:** F01/F24; workflow screenshots.

- [x] **R43 — PARTIAL** · source line 173

  **Requirement:** Use `min-height: 0` / `min-width: 0` behavior in flex/grid content so long inventories do not push the shell beyond the viewport. Keep scrollbar gutters stable where appropriate.

  **Analysis:** Desktop flex/grid constraints use minimum zero sizes; the 600px override removes the bounded shell behavior.

  **Evidence:** Preview.vue/Dashboard.vue.

- [x] **R44 — FAIL** · source line 175

  **Requirement:** Adapt layouts at smaller widths without clipping actions, filters, or dialogs.

  **Analysis:** 600px pages overflow vertically; 800px counts wrap, and populated certificate/port editor controls wrap at 1280px.

  **Evidence:** F01/F02; responsive measurements.

- [x] **R45 — FAIL** · source line 176

  **Requirement:** Use consistent card borders, rounded corners, spacing, input heights, and form alignment. Align controls even when labels wrap onto multiple lines.

  **Analysis:** Rancher URL input is native white and inline; Rescan sizing differs. Main schedule/mapping controls otherwise share alignment.

  **Evidence:** F07/F03; settings/port-form screenshots.

- [x] **R46 — PARTIAL** · source line 178

  **Requirement:** Inherit Rancher's active theme, tokens, typography, and host viewport in embedded pages; scope styles to the plugin. Standalone previews use the observed compact Network Manager dark presentation as their fallback.

  **Analysis:** Scoped variables are used, but important action/help/count colors have hardcoded dark fallbacks; installed light theme was not tested.

  **Evidence:** F20; CSS source.

- [x] **R47 — PASS_LOCAL** · source line 181

  **Requirement:** Use thin dark scrollbars matching the panels. Preserve operating-system forced-color choices.

  **Analysis:** Thin panel-colored scrollbars are used; forced-color override is present in source.

  **Evidence:** styles/scrollbars.css; primary screenshots.

- [x] **R48 — FAIL** · source line 182

  **Requirement:** Keep collapsed sections visually connected with one divider between adjacent sections.

  **Analysis:** Expanded Help sections show duplicated divider lines; shared Overview collapsible sections use a single divider.

  **Evidence:** F08; help-1280 screenshot.

- [x] **R49 — PARTIAL** · source line 183

  **Requirement:** Use title case for button and status labels. Keep explanatory text concise and practical.

  **Analysis:** Most visual buttons use title case, but Connection editor title, some state text and corrupted snapshot gate labels remain inconsistent.

  **Evidence:** F09; navigation.ts/SnapshotGate.vue.

- [x] **R50 — PARTIAL** · source line 184

  **Requirement:** Use green for verified good/ready states, amber for pending/partial states, red for failures, and neutral styling for unknown or inapplicable states. Pair color with a readable label.

  **Analysis:** Overview and diagnostic severity badges use colors; certificate grid Ready/Pending and rollout state text are not consistently badge-styled.

  **Evidence:** F10; certificates/pending screenshots.

- [x] **R51 — PARTIAL** · source line 186

  **Requirement:** Status banners tint the entire banner background for their severity, matching Network Manager's full-width coverage notices. Pending/partial verification uses the amber/yellow warning surface, not only amber text or a colored border; errors use the corresponding error surface. Preserve readable contrast in both themes.

  **Analysis:** Dark preview severity banners tint their full background; native theme contrast remains unverified.

  **Evidence:** SnapshotBanner.vue; coverage screenshots.

- [x] **R52 — PARTIAL** · source line 190

  **Requirement:** Keep badges and attachment counts compact and on one line. Enlarged badges should have a deliberate purpose rather than making every status compete with the page heading.

  **Analysis:** List badges are compact on their own row; selected connection header badge/title crowding needs review at 1280px.

  **Evidence:** overview-1280 screenshot.

- [x] **R53 — PARTIAL** · source line 192

  **Requirement:** Use the whole amber warning background for pending/partial verification. Management backend unavailable is a full red error banner. Each top-of-page banner type has its own Settings visibility checkbox; hiding a banner does not change status or authorize writes.

  **Analysis:** Coverage warning uses a full amber background. Missing/unavailable dependencies are not consistently reflected in scoped badges/notifications.

  **Evidence:** SnapshotBanner/refresh error source.

- [x] **R54 — FAIL** · source line 195

  **Requirement:** Every yellow/amber warning or red error notification at the top of a page is clickable and keyboard accessible. Open the exact affected item's Create, Edit, or repair workflow directly, so the user can create, update, or fix it. Preserve cluster, namespace, resource identity, and relevant filter; select/reveal the item and prefill known context where applicable. Missing configuration opens its Create/setup flow; existing invalid configuration opens its Edit/fix flow. Multiple affected items open the scoped issue list with direct per-item fix actions. When the correction is external or no editor exists, open that item's specific diagnostic/recovery instructions. Avoid generic landing pages when a direct destination exists. Navigation must retain normal draft, authorization, review, snapshot, and confirmation gates; clicking the notification does not apply a fix. Other top-of-page alerts also open their relevant item/view or guide section.

  **Analysis:** Coverage banner opens a gap list, but gaps do not lead directly to the exact fix editor; other read-failure notices are static.

  **Evidence:** F13; coverage/read-failure source.

- [x] **R55 — PARTIAL** · source line 215

  **Requirement:** The authenticated visual reference is `https://rancher.cormierconsulting.io`. Read-only inspection on 2026-10-11 found Lato 14 px typography and active tokens: body `#25282f`, body text `snow`, box `#171c22`, input `#25282f`, border `#38404b`, muted `#8f8f9c`, primary `#2f68df`, link `#9bbffd`. Embedded views consume these tokens dynamically; standalone previews use the observed theme as their fallback. Keep the normal host menu's group label and disclosure control separate, selected route behavior synchronized, and group expansion consistent with Rancher. Store this reference and observations, never credentials or copied authentication tokens.

  **Analysis:** Current preview resembles native dark navigation; live host theme values, focus/disabled states and light scheme need installed verification.

  **Evidence:** F20; native theme limitation.

### 4. Inventory, search, filters, and tables

- [x] **R56 — PASS_LOCAL** · source line 226

  **Requirement:** Use automatic grid column widths. Only actual selection columns use narrow fixed widths; text columns must not inherit those widths. Align text and its header left, numeric values and their headers right. Counts, priority, TTL, and sizes use numeric sorting/alignment.

  **Analysis:** Measured text/numeric headers and body cells align at 1280px; selection columns are narrow and other columns adapt.

  **Evidence:** all primary table rows; UI-010/UI-011.

- [x] **R57 — PASS_LOCAL** · source line 229

  **Requirement:** Sort file sizes by original bytes; use decimal B, KB, MB, GB, and TB units.

  **Analysis:** Stored ZIP byte count drives numeric sorting and decimal B/KB/MB/GB/TB formatting; existing formatter tests cover scaling.

  **Evidence:** size formatter; history screenshot.

- [x] **R58 — PASS_LOCAL** · source line 231

  **Requirement:** Provide an Overview summary plus searchable inventory and selected-resource details.

  **Analysis:** Master/detail Overview includes search, route inventory and selected resource details.

  **Evidence:** overview screenshot/source.

- [x] **R59 — PARTIAL** · source line 232

  **Requirement:** Use Rancher's existing top-level multi-select namespace filter as the single namespace control for embedded pages. Omit duplicate page-level namespace selectors and filter every inventory, overview, diagnostics view, operation, and relevant count from the host context directly. Match namespace/project/user/system/cluster scopes. Combine namespace selections as OR, with other page filters as AND. The standalone preview supplies one global namespace control in its simulated host header. Verify the native store contract.

  **Analysis:** Standalone global picker is shared and captures use All Namespaces. Authenticated Rancher namespace changes in both directions were not tested.

  **Evidence:** NamespaceSelector/native datasource source.

- [x] **R60 — PASS_LOCAL** · source line 238

  **Requirement:** Use searchable multi-select filters with a selected count, clear-selection action, and an understandable empty/default label. Dismiss popovers on Escape or outside interaction.

  **Analysis:** Searchable multi-selects, selected count, Clear, outside click, focus and Escape dismissal are implemented and inspected.

  **Evidence:** InventoryFilters.vue; interaction checks.

- [x] **R61 — PASS_LOCAL** · source line 240

  **Requirement:** Combine selections with OR inside one filter and AND across different filter groups.

  **Analysis:** OR within selections and AND across filter groups are covered by existing configuration tests.

  **Evidence:** configuration test suite.

- [x] **R62 — PARTIAL** · source line 241

  **Requirement:** Include plugin-specific filters such as protocol, service/port configuration, zone, record type, component, severity, or generation source when applicable.

  **Analysis:** Overview protocols/ports and certificate/diagnostic filters exist; Snapshots lacks a dedicated Manual/Automatic generation filter.

  **Evidence:** F11; history screenshot.

- [x] **R63 — PASS_LOCAL** · source line 243

  **Requirement:** Search names and relevant identifiers, labels, destinations, and values. Document domain-specific search behavior in the plugin standard.

  **Analysis:** Relevant names/namespaces/service ports are searchable, including partial port queries; domain-specific placeholders/help exist.

  **Evidence:** configuration tests; shared filter source.

- [x] **R64 — PASS_LOCAL** · source line 245

  **Requirement:** Show a Namespace column when namespace is part of the resource's identity; do not redundantly embed it in the displayed name. Show shared resources as Global.

  **Analysis:** Namespaced identity is separated into Namespace cells; unscoped presets display Global rather than namespace/name prefixes.

  **Evidence:** port/issuer/certificate screenshots.

- [x] **R65 — PASS_LOCAL** · source line 247

  **Requirement:** Default configuration inventories to a flat list. Offer Group By Namespace where useful, placing Global first. Preserve shared configuration availability within relevant scopes.

  **Analysis:** Flat lists are default, Group By Namespace is optional and Global is placed first. Snapshot ordering remains Created descending.

  **Evidence:** InventoryFilters/DataGrid source; grouping checks.

- [x] **R66 — PASS_LOCAL** · source line 249

  **Requirement:** Use a shared grid with sortable labeled columns, visible direction, numeric-aware comparisons, and accessible sort state. Do not sort selection/action columns.

  **Analysis:** Shared sortable headers expose direction/aria-sort and compare numbers separately from strings; main empty grids retain headers.

  **Evidence:** DataGrid.vue; all grid screenshots.

- [x] **R67 — PASS_LOCAL** · source line 251

  **Requirement:** Keep expanded detail rows attached to their parent during sorting and preserve group boundaries.

  **Analysis:** Expanded rows are bundled with their parent before sorting; grouping maintains those bundles. This structural check is source-based.

  **Evidence:** DataGrid.vue source.

- [x] **R68 — PASS_LOCAL** · source line 252

  **Requirement:** Retain headers on an empty grid and show a clear empty/no-matches message.

  **Analysis:** Empty grids retain labeled headers and centered No Results Available; empty Select All is disabled.

  **Evidence:** pending-rollouts/running-processes screenshots.

- [x] **R69 — PASS_LOCAL** · source line 253

  **Requirement:** Clicking a configuration row opens read-only details. Action icons and selection checkboxes must not also toggle or select the row accidentally.

  **Analysis:** Read-only details are separate from row action/checkbox events; measured certificate selection did not open row details.

  **Evidence:** row handler source; selection interaction.

- [x] **R70 — PASS_LOCAL** · source line 255

  **Requirement:** Keep row action icons right-aligned, horizontal, and unwrapped, with consistent compact hit areas, tooltips, accessible names, and visible keyboard focus.

  **Analysis:** Row action icons are compact, horizontal and right-aligned with accessible labels; destructive actions remain visually distinct.

  **Evidence:** all grid screenshots; actions.css.

- [x] **R71 — PASS_LOCAL** · source line 257

  **Requirement:** Add selection checkboxes and Select All only to full inventory grids with meaningful selection actions. Compact/embedded tables, summary panels, cards, and detail lists do not gain checkboxes merely to make them selectable. Use normal row/card activation for details; when selecting in a full grid, apply the displayed scope.

  **Analysis:** Overview route cards have no selection boxes. Full inventories expose meaningful bulk actions; restore selection is an explicit operation workflow.

  **Evidence:** UI-012; grids/source.

- [x] **R72 — PASS_LOCAL** · source line 261

  **Requirement:** Explicit grid selection reveals applicable selection-dependent contextual buttons in the top-right page action area, including Reorder and Delete. Hide them with no selected items; merely opening/highlighting a details-only row is not grid selection. Hide inapplicable actions and explain other unmet prerequisites when disabling an action for an existing selection. Derive the action's affected scope from the explicit selection and show it in review; never silently affect unselected resources. Contextual buttons use the same dimensions, icon size, padding, and alignment as neighboring actions. Selecting a details-only row must not implicitly authorize a mutation.

  **Analysis:** Explicit selection reveals scoped header actions and clears them when deselected. No live destructive apply was executed.

  **Evidence:** certificates-selected screenshot; PendingRollouts source.

- [x] **R73 — PASS_LOCAL** · source line 270

  **Requirement:** Use the DNS Manager preview's native checkbox presentation as the shared checkbox reference, superseding older Network Manager checkbox styling. Use real checkbox inputs with consistent size, theme, selection-column placement, spacing, and vertical alignment in headers and rows; do not substitute decorative checkbox icons. Keep checked, unchecked, disabled, focus, and partial-selection states clear. Select All reflects the displayed authorized scope and is indeterminate for a partial selection. Give every checkbox an accessible label and preserve keyboard interaction; selecting it must not also open row details. Reorder mode replaces these controls with handles according to the shared ordering standard.

  **Analysis:** Real native checkboxes are used; restoration Select All displayed a mixed state for partial selection.

  **Evidence:** snapshot-restore-visible screenshot; DataGrid source.

- [x] **R74 — PARTIAL** · source line 279

  **Requirement:** Review the exact affected resources before a bulk delete; preserve unrelated objects and Secrets.

  **Analysis:** UI reviews selected resources and excludes Secrets, but backend recovery snapshot coverage is not revalidated for general snapshot deletion.

  **Evidence:** F19; BulkDelete source.

- [x] **R75 — PARTIAL** · source line 280

  **Requirement:** Distinguish observed resources, working drafts, validated pending proposals, and examples in both labels and counts. Inferred associations must not be presented as durable ownership.

  **Analysis:** Labels distinguish drafts/examples, but saving issuer/port proposals mutates the same inventory arrays used to represent current configuration.

  **Evidence:** F18; pending/workspace source.

- [x] **R76 — PASS_LOCAL** · source line 282

  **Requirement:** Match the user's [filter-row reference](docs/design-reference/network-manager-filter-row.png): labels above the controls, consistent control height/borders/padding, a leading disclosure arrow for multi-select namespace choices, and evenly spaced columns aligned along their control bottoms. Diagnostics orders these as Search, Lookback (hours), Log source, Severity on one row when space permits. Controls fill their columns and wrap responsively rather than clipping or changing size.

  **Analysis:** Desktop shared filter rows have labels above, expanding search, consistent aligned controls, and configurable page-specific filters.

  **Evidence:** primary screenshots/UI-009.

- [x] **R77 — NOT_APPLICABLE** · source line 295

  **Requirement:** Put **Reorder** in the top-right page action area when manual ranking is supported and grid items are selected, following the shared selection-dependent visibility rule. Delete follows the same rule; Create remains independent of selection.

  **Analysis:** Network Manager has no persistently manually ranked inventory. This rule governs such collections; snapshot merge source priority is a separate temporary operation audited under requirements 149–156.

  **Evidence:** Network inventory semantics; MergeSnapshots.vue.

- [x] **R78 — NOT_APPLICABLE** · source line 298

  **Requirement:** Normal mode shows row selection checkboxes; Reorder appears only with an explicit selection. Entering reorder mode replaces every row's selection checkbox with a drag handle and removes the Select All control. Selection enables entry into the ordering workflow; the complete authorized collection remains its reviewed scope.

  **Analysis:** Network Manager has no persistently manually ranked inventory. This rule governs such collections; snapshot merge source priority is a separate temporary operation audited under requirements 149–156.

  **Evidence:** Network inventory semantics; MergeSnapshots.vue.

- [x] **R79 — NOT_APPLICABLE** · source line 302

  **Requirement:** Clicking Reorder hides the Reorder button and shows Cancel in that action area. Create/Delete and bulk selection are unavailable while ordering is being edited.

  **Analysis:** Network Manager has no persistently manually ranked inventory. This rule governs such collections; snapshot merge source priority is a separate temporary operation audited under requirements 149–156.

  **Evidence:** Network inventory semantics; MergeSnapshots.vue.

- [x] **R80 — NOT_APPLICABLE** · source line 304

  **Requirement:** Entering reorder mode alone does not show Save. Show Save beside Cancel only when the proposed order differs from the persisted order. Moving rows back to the original order hides Save again.

  **Analysis:** Network Manager has no persistently manually ranked inventory. This rule governs such collections; snapshot merge source priority is a separate temporary operation audited under requirements 149–156.

  **Evidence:** Network inventory semantics; MergeSnapshots.vue.

- [x] **R81 — NOT_APPLICABLE** · source line 306

  **Requirement:** Support drag-and-drop ordering and a keyboard-accessible equivalent using the same handles. Show the intended drop position and keep the moved row's details attached to it.

  **Analysis:** Network Manager has no persistently manually ranked inventory. This rule governs such collections; snapshot merge source priority is a separate temporary operation audited under requirements 149–156.

  **Evidence:** Network inventory semantics; MergeSnapshots.vue.

- [x] **R82 — NOT_APPLICABLE** · source line 308

  **Requirement:** During reorder mode, the whole row is a drag target: users can grab it anywhere, not only by its handle. Keep the handle as a visual cue and keyboard control; suppress normal row navigation/selection while dragging and retain Cancel/Save semantics.

  **Analysis:** Network Manager has no persistently manually ranked inventory. This rule governs such collections; snapshot merge source priority is a separate temporary operation audited under requirements 149–156.

  **Evidence:** Network inventory semantics; MergeSnapshots.vue.

- [x] **R83 — NOT_APPLICABLE** · source line 311

  **Requirement:** Capture the persisted order and its revision on entry, and edit a separate local proposal. Dropping a row changes only that proposal; it must not write through automatically.

  **Analysis:** Network Manager has no persistently manually ranked inventory. This rule governs such collections; snapshot merge source priority is a separate temporary operation audited under requirements 149–156.

  **Evidence:** Network inventory semantics; MergeSnapshots.vue.

- [x] **R84 — NOT_APPLICABLE** · source line 313

  **Requirement:** Reorder the complete authorized collection in persisted priority order. Suspend table sorting, grouping, filtering, and pagination that would conceal or rearrange members during editing; do not silently renumber rows outside the user's writable scope.

  **Analysis:** Network Manager has no persistently manually ranked inventory. This rule governs such collections; snapshot merge source priority is a separate temporary operation audited under requirements 149–156.

  **Evidence:** Network inventory semantics; MergeSnapshots.vue.

- [x] **R85 — NOT_APPLICABLE** · source line 316

  **Requirement:** Cancel discards the proposed order, restores the persisted order and normal controls, and writes neither ordering configuration nor a rollout. Existing selection/view context may be restored for items that still exist. Guard navigation away from a changed proposal like any other form.

  **Analysis:** Network Manager has no persistently manually ranked inventory. This rule governs such collections; snapshot merge source priority is a separate temporary operation audited under requirements 149–156.

  **Evidence:** Network inventory semantics; MergeSnapshots.vue.

- [x] **R86 — NOT_APPLICABLE** · source line 319

  **Requirement:** Refresh may update status information but must not replace a proposed order. If membership, permissions, or the persisted revision changes, mark the proposal conflicted and require review against the current collection before saving; never silently overwrite concurrent changes.

  **Analysis:** Network Manager has no persistently manually ranked inventory. This rule governs such collections; snapshot merge source priority is a separate temporary operation audited under requirements 149–156.

  **Evidence:** Network inventory semantics; MergeSnapshots.vue.

- [x] **R87 — NOT_APPLICABLE** · source line 322

  **Requirement:** Save reviews the previous/proposed order and affected scope, then stages the ordering draft in Pending Rollouts. Apply there uses the standard snapshot flow: validate or capture a recent matching snapshot of persisted configuration, confirm storage, recheck coverage/revision, and persist the complete ordering configuration through the backend. Include stable IDs, order/ranks, scope, and revision.

  **Analysis:** Network Manager has no persistently manually ranked inventory. This rule governs such collections; snapshot merge source priority is a separate temporary operation audited under requirements 149–156.

  **Evidence:** Network inventory semantics; MergeSnapshots.vue.

- [x] **R88 — NOT_APPLICABLE** · source line 327

  **Requirement:** Use the existing 24-hour/full-coverage snapshot requirement for this configuration change. A browser-only reorder is not a successful save. Capture the old order, not the unsaved proposal, as the pre-change recovery state; store the proposed order separately in the change record.

  **Analysis:** Network Manager has no persistently manually ranked inventory. This rule governs such collections; snapshot merge source priority is a separate temporary operation audited under requirements 149–156.

  **Evidence:** Network inventory semantics; MergeSnapshots.vue.

- [x] **R89 — NOT_APPLICABLE** · source line 330

  **Requirement:** While saving, prevent duplicate submission and further dragging. Leave the proposal available with an error if validation, backup, or persistence fails. Do not report success before backend acknowledgment.

  **Analysis:** Network Manager has no persistently manually ranked inventory. This rule governs such collections; snapshot merge source priority is a separate temporary operation audited under requirements 149–156.

  **Evidence:** Network inventory semantics; MergeSnapshots.vue.

- [x] **R90 — NOT_APPLICABLE** · source line 332

  **Requirement:** After staging Save, return to normal mode, restore checkboxes, and recalculate action visibility from the current selection; Reorder/Delete stay hidden when nothing is selected. Hide Save/Cancel; active navigation retains the applied order. Update navigation only after Apply confirms persistence. The applied order must survive reloads and manager/backend restarts and be included in snapshot restoration.

  **Analysis:** Network Manager has no persistently manually ranked inventory. This rule governs such collections; snapshot merge source priority is a separate temporary operation audited under requirements 149–156.

  **Evidence:** Network inventory semantics; MergeSnapshots.vue.

### 5. Overview and resource details

- [x] **R91 — PASS_LOCAL** · source line 349

  **Requirement:** Support two Overview design variants within the shared shell: **Summary** (DNS Manager's metric cards followed by flow/status and summary panels) and **Master/Detail** (Network Manager's metric cards and filters above a left selectable inventory and right details panel). These are reusable design patterns, not a requirement for an application to offer a runtime layout switch. Keep the current DNS Summary arrangement; choose the variant appropriate to the application.

  **Analysis:** Network Manager uses the allowed Master/Detail variant; DNS Summary-only requirements do not apply here.

  **Evidence:** overview screenshot.

- [x] **R92 — PARTIAL** · source line 355

  **Requirement:** Each Overview variant supports keyword search across relevant names, namespaces, and identifiers, and consumes the single host namespace filter from section 4.

  **Analysis:** Overview keyword search consumes preview global namespace scope; installed host picker synchronization needs validation.

  **Evidence:** Overview/shared filters; host integration limitation.

- [x] **R93 — PASS_LOCAL** · source line 357

  **Requirement:** Use compact statistic cards for actionable inventory, errors, related resources, and pending changes.

  **Analysis:** Routes, incidents, referenced certificates and pending changes are compact statistic cards.

  **Evidence:** overview screenshot.

- [x] **R94 — PARTIAL** · source line 358

  **Requirement:** Clicking an actionable card opens the corresponding page with the relevant filter.

  **Analysis:** Errors and pending cards navigate with meaningful scope; Referenced Certificates opens all certificates without a reference-only filter.

  **Evidence:** F27; Overview card source.

- [x] **R95 — PASS_LOCAL** · source line 359

  **Requirement:** Overview exposes resumable working drafts and validated pending changes distinctly.

  **Analysis:** Working drafts and validated pending changes are distinct; resumable editor drafts are exposed from Overview.

  **Evidence:** draft/resume source; configuration tests.

- [x] **R96 — PASS_LOCAL** · source line 360

  **Requirement:** Present the configured flow and resource context together where the application has a flow. Do not imply configured references prove successful traffic or service availability.

  **Analysis:** Incoming traffic, listener, destination and context are together; copy states configuration is not a reachability check.

  **Evidence:** overview/domain screenshots.

- [x] **R97 — PASS_LOCAL** · source line 362

  **Requirement:** Resource context includes namespace, owning application/controller, and applicable change state.

  **Analysis:** Namespace, owning application and preview change state appear in Resource Context.

  **Evidence:** overview screenshot.

- [x] **R98 — PARTIAL** · source line 363

  **Requirement:** Link Kubernetes resources to their native Rancher detail pages in the active cluster.

  **Analysis:** Native detail URL builder uses active cluster context; actual installed link targets were not verified.

  **Evidence:** ResourceLink.vue; native limitation.

- [x] **R99 — FAIL** · source line 364

  **Requirement:** Namespace, workload, pod, Service, node, Secret-reference, and other Rancher resource references are clickable native detail links wherever a destination can be resolved. Use active cluster context and stable resource identity; standalone previews use the configured Rancher URL. Disclose unavailable destinations rather than rendering misleading links; show Secret metadata only.

  **Analysis:** Several namespace/resource references remain plain text, notably diagnostics and snapshot operation lists, instead of native detail links.

  **Evidence:** F14; diagnostics/coverage/restore screenshots.

- [x] **R100 — PASS_LOCAL** · source line 369

  **Requirement:** Deep links into history/snapshots retain the selected resource scope and provide Clear Filter.

  **Analysis:** Resource-scoped snapshot links preserve route scope and provide Clear Filter; prior configuration tests cover these paths.

  **Evidence:** Overview/history deep-link source.

- [x] **R101 — PASS_LOCAL** · source line 370

  **Requirement:** Use collapsible detail sections to keep the default view readable; define domain-specific sections and their default expansion in the plugin standard.

  **Analysis:** Domain Details starts expanded; Ports & Mappings, TLS & Certificate and Snapshots start collapsed for a selected route.

  **Evidence:** overview screenshot.

- [x] **R102 — PASS_LOCAL** · source line 372

  **Requirement:** Open concrete HTTP/HTTPS address links in a new tab. Wildcards, regular expressions, raw TCP/SNI, and UDP addresses are references, not fabricated web URLs.

  **Analysis:** Concrete web addresses use safe new-tab links. Wildcards/raw transport are informational; IPv6 and URL escaping are tested.

  **Evidence:** domain-link tests/source.

- [x] **R103 — PASS_LOCAL** · source line 374

  **Requirement:** Show internal Service addresses and forwarded endpoint addresses separately; resolve named ports from actual metadata, bracket IPv6 addresses, and explain unavailable/headless addresses.

  **Analysis:** Service cluster IP and endpoint IP/port are distinct; named service ports resolve through inspected metadata.

  **Evidence:** domain/port tests/source.

- [x] **R104 — PASS_LOCAL** · source line 376

  **Requirement:** Address display is not a reachability check. Show the observation time/source when applicable.

  **Analysis:** Observation source/time and non-reachability caveat are displayed for address/configuration observations.

  **Evidence:** Overview source/details.

### 6. Forms and working drafts

- [x] **R105 — FAIL** · source line 380

  **Requirement:** Reuse form spacing, labels, help, validation feedback, and action placement across editors.

  **Analysis:** Forms differ in input styling and action placement; certificate/port forms wrap header controls and Settings URL is unstyled.

  **Evidence:** F02/F04/F07.

- [x] **R106 — PASS_LOCAL** · source line 381

  **Requirement:** Start each new-resource editor with a clean form. Preserve context for intentional edits.

  **Analysis:** New forms reset to clean defaults; editing intentionally loads existing connection identity and fields.

  **Evidence:** new editor screenshots.

- [x] **R107 — PASS_LOCAL** · source line 382

  **Requirement:** Keep immutable identity fields locked on existing resources.

  **Analysis:** Existing connection namespace and relevant identity fields are immutable in the tested model.

  **Evidence:** configuration tests; editor screenshots.

- [x] **R108 — PARTIAL** · source line 383

  **Requirement:** Retain user-entered names and overrides. Provide an explicit Use Suggested Name action rather than overwriting a customized name when another selection changes.

  **Analysis:** Conditional generation preserves manual Secret-name overrides, but an explicit Use Suggested Name control is not consistently provided.

  **Evidence:** certificate/editor suggestion source.

- [x] **R109 — PASS_LOCAL** · source line 385

  **Requirement:** Populate dependent selectors from inventory and the selected profile/scope.

  **Analysis:** Certificate/issuer/domain and port choices follow selected namespace/profile; multi-certificate hostname coverage is tested.

  **Evidence:** configuration tests; issuer/certificate source.

- [x] **R110 — PASS_LOCAL** · source line 386

  **Requirement:** Inline Add actions may create related drafts; distinguish these from persisted live resources.

  **Analysis:** Related Add actions produce drafts with explicit preview/staged behavior, rather than silently issuing live resources.

  **Evidence:** PublishService related Add source.

- [x] **R111 — PARTIAL** · source line 387

  **Requirement:** Validate dependencies, incompatible options, missing references, and conflicting mappings before creating a rollout proposal. Repeat authoritative validation on the server before writes.

  **Analysis:** Local model validates mapping/dependency constraints; authoritative live backend validation and ownership revision checks are not verified.

  **Evidence:** configuration suite; F15.

- [x] **R112 — PARTIAL** · source line 389

  **Requirement:** Offer Save Draft And Leave, Discard Changes, and Stay On This Page when navigation would lose unsaved changes. Cover both the plugin's controls and native Rancher route changes.

  **Analysis:** Actual connection leave prompt showed Save Draft/Discard/Stay; other forms register the guard. Native/browser-unload integration remains unverified.

  **Evidence:** unsaved-dialog screenshot; form-guard source.

- [x] **R113 — PASS_LOCAL** · source line 391

  **Requirement:** Allow incomplete working drafts to be resumed from Overview. Explain their persistence lifetime.

  **Analysis:** Incomplete form drafts are resumable from Overview and described as preview/session state, not durable snapshots.

  **Evidence:** editor-session.ts; configuration tests.

- [x] **R114 — FAIL** · source line 392

  **Requirement:** Keep Cancel beside the other form actions as an outlined/secondary button.

  **Analysis:** Shared header CSS overrides secondary Cancel styling, making it solid blue like primary actions.

  **Evidence:** F05; form/modal screenshots.

- [x] **R115 — PASS_LOCAL** · source line 393

  **Requirement:** Refresh must preserve field values, active drafts, selection, and the editor instance.

  **Analysis:** Entered Route Name stayed intact after Refresh; stateful editor is preserved in place rather than remounted.

  **Evidence:** manual refresh interaction; configuration tests.

- [x] **R116 — PARTIAL** · source line 394

  **Requirement:** Distinguish saving a draft from publishing/applying it. Disable live actions without a working, authenticated backend; saving local state must not claim a live resource was changed.

  **Analysis:** Draft saving and Apply are separated; live Apply is disabled without backend capability. Real authenticated execution is absent/unverified.

  **Evidence:** F15; PendingRollouts.vue.

- [x] **R117 — PARTIAL** · source line 396

  **Requirement:** Integration editors that configure a connection provide **Test Connection** using the current unsaved settings. Show the tested scope, result, and observation time; invalidate the result when connection settings change. Distinguish network reachability from authentication and the required service operations. Testing does not save or mutate managed configuration, and a missing backend cannot report a successful test.

  **Analysis:** Relevant provider configuration exposes credentials as references, but has no current-settings Test Connection with freshness/retest feedback.

  **Evidence:** F22; issuer/settings source.

### 7. Pending rollouts, processes, and change review

- [x] **R118 — PASS_LOCAL** · source line 404

  **Requirement:** Separate incomplete working drafts from validated pending rollout proposals.

  **Analysis:** Incomplete drafts are labeled Needs Completion and do not qualify for Apply until valid.

  **Evidence:** configuration tests; pending-rollouts source.

- [x] **R119 — PARTIAL** · source line 405

  **Requirement:** All unapplied managed changes are saved as drafts and visible in Pending Rollouts, including incomplete drafts labeled Needs Completion. Validate a draft into a reviewable proposal before enabling Apply. A form save stages the change without applying it. Apply from Pending Rollouts starts the backend operation, visible in Running Processes with its actual state and results. This includes ordering and configuration changes: the snapshot/revision gate runs before execution, and active navigation reflects confirmed configuration rather than an unapplied draft. Local display preferences and non-mutating tests do not create rollouts.

  **Analysis:** Pending proposals and simulated processes exist; current-state arrays can change before Apply and actual backend execution/readback is not verified.

  **Evidence:** F15/F18.

- [x] **R120 — PASS_LOCAL** · source line 413

  **Requirement:** Collect relevant creates, edits, reissues, configuration changes, deletions, and restore proposals in one review location. Repeated saves replace the same proposal rather than duplicating it.

  **Analysis:** Create/edit/reissue/port/delete/restore drafts enter a shared pending list; repeated edits update stable pending records.

  **Evidence:** pending-rollouts.ts; configuration tests.

- [x] **R121 — PARTIAL** · source line 415

  **Requirement:** Provide the affected resource list, scope, current/proposed configuration, and downloadable manifests or equivalent native configuration before application.

  **Analysis:** Affected scope and proposed manifests are available, but authoritative before/after ownership data requires a real backend.

  **Evidence:** pending/restore source; F15.

- [x] **R122 — PASS_LOCAL** · source line 417

  **Requirement:** Keep the pending counter shared between navigation and Overview. Examples do not count as changes.

  **Analysis:** Both use the same pending counter, with examples excluded; screenshots showed matching zero counts.

  **Evidence:** Overview/sidebar source.

- [x] **R123 — PARTIAL** · source line 418

  **Requirement:** For reusable configurations, show affected consumers before updating them. Editing a preset alone does not silently update existing consumers; reconfiguration is an explicit reviewed operation.

  **Analysis:** Consumers are exposed in reconfiguration review, but saved presets update current preview inventory before reviewed Apply.

  **Evidence:** PortPresets/reconfiguration source; F18.

- [x] **R124 — PARTIAL** · source line 420

  **Requirement:** Validate the complete affected group before applying it. Aim for consistent group changes and report partial failures truthfully when the backend cannot provide transactions.

  **Analysis:** Local affected-group validation is tested. Live transactional/partial failure reconciliation is not proven.

  **Evidence:** atomic configuration tests; F15.

- [x] **R125 — PARTIAL** · source line 422

  **Requirement:** Detect concurrent edits or changed dependencies and require a fresh review instead of overwriting them.

  **Analysis:** Local dependency changes invalidate review. Real resourceVersion checks against concurrent cluster writes are not tested.

  **Evidence:** snapshot gate/merge source; F15.

- [x] **R126 — PARTIAL** · source line 423

  **Requirement:** Detect Helm/Fleet/controller ownership and route edits through the owning source or clearly explain the reconciliation consequence before enabling a conflicting mutation.

  **Analysis:** Helm ownership is displayed; routing live changes through Helm/Fleet/controller source is not implemented/verified in preview.

  **Evidence:** ownership context; F15.

- [x] **R127 — PARTIAL** · source line 425

  **Requirement:** Track submitted work on the required Running Processes page, including operation, namespace/scope, status, start time, affected resources, progress when known, and configuration details.

  **Analysis:** Page exists with operation/status/times. Actual asynchronous backend jobs are not connected; available activity is simulated.

  **Evidence:** running-processes screenshot/source.

- [x] **R128 — PASS_LOCAL** · source line 427

  **Requirement:** Do not invent progress percentages or completion. Label simulated processes as simulations.

  **Analysis:** Preview simulated processes are explicitly labeled; model does not claim real controller rollout progress.

  **Evidence:** RunningProcesses simulation source.

- [x] **R129 — PASS_LOCAL** · source line 428

  **Requirement:** Keep session rollout/rollback history distinct from durable configuration snapshots.

  **Analysis:** Session operation records are separate from durable stored backups on Snapshots.

  **Evidence:** running/history source/screenshots.

### 8. Snapshots, schedules, restoration, and recovery

- [x] **R130 — PARTIAL** · source line 440

  **Requirement:** Store snapshots in a dedicated persistent server location, outside rotating logs. Confirm backend storage before satisfying any backup gate. Keep the volume in an independent backup policy; replication/persistence alone is not a backup.

  **Analysis:** Dedicated snapshot directory and persistent volume configuration exist; independent host backup/migration coverage was not proven.

  **Evidence:** server persistence tests; compose/PVC source.

- [x] **R131 — PASS_LOCAL** · source line 443

  **Requirement:** Export ZIP files containing the configuration index and independently readable manifests/configuration. Include Secrets is an explicit checkbox, default off; non-secret configuration is always included. A second downloaded copy is optional; a download-only workflow requires acknowledgment that the files were saved.

  **Analysis:** ZIP contains index/manifests and standalone recovery instructions; Secret-inclusive payload encryption and configuration-only omission are explicit.

  **Evidence:** server ZIP/recovery tests; RECOVERY.md.

- [x] **R132 — FAIL** · source line 447

  **Requirement:** Capture persisted pre-change configuration separately from local proposals and declared dependencies. Include Secret manifests/values only with Include Secrets; otherwise retain references and disclose omitted credential coverage. Exclude application/PV data. List unavailable Secrets and the observation time.

  **Analysis:** Capture reads arrays already updated by saved proposals, allowing proposed values to masquerade as persisted pre-change configuration.

  **Evidence:** F18; port-presets.ts/workspace.ts/snapshot-schedule.ts.

- [x] **R133 — PASS_LOCAL** · source line 451

  **Requirement:** Both Create Snapshot and the snapshot schedule's Run Now first open a modal asking whether to Include Secrets (default off). Selecting Include Secrets shows Password and Confirm Password fields and a locally evaluated strength bar beneath the password field. Show a readable strength label and mismatch feedback, with accessible labels/focus. Confirm requires matching passwords and the shared strength policy; Cancel clears both passwords and returns Include Secrets to unchecked.

  **Analysis:** Include Secrets is unchecked by default; checking reveals password/confirmation/strength fields and disables Create until valid. No credentials were entered.

  **Evidence:** snapshot-create-modal/secrets screenshots.

- [x] **R134 — PASS_LOCAL** · source line 457

  **Requirement:** Secret-inclusive backups require password encryption of the entire backup payload, including the index, configuration, and Secret manifests. Use AES-256 encrypted ZIP entries through a maintained implementation, not legacy ZipCrypto or a UI-only password check. Keep all recovery content in one encrypted payload entry (for example backup.zip inside the outer ZIP) with a generic filename, because ordinary ZIP encryption leaves entry names/metadata visible. See [WinZip encryption format](https://www.winzip.com/en/support/aes-encryption/) and [ZIP directory visibility](https://kb.winzip.com/en/130859).

  **Analysis:** Encrypted archive tests cover wrong-password verification and recovery. This is local cryptographic behavior, not production credential capture.

  **Evidence:** existing snapshot server tests.

- [x] **R135 — PARTIAL** · source line 464

  **Requirement:** Passwords are transient capture/export inputs: do not place them in drafts, browser storage, logs, or the archive index. Clear them on completion/cancellation. Never emit an unencrypted Secret-inclusive file when encryption fails. Verify that correct-password recovery succeeds and wrong/missing-password access fails before treating encrypted backup creation as successful.

  **Analysis:** Password handling clears transient inputs and avoids saved index fields; a full runtime browser-memory/log audit was not performed.

  **Evidence:** source review; server tests.

- [x] **R136 — PASS_LOCAL** · source line 469

  **Requirement:** Secret references alone are not restorable credentials. Redact Secret values and annotation values in all on-screen comparisons, including last-applied annotations; retain full captured manifests only within appropriately protected recovery content.

  **Analysis:** Screen values are redacted; missing Secret values are disclosed as non-restorable reference-only coverage.

  **Evidence:** snapshot comparison source; coverage screenshot.

- [x] **R137 — PARTIAL** · source line 475

  **Requirement:** Provide listing, search, scope/generation filters, manual capture, downloads, uploads, inspection, comparison, selected restoration with dependencies, merge, protected backup deletion, automatic scheduling, and retention cleanup.

  **Analysis:** Listing/search/scope/merge/restore/ZIP work locally; dedicated generation filter is absent and server deletion coverage is insufficient.

  **Evidence:** F11/F19; history/restore screenshots.

- [x] **R138 — PASS_LOCAL** · source line 478

  **Requirement:** Default to Created descending using raw timestamps, including within namespace groups and on a fresh open. Refresh preserves an explicit user-selected sort.

  **Analysis:** Fresh snapshot inventory uses raw Created descending; grouping retains Created ordering and user sort is preserved during refresh.

  **Evidence:** history screenshot; sort source.

- [x] **R139 — PASS_LOCAL** · source line 480

  **Requirement:** Size sorts numerically by the complete stored/exported ZIP bytes and uses decimal B, KB, MB, GB, and TB. Legacy JSON/YAML pairs display their combined byte size explicitly; they do not supply the complete-ZIP size used by current capacity estimates.

  **Analysis:** Snapshot Size uses complete ZIP bytes, numeric sorting and scaled decimal units; synthetic fixtures and full archive have distinct sizes.

  **Evidence:** history measurements; size formatting tests.

- [x] **R140 — PARTIAL** · source line 483

  **Requirement:** Use the common header actions/help/refresh/count shell. New uses a plus; Delete uses a red trash action with matching geometry. Scope filters include Manual or Automatic generation and date ranges with calendar selection, optional times, Clear Range, and convenient start-to-end selection.

  **Analysis:** Common heading, icon actions, count, Group By and date range exist; generation filter and workflow header placement are incomplete.

  **Evidence:** history screenshot; F11/F04.

- [x] **R141 — FAIL** · source line 490

  **Requirement:** For reconfiguration, rollback, restoration, bulk deletion, and ordering changes, verify a matching snapshot captured within the previous 24 hours for the complete affected configuration. Recheck coverage, age, and revisions at execution time. Changes invalidate coverage; a recent timestamp alone is insufficient.

  **Analysis:** Client gates compare content/age, but proposed/current conflation and server deletion's age-only recovery check violate full persisted affected-scope validation.

  **Evidence:** F18/F19; server.mjs:184.

- [x] **R142 — PASS_LOCAL** · source line 494

  **Requirement:** Select a stored snapshot or upload its index; automatically compare saved/current affected content side by side. YAML alone does not establish capture age or scope. Mismatching configuration cannot satisfy the mutation gate.

  **Analysis:** Saved/uploaded snapshot checks compare age and content automatically; mismatches remain blocked. Reference-only YAML does not establish encrypted credential coverage.

  **Evidence:** configuration tests; restore-review screenshot.

- [x] **R143 — PARTIAL** · source line 497

  **Requirement:** Restoration reviews affected items/dependencies and what will be overwritten. Require a fresh current-state snapshot and explicit overwrite confirmation. Block uncovered consumers, missing dependencies, and newer conflicting edits.

  **Analysis:** Selection/diff/current-state backup gate and confirmation are present, but authoritative current baseline and final live revision checks are unverified.

  **Evidence:** restore-review screenshot; F18/F15.

- [x] **R144 — PASS_LOCAL** · source line 500

  **Requirement:** Require explicit Secret selection/confirmation for credential replacement. Managed resource deletion never removes Secrets. Never silently restore unrelated objects or remove resources created after the selected snapshot.

  **Analysis:** Secrets default to not replacing credentials; replacement requires explicit selection. Managed resource deletion excludes Secrets by design.

  **Evidence:** snapshot selection tests/source.

- [x] **R145 — PARTIAL** · source line 503

  **Requirement:** Prepare restoration drafts in Pending Rollouts; Apply is a separate reviewed backend operation tracked in Running Processes. Preserve capture provenance.

  **Analysis:** Restoration prepares pending drafts. Separate live backend Apply and actual Running Processes readback remain unavailable/unverified.

  **Evidence:** restore/pending source; F15.

- [x] **R146 — PASS_LOCAL** · source line 505

  **Requirement:** Provide recovery instructions for obtaining files without the application and restoring reviewed native configuration, including owning Helm/Fleet sources.

  **Analysis:** Independent file retrieval, decryption and native manifest recovery are documented/tested without reliance on the running UI.

  **Evidence:** RECOVERY.md; ZIP tests.

- [x] **R147 — PARTIAL** · source line 510

  **Requirement:** Begin with Verify Snapshot Passwords when preparing selected sources. List every protected snapshot with its own password input, a Test Password action, and an adjacent Apply To All Snapshots action. Applying a password never verifies it. Provide Test All Passwords and show actual archive-decryption results per snapshot. Editing or copying passwords invalidates prior verification. Reverify before continuing; do not rely on a nonempty field or cached success alone.

  **Analysis:** Dedicated password verification supports encrypted sessions; actual UI traversal used unencrypted safe fixtures and source count showed zero before accepting two verified sources.

  **Evidence:** merge-unlock screenshot; server unlock tests; F25.

- [x] **R148 — PASS_LOCAL** · source line 516

  **Requirement:** Warn explicitly which snapshots will not be processed and why (missing password, incorrect password, unreadable archive). Include unencrypted snapshots normally. Only protected snapshots with a successfully supplied password enter the merge; skipped snapshots never enter priority, selection, provenance, output, or source deletion. Require at least two eligible sources. Keep the exclusion warning through final review. Passwords remain only in session memory and are never saved in drafts, preview source files, browser storage, logs, or exported metadata.

  **Analysis:** Missing/incorrect/unreadable sources are named and excluded; accepting verified sources requires explicit continuation and minimum source count.

  **Evidence:** unlock tests/source.

- [x] **R149 — PARTIAL** · source line 523

  **Requirement:** Merge opens a dedicated page in the shared shell. Its navigable stepper is Override Priority, one selection step per relevant item type, Review Differences, Final Summary. Each plugin adapter supplies its item types, selection order, stable identities, and dependency relationships in its own standard.

  **Analysis:** Dedicated navigable per-type wizard exists and is visually reviewed; issuer identity collision prevents correct flattening in some namespaced cases.

  **Evidence:** merge workflow screenshots; F16.

- [x] **R150 — FAIL** · source line 527

  **Requirement:** Highest-priority sources override lower ones by stable item identity, taking a complete item from the winning source; missing items come from lower sources. Support drag ordering and accessible keyboard controls.

  **Analysis:** Highest source priority is implemented, but profile identity issuer-profile/name omits namespace and collapses unrelated profiles.

  **Evidence:** F16; snapshot regression test.

- [x] **R151 — PASS_LOCAL** · source line 530

  **Requirement:** Every selection step shows only additions/content changes. Matching items remain in the final backup automatically. Skip types with zero additions/changes; a fully matching merge goes directly from priority to review and final confirmation.

  **Analysis:** Matching items are retained but hidden; changed/additional items appear in per-type steps and empty steps are skipped by the model.

  **Evidence:** configuration tests; merge type screenshots.

- [x] **R152 — PARTIAL** · source line 533

  **Requirement:** Automatically include known required dependencies; block unresolved dependencies. Keep selection, comparison, summaries, and backup output consistent.

  **Analysis:** Known dependencies are expanded and missing ones block merge/restore; namespace-colliding profile identity can corrupt the effective dependency set.

  **Evidence:** configuration tests; F16.

- [x] **R153 — PARTIAL** · source line 535

  **Requirement:** Changed Secrets default to keeping readable current credentials; selecting a snapshot version requires an explicit choice. Read current versions of every source Secret as well as currently referenced Secrets, including after references change. Failed reads cannot silently reuse stale credentials. If current values are unavailable, preserve the saved version in the backup and disclose the gap. Matching Secrets keep their original capture provenance. Merge never writes live credentials and follows the same Include Secrets/encryption contract as capture.

  **Analysis:** Current credentials take precedence where readable and saved provenance is retained. The live authenticated Secret-read path was not tested in the browser.

  **Evidence:** Secret freshness tests/source.

- [x] **R154 — FAIL** · source line 542

  **Requirement:** Compare the effective flattened selection against current configuration, side by side, showing additions/content changes only. Shared IDs alone are not conflicts; matching and current-only items are excluded and never implicitly deleted. Ignore transient controller status/resource-version changes in comparisons.

  **Analysis:** Comparison omits persistent metadata.labels; a metadata-only Service change is wrongly reported Unchanged and may disappear from review.

  **Evidence:** F17; snapshot regression test.

- [x] **R155 — PARTIAL** · source line 546

  **Requirement:** Final confirmation states scope, precedence, added/changed counts, and whether originals are retained. Offer Remove These Snapshots When Merged; partial merges that omit configuration retain originals. Save durably before any source removal. Cleanup failure leaves a successful save intact and permits separate cleanup without retrying the merge. Preserve per-item capture dates through merges and subset selection: merging old content does not make its coverage fresh.

  **Analysis:** Durable merge/provenance/omission protection exists. General original-deletion recovery content is not validated server-side.

  **Evidence:** merge server tests; F19.

- [x] **R156 — PASS_LOCAL** · source line 552

  **Requirement:** Protect unsaved merge choices using the common draft/leave guard and register the merge editor as a hidden route. Merging, restoration preparation, and Apply remain separate actions.

  **Analysis:** Merge uses hidden route and shared leave/draft guard; baseline changes invalidate choices. Navigation/header ownership issues are separately failed.

  **Evidence:** merge editor-session source.

- [x] **R157 — PARTIAL** · source line 558

  **Requirement:** Show per-resource coverage and snapshot history. The coverage display checks the last seven days: green matching, amber partial/differing, red no recent applicable copy. This display window is separate from the 24-hour mutation gate. Multiple snapshots may collectively cover known configuration; fixtures do not prove live backup.

  **Analysis:** Seven-day status/history UI works; identity/content omissions can produce inaccurate matching coverage.

  **Evidence:** coverage screenshot; F16/F17.

- [x] **R158 — PASS_LOCAL** · source line 562

  **Requirement:** Make the banner clickable and keyboard accessible. Green opens the inventory; partial/missing/outdated coverage opens a dedicated summary/diff page using the Snapshots shell. Group missing, outdated, and changed items into collapsible sections by type; hide matching/recently covered items. Compare uncovered items with their latest applicable stored version, redacting Secret values.

  **Analysis:** Banner is keyboard-clickable; gap page hides covered items and groups missing Secrets in collapsible sections with the shared header.

  **Evidence:** snapshot-coverage screenshot.

- [x] **R159 — PASS_LOCAL** · source line 567

  **Requirement:** For this notification only, Secrets use backup presence rather than freshness or content differences. A Secret with captured values in an applicable stored backup is excluded from freshness/difference totals, even after rotation. References without captured values remain missing-backup gaps, including with Include Secrets off. Record missing/omitted recovery coverage in the index and recovery comments. This presence-only rule never relaxes restore dependencies or write validation.

  **Analysis:** Secret values use applicable backup presence, not freshness/current-value equivalence, only for the banner; references still show missing.

  **Evidence:** Secret coverage configuration tests.

- [x] **R160 — PASS_LOCAL** · source line 573

  **Requirement:** Resource history links retain selected scope and provide Clear Filter. Network Manager defines its resource-specific badge layout in its own standard.

  **Analysis:** Resource and exact snapshot links retain scope and offer Clear Filter.

  **Evidence:** Overview snapshot link source.

- [x] **R161 — PASS_LOCAL** · source line 578

  **Requirement:** Place Automatic Snapshot Schedule and Automatic Snapshot Cleanup side by side at the bottom, each occupying 50% of the row. Align configuration fields left, actions right, and use compact retention units. Beneath each panel's controls show only its next date: Next Snapshot in the capture panel and Next Delete in the cleanup panel. Put explanatory/status paragraphs about server scheduling, browser closure, capture source, recovery copies, retention protection, and estimation assumptions in a help icon beside the corresponding panel title, linking to the relevant guide section. Errors remain visible and actionable.

  **Analysis:** Schedule/cleanup panels are equal-width, left-group fields/right actions, compact retention units; they stack responsively in source.

  **Evidence:** history-1920 screenshot; SnapshotSchedule.vue.

- [x] **R162 — PASS_LOCAL** · source line 586

  **Requirement:** Enabled is a green badge; Disabled is red. Loading/unknown has a distinct state.

  **Analysis:** Enabled is green, Disabled red and Unavailable is distinct; local loaded state was visibly rendered.

  **Evidence:** schedule screenshots/source.

- [x] **R163 — PASS_LOCAL** · source line 587

  **Requirement:** Persist enabled state, interval, scope, and capture source on the server; run with the browser closed. Support minutes, hours, days, weeks, and calendar months with month-end clamping. Disclose whether the source is fresh live state or saved inspection.

  **Analysis:** Server persists interval/scope/source and executes without a browser; supported units include minute/hour/day/week/month. Live cluster capture is not claimed.

  **Evidence:** existing server restart/schedule tests.

- [x] **R164 — PASS_LOCAL** · source line 590

  **Requirement:** Cleanup is disabled by default. Protect the newest applicable snapshot for each known scope/configuration item and retain originals required by partial merges.

  **Analysis:** Default is disabled; retention protects newest applicable item/scope coverage. Isolated audit schedule changes do not establish production policy.

  **Evidence:** cleanup server tests/source.

- [x] **R165 — PARTIAL** · source line 592

  **Requirement:** Immediately below both panels, provide a separate row spanning 100% of the combined width, divided into three equal columns: Available Drive Space, Largest Snapshot, and Estimated Run Out Of Space. No storage figures belong inside either schedule panel. Format examples (illustrative, never hardcoded): `Available Drive Space: 950.8 GB / 1.1 TB`; `Largest Snapshot: 555.6 KB · Approximately 1,711,350 More Snapshots Fit`.

  **Analysis:** Storage has a full-width three-column row, but its default collapsed disclosure hides the required figures until opened.

  **Evidence:** F23; SnapshotSchedule.vue.

- [x] **R166 — PARTIAL** · source line 598

  **Requirement:** Available storage means bytes writable by the service account at the configured destination: available filesystem space bounded by any smaller remaining PVC, dataset, volume, tenant, or application quota. Do not show parent drive capacity as backup capacity or double-count replicas. Required limits that cannot be measured show Unavailable with a reason, never zero or a fabricated exhaustion date.

  **Analysis:** Effective configured quota and filesystem free bytes are combined; real service-account/PVC volume-limit discovery was not tested in deployment.

  **Evidence:** statfs/quota tests/source.

- [x] **R167 — PASS_LOCAL** · source line 603

  **Requirement:** Measure the actual mounted filesystem containing the resolved snapshot-save directory (including PVC/bind mounts/symlinks); report effective available bytes and that destination's total capacity. Do not substitute the host's root disk, browser disk, or a different mount. Apply smaller known quotas and disclose them through contextual Help. Refresh from backend measurements rather than fixtures.

  **Analysis:** Storage resolves the actual save directory and calls statfs on its mounted filesystem; configured quota bounds the result.

  **Evidence:** storage server tests/source.

- [x] **R168 — PASS_LOCAL** · source line 608

  **Requirement:** Estimates use the largest complete saved ZIP, effective available bytes, and the saved enabled cadence. Without a size or enabled schedule, show no prediction. Explain competing usage and cleanup assumptions in contextual Help rather than helper paragraphs. Refresh measurements in place after capture, cleanup, schedule changes, and normal refresh. An estimate is not a promise of available capacity.

  **Analysis:** Largest complete ZIP and saved cadence drive estimate; configured 1GiB isolated quota supplies a known bounded test destination.

  **Evidence:** storage forecast tests/source.

- [x] **R169 — PASS_LOCAL** · source line 613

  **Requirement:** If the computed exhaustion date is more than one calendar year from the measurement time, display `∞` instead of a distant date; retain the full estimate for accessible help. At exactly one year or sooner, show the localized date/time. Unknown size, unavailable space, or a disabled schedule remain Unavailable or Not Scheduled as appropriate; never turn unknown estimates into infinity.

  **Analysis:** Unavailable/unknown limits are disclosed and horizons over a calendar year display infinity rather than spurious precision.

  **Evidence:** storage formatter/source tests.

### 9. Refresh, diagnostics, settings, and help

- [x] **R170 — PASS_LOCAL** · source line 623

  **Requirement:** Provide a shared manual Refresh action and Refresh Every selector.

  **Analysis:** Manual icon Refresh and Refresh Every are shared; Rescan remains a separate discovery action.

  **Evidence:** shared refresh screenshots.

- [x] **R171 — PASS_LOCAL** · source line 624

  **Requirement:** Default to five minutes. Offer Off, 30 Seconds, 1 Minute, 5 Minutes, 15 Minutes, and 1 Hour.

  **Analysis:** Default is five minutes with Off, 30 Seconds, 1/5/15 Minutes and 1 Hour choices.

  **Evidence:** DOM snapshots.

- [x] **R172 — PASS_LOCAL** · source line 625

  **Requirement:** Show a fixed-width `MM:SS` countdown driven by a clock deadline, avoiding accumulated timer drift. Interval changes and manual refresh reset it; Off displays `00:00`.

  **Analysis:** Deadline-based fixed MM:SS sits between selector and Refresh; reset/off behavior is covered by the configuration suite.

  **Evidence:** countdown tests; screenshots.

- [x] **R173 — PASS_LOCAL** · source line 627

  **Requirement:** Update data in place without page reloads, editor remounts, or replacement of unsaved form state.

  **Analysis:** Refresh updated in place while preserving the typed value and editor; local form guard remained active.

  **Evidence:** manual refresh with edited Route Name.

- [x] **R174 — PASS_LOCAL** · source line 628

  **Requirement:** Prevent overlapping refresh work. Show busy/error feedback and retain existing data on failure.

  **Analysis:** Overlap prevention and bounded read failure retain previous data; configuration tests cover cancellation behavior.

  **Evidence:** bounded-read source/tests.

- [x] **R175 — PARTIAL** · source line 629

  **Requirement:** For a delayed data request (300 ms default), show a centered loading indicator over a blurred/dimmed page with an accessible loading status. Preserve the underlying editor and data rather than remounting them. Fail an unanswered request after 60 seconds with a visible timeout message; retry failed reads every 60 seconds except confirmed source disconnections, which retry every five seconds and restore the regular five-minute refresh after verified recovery. Show count spinners only during delayed requests; confirmed failures remain red between attempts. Retry until successful or cancelled. Show the retry countdown, prevent overlapping requests, abort abandoned requests, and ignore late responses. Clear the overlay on response/cancellation. Do not automatically replay timed-out rollout writes; reconcile their backend operation status before any explicit retry.

  **Analysis:** Delayed overlay/timeout/retry code exists; actual slow backend focus/retry transitions were not forced in this audit.

  **Evidence:** bounded-read unit tests/source.

- [x] **R176 — FAIL** · source line 640

  **Requirement:** Reserve loading indicators for actual delayed requests (300 ms default); idle, unconfigured sources and retry countdowns are not loading. Keep confirmed failures visible between attempts. Missing configuration requires configuration, not probes.

  **Analysis:** Count spinner follows global refreshing immediately rather than only its delayed associated data request.

  **Evidence:** F12; PageSummary.vue.

- [x] **R177 — PARTIAL** · source line 646

  **Requirement:** Diagnostics follows Network Manager's filter layout with keyword search, multi-select namespace scope from Rancher's global selector, log source, severity (Debug, Info, Warn, Error), and lookback. Discover relevant running resources and controller replicas as sources via the backend, and label unavailable collections distinctly. The navigation badge counts only warnings/errors over the rolling last 24 hours, independent of view filters: neutral zero, yellow warnings-only, or red combined warnings and errors when any error exists. Identify scope (browser vs managed-resource logs).

  **Analysis:** Aligned filters and host scope exist locally; real Rancher controller replica discovery and live logs are not connected.

  **Evidence:** diagnostics screenshot/source.

- [x] **R178 — PASS_LOCAL** · source line 652

  **Requirement:** Diagnostics defaults to a 24-hour view. Each adapter documents its available retention/lookback limits in its plugin standard.

  **Analysis:** Lookback is 24 hours on opening; adapter limitation/demo source is labeled.

  **Evidence:** diagnostics DOM/screenshot.

- [x] **R179 — PASS_LOCAL** · source line 654

  **Requirement:** Make badge scope, time window, and separate severity counts accessible. Keep its rolling 24-hour total independent of view filters while honoring host namespace/access scope. Unavailable log data is not a verified zero.

  **Analysis:** Rolling scoped 24-hour count showed 1 warning and 1 error, red tone, accessible breakdown; independent of view search/severity.

  **Evidence:** diagnostics DOM; source.

- [x] **R180 — PASS_LOCAL** · source line 657

  **Requirement:** Clearly label demo logs, static inventory, simulated operations, and unverified observations. A refresh of static/demo data must not claim a fresh live cluster inspection.

  **Analysis:** Demo logs, static data, simulated processes and preview behavior are identified; refresh does not claim new live observation.

  **Evidence:** DOM/source.

- [x] **R181 — PASS_LOCAL** · source line 661

  **Requirement:** Persist display preferences per browser, including Preview, snapshot status banner, and cluster inspection notices as separate controls. These controls change presentation, not access or write capability.

  **Analysis:** Browser display preferences persist independently; toggles do not alter snapshot scheduling/storage capabilities.

  **Evidence:** Settings screenshot/source.

- [x] **R182 — PARTIAL** · source line 663

  **Requirement:** Every top-of-page notification/banner type has its own labeled visibility checkbox in Settings. New banner types must add the matching preference rather than relying on a single global hide switch. Apply preferences consistently across pages and persist them per browser; hiding a banner does not alter underlying status or bypass required validation, backup, or write controls.

  **Analysis:** Preview, snapshot, inspection and read failure controls exist; all dependency warning types are not implemented as independently controlled notifications.

  **Evidence:** Settings source; F12/F13.

- [x] **R183 — PASS_LOCAL** · source line 668

  **Requirement:** Default Preview off for standalone test builds and native extension builds. An explicit saved preference may enable preview labels and banners; fresh root-suite sessions start with them off. This preference changes presentation only. Hidden notices do not turn sample data into live evidence, disable mock data, or suppress real issue notifications.

  **Analysis:** Fresh native/test defaults are off; explicit previously saved Preview preference can enable explanatory labels.

  **Evidence:** display-settings source.

- [x] **R184 — PASS_LOCAL** · source line 672

  **Requirement:** Standalone resource links may use a configured Rancher origin, validated as an HTTP/HTTPS origin without embedded credentials. Native builds use the active Rancher context.

  **Analysis:** HTTP(S) origin validation rejects embedded credentials; native links use active host origin rather than a hardcoded cluster.

  **Evidence:** DisplaySettings.vue:11.

- [x] **R185 — PARTIAL** · source line 674

  **Requirement:** Provide the Rancher URL and other relevant connection/configuration settings on the shared Settings page, alongside per-banner visibility preferences.

  **Analysis:** Rancher URL and visibility controls exist; functional management connection configuration/testing is not connected.

  **Evidence:** Settings screenshot; F22.

- [x] **R186 — PASS_LOCAL** · source line 679

  **Requirement:** Help is the final navigation page and has no inventory count or question-mark controls. Use collapsible sections for the application's purpose, every page, action, resource link, and common workflow; describe each trigger and effect.

  **Analysis:** Help is final, uncounted and has no question-mark controls; collapsed topics cover the app's pages.

  **Evidence:** help screenshot/navigation.ts.

- [x] **R187 — PASS_LOCAL** · source line 682

  **Requirement:** Explain preview versus live capabilities and how to recover or diagnose failures. Contextual popups reuse these sections; Open Help navigates to and expands the relevant section. Help's application links open the page/section they describe and synchronize the active navigation item.

  **Analysis:** Topics cover preview/live and recovery; contextual popups reuse sections and route Open Help to relevant content.

  **Evidence:** help-sections/HelpTip source.

### 10. Authentication, availability, packaging, and implementation boundaries

- [x] **R188 — NOT_VERIFIED** · source line 689

  **Requirement:** Reuse Rancher's authenticated session and enforce the active user's permissions for both reads and writes. Loading an authenticated UI is not sufficient backend authorization.

  **Analysis:** No authenticated native read/write or server authorization acceptance test was performed; preview cannot prove enforcement.

  **Evidence:** native datasource factory; F15.

- [x] **R189 — PARTIAL** · source line 691

  **Requirement:** Keep backend credentials and private keys out of browser state, repository files, plaintext exports, and logs. The explicit Include Secrets encrypted-backup flow is the exception for recovery exports; never display its values in the UI. Show Secret reference names/keys rather than Secret values.

  **Analysis:** Encrypted explicit recovery path is supported and screen values are redacted; complete browser/log credential isolation requires live integration validation.

  **Evidence:** encryption tests; Secret capture source.

- [x] **R190 — PASS_LOCAL** · source line 695

  **Requirement:** Read public certificate metadata only; do not return private keys or provider credentials.

  **Analysis:** Certificate listing reads public metadata and Secret references; it does not display private keys or provider credentials.

  **Evidence:** certificate inventory/source.

- [x] **R191 — NOT_VERIFIED** · source line 696

  **Requirement:** The plugin manages configuration; managed routing/DNS must continue if its UI or management API fails.

  **Analysis:** Management runtime is separate architecturally; real routing continuity during UI/API failure was not exercised.

  **Evidence:** architecture/rollout limitation.

- [x] **R192 — PARTIAL** · source line 697

  **Requirement:** Use versioned extension assets and a Helm chart registering `UIPlugin`. Publish the Rancher `files.txt` plus `plugin/` layout, not merely a standalone JavaScript URL.

  **Analysis:** UIPlugin chart/assets structure is present; native published files and clean install verification were not run.

  **Evidence:** chart/extension source; build log.

- [x] **R193 — PARTIAL** · source line 699

  **Requirement:** Separate UI registration, asset hosting, management backend, and managed workloads. Clearly document which chart installs which resources; registration alone does not install those dependencies.

  **Analysis:** Deployment roles are documented; chart registration/runtime separation still needs an installed acceptance check.

  **Evidence:** README/RECOVERY/chart source.

- [x] **R194 — PASS_LOCAL** · source line 701

  **Requirement:** Reuse existing infrastructure rather than adding another ingress, database, or monitoring stack merely to support a manager page.

  **Analysis:** No separate ingress/database/monitoring stack was introduced solely for this audit or preview feature.

  **Evidence:** deployment source review.

- [x] **R195 — PASS_LOCAL** · source line 703

  **Requirement:** A standalone preview uses the same components with isolated fixture data and clearly declared capabilities. Keep unauthenticated preview hosting private and free of live cluster credentials.

  **Analysis:** Shared pages were tested against an isolated local directory and scrubbed fixtures; user container and credentials were not accessed.

  **Evidence:** isolated 127.0.0.1:8091 preview.

- [x] **R196 — PASS_LOCAL** · source line 705

  **Requirement:** Every custom Rancher plugin must include a repository-owned, locally runnable standalone interface preview. An inline mockup alone does not satisfy this requirement.

  **Analysis:** Repository-owned standalone UI runs and builds; evidence is real rendered pages, not a design mockup.

  **Evidence:** actual screenshots/build log.

- [x] **R197 — PARTIAL** · source line 707

  **Requirement:** Match the Network Manager development workflow: `npm install` (or `npm ci` with the lockfile), `npm run preview`, and `npm run build:preview`. Pin dependencies and retain the lockfile.

  **Analysis:** Shared npm scripts and lockfile are present and build passes; clean dependency installation was not repeated on the dirty workspace.

  **Evidence:** package.json/lockfile/build log.

- [x] **R198 — NOT_VERIFIED** · source line 709

  **Requirement:** `npm run preview` must start a usable browser-based plugin UI directly from the local project after dependency installation. It must work without Docker or Docker Compose, container image builds, a full application deployment, or a Kubernetes/Helm installation. Optional container/backend integration previews may supplement this npm workflow but cannot replace it or become prerequisites. Use clearly labeled fixtures/local adapters for unavailable services so pages, navigation, forms, selection actions, and draft flows can be previewed locally.

  **Analysis:** The audit ran a local built UI, not a fresh npm preview with Docker stopped. Optional backend startup failure remains a source-level concern.

  **Evidence:** vite-plugin source; F21.

- [x] **R199 — PASS_LOCAL** · source line 716

  **Requirement:** Document the preview URL, prerequisites, commands, and how to stop it with Ctrl+C. Bind to `127.0.0.1` by default and use a documented, distinct port so managers can run together. Network Manager uses 5173; DNS Manager uses 5174. Fail clearly on a port conflict.

  **Analysis:** Localhost URL, prerequisites, commands and Ctrl+C stop are documented with a distinct local port.

  **Evidence:** README/vite source.

- [x] **R230 — PARTIAL** · source line 719

  **Requirement:** Each plugin folder supports `npm run preview`; repository-root `npm run preview` launches all registered plugins together for cross-plugin consistency checks. Support choosing named plugins and stop only processes started by that run. Present the selected plugins in one browser page, with side-by-side and full-width views that retain each plugin's active state. Prepopulate one temporary project-owned session datasource using the shared contract, with separate logical plugin records and snapshot directories. Saves persist within that session without changing the seed fixtures; retain session files after stopping. Start preview-only labels and banners disabled, while identifying mock data in the suite shell. This display preference must not disable mock data or real issue notifications.

  **Analysis:** Suite supports registered plugin selection/session state in source; cross-plugin side-by-side behavior and process ownership were not visually tested in this Network-only audit.

  **Evidence:** root preview-suite source.

- [x] **R201 — PARTIAL** · source line 729

  **Requirement:** Use one shared datasource contract for normalized inventory, saved state, refresh, capabilities, and reviewed writes. Project-owned JSON mock sources are editable and saveable through npm previews, including provenance/schema information. Persist valid edits atomically with revision conflict checks and visible failures. Native Rancher API adapters implement the same contract through authenticated reads and reviewed writes; changing providers must not require rewriting page UI. Credentials, passwords, and decrypted Secret values must never enter mock files.

  **Analysis:** Swappable inventory/state contract exists, but concrete authenticated native provider is not end-to-end verified.

  **Evidence:** shared preview-data/native adapter source.

- [x] **R231 — NOT_VERIFIED** · source line 736

  **Requirement:** Every feature and ability must have representative demo data pulled from its authoritative source where available, scrubbed before persistence, and saved in one project-owned global local demo database/data file shared by the plugin suite. Include the states needed to exercise the feature, such as populated and empty inventories, dependencies, drafts, warnings, errors, and operation results. Preserve source identity, capture time, schema version, and the scrubbing rules; label synthetic scenarios and never present them as live observations. Remove real credentials, Secret values, private keys, personal information, and sensitive identifiers; use safe replacements that retain referential consistency. Track and synchronize the global demo file with Git LFS and include its tracked pointer in the repository, so a normal checkout with LFS provides the prepopulated data. Document LFS setup/pull and report missing LFS content clearly. Root and per-plugin npm previews consume this same global source through the swappable datasource contract; preview saves use editable local/session copies rather than overwrite the distributed seed. A new feature is incomplete until its representative data, scrub/validation checks, and UI tests are included.

  **Analysis:** Global Git LFS feature-scenario completeness, authoritative scrubbing and missing-LFS startup need a separate fixture audit; small merge fixtures do not prove every feature's demo coverage.

  **Evidence:** preview-data source; new standard item.

- [x] **R202 — PARTIAL** · source line 752

  **Requirement:** Keep the standalone Rancher-like shell outside native integration; reuse the manager's Vue page components for the preview and native routes. Native pages use Rancher's own chrome.

  **Analysis:** Standalone chrome is outside the shared Dashboard. Actual native header/sidebar inheritance was not visually inspected.

  **Evidence:** preview/native Dashboard source.

- [x] **R203 — PARTIAL** · source line 754

  **Requirement:** Interface preview startup must not require cluster credentials, Windows connectivity, the managed service, a live management backend, or any Docker/test containers. Label sample inventory and simulated status. Document browser-only preview state separately from backend-confirmed durable snapshots.

  **Analysis:** Preview needs no cluster credentials, but optional local snapshot helper startup can reject Vite setup; failure-tolerant startup needs a test.

  **Evidence:** F21; shared vite plugin.

- [x] **R204 — PASS_LOCAL** · source line 758

  **Requirement:** Keep preview/build, publication, installation, and live execution distinct. Do not describe a generated draft or compiled library as deployed functionality.

  **Analysis:** Preview/build evidence is explicitly separated from publication, installation and live execution; no deployment claim is made.

  **Evidence:** this report; README.

- [x] **R205 — NOT_VERIFIED** · source line 760

  **Requirement:** Verify native integration, authorization, live observation, server validation, and result readback before marking a live feature implemented.

  **Analysis:** Native integration, permissions, server validation and result readback remain required before declaring live readiness.

  **Evidence:** release validation plan.

- [x] **R206 — NOT_VERIFIED** · source line 762

  **Requirement:** Deliver an installable Helm-based package that deploys the application's runtime and registers its Rancher management interface in the native left navigation. Build the actual extension bundle, page routes, Explorer menu registration, and operator-compatible extension chart; a generic workload chart or Vite preview alone does not register a Rancher UI extension. Declare the compatible Rancher version and required extension operator/CRDs. When Rancher's management cluster and workload cluster differ, explicitly target both: a Helm release only creates resources in its target cluster. Keep one documented installation workflow without claiming a single ordinary release can implicitly configure another cluster. Release acceptance includes a clean Helm install, visible native menu/routes, theme/namespace integration, refresh recovery, upgrade, and uninstall checks. See [Rancher's extension packaging](https://extensions.rancher.io/extensions/v2/publishing) and [native side-menu registration](https://extensions.rancher.io/extensions/next/api/nav/side-menu).

  **Analysis:** Packaging source exists; no clean install/upgrade/uninstall or runtime/register acceptance test was performed.

  **Evidence:** Helm/package source.

### 13. Review checklist for each new plugin

- [x] **R207 — PARTIAL** · source line 803

  **Requirement:** [ ] Native group opens Overview; menus, resource identities, and counts use the correct context.

  **Analysis:** Preview manager opens Overview and scoped counts exist; hidden ownership and native context/authorization require fixes/verification.

  **Evidence:** F06/F12; page navigation checks.

- [x] **R208 — FAIL** · source line 804

  **Requirement:** [ ] Shared heading/actions/help, viewport layout, internal scrolling, and responsive behavior work.

  **Analysis:** Shared desktop shell works, but mobile overflow, action wrapping, Rescan sizing and panel workflow actions fail measured requirements.

  **Evidence:** F01/F02/F03/F04; UI evidence.

- [x] **R209 — PASS_LOCAL** · source line 805

  **Requirement:** [ ] Grids sort correctly, retain empty headers, and keep expanded rows with their parent.

  **Analysis:** Sortable direction/aria metadata, parent-row bundling and retained empty headers are implemented; recorded geometry checks pass on primary tables.

  **Evidence:** DataGrid source; empty grid screenshots.

- [x] **R210 — PARTIAL** · source line 806

  **Requirement:** [ ] Filters/search/grouping honor scope; icon actions do not accidentally toggle rows.

  **Analysis:** Local filters/grouping and action event isolation work; live host namespace bidirectional synchronization remains unverified.

  **Evidence:** filter interactions; native limitation.

- [x] **R211 — PASS_LOCAL** · source line 807

  **Requirement:** [ ] Top-right selection-dependent actions, including Reorder/Delete, are hidden without explicit grid selection and disappear when selection is cleared.

  **Analysis:** Selection-only Delete is hidden/cleared correctly. Ranked Reorder does not apply to this manager's inventories.

  **Evidence:** certificates selection screenshot.

- [x] **R212 — NOT_APPLICABLE** · source line 809

  **Requirement:** [ ] Ranked collections use the shared top-right Reorder/Cancel/dirty-only Save flow; order persistence, conflict detection, snapshot recovery, and related navigation are verified.

  **Analysis:** No persistently manually ranked collection exists here. Merge source priority is audited against its separate wizard rules.

  **Evidence:** Network inventory semantics.

- [x] **R213 — PARTIAL** · source line 811

  **Requirement:** [ ] Keyboard navigation, labels, focus, dialogs, and non-color status descriptions are usable.

  **Analysis:** Labels, focus popup and guards were checked; corrupted snapshot gate text and untested full keyboard/native accessibility prevent full acceptance.

  **Evidence:** hover/focus Help; mixed checkbox; F09.

- [x] **R214 — PARTIAL** · source line 812

  **Requirement:** [ ] New/edit forms preserve intentional overrides and guard unsaved navigation.

  **Analysis:** Clean/edit guard flow works locally, but explicit suggested-name reset and native navigation behavior need completion/verification.

  **Evidence:** unsaved dialog; R108.

- [x] **R215 — PASS_LOCAL** · source line 813

  **Requirement:** [ ] Refresh keeps drafts/selection intact and accurately identifies source/freshness.

  **Analysis:** Typed form data survives refresh; source/freshness stays labeled rather than implying live retrieval.

  **Evidence:** manual refresh interaction/configuration tests.

- [x] **R216 — PARTIAL** · source line 814

  **Requirement:** [ ] Working drafts, validated proposals, submitted processes, examples, and durable snapshots are distinct.

  **Analysis:** Labels distinguish working/pending/process/snapshot states, but current inventory arrays still absorb unapplied issuer/port proposals.

  **Evidence:** F18; local state source.

- [x] **R217 — PARTIAL** · source line 815

  **Requirement:** [ ] Changes expose affected resources, ownership, before/after review, and concurrency validation.

  **Analysis:** Local affected/diff views exist; authoritative ownership/revision and persisted-current separation are incomplete/unverified.

  **Evidence:** F15/F18.

- [x] **R218 — FAIL** · source line 816

  **Requirement:** [ ] Applicable mutation gates verify recent full-scope backup and recheck before execution.

  **Analysis:** Pre-change baseline conflation and server age-only deletion check prevent acceptance of full-scope execution backup verification.

  **Evidence:** F18/F19.

- [x] **R219 — PASS_LOCAL** · source line 817

  **Requirement:** [ ] Snapshots survive application restart and support recovery without the manager.

  **Analysis:** Snapshots survive server restart and standalone ZIP/YAML recovery is tested locally; deployment volume backup is separate.

  **Evidence:** existing server persistence/recovery tests.

- [x] **R220 — PASS_LOCAL** · source line 818

  **Requirement:** [ ] Schedules/cleanup run with the browser closed, disclose source, and protect retained coverage.

  **Analysis:** Browser-independent scheduling/source labeling and newest-item retention pass local server tests.

  **Evidence:** existing schedule/cleanup tests.

- [x] **R221 — PARTIAL** · source line 819

  **Requirement:** [ ] ZIP/Include Secrets encryption, recovery, provenance, merge, and presence-only banner rules work.

  **Analysis:** Encryption/ZIP/provenance/presence checks pass existing tests, but targeted namespaced issuer and persistent metadata regressions fail.

  **Evidence:** F16/F17; snapshot tests.

- [x] **R222 — PARTIAL** · source line 820

  **Requirement:** [ ] Storage reports effective writable quota and uses complete ZIP sizes for estimates.

  **Analysis:** Configured writable quota/ZIP estimate logic works; default collapsed display and actual deployed quota verification remain open.

  **Evidence:** storage tests; F23.

- [x] **R223 — PARTIAL** · source line 821

  **Requirement:** [ ] Common pages, contextual Help, per-banner Settings, and scoped Diagnostics follow this standard.

  **Analysis:** Help, Settings and Diagnostics use shared shell, but styling/dividers/count state/resource links are not fully consistent.

  **Evidence:** F07/F08/F12/F14.

- [x] **R224 — FAIL** · source line 822

  **Requirement:** [ ] Yellow/red top-of-page notifications open the exact item Create/Edit/fix flow with scope preserved, keyboard access, and the normal mutation review gates.

  **Analysis:** Warning/error notices do not all open scoped item fix editors with mutation review preserved.

  **Evidence:** F13.

- [x] **R225 — NOT_VERIFIED** · source line 824

  **Requirement:** [ ] Backend authorization and credential handling are verified; hidden notices do not change capabilities.

  **Analysis:** No installed authenticated backend permission matrix/credential handling validation was performed.

  **Evidence:** F15; security acceptance plan.

- [x] **R226 — NOT_VERIFIED** · source line 825

  **Requirement:** [ ] Managed service operation continues during UI/management failure.

  **Analysis:** Managed traffic during real UI/backend failure remains untested.

  **Evidence:** live continuity plan.

- [x] **R227 — NOT_VERIFIED** · source line 826

  **Requirement:** [ ] Native release packaging and installation are verified separately from standalone preview/build.

  **Analysis:** Native publication and installation were not performed; successful standalone build is not release evidence.

  **Evidence:** release validation plan.

- [x] **R228 — PARTIAL** · source line 827

  **Requirement:** [ ] Repository-owned local interface preview starts and builds using the shared npm workflow.

  **Analysis:** Local built UI and build pass; clean npm preview startup on a fresh environment remains unverified.

  **Evidence:** build-output.txt; actual browser evidence.

- [x] **R232 — NOT_VERIFIED** · source line 828

  **Requirement:** [ ] Every feature has scrubbed representative scenarios in the repository's global Git LFS demo database/data file; previews consume it through the shared provider.

  **Analysis:** No complete global LFS scenario/scrubbing/provider acceptance run was performed.

  **Evidence:** new global demo acceptance item.

- [x] **R229 — NOT_VERIFIED** · source line 830

  **Requirement:** [ ] `npm run preview` provides usable plugin UI with Docker stopped and without backend, cluster, container-build, or deployment prerequisites.

  **Analysis:** No Docker-stopped/backend-absent fresh npm preview acceptance test was performed.

  **Evidence:** F21; isolated built server.

## Additional non-bullet source checks

| Source item | Status | Analysis |
|---|---|---|
| Purpose/status and maintenance paragraphs | PASS_LOCAL | Treated as a cross-plugin design standard, not proof of deployment. This report preserves production boundaries and explicit variations. |
| Navigation order block | PASS_LOCAL | Required final six entries match navigation.ts; hidden operations retain no visible owning highlight (R25 fails). |
| Ranked-collection six-state behavior table | NOT_APPLICABLE | Network has no persistent manually ranked inventory. The six cases (normal empty/selected; clean/dirty reorder; refreshing/conflict; saving) apply when that feature exists. Merge precedence uses its own rules. |
| DNS Zones/breadcrumb demonstration | NOT_APPLICABLE / PARTIAL | Zones are DNS-only. Reusable breadcrumb/owning navigation rule applies and fails on hidden Network routes. |
| Native visual reference note | PARTIAL | Used as documented reference; no new authenticated Rancher capture or light-theme inspection was performed. |
| Network Manager-specific variation | APPROVED_VARIATION | Native right-side navigation counts are explicitly approved in NETWORK-MANAGER-STANDARDS.md; no conflicting left-column migration is proposed. |
| Published/installed/live claims | NOT_VERIFIED | Build/local UI are verified; install/auth/live/controller/recovery acceptance remains pending. |
