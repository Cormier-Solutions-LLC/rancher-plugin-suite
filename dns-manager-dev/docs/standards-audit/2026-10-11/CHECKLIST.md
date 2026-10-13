# DNS Manager: item-by-item standards audit

Reviewed 2026-10-11. Standard SHA-256: `0ef93f67eee12e86f2de9d5853bbbf9dcc5b7ad54ddf9f5a0a5c068bf3f41b5f`.

Every one of the 231 top-level source/rule/checklist items has a disposition. There are 9 source-reference items, 198 shared rule items, and 24 acceptance-checklist items; these are not 231 independent tests. Sections 11, 12 and 14 contain prose, addressed below. Historical appendices remain evidence, not acceptance claims.

Verified local means only the stated local scope was demonstrated. Partial identifies both what works and what is missing. Unverified live is not a pass. Not applicable includes its reason. See [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md) for findings and limits.

## 1. Purpose and source of requirements

### RPD-01-01 — Context

**Requirement (standard line 22):** [Network Manager Standards](../../../../NETWORK-MANAGER-STANDARDS.md) and [implementation notes](../../../../simple-network-manager-dev/README.md).

**Analysis:** Requirement source/reference recorded; this reference is context, not evidence of DNS implementation. The current normative sections govern this audit.

**Evidence:** [RANCHER-PLUGIN-DESIGN.md](../../../../RANCHER-PLUGIN-DESIGN.md).
### RPD-01-02 — Context

**Requirement (standard line 23):** [Current navigation](../../../../simple-network-manager-dev/pkg/simple-network-manager/navigation.ts) and [native Rancher registration](../../../../simple-network-manager-dev/pkg/simple-network-manager/product.ts).

**Analysis:** Requirement source/reference recorded; this reference is context, not evidence of DNS implementation. The current normative sections govern this audit.

**Evidence:** [RANCHER-PLUGIN-DESIGN.md](../../../../RANCHER-PLUGIN-DESIGN.md).
### RPD-01-03 — Context

**Requirement (standard line 25):** [Shared page shell](../../../../simple-network-manager-dev/pkg/simple-network-manager/pages/Dashboard.vue).

**Analysis:** Requirement source/reference recorded; this reference is context, not evidence of DNS implementation. The current normative sections govern this audit.

**Evidence:** [RANCHER-PLUGIN-DESIGN.md](../../../../RANCHER-PLUGIN-DESIGN.md).
### RPD-01-04 — Context

**Requirement (standard line 26):** [Reusable page components](../../../../simple-network-manager-dev/pkg/simple-network-manager/pages).

**Analysis:** Requirement source/reference recorded; this reference is context, not evidence of DNS implementation. The current normative sections govern this audit.

**Evidence:** [RANCHER-PLUGIN-DESIGN.md](../../../../RANCHER-PLUGIN-DESIGN.md).
### RPD-01-05 — Context

**Requirement (standard line 27):** [Shared behavior and state](../../../../simple-network-manager-dev/pkg/simple-network-manager/data).

**Analysis:** Requirement source/reference recorded; this reference is context, not evidence of DNS implementation. The current normative sections govern this audit.

**Evidence:** [RANCHER-PLUGIN-DESIGN.md](../../../../RANCHER-PLUGIN-DESIGN.md).
### RPD-01-06 — Context

**Requirement (standard line 28):** [Action styling](../../../../simple-network-manager-dev/pkg/simple-network-manager/styles/actions.css) and [scrollbar styling](../../../../simple-network-manager-dev/pkg/simple-network-manager/styles/scrollbars.css).

**Analysis:** Requirement source/reference recorded; this reference is context, not evidence of DNS implementation. The current normative sections govern this audit.

**Evidence:** [RANCHER-PLUGIN-DESIGN.md](../../../../RANCHER-PLUGIN-DESIGN.md).
### RPD-01-07 — Context

**Requirement (standard line 30):** [Manual recovery requirements](../../../../simple-network-manager-dev/RECOVERY.md).

**Analysis:** Requirement source/reference recorded; this reference is context, not evidence of DNS implementation. The current normative sections govern this audit.

**Evidence:** [RANCHER-PLUGIN-DESIGN.md](../../../../RANCHER-PLUGIN-DESIGN.md).
### RPD-01-08 — Context

**Requirement (standard line 31):** [DNS Manager design](../../../../DNS-MANAGER-DESIGN.md) and [local prototype notes](../../../README.md).

**Analysis:** Requirement source/reference recorded; this reference is context, not evidence of DNS implementation. The current normative sections govern this audit.

**Evidence:** [RANCHER-PLUGIN-DESIGN.md](../../../../RANCHER-PLUGIN-DESIGN.md).
### RPD-01-09 — Context

**Requirement (standard line 32):** [Network Manager preview evidence](../../../../simple-network-manager-dev/IMPLEMENTATION-REVIEW.md).

**Analysis:** Requirement source/reference recorded; this reference is context, not evidence of DNS implementation. The current normative sections govern this audit.

**Evidence:** [RANCHER-PLUGIN-DESIGN.md](../../../../RANCHER-PLUGIN-DESIGN.md).

## 2. Native integration and navigation

### RPD-02-01 — Partial

**Requirement (standard line 64):** Register a native UI extension in the selected cluster's Explorer navigation.

**Analysis:** product.js registers Explorer virtual types and routing.js supplies cluster routes. Installed native menu behavior has not been demonstrated; F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/navigation.js](../../../pkg/dns-manager/navigation.js); [dns-manager-dev/pkg/dns-manager/product.js](../../../pkg/dns-manager/product.js); [dns-manager-dev/pkg/dns-manager/routing.js](../../../pkg/dns-manager/routing.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-02-02 — Partial

**Requirement (standard line 65):** Use an expandable manager group with the application's name. Its label opens Overview and reveals the group, including when another child is active; keep disclosure controls distinct from route labels and follow native menu behavior.

**Analysis:** The standalone manager label opens Overview and Zones has a separate disclosure button. Native registration also adds both home and overview entries, requiring duplicate/default-route verification; F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/navigation.js](../../../pkg/dns-manager/navigation.js); [dns-manager-dev/pkg/dns-manager/product.js](../../../pkg/dns-manager/product.js); [dns-manager-dev/pkg/dns-manager/routing.js](../../../pkg/dns-manager/routing.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-02-03 — Verified local

**Requirement (standard line 68):** Make Overview the default page and clearly indicate the active page.

**Analysis:** Fresh audit opens Overview; aria-current identifies one active page. Tests cover the visible pages and hidden editor ownership.

**Evidence:** [dns-manager-dev/pkg/dns-manager/navigation.js](../../../pkg/dns-manager/navigation.js); [dns-manager-dev/pkg/dns-manager/product.js](../../../pkg/dns-manager/product.js); [dns-manager-dev/pkg/dns-manager/routing.js](../../../pkg/dns-manager/routing.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-02-04 — Verified local

**Requirement (standard line 69):** Every manager ends with Pending Rollouts, Running Processes, Snapshots, Diagnostics, Settings, Help, in that order. Inventory pages and their dynamic resource entries precede this shared group. These common pages are specified here.

**Analysis:** The six required common pages appear in the specified ending order after Sources and Zones; the shared navigation test checks this sequence.

**Evidence:** [dns-manager-dev/pkg/dns-manager/navigation.js](../../../pkg/dns-manager/navigation.js); [dns-manager-dev/pkg/dns-manager/product.js](../../../pkg/dns-manager/product.js); [dns-manager-dev/pkg/dns-manager/routing.js](../../../pkg/dns-manager/routing.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-02-05 — Verified local

**Requirement (standard line 72):** Prefer useful flat inventory pages; use nested expandable resource groups where relevant. Avoid redundant inventories. Create/Edit routes remain hidden from the sidebar and are reached through contextual actions.

**Analysis:** Sources/Zones are flat inventories and zone children are expandable. Create/Edit routes are absent from the visible menu.

**Evidence:** [dns-manager-dev/pkg/dns-manager/navigation.js](../../../pkg/dns-manager/navigation.js); [dns-manager-dev/pkg/dns-manager/product.js](../../../pkg/dns-manager/product.js); [dns-manager-dev/pkg/dns-manager/routing.js](../../../pkg/dns-manager/routing.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-02-06 — Partial

**Requirement (standard line 75):** Dynamic resource entries use stable identities, meaningful resource labels, and the active user's access, rather than positional indexes.

**Analysis:** Zones use stable zone.id and records use owner/type/value identity, verified by identity tests. Authorization does not constrain an authenticated inventory yet; F03/F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/navigation.js](../../../pkg/dns-manager/navigation.js); [dns-manager-dev/pkg/dns-manager/product.js](../../../pkg/dns-manager/product.js); [dns-manager-dev/pkg/dns-manager/routing.js](../../../pkg/dns-manager/routing.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-02-07 — Partial

**Requirement (standard line 77):** Use compact reactive count badges in a fixed left-hand column before menu labels. Align this column across top-level and nested entries; reserve blank space when there is no count. Disclosure arrows occupy a separate slot without shifting counts. Zone/domain entries show scoped record counts. An unavailable inventory is not zero.

**Analysis:** Real browser measurements confirm aligned left count slots, including nested zones. Unavailable backend is explained by red badges, but native availability/loading contracts remain unverified; F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/navigation.js](../../../pkg/dns-manager/navigation.js); [dns-manager-dev/pkg/dns-manager/product.js](../../../pkg/dns-manager/product.js); [dns-manager-dev/pkg/dns-manager/routing.js](../../../pkg/dns-manager/routing.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-02-08 — Partial

**Requirement (standard line 81):** Relevant page header, navigation, and Overview counts share the same scoped data; header counts sit immediately after Refresh. Example values are not fixed requirements.

**Analysis:** Scoped resource totals are shared before keyword filtering. A no-match Zones search yields header 0 with navigation 4, and native pending uses unscoped drafts.length; F03/F08.

**Evidence:** [dns-manager-dev/pkg/dns-manager/navigation.js](../../../pkg/dns-manager/navigation.js); [dns-manager-dev/pkg/dns-manager/product.js](../../../pkg/dns-manager/product.js); [dns-manager-dev/pkg/dns-manager/routing.js](../../../pkg/dns-manager/routing.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-02-09 — Partial

**Requirement (standard line 83):** Keep cluster identity visible and honor Rancher's cluster and namespace context.

**Analysis:** Preview shows cluster identity and one global namespace selector; namespace-context consumes host state. Live project/access/cluster switching needs installed verification; F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/navigation.js](../../../pkg/dns-manager/navigation.js); [dns-manager-dev/pkg/dns-manager/product.js](../../../pkg/dns-manager/product.js); [dns-manager-dev/pkg/dns-manager/routing.js](../../../pkg/dns-manager/routing.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-02-10 — Not applicable

**Requirement (standard line 84):** Treat placement near Compliance as the Network Manager reference; validate ordering in the installed Rancher version rather than assuming a weight guarantees placement.

**Analysis:** The near-Compliance placement requirement is explicitly a Network Manager reference. DNS installed placement is still part of its own release verification.

**Evidence:** [dns-manager-dev/pkg/dns-manager/navigation.js](../../../pkg/dns-manager/navigation.js); [dns-manager-dev/pkg/dns-manager/product.js](../../../pkg/dns-manager/product.js); [dns-manager-dev/pkg/dns-manager/routing.js](../../../pkg/dns-manager/routing.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-02-11 — Unverified live

**Requirement (standard line 86):** Target the recorded Rancher 2.15.x / Extensions API 3 environment initially; recheck compatibility when Rancher or the extension SDK changes.

**Analysis:** Chart metadata targets Rancher 2.15.x/Extensions API 3. A clean install on that host/version has not been performed during this review; F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/navigation.js](../../../pkg/dns-manager/navigation.js); [dns-manager-dev/pkg/dns-manager/product.js](../../../pkg/dns-manager/product.js); [dns-manager-dev/pkg/dns-manager/routing.js](../../../pkg/dns-manager/routing.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-02-12 — Partial

**Requirement (standard line 88):** Embedded pages inherit Rancher's active color scheme, theme tokens, typography, host viewport, and native left navigation. Use supported extension registration and routing rather than a second sidebar or global CSS overrides. Groups, nested entries, disclosure controls, selected routes, and namespace context follow the installed Rancher's menu behavior. Preview chrome is standalone-only. Validate requested count placement and loading indicators against native menu capabilities; a preview demonstration alone does not prove native navigation support.

**Analysis:** Native Dashboard omits standalone chrome and uses scoped host-token fallbacks. Native registration, namespace behavior, count placement and host height remain unverified; F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/navigation.js](../../../pkg/dns-manager/navigation.js); [dns-manager-dev/pkg/dns-manager/product.js](../../../pkg/dns-manager/product.js); [dns-manager-dev/pkg/dns-manager/routing.js](../../../pkg/dns-manager/routing.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-02-13 — Verified local

**Requirement (standard line 95):** Display counts only when they represent a relevant inventory or operation. Help and Settings have no counts. Reuse compact left-column navigation badges for domain/zone record counts, header counts, and other relevant inventories.

**Analysis:** Settings/Help show neither navigation nor header counts. Inventory count slots and refresh-adjacent totals are present and unit-tested.

**Evidence:** [dns-manager-dev/pkg/dns-manager/navigation.js](../../../pkg/dns-manager/navigation.js); [dns-manager-dev/pkg/dns-manager/product.js](../../../pkg/dns-manager/product.js); [dns-manager-dev/pkg/dns-manager/routing.js](../../../pkg/dns-manager/routing.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-02-14 — Partial

**Requirement (standard line 98):** Use the DNS breadcrumb pattern: clickable manager name returns to Overview, followed by the current page; add clickable ancestors for nested editors where relevant. The manager title always opens Overview. Breadcrumbs and page headings use the same current route identity.

**Analysis:** Manager breadcrumb returns to Overview and the heading matches current route. Record editors lack clickable zone ancestors and all use the generic Record Draft heading; F05.

**Evidence:** [dns-manager-dev/pkg/dns-manager/navigation.js](../../../pkg/dns-manager/navigation.js); [dns-manager-dev/pkg/dns-manager/product.js](../../../pkg/dns-manager/product.js); [dns-manager-dev/pkg/dns-manager/routing.js](../../../pkg/dns-manager/routing.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-02-15 — Verified local

**Requirement (standard line 101):** Zones is expandable/collapsible, with zone entries nested beneath it and record-count badges. Clicking its label opens the inventory; a separate arrow toggles children. Preserve active page, persisted order, counts, and expansion preference. Other inventory groups may use the same relevant pattern.

**Analysis:** Zones label and separate disclosure work; persisted order/expansion restore, child counts and active group selection are tested in the local UI.

**Evidence:** [dns-manager-dev/pkg/dns-manager/navigation.js](../../../pkg/dns-manager/navigation.js); [dns-manager-dev/pkg/dns-manager/product.js](../../../pkg/dns-manager/product.js); [dns-manager-dev/pkg/dns-manager/routing.js](../../../pkg/dns-manager/routing.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-02-16 — Partial

**Requirement (standard line 105):** Every page-changing interaction synchronizes the active navigation item, including metric cards, grid/resource links, breadcrumbs, contextual Help, and editor actions. Hidden Create/Edit routes select their owning visible inventory item. Navigating to a child reveals its menu group; manual collapse may highlight the owning group while retaining the active child page. Do not highlight multiple unrelated items.

**Analysis:** Preview navigation synchronizes cards, editor parent and Open Help; tests verify one selected owner. Native menu synchronization awaits installation; F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/navigation.js](../../../pkg/dns-manager/navigation.js); [dns-manager-dev/pkg/dns-manager/product.js](../../../pkg/dns-manager/product.js); [dns-manager-dev/pkg/dns-manager/routing.js](../../../pkg/dns-manager/routing.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-02-17 — Partial

**Requirement (standard line 110):** A count badge is red whenever a required dependency in that inventory/page scope is missing, unconfigured, unavailable, or failing. Explain the concrete blocking condition in its accessible description and tooltip, even when the item count is zero. Preserve the count's original meaning; do not substitute an incident total for a zone/record/item count. Optional or merely pending verification retains its appropriate separate state. Hiding a banner must not hide this required-failure indication. Diagnostics retains its warning/error event-count meaning.

**Analysis:** Required-backend failures make even zero badges red with concrete descriptions; hiding the banner retains them. Native product registration does not consume failure severity; F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/navigation.js](../../../pkg/dns-manager/navigation.js); [dns-manager-dev/pkg/dns-manager/product.js](../../../pkg/dns-manager/product.js); [dns-manager-dev/pkg/dns-manager/routing.js](../../../pkg/dns-manager/routing.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-02-18 — Partial

**Requirement (standard line 117):** Loading is a separate count-badge state: show a small spinner in the fixed count slot while the associated data is pending, rather than temporarily marking it red because readiness is not yet known. Preserve the last known count in its accessible description. Once the request resolves, show the actual count and health severity; a timeout/confirmed required failure is red. Keep the spinner aligned with other count badges and respect reduced-motion preferences.

**Analysis:** Delayed observation reads show aligned spinners after 300 ms, preserve known counts, and clear on failure/cancellation. Native navigationState.phase is not wired and snapshot reads bypass this state; F03/F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/navigation.js](../../../pkg/dns-manager/navigation.js); [dns-manager-dev/pkg/dns-manager/product.js](../../../pkg/dns-manager/product.js); [dns-manager-dev/pkg/dns-manager/routing.js](../../../pkg/dns-manager/routing.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).

## 3. Page shell, layout, and styling

### RPD-03-01 — Partial

**Requirement (standard line 126):** The user's Network Manager screenshots define the shared layout, spacing, color, and presentation reference for every plugin page: [inventory grid](../../../../docs/design-reference/network-manager-port-configurations.png) and [Overview master/detail](../../../../docs/design-reference/network-manager-overview.png). Use the grid pattern for inventories and the master/detail pattern where useful; retain their common heading, status area, filters, panels, and aligned bottom edge. Screenshot data/counts are examples, not requirements to reproduce those values.

**Analysis:** Most inventory pages reproduce the reference dark panels, heading, fixed filters and bottom edge. Snapshot controls, mobile content allocation and separate styling deviate; F07/F11.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-02 — Verified local

**Requirement (standard line 132):** Reuse one page shell across pages and across the standalone preview/native extension.

**Analysis:** Dashboard.vue is reused by standalone Preview.vue and native routes; all visible pages share its heading/status/action containers.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-03 — Verified local

**Requirement (standard line 133):** Show manager name and cluster context, a clear page heading, a compact Help control, page-level actions, refresh controls, and an item count where useful.

**Analysis:** Heading, cluster context, circled Help, actions, Refresh Every/countdown and relevant totals are present. Help/Settings correctly omit totals.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-04 — Partial

**Requirement (standard line 135):** Put all page actions, including Save/Save Draft, Test Connection, Cancel, selection-dependent actions, and manual refresh, in the top-right heading action row beside Refresh Every and its countdown. Modal confirmation controls remain within their dialog. Buttons in a group share width/height, padding, icon sizing, and alignment. Do not duplicate the page title inside its panel; retain distinct section headings where they communicate a separate subject.

**Analysis:** Source/record/settings actions are moved to the heading. Merge Next/Back/Cancel and restoration preparation remain content/footer controls; F12.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-05 — Verified local

**Requirement (standard line 140):** Top-right actions that operate without a grid selection may appear whenever applicable. Any action that requires selected grid items stays hidden until items are explicitly selected; hide it again immediately when selection is cleared. This applies to Reorder, Delete, and every other selection-dependent operation, including applicable Merge, Apply, Reconfigure, Rescan, or Snapshot actions. Do not show a disabled button merely because no items are selected. Once items are selected, other unmet prerequisites may disable the action with an explanation. Create/New, Refresh, and editor actions use their own applicable context when they do not require grid selection.

**Analysis:** Sources, Zones and record Delete actions are hidden before selection and disappear when cleared. Snapshot Delete/Merge are likewise selection-driven.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-06 — Gap

**Requirement (standard line 149):** Align heading actions with the primary title. New, Merge, Apply, and conditional red Delete share one font, icon size, and button height. The Network Manager reference uses 14 px text, 18 px SVGs, and 40 px buttons; Refresh stays icon-only.

**Analysis:** Main action SVGs are 16 px instead of 18 px; snapshot New lacks plus and snapshot Delete is blue. Selected snapshot actions wrap below the title at desktop width; F07/F11.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-07 — Partial

**Requirement (standard line 152):** Buttons within the same action group share dimensions, icon size, padding, font, border radius, and alignment. Use a common width for adjacent labeled actions sized for the longest label; changing primary/danger/secondary styling must not change geometry. Icon-only groups use consistent square hit areas, and their icons and controls align with neighboring actions.

**Analysis:** Main adjacent labeled buttons are equalized and measured. Snapshot/password dialogs use different geometry; Cancel and Create Snapshot have unequal widths; F07.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-08 — Gap

**Requirement (standard line 157):** Match Network Manager's shared buttons and refresh controls exactly by reusing its components and styles. Place Refresh Every, countdown, manual Refresh, and item count in the top-right heading action area, never in the filter/content row.

**Analysis:** DNS implements separate string-template actions and CSS rather than reusing Network components/styles; snapshot actions introduce another style system. Shared refresh location is correct; F07.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-09 — Partial

**Requirement (standard line 160):** Position the item count immediately right of Refresh. Hover/focus help must render above navigation and avoid clipping; use a body overlay with bounded placement rather than click-only explanations.

**Analysis:** Count sits after Refresh. Context help is click-only rather than hover/focus, and namespace/date controls have distinct popover behavior; F09.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-10 — Partial

**Requirement (standard line 163):** Contextual Help/More Info uses an accessible circled question mark immediately beside its title, field, column, or status. Open a popup with Close and Open Help; reuse the relevant Help section. Open Help navigates to and expands that section. The Help page itself has no question-mark controls.

**Analysis:** Circled controls open a dialog with Close/Open Help and expand the guide. Help itself has none. Most fields/columns lack specific help and snapshot gate text remains inline; F09/F12.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-11 — Partial

**Requirement (standard line 167):** Keep the heading, status information, and filters outside the scrolling content area.

**Analysis:** Main filters/status are outside grid scrollers at desktop size. On 480 px Diagnostics, fixed prose consumes the remaining height and pushes filters below the visible viewport; F11.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-12 — Partial

**Requirement (standard line 168):** Fill the available viewport. Panels extend to the available bottom edge instead of stopping at an arbitrary content height.

**Analysis:** Inventory panels extend to the bottom edge. Running Processes uses a short placeholder, and snapshot/mobile allocations leave unusably small content regions; F11/F16.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-13 — Partial

**Requirement (standard line 170):** The available viewport height is also the outer shell's maximum height. Account for Rancher's host chrome in native mode and the preview chrome in standalone mode; additional content must not expand the document into vertical page scrolling.

**Analysis:** All 39 primary viewport measurements show no document overflow. Native host-chrome sizing was not verified, and lack of overflow alone does not prove usable internal space; F11/F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-14 — Verified local

**Requirement (standard line 173):** Use internal panel scrolling. In a master/detail view, align both panels to the same bottom edge; the list scrolls independently, and details scroll when content exceeds the panel.

**Analysis:** DNS uses the permitted Summary arrangement with internally scrolling panels. It has no two-column master/detail view requiring paired bottom alignment.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-15 — Partial

**Requirement (standard line 175):** Bound overflowing inventories, forms, and detail content to the remaining panel height and use the shared custom scrollbar styling. Keep headings, actions, and filters visible while that content scrolls.

**Analysis:** Grids/forms/Help scroll internally with fixed heading controls. Snapshot schedules shrink to very short scroll areas and mobile Diagnostics effectively loses its log viewport; F11.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-16 — Verified local

**Requirement (standard line 178):** Use `min-height: 0` / `min-width: 0` behavior in flex/grid content so long inventories do not push the shell beyond the viewport. Keep scrollbar gutters stable where appropriate.

**Analysis:** The shell and content use min-height/min-width zero and stable gutters. Geometry checks confirm the outer viewport remains bounded across three widths.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-17 — Gap

**Requirement (standard line 180):** Adapt layouts at smaller widths without clipping actions, filters, or dialogs.

**Analysis:** Mobile Overview leaves only a sliver for its panels, Diagnostics filters/logs fall below available space, and Snapshots loses usable history/storage space. Actions staying on-screen is insufficient; F11.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-18 — Partial

**Requirement (standard line 181):** Use consistent card borders, rounded corners, spacing, input heights, and form alignment. Align controls even when labels wrap onto multiple lines.

**Analysis:** Source/record forms align fields and standard 40 px controls. Snapshot password inputs render substantially taller and snapshot/date filters have uneven vertical layout; F07/F11.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-19 — Partial

**Requirement (standard line 183):** Inherit Rancher's active theme, tokens, typography, and host viewport in embedded pages; scope styles to the plugin. Standalone previews use the observed compact Network Manager dark presentation as their fallback.

**Analysis:** Scoped CSS consumes Rancher variables and standalone fallback colors. Native light/dark theme and host viewport integration are unverified; F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-20 — Verified local

**Requirement (standard line 186):** Use thin dark scrollbars matching the panels. Preserve operating-system forced-color choices.

**Analysis:** Scoped thin dark scrollbar rules include forced-color handling; rendered inventory/Help scrollbars match the panels. Forced-color OS mode was source-checked, not visually activated.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-21 — Verified local

**Requirement (standard line 187):** Keep collapsed sections visually connected with one divider between adjacent sections.

**Analysis:** Help and zone replication disclosures remain connected to their panels with dividers; expanded replication and Help were visually checked.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-22 — Gap

**Requirement (standard line 188):** Use title case for button and status labels. Keep explanatory text concise and practical.

**Analysis:** Snapshot gate labels contain visible mojibake (â€”, â€¦) and sentence-case actions. Lower-case pending kinds/status descriptions also break consistent presentation; F07.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-23 — Partial

**Requirement (standard line 189):** Use green for verified good/ready states, amber for pending/partial states, red for failures, and neutral styling for unknown or inapplicable states. Pair color with a readable label.

**Analysis:** Required failures use red/amber labeled surfaces and sample states explicitly say Sample. Enabled/disabled schedule badges are readable; unknown/loading schedule state is not distinct; F07/F11.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-24 — Verified local

**Requirement (standard line 191):** Status banners tint the entire banner background for their severity, matching Network Manager's full-width coverage notices. Pending/partial verification uses the amber/yellow warning surface, not only amber text or a colored border; errors use the corresponding error surface. Preserve readable contrast in both themes.

**Analysis:** Overview warning and backend error use full amber/red tinted backgrounds with readable text; screenshots confirm severity surfaces.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-25 — Partial

**Requirement (standard line 195):** Keep badges and attachment counts compact and on one line. Enlarged badges should have a deliberate purpose rather than making every status compete with the page heading.

**Analysis:** Desktop badges are compact; tablet Disabled schedule badges wrap across two lines, violating the one-line rule; F07/F11.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-26 — Verified local

**Requirement (standard line 197):** Use the whole amber warning background for pending/partial verification. Management backend unavailable is a full red error banner. Each top-of-page banner type has its own Settings visibility checkbox; hiding a banner does not change status or authorize writes.

**Analysis:** Amber failover and red backend notices have independent Settings controls. Hiding them does not enable Apply or clear the required-failure badges.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-27 — Partial

**Requirement (standard line 200):** Every yellow/amber warning or red error notification at the top of a page is clickable and keyboard accessible. Open the exact affected item's Create, Edit, or repair workflow directly, so the user can create, update, or fix it. Preserve cluster, namespace, resource identity, and relevant filter; select/reveal the item and prefill known context where applicable. Missing configuration opens its Create/setup flow; existing invalid configuration opens its Edit/fix flow. Multiple affected items open the scoped issue list with direct per-item fix actions. When the correction is external or no editor exists, open that item's specific diagnostic/recovery instructions. Avoid generic landing pages when a direct destination exists. Navigation must retain normal draft, authorization, review, snapshot, and confirmation gates; clicking the notification does not apply a fix. Other top-of-page alerts also open their relevant item/view or guide section.

**Analysis:** Failover opens its specific Diagnostics instructions and backend error opens source Edit/Test Connection (or Create if missing). Request-failure and reorder warning surfaces do not implement direct repair navigation; F18.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).
### RPD-03-28 — Partial

**Requirement (standard line 220):** The authenticated visual reference is `https://rancher.cormierconsulting.io`. Read-only inspection on 2026-10-11 found Lato 14 px typography and active tokens: body `#25282f`, body text `snow`, box `#171c22`, input `#25282f`, border `#38404b`, muted `#8f8f9c`, primary `#2f68df`, link `#9bbffd`. Embedded views consume these tokens dynamically; standalone previews use the observed theme as their fallback. Keep the normal host menu's group label and disclosure control separate, selected route behavior synchronized, and group expansion consistent with Rancher. Store this reference and observations, never credentials or copied authentication tokens.

**Analysis:** Standalone colors/font align with the recorded reference. This review did not authenticate to the live Rancher visual reference or prove dynamic native token behavior; F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue](../../../pkg/dns-manager/pages/Dashboard.vue); [dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json](layout-evidence.json); [dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json](visual-evidence.json).

## 4. Inventory, search, filters, and tables

### RPD-04-01 — Partial

**Requirement (standard line 231):** Use automatic grid column widths. Only actual selection columns use narrow fixed widths; text columns must not inherit those widths. Align text and its header left, numeric values and their headers right. Counts, priority, TTL, and sizes use numeric sorting/alignment.

**Analysis:** Main grids right-align priority/records/TTL with numeric sorting and narrow checkbox columns. Browser measurements show snapshot numeric cells/header alignment is inconsistent; F07.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-02 — Verified local

**Requirement (standard line 234):** Sort file sizes by original bytes; use decimal B, KB, MB, GB, and TB units.

**Analysis:** Shared snapshot DataGrid sorts data-sort bytes rather than formatted labels; UI test preserves detail adjacency. file-size uses decimal units.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-03 — Partial

**Requirement (standard line 236):** Provide an Overview summary plus searchable inventory and selected-resource details.

**Analysis:** Summary and searchable zone/resource inventories exist. Sources/records lack read-only row details; record activation only supports an edit pencil; F05.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-04 — Partial

**Requirement (standard line 237):** Use Rancher's existing top-level multi-select namespace filter as the single namespace control for embedded pages. Omit duplicate page-level namespace selectors and filter every inventory, overview, diagnostics view, operation, and relevant count from the host context directly. Match namespace/project/user/system/cluster scopes. Combine namespace selections as OR, with other page filters as AND. The standalone preview supplies one global namespace control in its simulated host header. Verify the native store contract.

**Analysis:** One global preview namespace picker and host namespace-context module are present, with OR scope matching. Live store/project/permission contract has not been exercised; F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-05 — Gap

**Requirement (standard line 243):** Use searchable multi-select filters with a selected count, clear-selection action, and an understandable empty/default label. Dismiss popovers on Escape or outside interaction.

**Analysis:** Global namespace choices are searchable/multiple, but record type, zone type, severity and log source are single selects without selected-count/Clear Selection; F04.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-06 — Partial

**Requirement (standard line 245):** Combine selections with OR inside one filter and AND across different filter groups.

**Analysis:** Namespace choices combine with OR and keyword/type filters use AND. Other required multi-select groups cannot express multiple selections; F04.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-07 — Partial

**Requirement (standard line 246):** Include plugin-specific filters such as protocol, service/port configuration, zone, record type, component, severity, or generation source when applicable.

**Analysis:** Zone/record type and Diagnostics source/severity exist. Snapshot generation is searchable text only, with no dedicated Manual/Automatic filter; F04.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-08 — Verified local

**Requirement (standard line 248):** Search names and relevant identifiers, labels, destinations, and values. Document domain-specific search behavior in the plugin standard.

**Analysis:** Zone search covers names, kind, namespace, source and record values; record search covers owner/type/value. DNS semantics are in its separate design specification.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-09 — Partial

**Requirement (standard line 250):** Show a Namespace column when namespace is part of the resource's identity; do not redundantly embed it in the displayed name. Show shared resources as Global.

**Analysis:** Zones and logs expose Namespace and Global where applicable. Pending uses a generic scope and snapshots compress namespaces into Scope; F08/F12.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-10 — Partial

**Requirement (standard line 252):** Default configuration inventories to a flat list. Offer Group By Namespace where useful, placing Global first. Preserve shared configuration availability within relevant scopes.

**Analysis:** Main configuration lists default flat and snapshot Group By Namespace exists. Its namespace grouping sorts lexically with Global first; other useful grouping is absent rather than fabricated.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-11 — Partial

**Requirement (standard line 254):** Use a shared grid with sortable labeled columns, visible direction, numeric-aware comparisons, and accessible sort state. Do not sort selection/action columns.

**Analysis:** Main tables provide accessible sort state and numeric comparisons. The outer imperative decorator also re-decorates snapshot Vue tables, making Actions sortable and overriding shared header behavior; F07.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-12 — Verified local

**Requirement (standard line 256):** Keep expanded detail rows attached to their parent during sorting and preserve group boundaries.

**Analysis:** Shared DataGrid tests keep expanded detail rows with their parent and preserve group boundaries; DNS core grids do not currently expose expanded row details.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-13 — Verified local

**Requirement (standard line 257):** Retain headers on an empty grid and show a clear empty/no-matches message.

**Analysis:** Empty Pending and filtered Zones retain headers and a clear No Matching/No Results message. Unit and visual checks cover these states.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-14 — Gap

**Requirement (standard line 258):** Clicking a configuration row opens read-only details. Action icons and selection checkboxes must not also toggle or select the row accidentally.

**Analysis:** Source name opens Edit directly; record-row text has no activation handler or read-only details. Selection/pencils avoid accidental navigation; F05.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-15 — Partial

**Requirement (standard line 260):** Keep row action icons right-aligned, horizontal, and unwrapped, with consistent compact hit areas, tooltips, accessible names, and visible keyboard focus.

**Analysis:** Main pencil/chevron actions are compact, right-aligned, named and keyboard focusable. Snapshot actions use larger blue controls and wrapping/alternate styling; F07.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-16 — Verified local

**Requirement (standard line 262):** Add selection checkboxes and Select All only to full inventory grids with meaningful selection actions. Compact/embedded tables, summary panels, cards, and detail lists do not gain checkboxes merely to make them selectable. Use normal row/card activation for details; when selecting in a full grid, apply the displayed scope.

**Analysis:** Checkboxes occur in full inventories and restoration/merge selection grids. Compact Overview tables and cards remain activation-only without selection boxes.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-17 — Partial

**Requirement (standard line 266):** Explicit grid selection reveals applicable selection-dependent contextual buttons in the top-right page action area, including Reorder and Delete. Hide them with no selected items; merely opening/highlighting a details-only row is not grid selection. Hide inapplicable actions and explain other unmet prerequisites when disabling an action for an existing selection. Derive the action's affected scope from the explicit selection and show it in review; never silently affect unselected resources. Contextual buttons use the same dimensions, icon size, padding, and alignment as neighboring actions. Selecting a details-only row must not implicitly authorize a mutation.

**Analysis:** Explicit selection reveals heading actions and Delete review shows selected IDs. Reorder explicitly reviews the whole collection, as its exception permits. Snapshot geometry and some live scope validation remain incomplete; F07/F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-18 — Partial

**Requirement (standard line 275):** Use the DNS Manager preview's native checkbox presentation as the shared checkbox reference, superseding older Network Manager checkbox styling. Use real checkbox inputs with consistent size, theme, selection-column placement, spacing, and vertical alignment in headers and rows; do not substitute decorative checkbox icons. Keep checked, unchecked, disabled, focus, and partial-selection states clear. Select All reflects the displayed authorized scope and is indeterminate for a partial selection. Give every checkbox an accessible label and preserve keyboard interaction; selecting it must not also open row details. Reorder mode replaces these controls with handles according to the shared ordering standard.

**Analysis:** Native checkbox inputs, accessible labels and partial Select All work in main grids and tests. Snapshot Select All uses a separate computed implementation without a partial indicator; F07.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-19 — Partial

**Requirement (standard line 284):** Review the exact affected resources before a bulk delete; preserve unrelated objects and Secrets.

**Analysis:** Managed Delete review identifies selected IDs and stages a proposal, never live deletion. Live exact-resource/Secret preservation needs authoritative backend validation; F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-20 — Gap

**Requirement (standard line 285):** Distinguish observed resources, working drafts, validated pending proposals, and examples in both labels and counts. Inferred associations must not be presented as durable ownership.

**Analysis:** Examples are labeled but incomplete and validated drafts both render Draft · Not Applied; observed status and working changes are not fully distinguished; F02.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-21 — Partial

**Requirement (standard line 287):** Match the user's [filter-row reference](../../../../docs/design-reference/network-manager-filter-row.png): labels above the controls, consistent control height/borders/padding, a leading disclosure arrow for multi-select namespace choices, and evenly spaced columns aligned along their control bottoms. Diagnostics orders these as Search, Lookback (hours), Log source, Severity on one row when space permits. Controls fill their columns and wrap responsively rather than clipping or changing size.

**Analysis:** Desktop Diagnostics orders Search, Lookback, Log source, Severity with aligned control bottoms. Snapshot date label/control sits higher than adjacent filters, and mobile layouts lose content space; F11.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-22 — Verified local

**Requirement (standard line 300):** Put **Reorder** in the top-right page action area when manual ranking is supported and grid items are selected, following the shared selection-dependent visibility rule. Delete follows the same rule; Create remains independent of selection.

**Analysis:** Reorder/Delete appear in the heading only after explicit Zones selection; Create stays independent. Selection UI tests cover show/clear behavior.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-23 — Verified local

**Requirement (standard line 303):** Normal mode shows row selection checkboxes; Reorder appears only with an explicit selection. Entering reorder mode replaces every row's selection checkbox with a drag handle and removes the Select All control. Selection enables entry into the ordering workflow; the complete authorized collection remains its reviewed scope.

**Analysis:** Reorder replaces all checkboxes with handles and removes Select All; the full collection is shown in applied priority order.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-24 — Verified local

**Requirement (standard line 307):** Clicking Reorder hides the Reorder button and shows Cancel in that action area. Create/Delete and bulk selection are unavailable while ordering is being edited.

**Analysis:** Reorder hides its own button and Create/Delete, exposing Cancel in the same heading area. No bulk selection remains.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-25 — Verified local

**Requirement (standard line 309):** Entering reorder mode alone does not show Save. Show Save beside Cancel only when the proposed order differs from the persisted order. Moving rows back to the original order hides Save again.

**Analysis:** Save is absent on entry, appears after ArrowDown changes the proposal, and is hidden when the order returns to its original state.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-26 — Partial

**Requirement (standard line 311):** Support drag-and-drop ordering and a keyboard-accessible equivalent using the same handles. Show the intended drop position and keep the moved row's details attached to it.

**Analysis:** Whole-row draggable handlers and keyboard handle arrows exist; keyboard movement is visually/unit checked. Real pointer drag/drop was source-inspected but not exercised during this audit.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-27 — Partial

**Requirement (standard line 313):** During reorder mode, the whole row is a drag target: users can grab it anywhere, not only by its handle. Keep the handle as a visual cue and keyboard control; suppress normal row navigation/selection while dragging and retain Cancel/Save semantics.

**Analysis:** Rows carry draggable/data-drag and suppress normal navigation during ordering. Pointer grab/drop behavior was not visually exercised; keyboard ordering was.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-28 — Partial

**Requirement (standard line 316):** Capture the persisted order and its revision on entry, and edit a separate local proposal. Dropping a row changes only that proposal; it must not write through automatically.

**Analysis:** The proposal copies applied stable IDs and stages a revision. Only browser/project revision exists; no authoritative backend order revision yet; F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-29 — Partial

**Requirement (standard line 318):** Reorder the complete authorized collection in persisted priority order. Suspend table sorting, grouping, filtering, and pagination that would conceal or rearrange members during editing; do not silently renumber rows outside the user's writable scope.

**Analysis:** Reorder displays the complete local collection and removes filtering/sorting controls. An authorized writable collection cannot yet be proven without the backend; F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-30 — Verified local

**Requirement (standard line 321):** Cancel discards the proposed order, restores the persisted order and normal controls, and writes neither ordering configuration nor a rollout. Existing selection/view context may be restored for items that still exist. Guard navigation away from a changed proposal like any other form.

**Analysis:** Cancel clears the proposal without adding a rollout or changing applied order. Unsaved navigation presents the common leave dialog.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-31 — Gap

**Requirement (standard line 324):** Refresh may update status information but must not replace a proposed order. If membership, permissions, or the persisted revision changes, mark the proposal conflicted and require review against the current collection before saving; never silently overwrite concurrent changes.

**Analysis:** Refresh preserves the proposal but observations never reconcile inventory/revision/membership. No live conflict marking or review against a changed collection exists; F03/F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-32 — Partial

**Requirement (standard line 327):** Save reviews the previous/proposed order and affected scope, then stages the ordering draft in Pending Rollouts. Apply there uses the standard snapshot flow: validate or capture a recent matching snapshot of persisted configuration, confirm storage, recheck coverage/revision, and persist the complete ordering configuration through the backend. Include stable IDs, order/ranks, scope, and revision.

**Analysis:** Save reviews previous/proposed order and stages IDs/scope/revision in Pending. Apply/snapshot/revision validation and durable ordering are unavailable; F03/F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-33 — Partial

**Requirement (standard line 332):** Use the existing 24-hour/full-coverage snapshot requirement for this configuration change. A browser-only reorder is not a successful save. Capture the old order, not the unsaved proposal, as the pre-change recovery state; store the proposed order separately in the change record.

**Analysis:** Snapshot capture takes applied order separately from pending drafts. The local gate checks scope/age, but no ordering execution endpoint enforces it; F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-34 — Partial

**Requirement (standard line 335):** While saving, prevent duplicate submission and further dragging. Leave the proposal available with an error if validation, backup, or persistence fails. Do not report success before backend acknowledgment.

**Analysis:** Local staging returns synchronously and preserves applied state. Duplicate prevention, dragging locks and backend failure recovery at execution are unverified; F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).
### RPD-04-35 — Partial

**Requirement (standard line 337):** After staging Save, return to normal mode, restore checkboxes, and recalculate action visibility from the current selection; Reorder/Delete stay hidden when nothing is selected. Hide Save/Cancel; active navigation retains the applied order. Update navigation only after Apply confirms persistence. The applied order must survive reloads and manager/backend restarts and be included in snapshot restoration.

**Analysis:** After staging, normal controls return and active navigation stays applied. Local saved order restores, but durable backend persistence/restoration acceptance remains missing; F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue](../../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts).

## 5. Overview and resource details

### RPD-05-01 — Verified local

**Requirement (standard line 354):** Support two Overview design variants within the shared shell: **Summary** (DNS Manager's metric cards followed by flow/status and summary panels) and **Master/Detail** (Network Manager's metric cards and filters above a left selectable inventory and right details panel). These are reusable design patterns, not a requirement for an application to offer a runtime layout switch. Keep the current DNS Summary arrangement; choose the variant appropriate to the application.

**Analysis:** DNS retains the specified Summary variant: metric cards, configured flow/status and summary sections in the shared shell.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/36-overview-lower.png](screenshots/36-overview-lower.png).
### RPD-05-02 — Partial

**Requirement (standard line 360):** Each Overview variant supports keyword search across relevant names, namespaces, and identifiers, and consumes the single host namespace filter from section 4.

**Analysis:** Overview keyword search and global namespace filtering are present. Source/DNS instance summaries are not all keyword filtered consistently; F03.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/36-overview-lower.png](screenshots/36-overview-lower.png).
### RPD-05-03 — Partial

**Requirement (standard line 362):** Use compact statistic cards for actionable inventory, errors, related resources, and pending changes.

**Analysis:** Source/Zone/DNS instance cards exist; errors and pending changes lack equivalent actionable statistic cards; F02/F08.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/36-overview-lower.png](screenshots/36-overview-lower.png).
### RPD-05-04 — Partial

**Requirement (standard line 363):** Clicking an actionable card opens the corresponding page with the relevant filter.

**Analysis:** Sources and Zones cards navigate correctly. DNS Instances is a static noninteractive card and warning/pending scope cards are absent; F05.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/36-overview-lower.png](screenshots/36-overview-lower.png).
### RPD-05-05 — Gap

**Requirement (standard line 364):** Overview exposes resumable working drafts and validated pending changes distinctly.

**Analysis:** Working Drafts & Snapshots shows a count only, with no resume controls or distinction from validated pending changes; F02.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/36-overview-lower.png](screenshots/36-overview-lower.png).
### RPD-05-06 — Verified local

**Requirement (standard line 365):** Present the configured flow and resource context together where the application has a flow. Do not imply configured references prove successful traffic or service availability.

**Analysis:** DNS Request Path and Source & Fallback show configuration while labeling serving/replication Sample and Live Connection Unverified. They do not claim live evidence.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/36-overview-lower.png](screenshots/36-overview-lower.png).
### RPD-05-07 — Partial

**Requirement (standard line 367):** Resource context includes namespace, owning application/controller, and applicable change state.

**Analysis:** Namespace, source and instance context is visible. Owning controller/application and actual change-state context are not supplied by a live adapter; F03/F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/36-overview-lower.png](screenshots/36-overview-lower.png).
### RPD-05-08 — Partial

**Requirement (standard line 368):** Link Kubernetes resources to their native Rancher detail pages in the active cluster.

**Analysis:** rancherLink supports configured preview origin and active cluster parameter. Native workload/service/resource detail resolution remains incomplete and unverified; F05/F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/36-overview-lower.png](screenshots/36-overview-lower.png).
### RPD-05-09 — Partial

**Requirement (standard line 369):** Namespace, workload, pod, Service, node, Secret-reference, and other Rancher resource references are clickable native detail links wherever a destination can be resolved. Use active cluster context and stable resource identity; standalone previews use the configured Rancher URL. Disclose unavailable destinations rather than rendering misleading links; show Secret metadata only.

**Analysis:** Namespace references disclose missing Rancher URL. Source/instance/node/Secret reference names do not all become resolvable native detail links; F05.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/36-overview-lower.png](screenshots/36-overview-lower.png).
### RPD-05-10 — Partial

**Requirement (standard line 374):** Deep links into history/snapshots retain the selected resource scope and provide Clear Filter.

**Analysis:** Snapshot history-context supports selected scope/Clear Filter, but DNS resource pages expose no history deep-link controls; F06.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/36-overview-lower.png](screenshots/36-overview-lower.png).
### RPD-05-11 — Verified local

**Requirement (standard line 375):** Use collapsible detail sections to keep the default view readable; define domain-specific sections and their default expansion in the plugin standard.

**Analysis:** Replication Details and Lookup Policy are collapsed by default; Help sections collapse/expand. DNS owns these subject-specific disclosure semantics.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/36-overview-lower.png](screenshots/36-overview-lower.png).
### RPD-05-12 — Not applicable

**Requirement (standard line 377):** Open concrete HTTP/HTTPS address links in a new tab. Wildcards, regular expressions, raw TCP/SNI, and UDP addresses are references, not fabricated web URLs.

**Analysis:** These DNS pages present IP/domain references, not HTTP/HTTPS endpoint launch actions. No fabricated web URL is created for DNS/TCP/UDP values.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/36-overview-lower.png](screenshots/36-overview-lower.png).
### RPD-05-13 — Not applicable

**Requirement (standard line 379):** Show internal Service addresses and forwarded endpoint addresses separately; resolve named ports from actual metadata, bracket IPv6 addresses, and explain unavailable/headless addresses.

**Analysis:** Forwarded application endpoints and named Service ports are Network routing behavior; DNS correctly shows its configured source/DNS hops as references.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/36-overview-lower.png](screenshots/36-overview-lower.png).
### RPD-05-14 — Partial

**Requirement (standard line 381):** Address display is not a reachability check. Show the observation time/source when applicable.

**Analysis:** Sample and Unverified labels distinguish addresses from reachability. Fixed transfer age and static cards lack per-observation source/time; F03/F08.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/36-overview-lower.png](screenshots/36-overview-lower.png).

## 6. Forms and working drafts

### RPD-06-01 — Partial

**Requirement (standard line 385):** Reuse form spacing, labels, help, validation feedback, and action placement across editors.

**Analysis:** Source/record forms reuse labels/spacing and heading actions. Zone creation is broken and record-specific validation/help is missing; F01/F15.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/29-zone-create.png](screenshots/29-zone-create.png).
### RPD-06-02 — Gap

**Requirement (standard line 386):** Start each new-resource editor with a clean form. Preserve context for intentional edits.

**Analysis:** Source and record new forms are clean, but zone:new is matched by the zone-detail branch first and shows Zone unavailable instead of its editor; F01.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/29-zone-create.png](screenshots/29-zone-create.png).
### RPD-06-03 — Verified local

**Requirement (standard line 387):** Keep immutable identity fields locked on existing resources.

**Analysis:** Existing source name and existing record owner/type are locked; edit screenshots and unit tests establish immutable identity behavior.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/29-zone-create.png](screenshots/29-zone-create.png).
### RPD-06-04 — Verified local

**Requirement (standard line 388):** Retain user-entered names and overrides. Provide an explicit Use Suggested Name action rather than overwriting a customized name when another selection changes.

**Analysis:** Changing any of seven new record types retains customized name/value. There is no automatic naming overwrite or suggestion requiring an alternate action.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/29-zone-create.png](screenshots/29-zone-create.png).
### RPD-06-05 — Partial

**Requirement (standard line 390):** Populate dependent selectors from inventory and the selected profile/scope.

**Analysis:** Writable source derives from the single available integration; choices remain fixed/singular and do not represent live authorized dependent inventory; F03/F15.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/29-zone-create.png](screenshots/29-zone-create.png).
### RPD-06-06 — Not applicable

**Requirement (standard line 391):** Inline Add actions may create related drafts; distinguish these from persisted live resources.

**Analysis:** DNS currently exposes no inline Add-related editor. Its hidden contextual source/record editors stage local changes distinctly.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/29-zone-create.png](screenshots/29-zone-create.png).
### RPD-06-07 — Gap

**Requirement (standard line 392):** Validate dependencies, incompatible options, missing references, and conflicting mappings before creating a rollout proposal. Repeat authoritative validation on the server before writes.

**Analysis:** Forms check basic required fields/TTL minimum only; DNS syntax, mapping conflicts, missing references and authoritative server validation are absent; F15/F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/29-zone-create.png](screenshots/29-zone-create.png).
### RPD-06-08 — Partial

**Requirement (standard line 394):** Offer Save Draft And Leave, Discard Changes, and Stay On This Page when navigation would lose unsaved changes. Cover both the plugin's controls and native Rancher route changes.

**Analysis:** Plugin controls and beforeRouteLeave expose Stay/Save Draft And Leave/Discard. The preview leave flow is tested; native routing and every snapshot-editor path need integration proof; F12/F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/29-zone-create.png](screenshots/29-zone-create.png).
### RPD-06-09 — Gap

**Requirement (standard line 396):** Allow incomplete working drafts to be resumed from Overview. Explain their persistence lifetime.

**Analysis:** needsCompletion is saved but never resumeable from Overview or Pending. Persistence text still says browser-stored despite project-file preview storage; F02.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/29-zone-create.png](screenshots/29-zone-create.png).
### RPD-06-10 — Partial

**Requirement (standard line 397):** Keep Cancel beside the other form actions as an outlined/secondary button.

**Analysis:** Main Cancel is beside Save and styled secondary. Password-modal Cancel uses the same blue primary styling as submit; F07.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/29-zone-create.png](screenshots/29-zone-create.png).
### RPD-06-11 — Verified local

**Requirement (standard line 398):** Refresh must preserve field values, active drafts, selection, and the editor instance.

**Analysis:** Manual refresh retains the actual source editor node and entered values; ordering proposal survives refresh. Tests verify the editor instance rather than a replacement.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/29-zone-create.png](screenshots/29-zone-create.png).
### RPD-06-12 — Verified local

**Requirement (standard line 399):** Distinguish saving a draft from publishing/applying it. Disable live actions without a working, authenticated backend; saving local state must not claim a live resource was changed.

**Analysis:** Save Draft stages preview:true changes and review labels live Apply unavailable. Apply remains disabled and no local save claims Windows/Kubernetes mutation.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/29-zone-create.png](screenshots/29-zone-create.png).
### RPD-06-13 — Partial

**Requirement (standard line 401):** Integration editors that configure a connection provide **Test Connection** using the current unsaved settings. Show the tested scope, result, and observation time; invalidate the result when connection settings change. Distinguish network reachability from authentication and the required service operations. Testing does not save or mutate managed configuration, and a missing backend cannot report a successful test.

**Analysis:** Test Connection reads unsaved host/address/reference, shows time and Not Verified, and invalidates on edits. Backend reachability/auth/service-operation evidence is not implemented; F03.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/29-zone-create.png](screenshots/29-zone-create.png).

## 7. Pending rollouts, processes, and change review

### RPD-07-01 — Gap

**Requirement (standard line 409):** Separate incomplete working drafts from validated pending rollout proposals.

**Analysis:** All drafts have the same status and no validation/resume lifecycle. needsCompletion exists only in saved JSON; F02.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/30-pending-incomplete.png](screenshots/30-pending-incomplete.png); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/31-pending-review.png](screenshots/31-pending-review.png).
### RPD-07-02 — Gap

**Requirement (standard line 410):** All unapplied managed changes are saved as drafts and visible in Pending Rollouts, including incomplete drafts labeled Needs Completion. Validate a draft into a reviewable proposal before enabling Apply. A form save stages the change without applying it. Apply from Pending Rollouts starts the backend operation, visible in Running Processes with its actual state and results. This includes ordering and configuration changes: the snapshot/revision gate runs before execution, and active navigation reflects confirmed configuration rather than an unapplied draft. Local display preferences and non-mutating tests do not create rollouts.

**Analysis:** Drafts are visible and form saves do not Apply, but Needs Completion, validation-to-proposal, backend Apply and Running Processes tracking are missing; F02/F03/F16.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/30-pending-incomplete.png](screenshots/30-pending-incomplete.png); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/31-pending-review.png](screenshots/31-pending-review.png).
### RPD-07-03 — Partial

**Requirement (standard line 418):** Collect relevant creates, edits, reissues, configuration changes, deletions, and restore proposals in one review location. Repeated saves replace the same proposal rather than duplicating it.

**Analysis:** Source/record/order/delete/restore stage in one draft list and stable-target saves replace entries. No authenticated acceptance/execution pipeline exists; F03/F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/30-pending-incomplete.png](screenshots/30-pending-incomplete.png); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/31-pending-review.png](screenshots/31-pending-review.png).
### RPD-07-04 — Gap

**Requirement (standard line 420):** Provide the affected resource list, scope, current/proposed configuration, and downloadable manifests or equivalent native configuration before application.

**Analysis:** Review shows raw proposed JSON without a structured current/proposed diff, complete consumers, or downloadable native configuration; F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/30-pending-incomplete.png](screenshots/30-pending-incomplete.png); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/31-pending-review.png](screenshots/31-pending-review.png).
### RPD-07-05 — Partial

**Requirement (standard line 422):** Keep the pending counter shared between navigation and Overview. Examples do not count as changes.

**Analysis:** Preview Pending/Overview use the same draft collection before filtering. Native Pending counts all drafts rather than scoped drafts; F08/F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/30-pending-incomplete.png](screenshots/30-pending-incomplete.png); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/31-pending-review.png](screenshots/31-pending-review.png).
### RPD-07-06 — Partial

**Requirement (standard line 423):** For reusable configurations, show affected consumers before updating them. Editing a preset alone does not silently update existing consumers; reconfiguration is an explicit reviewed operation.

**Analysis:** Source changes are explicit local drafts. Zones/records/consumers affected by source integration edits are not enumerated before review; F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/30-pending-incomplete.png](screenshots/30-pending-incomplete.png); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/31-pending-review.png](screenshots/31-pending-review.png).
### RPD-07-07 — Unverified live

**Requirement (standard line 425):** Validate the complete affected group before applying it. Aim for consistent group changes and report partial failures truthfully when the backend cannot provide transactions.

**Analysis:** Group validation, backend transaction/partial-failure behavior cannot be tested because Apply is unavailable. Treat live rollout acceptance as unfinished; F03/F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/30-pending-incomplete.png](screenshots/30-pending-incomplete.png); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/31-pending-review.png](screenshots/31-pending-review.png).
### RPD-07-08 — Gap

**Requirement (standard line 427):** Detect concurrent edits or changed dependencies and require a fresh review instead of overwriting them.

**Analysis:** No authoritative order/config revision or dependency version is checked by an execution endpoint; local file revision checks do not establish live concurrency; F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/30-pending-incomplete.png](screenshots/30-pending-incomplete.png); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/31-pending-review.png](screenshots/31-pending-review.png).
### RPD-07-09 — Gap

**Requirement (standard line 428):** Detect Helm/Fleet/controller ownership and route edits through the owning source or clearly explain the reconciliation consequence before enabling a conflicting mutation.

**Analysis:** Controller/Helm/Fleet ownership is not discovered or presented in draft review. No source-owned edit/reconciliation flow exists; F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/30-pending-incomplete.png](screenshots/30-pending-incomplete.png); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/31-pending-review.png](screenshots/31-pending-review.png).
### RPD-07-10 — Gap

**Requirement (standard line 430):** Track submitted work on the required Running Processes page, including operation, namespace/scope, status, start time, affected resources, progress when known, and configuration details.

**Analysis:** Running Processes always renders No Running Processes; it has no real operation inventory, scope/status/start/progress/configuration view or populated demo state; F16.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/30-pending-incomplete.png](screenshots/30-pending-incomplete.png); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/31-pending-review.png](screenshots/31-pending-review.png).
### RPD-07-11 — Verified local

**Requirement (standard line 432):** Do not invent progress percentages or completion. Label simulated processes as simulations.

**Analysis:** No invented progress percentage/completion is shown. Placeholder clearly says no backend operation has been accepted.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/30-pending-incomplete.png](screenshots/30-pending-incomplete.png); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/31-pending-review.png](screenshots/31-pending-review.png).
### RPD-07-12 — Partial

**Requirement (standard line 433):** Keep session rollout/rollback history distinct from durable configuration snapshots.

**Analysis:** Durable local snapshots use a separate directory and drafts are separate. DNS has no submitted session rollout/rollback history yet; F16.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/30-pending-incomplete.png](screenshots/30-pending-incomplete.png); [dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/31-pending-review.png](screenshots/31-pending-review.png).

## 8. Snapshots, schedules, restoration, and recovery

### RPD-08-01 — Partial

**Requirement (standard line 445):** Store snapshots in a dedicated persistent server location, outside rotating logs. Confirm backend storage before satisfying any backup gate. Keep the volume in an independent backup policy; replication/persistence alone is not a backup.

**Analysis:** Loopback service writes isolated snapshot ZIPs/indexes outside logs and confirms persistence. Production persistent-volume mount/backup policy has not been accepted; F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-02 — Verified local

**Requirement (standard line 448):** Export ZIP files containing the configuration index and independently readable manifests/configuration. Include Secrets is an explicit checkbox, default off; non-secret configuration is always included. A second downloaded copy is optional; a download-only workflow requires acknowledgment that the files were saved.

**Analysis:** Local encrypted/unencrypted captures produce ZIP recovery content; Include Secrets defaults off, non-secret configuration always captures, and optional download/gate acknowledgments exist.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-03 — Partial

**Requirement (standard line 452):** Capture persisted pre-change configuration separately from local proposals and declared dependencies. Include Secret manifests/values only with Include Secrets; otherwise retain references and disclose omitted credential coverage. Exclude application/PV data. List unavailable Secrets and the observation time.

**Analysis:** Applied source/zones/order are captured separately from pendingChanges and PV data is excluded. Authenticated Secret/source reads and full missing-credential coverage are not connected; F03.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-04 — Partial

**Requirement (standard line 456):** Both Create Snapshot and the snapshot schedule's Run Now first open a modal asking whether to Include Secrets (default off). Selecting Include Secrets shows Password and Confirm Password fields and a locally evaluated strength bar beneath the password field. Show a readable strength label and mismatch feedback, with accessible labels/focus. Confirm requires matching passwords and the shared strength policy; Cancel clears both passwords and returns Include Secrets to unchecked.

**Analysis:** Both capture paths ask Snapshot Options, matching/strength/mismatch are UI-tested. Unlock modal fails to focus the password field and Cancel does not reset includeSecrets in a reused instance; F09/F12.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-05 — Verified local

**Requirement (standard line 462):** Secret-inclusive backups require password encryption of the entire backup payload, including the index, configuration, and Secret manifests. Use AES-256 encrypted ZIP entries through a maintained implementation, not legacy ZipCrypto or a UI-only password check. Keep all recovery content in one encrypted payload entry (for example backup.zip inside the outer ZIP) with a generic filename, because ordinary ZIP encryption leaves entry names/metadata visible. See [WinZip encryption format](https://www.winzip.com/en/support/aes-encryption/) and [ZIP directory visibility](https://kb.winzip.com/en/130859).

**Analysis:** @zip.js AES-256 writes one generic encrypted payload entry. Correct-password recovery and wrong/missing-password rejection pass backend encryption tests.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-06 — Verified local

**Requirement (standard line 469):** Passwords are transient capture/export inputs: do not place them in drafts, browser storage, logs, or the archive index. Clear them on completion/cancellation. Never emit an unencrypted Secret-inclusive file when encryption fails. Verify that correct-password recovery succeeds and wrong/missing-password access fails before treating encrypted backup creation as successful.

**Analysis:** Password refs clear after submit/cancel and never enter persisted proposals/index; encrypted backup tests verify fail-closed behavior on weak/password failures.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-07 — Verified local

**Requirement (standard line 474):** Secret references alone are not restorable credentials. Redact Secret values and annotation values in all on-screen comparisons, including last-applied annotations; retain full captured manifests only within appropriately protected recovery content.

**Analysis:** Comparison helpers redact Secret data/stringData and annotation values. Local restore refuses decrypted Secret values in preview drafts; native restore is separate.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-08 — Partial

**Requirement (standard line 480):** Provide listing, search, scope/generation filters, manual capture, downloads, uploads, inspection, comparison, selected restoration with dependencies, merge, protected backup deletion, automatic scheduling, and retention cleanup.

**Analysis:** Local list/capture/download/upload-via-gate/restore/merge/delete/schedules/cleanup exist. Generation filter, full production dependencies and live inspection remain incomplete; F04/F12/F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-09 — Partial

**Requirement (standard line 483):** Default to Created descending using raw timestamps, including within namespace groups and on a fresh open. Refresh preserves an explicit user-selected sort.

**Analysis:** Snapshot DataGrid declares Created descending with raw timestamps. Outer table decoration can replace aria-sort with none and conflicting header sorting; F07.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-10 — Verified local

**Requirement (standard line 485):** Size sorts numerically by the complete stored/exported ZIP bytes and uses decimal B, KB, MB, GB, and TB. Legacy JSON/YAML pairs display their combined byte size explicitly; they do not supply the complete-ZIP size used by current capacity estimates.

**Analysis:** History uses complete sizeBytes and raw data-sort; legacy combined sizes are explicit. Backend estimate excludes legacy pairs from complete-ZIP size.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-11 — Gap

**Requirement (standard line 488):** Use the common header actions/help/refresh/count shell. New uses a plus; Delete uses a red trash action with matching geometry. Scope filters include Manual or Automatic generation and date ranges with calendar selection, optional times, Clear Range, and convenient start-to-end selection.

**Analysis:** New Snapshot has no plus and Delete is blue. Generation lacks a dedicated filter; date/calendar/time/Clear Range are present. Header/filter styling differs; F04/F07.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-12 — Partial

**Requirement (standard line 495):** For reconfiguration, rollback, restoration, bulk deletion, and ordering changes, verify a matching snapshot captured within the previous 24 hours for the complete affected configuration. Recheck coverage, age, and revisions at execution time. Changes invalidate coverage; a recent timestamp alone is insufficient.

**Analysis:** Local snapshot gate validates matching content/age/scope. Order/live Apply lacks a server execution gate with final authoritative revision/coverage check; F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-13 — Verified local

**Requirement (standard line 499):** Select a stored snapshot or upload its index; automatically compare saved/current affected content side by side. YAML alone does not establish capture age or scope. Mismatching configuration cannot satisfy the mutation gate.

**Analysis:** Existing index/upload choices and current/saved comparison are present; gate validator checks full matching content and timestamp rather than YAML alone.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-14 — Partial

**Requirement (standard line 502):** Restoration reviews affected items/dependencies and what will be overwritten. Require a fresh current-state snapshot and explicit overwrite confirmation. Block uncovered consumers, missing dependencies, and newer conflicting edits.

**Analysis:** Restore lets users select items/dependencies, compare current/saved and require fresh baseline capture/confirmation. Live consumers/permissions/dependency/conflict checks remain absent; F10/F12.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-15 — Partial

**Requirement (standard line 505):** Require explicit Secret selection/confirmation for credential replacement. Managed resource deletion never removes Secrets. Never silently restore unrelated objects or remove resources created after the selected snapshot.

**Analysis:** Secret restoration is explicit and decrypted values cannot enter local drafts. Production credential replacement/deletion semantics are unverified because authenticated operations are absent; F03/F10.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-16 — Partial

**Requirement (standard line 508):** Prepare restoration drafts in Pending Rollouts; Apply is a separate reviewed backend operation tracked in Running Processes. Preserve capture provenance.

**Analysis:** Prepare Selected Restore queues preview Pending drafts with provenance; live Apply/process tracking are unavailable. Some comparison scope metadata yields false positive differences; F12/F16.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-17 — Partial

**Requirement (standard line 510):** Provide recovery instructions for obtaining files without the application and restoring reviewed native configuration, including owning Helm/Fleet sources.

**Analysis:** ZIP contains recovery index and independent configuration/manifests; README describes extraction boundaries. A complete DNS owning-source recovery runbook/live rehearsal is missing; F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-18 — Verified local

**Requirement (standard line 515):** Begin with Verify Snapshot Passwords when preparing selected sources. List every protected snapshot with its own password input, a Test Password action, and an adjacent Apply To All Snapshots action. Applying a password never verifies it. Provide Test All Passwords and show actual archive-decryption results per snapshot. Editing or copying passwords invalidates prior verification. Reverify before continuing; do not rely on a nonempty field or cached success alone.

**Analysis:** Protected sources have per-row password/Test/Apply To All and Test All; real archive calls verify passwords, edits invalidate results, Continue reverifies. Unit and browser wrong/correct paths checked.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-19 — Verified local

**Requirement (standard line 521):** Warn explicitly which snapshots will not be processed and why (missing password, incorrect password, unreadable archive). Include unencrypted snapshots normally. Only protected snapshots with a successfully supplied password enter the merge; skipped snapshots never enter priority, selection, provenance, output, or source deletion. Require at least two eligible sources. Keep the exclusion warning through final review. Passwords remain only in session memory and are never saved in drafts, preview source files, browser storage, logs, or exported metadata.

**Analysis:** Unencrypted sources are retained, protected incorrect sources are named with reasons, at least two eligible sources are required. Session passwords/exclusions remain transient; UI tests verify filtering.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-20 — Partial

**Requirement (standard line 528):** Merge opens a dedicated page in the shared shell. Its navigable stepper is Override Priority, one selection step per relevant item type, Review Differences, Final Summary. Each plugin adapter supplies its item types, selection order, stable identities, and dependency relationships in its own standard.

**Analysis:** Merge renders its stepper and DNS Configuration/changes/review/summary. It remains inside outer Snapshots route/heading rather than a dedicated hidden editor page; F12.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-21 — Verified local

**Requirement (standard line 532):** Highest-priority sources override lower ones by stable item identity, taking a complete item from the winning source; missing items come from lower sources. Support drag ordering and accessible keyboard controls.

**Analysis:** Whole-item stable identity precedence and fallback are implemented; priority rows expose pointer ordering plus arrow/Alt keyboard controls. Current sources retain capture dates.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-22 — Verified local

**Requirement (standard line 535):** Every selection step shows only additions/content changes. Matching items remain in the final backup automatically. Skip types with zero additions/changes; a fully matching merge goes directly from priority to review and final confirmation.

**Analysis:** Matching-only merge skips selection and changed-record scenario adds one DNS Configuration step. Matching items remain automatically; browser screenshots show both flows.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-23 — Partial

**Requirement (standard line 538):** Automatically include known required dependencies; block unresolved dependencies. Keep selection, comparison, summaries, and backup output consistent.

**Analysis:** snapshot-items/selectSnapshotItems include known dependencies and missing references block selection. Full live DNS/Secret dependency discovery is not supplied; F03/F12.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-24 — Partial

**Requirement (standard line 540):** Changed Secrets default to keeping readable current credentials; selecting a snapshot version requires an explicit choice. Read current versions of every source Secret as well as currently referenced Secrets, including after references change. Failed reads cannot silently reuse stale credentials. If current values are unavailable, preserve the saved version in the backup and disclose the gap. Matching Secrets keep their original capture provenance. Merge never writes live credentials and follows the same Include Secrets/encryption contract as capture.

**Analysis:** Secret selection helpers preserve current/saved provenance and do not write live values. captureRelevantSecrets always fails for references and Merge catches that failure; authoritative fresh current Secret reads remain missing; F03/F12.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-25 — Partial

**Requirement (standard line 547):** Compare the effective flattened selection against current configuration, side by side, showing additions/content changes only. Shared IDs alone are not conflicts; matching and current-only items are excluded and never implicitly deleted. Ignore transient controller status/resource-version changes in comparisons.

**Analysis:** Changed DNS configurations compare side by side; matching merge has no differences/current-only deletion. Restoration includes snapshotScope metadata and reports a false diff for unchanged content; F12.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-26 — Verified local

**Requirement (standard line 551):** Final confirmation states scope, precedence, added/changed counts, and whether originals are retained. Offer Remove These Snapshots When Merged; partial merges that omit configuration retain originals. Save durably before any source removal. Cleanup failure leaves a successful save intact and permits separate cleanup without retrying the merge. Preserve per-item capture dates through merges and subset selection: merging old content does not make its coverage fresh.

**Analysis:** Final summary reports scope/precedence/counts and removal option; backend stores before source cleanup, retains partial-merge originals and preserves per-item age. Local backend tests pass.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-27 — Partial

**Requirement (standard line 557):** Protect unsaved merge choices using the common draft/leave guard and register the merge editor as a hidden route. Merging, restoration preparation, and Apply remain separate actions.

**Analysis:** Merge registers dirty state and saved choices, but has no hidden route and its own Cancel/Back To Snapshots bypass the outer dirty-leave review. Navigation/persistence needs unified editor contract; F12.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-28 — Gap

**Requirement (standard line 563):** Show per-resource coverage and snapshot history. The coverage display checks the last seven days: green matching, amber partial/differing, red no recent applicable copy. This display window is separate from the 24-hour mutation gate. Multiple snapshots may collectively cover known configuration; fixtures do not prove live backup.

**Analysis:** Coverage computation exists but DNS mounts no per-resource coverage/history badges or seven-day coverage UI; F06.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-29 — Gap

**Requirement (standard line 567):** Make the banner clickable and keyboard accessible. Green opens the inventory; partial/missing/outdated coverage opens a dedicated summary/diff page using the Snapshots shell. Group missing, outdated, and changed items into collapsible sections by type; hide matching/recently covered items. Compare uncovered items with their latest applicable stored version, redacting Secret values.

**Analysis:** No coverage banner or dedicated grouped missing/outdated/changed diff page exists in DNS navigation/routing; F06.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-30 — Partial

**Requirement (standard line 572):** For this notification only, Secrets use backup presence rather than freshness or content differences. A Secret with captured values in an applicable stored backup is excluded from freshness/difference totals, even after rotation. References without captured values remain missing-backup gaps, including with Include Secrets off. Record missing/omitted recovery coverage in the index and recovery comments. This presence-only rule never relaxes restore dependencies or write validation.

**Analysis:** Presence-only Secret coverage logic passes unit tests, including rotation/age. There is no mounted DNS coverage notice and source credential references are not fully modeled; F06/F03.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-31 — Partial

**Requirement (standard line 578):** Resource history links retain selected scope and provide Clear Filter. Network Manager defines its resource-specific badge layout in its own standard.

**Analysis:** history-context supports scoped filtering/Clear Filter, but zones/records offer no resource snapshot-history links; F06.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-32 — Partial

**Requirement (standard line 583):** Place Automatic Snapshot Schedule and Automatic Snapshot Cleanup side by side at the bottom, each occupying 50% of the row. Align configuration fields left, actions right, and use compact retention units. Beneath each panel's controls show only its next date: Next Snapshot in the capture panel and Next Delete in the cleanup panel. Put explanatory/status paragraphs about server scheduling, browser closure, capture source, recovery copies, retention protection, and estimation assumptions in a help icon beside the corresponding panel title, linking to the relevant guide section. Errors remain visible and actionable.

**Analysis:** Two equal-width desktop schedule panels and only next-date paragraphs are correct; explanation moved to title Help. Panels shrink below usable height and errors are not direct repair actions; F11/F18.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-33 — Partial

**Requirement (standard line 591):** Enabled is a green badge; Disabled is red. Loading/unknown has a distinct state.

**Analysis:** Disabled is red and enabled green. Before asynchronous load, default Disabled is shown without a distinct loading/unknown schedule state; F11.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-34 — Verified local

**Requirement (standard line 592):** Persist enabled state, interval, scope, and capture source on the server; run with the browser closed. Support minutes, hours, days, weeks, and calendar months with month-end clamping. Disclose whether the source is fresh live state or saved inspection.

**Analysis:** Local service persists state/interval/scope/saved source, runs without browser and supports all units/month clamping. Shared backend scheduler tests establish local behavior, not production deployment.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-35 — Verified local

**Requirement (standard line 595):** Cleanup is disabled by default. Protect the newest applicable snapshot for each known scope/configuration item and retain originals required by partial merges.

**Analysis:** Cleanup starts disabled, protects newest applicable scope/item snapshots, and preserves required originals for partial merges; backend tests check protection.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-36 — Partial

**Requirement (standard line 597):** Immediately below both panels, provide a separate row spanning 100% of the combined width, divided into three equal columns: Available Drive Space, Largest Snapshot, and Estimated Run Out Of Space. No storage figures belong inside either schedule panel. Format examples (illustrative, never hardcoded): `Available Drive Space: 950.8 GB / 1.1 TB`; `Largest Snapshot: 555.6 KB · Approximately 1,711,350 More Snapshots Fit`.

**Analysis:** Storage is outside both panels with three equal-width columns; measured browser confirms it. Mobile available-height allocation can push the row out of view; F11.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-37 — Partial

**Requirement (standard line 603):** Available storage means bytes writable by the service account at the configured destination: available filesystem space bounded by any smaller remaining PVC, dataset, volume, tenant, or application quota. Do not show parent drive capacity as backup capacity or double-count replicas. Required limits that cannot be measured show Unavailable with a reason, never zero or a fabricated exhaustion date.

**Analysis:** Service probes writable statfs destination and applies configured smaller quotas with unavailable reasons. Production PVC/dataset/application limits remain unverified; F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-38 — Verified local

**Requirement (standard line 608):** Measure the actual mounted filesystem containing the resolved snapshot-save directory (including PVC/bind mounts/symlinks); report effective available bytes and that destination's total capacity. Do not substitute the host's root disk, browser disk, or a different mount. Apply smaller known quotas and disclose them through contextual Help. Refresh from backend measurements rather than fixtures.

**Analysis:** Backend realpath/statfs measures the mounted resolved snapshot directory rather than browser/root fixtures, with quota bounds. Local storage tests pass; no live PVC claim is made.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-39 — Partial

**Requirement (standard line 613):** Estimates use the largest complete saved ZIP, effective available bytes, and the saved enabled cadence. Without a size or enabled schedule, show no prediction. Explain competing usage and cleanup assumptions in contextual Help rather than helper paragraphs. Refresh measurements in place after capture, cleanup, schedule changes, and normal refresh. An estimate is not a promise of available capacity.

**Analysis:** Largest complete ZIP, saved cadence and effective writable bytes drive predictions and capture/cleanup updates. Main header refresh does not reload storage/schedules; F03.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).
### RPD-08-40 — Verified local

**Requirement (standard line 618):** If the computed exhaustion date is more than one calendar year from the measurement time, display `∞` instead of a distant date; retain the full estimate for accessible help. At exactly one year or sooner, show the localized date/time. Unknown size, unavailable space, or a disabled schedule remain Unavailable or Not Scheduled as appropriate; never turn unknown estimates into infinity.

**Analysis:** Backend/UI estimate returns infinity only beyond one calendar year; exact-boundary/unknown cases pass shared tests. Disabled displays no distant fabricated date.

**Evidence:** [dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue](../../../pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue); [dns-manager-dev/tests/ui/snapshots.spec.ts](../../../tests/ui/snapshots.spec.ts); [dns-manager-dev/tests/backup.test.mjs](../../../tests/backup.test.mjs); [dns-manager-dev/tests/backup-server.test.mjs](../../../tests/backup-server.test.mjs); [preview-data/tests/snapshot-server.test.mjs](../../../../preview-data/tests/snapshot-server.test.mjs); [preview-data/tests/snapshot-unlock.test.mjs](../../../../preview-data/tests/snapshot-unlock.test.mjs).

## 9. Refresh, diagnostics, settings, and help

### RPD-09-01 — Verified local

**Requirement (standard line 628):** Provide a shared manual Refresh action and Refresh Every selector.

**Analysis:** The common heading supplies icon-only Refresh and Refresh Every across all visible pages/editors.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/request-state.js](../../../pkg/dns-manager/ui/request-state.js); [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-09-02 — Verified local

**Requirement (standard line 629):** Default to five minutes. Offer Off, 30 Seconds, 1 Minute, 5 Minutes, 15 Minutes, and 1 Hour.

**Analysis:** Default five minutes and all six required intervals are unit-tested; Off displays 00:00.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/request-state.js](../../../pkg/dns-manager/ui/request-state.js); [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-09-03 — Verified local

**Requirement (standard line 630):** Show a fixed-width `MM:SS` countdown driven by a clock deadline, avoiding accumulated timer drift. Interval changes and manual refresh reset it; Off displays `00:00`.

**Analysis:** Clock-deadline countdown has fixed-width tabular presentation, resets on refresh/interval change, and avoids subtracting accumulated ticks.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/request-state.js](../../../pkg/dns-manager/ui/request-state.js); [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-09-04 — Gap

**Requirement (standard line 632):** Update data in place without page reloads, editor remounts, or replacement of unsaved form state.

**Analysis:** Refresh preserves editor DOM but readObservations results are discarded by onReady; inventory/records remain initial clones. Snapshot list/storage/schedules are not refreshed by header Refresh; F03.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/request-state.js](../../../pkg/dns-manager/ui/request-state.js); [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-09-05 — Partial

**Requirement (standard line 633):** Prevent overlapping refresh work. Show busy/error feedback and retain existing data on failure.

**Analysis:** Observation request controller suppresses overlapping requests, retains existing content and shows failure. Snapshot reads have a separate unbounded fetch path; F03.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/request-state.js](../../../pkg/dns-manager/ui/request-state.js); [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-09-06 — Partial

**Requirement (standard line 634):** For a delayed data request (300 ms default), show a centered loading indicator over a blurred/dimmed page with an accessible loading status. Preserve the underlying editor and data rather than remounting them. Fail an unanswered request after 60 seconds with a visible timeout message; retry failed reads every 60 seconds except confirmed source disconnections, which retry every five seconds and restore the regular five-minute refresh after verified recovery. Show count spinners only during delayed requests; confirmed failures remain red between attempts. Retry until successful or cancelled. Show the retry countdown, prevent overlapping requests, abort abandoned requests, and ignore late responses. Clear the overlay on response/cancellation. Do not automatically replay timed-out rollout writes; reconcile their backend operation status before any explicit retry.

**Analysis:** UI tests prove 300-ms delay, 60-second timeout, abort-on-navigation and five-second source recovery. Snapshot/schedule/list reads do not use the same timeout/overlay/retry lifecycle; F03.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/request-state.js](../../../pkg/dns-manager/ui/request-state.js); [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-09-07 — Verified local

**Requirement (standard line 645):** Reserve loading indicators for actual delayed requests (300 ms default); idle, unconfigured sources and retry countdowns are not loading. Keep confirmed failures visible between attempts. Missing configuration requires configuration, not probes.

**Analysis:** Idle unconfigured backend shows failures rather than spinners. Delayed requests alone show loading, and confirmed failures remain red between retries.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/request-state.js](../../../pkg/dns-manager/ui/request-state.js); [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-09-08 — Partial

**Requirement (standard line 651):** Diagnostics follows Network Manager's filter layout with keyword search, multi-select namespace scope from Rancher's global selector, log source, severity (Debug, Info, Warn, Error), and lookback. Discover relevant running resources and controller replicas as sources via the backend, and label unavailable collections distinctly. The navigation badge counts only warnings/errors over the rolling last 24 hours, independent of view filters: neutral zero, yellow warnings-only, or red combined warnings and errors when any error exists. Identify scope (browser vs managed-resource logs).

**Analysis:** Diagnostics has the specified desktop filter order/severities, global namespace context and browser 24-hour events. Backend resource/replica discovery and logs are unavailable; F08.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/request-state.js](../../../pkg/dns-manager/ui/request-state.js); [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-09-09 — Partial

**Requirement (standard line 657):** Diagnostics defaults to a 24-hour view. Each adapter documents its available retention/lookback limits in its plugin standard.

**Analysis:** View defaults to 24 hours. Controls limit hours but DNS standard/help do not document actual managed-log retention/lookback capabilities; F08.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/request-state.js](../../../pkg/dns-manager/ui/request-state.js); [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-09-10 — Gap

**Requirement (standard line 659):** Make badge scope, time window, and separate severity counts accessible. Keep its rolling 24-hour total independent of view filters while honoring host namespace/access scope. Unavailable log data is not a verified zero.

**Analysis:** Badge aria-label says N items plus backend issue; it omits rolling window, browser-vs-managed scope and separate warning/error totals. Unavailable managed logs cannot be inferred from browser zero; F08.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/request-state.js](../../../pkg/dns-manager/ui/request-state.js); [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-09-11 — Partial

**Requirement (standard line 662):** Clearly label demo logs, static inventory, simulated operations, and unverified observations. A refresh of static/demo data must not claim a fresh live cluster inspection.

**Analysis:** Most cards/grids say Sample and logs disclose browser-only scope. Manual notice says observations refreshed although it does not reload the demo provider; F03/F08.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/request-state.js](../../../pkg/dns-manager/ui/request-state.js); [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-09-12 — Partial

**Requirement (standard line 666):** Persist display preferences per browser, including Preview, snapshot status banner, and cluster inspection notices as separate controls. These controls change presentation, not access or write capability.

**Analysis:** Preview/failover/backend controls persist in project saved state. Snapshot notice is absent and shared project preferences are not per-browser display storage; F06/F17.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/request-state.js](../../../pkg/dns-manager/ui/request-state.js); [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-09-13 — Partial

**Requirement (standard line 668):** Every top-of-page notification/banner type has its own labeled visibility checkbox in Settings. New banner types must add the matching preference rather than relying on a single global hide switch. Apply preferences consistently across pages and persist them per browser; hiding a banner does not alter underlying status or bypass required validation, backup, or write controls.

**Analysis:** Existing three top-notice types have independent toggles. New request-failure/ordering/coverage types are not all represented by separate preferences; F17/F18.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/request-state.js](../../../pkg/dns-manager/ui/request-state.js); [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-09-14 — Verified local

**Requirement (standard line 673):** Default Preview off for standalone test builds and native extension builds. An explicit saved preference may enable preview labels and banners; fresh root-suite sessions start with them off. This preference changes presentation only. Hidden notices do not turn sample data into live evidence, disable mock data, or suppress real issue notifications.

**Analysis:** Fresh preview preferences set preview false; root shell identifies mock data separately. Hidden preview notices do not disable sample datasource or genuine failures.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/request-state.js](../../../pkg/dns-manager/ui/request-state.js); [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-09-15 — Verified local

**Requirement (standard line 677):** Standalone resource links may use a configured Rancher origin, validated as an HTTP/HTTPS origin without embedded credentials. Native builds use the active Rancher context.

**Analysis:** Settings rejects non-HTTP(S), credentials, paths, query and fragment and saves URL.origin only. Regression test verifies credential/path rejection.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/request-state.js](../../../pkg/dns-manager/ui/request-state.js); [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-09-16 — Partial

**Requirement (standard line 679):** Provide the Rancher URL and other relevant connection/configuration settings on the shared Settings page, alongside per-banner visibility preferences.

**Analysis:** Rancher URL and existing notice controls are on Settings. Live provider connection/configuration and absent coverage notice controls remain incomplete; F03/F06.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/request-state.js](../../../pkg/dns-manager/ui/request-state.js); [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-09-17 — Partial

**Requirement (standard line 684):** Help is the final navigation page and has no inventory count or question-mark controls. Use collapsible sections for the application's purpose, every page, action, resource link, and common workflow; describe each trigger and effect.

**Analysis:** Help is last, has no count/questions, and collapsible page sections explain trigger/effect. Detailed merge steps, capture gates, quota/recovery/retention and resume behavior need complete guide content; F02/F12.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/request-state.js](../../../pkg/dns-manager/ui/request-state.js); [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).
### RPD-09-18 — Partial

**Requirement (standard line 687):** Explain preview versus live capabilities and how to recover or diagnose failures. Contextual popups reuse these sections; Open Help navigates to and expands the relevant section. Help's application links open the page/section they describe and synchronize the active navigation item.

**Analysis:** Context dialogs reuse guide text and Open Help selects/expands the owning section. Snapshot schedule Help text resolves only to generic Snapshots guide, and live recovery instructions are incomplete; F09/F14.

**Evidence:** [dns-manager-dev/pkg/dns-manager/ui/request-state.js](../../../pkg/dns-manager/ui/request-state.js); [dns-manager-dev/pkg/dns-manager/ui/dns-manager.js](../../../pkg/dns-manager/ui/dns-manager.js); [dns-manager-dev/tests/ui/standards.spec.ts](../../../tests/ui/standards.spec.ts).

## 10. Authentication, availability, packaging, and implementation boundaries

### RPD-10-01 — Unverified live

**Requirement (standard line 694):** Reuse Rancher's authenticated session and enforce the active user's permissions for both reads and writes. Loading an authenticated UI is not sufficient backend authorization.

**Analysis:** Native session/store integration exists, but no authenticated observation/write provider or server permission enforcement is connected. Preview hosting is not production authorization; F03/F10.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-02 — Partial

**Requirement (standard line 696):** Keep backend credentials and private keys out of browser state, repository files, plaintext exports, and logs. The explicit Include Secrets encrypted-backup flow is the exception for recovery exports; never display its values in the UI. Show Secret reference names/keys rather than Secret values.

**Analysis:** Repository mock validation rejects Secret values/password fields and preview draft staging fails closed. Production credential transport/log protection requires backend verification; F03/F10.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-03 — Not applicable

**Requirement (standard line 700):** Read public certificate metadata only; do not return private keys or provider credentials.

**Analysis:** DNS currently exposes no certificate/private-key feature. Secret-reference behavior is audited separately; no private key is returned by these pages.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-04 — Unverified live

**Requirement (standard line 701):** The plugin manages configuration; managed routing/DNS must continue if its UI or management API fails.

**Analysis:** UI does not own the DNS serving path, but Kubernetes/Windows/Traefik outage behavior was not exercised. Independent architecture is not HA acceptance; F14.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-05 — Partial

**Requirement (standard line 702):** Use versioned extension assets and a Helm chart registering `UIPlugin`. Publish the Rancher `files.txt` plus `plugin/` layout, not merely a standalone JavaScript URL.

**Analysis:** Extension build configuration and Helm UIPlugin chart use versioned files.txt/plugin layout. Publishing/reachability/operator installation are unverified; F14.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-06 — Verified local

**Requirement (standard line 704):** Separate UI registration, asset hosting, management backend, and managed workloads. Clearly document which chart installs which resources; registration alone does not install those dependencies.

**Analysis:** Chart README explicitly distinguishes interface registration from DNS runtime/Windows adapter/storage/backend dependencies and targets management cluster only.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-07 — Verified local

**Requirement (standard line 706):** Reuse existing infrastructure rather than adding another ingress, database, or monitoring stack merely to support a manager page.

**Analysis:** Standalone uses local files and a loopback backup service without adding production ingress/database/monitoring. New shared demo-file requirement is an explicit dataset change, not a new production stack.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-08 — Verified local

**Requirement (standard line 708):** A standalone preview uses the same components with isolated fixture data and clearly declared capabilities. Keep unauthenticated preview hosting private and free of live cluster credentials.

**Analysis:** Isolated audit preview uses the real Vue components, loopback ports and disposable saved sample source. It declares live Apply/observations unavailable and carries no live cluster credentials.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-09 — Verified local

**Requirement (standard line 710):** Every custom Rancher plugin must include a repository-owned, locally runnable standalone interface preview. An inline mockup alone does not satisfy this requirement.

**Analysis:** Repository Preview.vue/Vite starts an interactive local UI; all pages were exercised in this audit rather than an inline mockup.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-10 — Verified local

**Requirement (standard line 712):** Match the Network Manager development workflow: `npm install` (or `npm ci` with the lockfile), `npm run preview`, and `npm run build:preview`. Pin dependencies and retain the lockfile.

**Analysis:** Pinned package/lockfile and npm preview/build workflow exist; UI test dependencies are pinned. Current preview build passed.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-11 — Verified local

**Requirement (standard line 714):** `npm run preview` must start a usable browser-based plugin UI directly from the local project after dependency installation. It must work without Docker or Docker Compose, container image builds, a full application deployment, or a Kubernetes/Helm installation. Optional container/backend integration previews may supplement this npm workflow but cannot replace it or become prerequisites. Use clearly labeled fixtures/local adapters for unavailable services so pages, navigation, forms, selection actions, and draft flows can be previewed locally.

**Analysis:** Audit UI and snapshot service started directly with npm/Vite/Node on loopback with no deployment/container dependency; pages/forms/drafts are usable except reported UI gaps.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-12 — Verified local

**Requirement (standard line 721):** Document the preview URL, prerequisites, commands, and how to stop it with Ctrl+C. Bind to `127.0.0.1` by default and use a documented, distinct port so managers can run together. Network Manager uses 5173; DNS Manager uses 5174. Fail clearly on a port conflict.

**Analysis:** README documents Node >=24, 5174, root 5172, Ctrl+C and conflict behavior. Vite strictPort and separate backup port are configured.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-13 — Partial

**Requirement (standard line 724):** Each plugin folder supports `npm run preview`; repository-root `npm run preview` launches all registered plugins together for cross-plugin consistency checks. Support choosing named plugins and stop only processes started by that run. Present the selected plugins in one browser page, with side-by-side and full-width views that retain each plugin's active state. Prepopulate one temporary project-owned session datasource using the shared contract, with separate logical plugin records and snapshot directories. Saves persist within that session without changing the seed fixtures; retain session files after stopping. Start preview-only labels and banners disabled, while identifying mock data in the suite shell. This display preference must not disable mock data or real issue notifications.

**Analysis:** Root launcher supplies temporary shared-contract session records, one browser hub and isolated snapshots; per-plugin commands exist. New global LFS seed file is missing, and suite consistency against native host is unverified; F13/F14.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-14 — Partial

**Requirement (standard line 734):** Use one shared datasource contract for normalized inventory, saved state, refresh, capabilities, and reviewed writes. Project-owned JSON mock sources are editable and saveable through npm previews, including provenance/schema information. Persist valid edits atomically with revision conflict checks and visible failures. Native Rancher API adapters implement the same contract through authenticated reads and reviewed writes; changing providers must not require rewriting page UI. Credentials, passwords, and decrypted Secret values must never enter mock files.

**Analysis:** Shared JSON provider validates/revisions/atomic saves and UI Mock Data saves/reloads; backend tests pass. Native routes do not inject that provider and observation results never update UI; F03.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-15 — Gap

**Requirement (standard line 741):** Every feature and ability must have representative demo data pulled from its authoritative source where available, scrubbed before persistence, and saved in one project-owned global local demo database/data file shared by the plugin suite. Include the states needed to exercise the feature, such as populated and empty inventories, dependencies, drafts, warnings, errors, and operation results. Preserve source identity, capture time, schema version, and the scrubbing rules; label synthetic scenarios and never present them as live observations. Remove real credentials, Secret values, private keys, personal information, and sensitive identifiers; use safe replacements that retain referential consistency. Track and synchronize the global demo file with Git LFS and include its tracked pointer in the repository, so a normal checkout with LFS provides the prepopulated data. Document LFS setup/pull and report missing LFS content clearly. Root and per-plugin npm previews consume this same global source through the swappable datasource contract; preview saves use editable local/session copies rather than overwrite the distributed seed. A new feature is incomplete until its representative data, scrub/validation checks, and UI tests are included.

**Analysis:** New requirement added by this request. Existing seeds are separate DNS/Network JSON, with no global LFS-tracked DB/file, .gitattributes rule or complete feature scenarios/scrub pipeline; F13.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-16 — Verified local

**Requirement (standard line 757):** Keep the standalone Rancher-like shell outside native integration; reuse the manager's Vue page components for the preview and native routes. Native pages use Rancher's own chrome.

**Analysis:** Standalone wrapper alone adds simulated chrome; routing renders Dashboard with previewShell false under native host.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-17 — Verified local

**Requirement (standard line 759):** Interface preview startup must not require cluster credentials, Windows connectivity, the managed service, a live management backend, or any Docker/test containers. Label sample inventory and simulated status. Document browser-only preview state separately from backend-confirmed durable snapshots.

**Analysis:** No cluster credentials/Docker/Windows connection is required to launch. README explicitly distinguishes project preview state and local server ZIPs from live backend acceptance.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-18 — Verified local

**Requirement (standard line 763):** Keep preview/build, publication, installation, and live execution distinct. Do not describe a generated draft or compiled library as deployed functionality.

**Analysis:** README and UI label build/drafts/local backups separately from published/installed/live behavior; no release success is claimed by local tests.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-19 — Unverified live

**Requirement (standard line 765):** Verify native integration, authorization, live observation, server validation, and result readback before marking a live feature implemented.

**Analysis:** Native integration/authorization/live observations/server validation/readback have not been verified. Apply remains unavailable rather than misrepresented; F03/F14.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).
### RPD-10-20 — Gap

**Requirement (standard line 767):** Deliver an installable Helm-based package that deploys the application's runtime and registers its Rancher management interface in the native left navigation. Build the actual extension bundle, page routes, Explorer menu registration, and operator-compatible extension chart; a generic workload chart or Vite preview alone does not register a Rancher UI extension. Declare the compatible Rancher version and required extension operator/CRDs. When Rancher's management cluster and workload cluster differ, explicitly target both: a Helm release only creates resources in its target cluster. Keep one documented installation workflow without claiming a single ordinary release can implicitly configure another cluster. Release acceptance includes a clean Helm install, visible native menu/routes, theme/namespace integration, refresh recovery, upgrade, and uninstall checks. See [Rancher's extension packaging](https://extensions.rancher.io/extensions/v2/publishing) and [native side-menu registration](https://extensions.rancher.io/extensions/next/api/nav/side-menu).

**Analysis:** Chart registers UI only; DNS runtime, authenticated backend and cross-cluster installation/recovery/upgrade/uninstall workflow are not delivered as one accepted runtime package; F14.

**Evidence:** [dns-manager-dev/README.md](../../../README.md); [charts/dns-manager/README.md](../../../../charts/dns-manager/README.md); [preview-data/data-source.mjs](../../../../preview-data/data-source.mjs); [preview-data/vite-plugin.mjs](../../../../preview-data/vite-plugin.mjs); [scripts/preview-suite.mjs](../../../../scripts/preview-suite.mjs).

## 13. Review checklist for each new plugin

### RPD-13-01 — Partial

**Requirement (standard line 808):** Native group opens Overview; menus, resource identities, and counts use the correct context.

**Analysis:** Preview manager/group/routes/counts checked; native authorization/context/menu remains unverified. See section 2 and F14.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-02 — Gap

**Requirement (standard line 809):** Shared heading/actions/help, viewport layout, internal scrolling, and responsive behavior work.

**Analysis:** Core desktop shell passes many alignment checks, but action icons/snapshot styling and mobile/schedule content allocation fail. See F07/F11.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-03 — Partial

**Requirement (standard line 810):** Grids sort correctly, retain empty headers, and keep expanded rows with their parent.

**Analysis:** Main empty/sort behavior and shared detail adjacency pass; outer decoration conflicts with snapshot Actions/sort/numeric alignment. See F07.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-04 — Partial

**Requirement (standard line 811):** Filters/search/grouping honor scope; icon actions do not accidentally toggle rows.

**Analysis:** Namespace scope and search work locally; multi-select domain filters and read-only row activation remain gaps. See F04/F05.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-05 — Verified local

**Requirement (standard line 812):** Top-right selection-dependent actions, including Reorder/Delete, are hidden without explicit grid selection and disappear when selection is cleared.

**Analysis:** Unit tests verify main selection-dependent show/clear actions; snapshot Merge/Delete are conditional on selection. Review controls retain applicable gates.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-06 — Partial

**Requirement (standard line 814):** Ranked collections use the shared top-right Reorder/Cancel/dirty-only Save flow; order persistence, conflict detection, snapshot recovery, and related navigation are verified.

**Analysis:** Reorder proposal/Cancel/dirty-only Save/staging checked; authoritative revision, snapshot execution and durable order acceptance are missing. See F10.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-07 — Partial

**Requirement (standard line 816):** Keyboard navigation, labels, focus, dialogs, and non-color status descriptions are usable.

**Analysis:** Main labels/keyboard reorder/focus/dialog bounds checked. Focus-triggered Help, unlock focus and all native accessibility paths remain incomplete. See F09/F14.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-08 — Gap

**Requirement (standard line 817):** New/edit forms preserve intentional overrides and guard unsaved navigation.

**Analysis:** Source/record values/leave guard pass; Create Zone and incomplete-draft resume fail. See F01/F02.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-09 — Gap

**Requirement (standard line 818):** Refresh keeps drafts/selection intact and accurately identifies source/freshness.

**Analysis:** Editor nodes survive refresh but data does not consume successful observations; static refresh claims and snapshot lifecycle differ. See F03.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-10 — Gap

**Requirement (standard line 819):** Working drafts, validated proposals, submitted processes, examples, and durable snapshots are distinct.

**Analysis:** Local drafts/examples/snapshots are labeled, but incomplete/validated proposals/processes are not implemented distinctly. See F02/F16.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-11 — Gap

**Requirement (standard line 820):** Changes expose affected resources, ownership, before/after review, and concurrency validation.

**Analysis:** Raw proposal JSON omits structured before/after, consumers and controller ownership; authoritative concurrency validation is missing. See F10.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-12 — Partial

**Requirement (standard line 821):** Applicable mutation gates verify recent full-scope backup and recheck before execution.

**Analysis:** Local snapshot validator checks exact scope/age, but backend mutation execution/revision gate remains absent. See F10.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-13 — Partial

**Requirement (standard line 822):** Snapshots survive application restart and support recovery without the manager.

**Analysis:** Local snapshot server/store restart persistence and ZIP recovery pass backend tests. Production persistent-volume/offline DNS recovery has not been rehearsed. See F14.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-14 — Partial

**Requirement (standard line 823):** Schedules/cleanup run with the browser closed, disclose source, and protect retained coverage.

**Analysis:** Local scheduler/cleanup tests prove saved-source cadence/protection; production browser-closed service/retention behavior is unverified. See F14.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-15 — Partial

**Requirement (standard line 824):** ZIP/Include Secrets encryption, recovery, provenance, merge, and presence-only banner rules work.

**Analysis:** Local AES ZIP/unlock/merge/provenance tests pass; presence-only coverage logic is not mounted, and current Secret provider is missing. See F06/F12.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-16 — Partial

**Requirement (standard line 825):** Storage reports effective writable quota and uses complete ZIP sizes for estimates.

**Analysis:** Actual resolved destination/quota/complete-ZIP estimates are tested locally. Live PVC/dataset quota access is unverified and header storage refresh is missing. See F03/F14.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-17 — Partial

**Requirement (standard line 826):** Common pages, contextual Help, per-banner Settings, and scoped Diagnostics follow this standard.

**Analysis:** Common-page ordering/Help/Settings/Diagnostics checked; process inventory, per-browser complete banner preferences and accessible log badge details fail. See F08/F16/F17.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-18 — Partial

**Requirement (standard line 827):** Yellow/red top-of-page notifications open the exact item Create/Edit/fix flow with scope preserved, keyboard access, and the normal mutation review gates.

**Analysis:** Existing Overview warning/backend error open specific repair pages with keyboard buttons and preserve draft guard. Other request/reorder alerts lack action routes. See F18.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-19 — Unverified live

**Requirement (standard line 829):** Backend authorization and credential handling are verified; hidden notices do not change capabilities.

**Analysis:** Local credential redaction/fail-closed behavior checked; production backend authorization and permission readback remain unverified. See F03/F10.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-20 — Unverified live

**Requirement (standard line 830):** Managed service operation continues during UI/management failure.

**Analysis:** No managed DNS service outage/management-failure integration exercise occurred. UI isolation alone cannot establish availability. See F14.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-21 — Unverified live

**Requirement (standard line 831):** Native release packaging and installation are verified separately from standalone preview/build.

**Analysis:** Source/build/chart checks are local; operator publication/native installation/theme/upgrade/uninstall acceptance remain pending. See F14.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-22 — Verified local

**Requirement (standard line 832):** Repository-owned local interface preview starts and builds using the shared npm workflow.

**Analysis:** Repository npm/Vite preview ran and build:preview passed; real browser evidence and UI tests accompany the review.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-23 — Gap

**Requirement (standard line 833):** Every feature has scrubbed representative scenarios in the repository's global Git LFS demo database/data file; previews consume it through the shared provider.

**Analysis:** Global scrubbed feature dataset/Git LFS pointer/runtime content checks do not exist yet. The new requirement and its repair plan are documented; F13.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).
### RPD-13-24 — Partial

**Requirement (standard line 835):** `npm run preview` provides usable plugin UI with Docker stopped and without backend, cluster, container-build, or deployment prerequisites.

**Analysis:** Standalone audit launched without invoking Docker/backend/cluster installation. The optional engine prototype is separate. The user’s Docker was not stopped, so a Docker-stopped runtime acceptance check remains unperformed.

**Evidence:** [dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md](REPORT.md); [dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json](test-results.json).

## Narrative sections

- **Section 11: Context.** Network-specific variations are delegated to NETWORK-MANAGER-STANDARDS.md. This DNS audit does not assert Network Manager compliance.
- **Section 12: Partial.** DNS adopts the common pages and hidden editors as specified. Source/record semantics are reviewed here; live replication/HA/lookup-engine behavior belongs to DNS-MANAGER-DESIGN.md and remains outside UI proof.
- **Section 14: Verified local.** This audit preserves historical evidence and distinguishes normative requirements, local behavior and unverified live capabilities. Only the new shared global-demo requirement was added; no historical claim was rewritten as implementation proof.
