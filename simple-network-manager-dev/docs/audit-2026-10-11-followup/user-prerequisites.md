# What needs your input before all gaps can be closed

This distinguishes user prerequisites from work the agent should do. A failed local test is a project defect, not a request for you to fix code. This follow-up is another audit, not authorization to deploy or change live cluster resources.

## Your short action list

1. **Choose the native test environment.** Confirm Rancher origin, cluster ID/context and a disposable namespace or test cluster. Say whether it may be used for UIPlugin/backend installation and reviewed test mutations. The current `default` Kubernetes context is reachable; only Harvester was listed as a registered UIPlugin, with no Network Manager entry. Read access is already working, so new credentials are not automatically needed.
2. **Authorize a permission-test setup.** Provide existing read-only/limited/write-enabled test identities, or authorize creation of temporary scoped accounts/roles in the chosen test environment. Use your normal Rancher login or approved Secret references; do not paste tokens, passwords, certificate keys or DNS-provider credentials into chat. Testing admin access alone cannot establish denied-operation behavior.
3. **Confirm test resource/provider scope.** Identify safe example routes, Services, issuers/certificates and Secret references. For actual provider connectivity/certificate issuance, identify an approved sandbox DNS zone/staging issuer and its existing credential references. Secret overwrite, deletion, restore and controller/Helm/Fleet ownership tests must target disposable resources, not existing production traffic. The agent prepares a concrete manifest/diff/test plan before requesting execution authorization.
4. **Identify test storage and recovery policy.** Supply/approve a disposable PVC/volume, quota/limit and intended independent backup/migration mechanism. Permit restart/replacement/recovery tests on that test runtime. No application/PV data backup is needed for configuration-only snapshots. Local temporary-directory tests do not prove production persistence, quota or independent backups.

A reachable HTTPS asset origin is needed for native installation. You may approve an existing test hosting location; building/versioning assets and wiring the backend are agent work. Helm is not on the current PATH, but obtaining approved vendor tooling is also agent work, not a requirement for you to install it manually.

## No user action required for these categories

- Shared layout, alignment, field styling, badges, tooltips, labels, button sizing, count placement, hidden-route ownership, filter and Help corrections.
- Snapshot stable identities, complete comparison, confirmed-current versus proposed state, and server-side destructive backup checks.
- Fresh UI/model/server tests, safe synthetic fixtures, local build/preview checks, startup failure tests, datasource wiring and scrubbed Git LFS coverage.
- Additional local accessibility, keyboard, browser guard, slow-read and encrypted synthetic recovery evidence.

The approved right-side Network Manager navigation count variation is already documented. No new design choice is needed to preserve it. If a genuine standards conflict appears during fixes, the agent should present that exact conflict for your review rather than ask you to reconfirm existing instructions.

## Every previously non-passing item

Each row below retains the prior result and its specific analysis. “Mixed” means the agent must first implement/prepare the feature; access alone will not fix it. Native tests are not run against production merely because kubectl has permission.


- [x] **R10 — PARTIAL**

  **Expected:** Register a native UI extension in the selected cluster's Explorer navigation.

  **Current gap:** Native registration exists in source; installed Explorer registration and authenticated access were not exercised.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R12 — PARTIAL**

  **Expected:** Make Overview the default page and clearly indicate the active page.

  **Current gap:** Visible pages highlight correctly; hidden editor/merge/coverage pages lose the owning active entry.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R17 — PARTIAL**

  **Expected:** Relevant page header, navigation, and Overview counts share the same scoped data; header counts sit immediately after Refresh. Example values are not fixed requirements.

  **Current gap:** Shared totals exist, but counts wrap away from Refresh at 800px and merge verification initially reports zero sources.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R18 — PARTIAL**

  **Expected:** Keep cluster identity visible and honor Rancher's cluster and namespace context.

  **Current gap:** Preview cluster label and global picker are present; real host-store synchronization is not proven by preview interaction.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R19 — NOT_VERIFIED**

  **Expected:** Treat placement near Compliance as the Network Manager reference; validate ordering in the installed Rancher version rather than assuming a weight guarantees placement.

  **Current gap:** Installed placement near Compliance requires the target Rancher instance; preview ordering is not installation evidence.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R20 — NOT_VERIFIED**

  **Expected:** Target the recorded Rancher 2.15.x / Extensions API 3 environment initially; recheck compatibility when Rancher or the extension SDK changes.

  **Current gap:** Recorded target versions are declared; no fresh installed compatibility test was performed.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R21 — PARTIAL**

  **Expected:** Embedded pages inherit Rancher's active color scheme, theme tokens, typography, host viewport, and native left navigation. Use supported extension registration and routing rather than a second sidebar or global CSS overrides. Groups, nested entries, disclosure controls, selected routes, and namespace context follow the installed Rancher's menu behavior. Preview chrome is standalone-only. Validate requested count placement and loading indicators against native menu capabilities; a preview demonstration alone does not prove native navigation support.

  **Current gap:** Native route reuses pages, but hardcoded dark colors remain and native typography/light theme were not visually verified.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R23 — FAIL**

  **Expected:** Use the DNS breadcrumb pattern: clickable manager name returns to Overview, followed by the current page; add clickable ancestors for nested editors where relevant. The manager title always opens Overview. Breadcrumbs and page headings use the same current route identity.

  **Current gap:** Breadcrumb has manager/current page but no clickable Snapshot ancestor for merge/coverage and no owning ancestor for the connection editor.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R25 — FAIL**

  **Expected:** Every page-changing interaction synchronizes the active navigation item, including metric cards, grid/resource links, breadcrumbs, contextual Help, and editor actions. Hidden Create/Edit routes select their owning visible inventory item. Navigating to a child reveals its menu group; manual collapse may highlight the owning group while retaining the active child page. Do not highlight multiple unrelated items.

  **Current gap:** Hidden page transitions leave no owning sidebar item active; visible page navigation does work.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R26 — FAIL**

  **Expected:** A count badge is red whenever a required dependency in that inventory/page scope is missing, unconfigured, unavailable, or failing. Explain the concrete blocking condition in its accessible description and tooltip, even when the item count is zero. Preserve the count's original meaning; do not substitute an incident total for a zone/record/item count. Optional or merely pending verification retains its appropriate separate state. Hiding a banner must not hide this required-failure indication. Diagnostics retains its warning/error event-count meaning.

  **Current gap:** Counts do not consistently expose missing required dependencies in the inventory's own scope.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R27 — FAIL**

  **Expected:** Loading is a separate count-badge state: show a small spinner in the fixed count slot while the associated data is pending, rather than temporarily marking it red because readiness is not yet known. Preserve the last known count in its accessible description. Once the request resolves, show the actual count and health severity; a timeout/confirmed required failure is red. Keep the spinner aligned with other count badges and respect reduced-motion preferences.

  **Current gap:** Page count uses shared refresh state immediately, not a scoped delayed read; native count loading was not proven.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R28 — PARTIAL**

  **Expected:** The user's Network Manager screenshots define the shared layout, spacing, color, and presentation reference for every plugin page: [inventory grid](docs/design-reference/network-manager-port-configurations.png) and [Overview master/detail](docs/design-reference/network-manager-overview.png). Use the grid pattern for inventories and the master/detail pattern where useful; retain their common heading, status area, filters, panels, and aligned bottom edge. Screenshot data/counts are examples, not requirements to reproduce those values.

  **Current gap:** Desktop largely matches the reference, but responsive shell, forms and header consistency remain uneven.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R31 — FAIL**

  **Expected:** Put all page actions, including Save/Save Draft, Test Connection, Cancel, selection-dependent actions, and manual refresh, in the top-right heading action row beside Refresh Every and its countdown. Modal confirmation controls remain within their dialog. Buttons in a group share width/height, padding, icon sizing, and alignment. Do not duplicate the page title inside its panel; retain distinct section headings where they communicate a separate subject.

  **Current gap:** Merge navigation, restore preparation and review actions remain in panel/footer content rather than the page action area.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R33 — FAIL**

  **Expected:** Align heading actions with the primary title. New, Merge, Apply, and conditional red Delete share one font, icon size, and button height. The Network Manager reference uses 14 px text, 18 px SVGs, and 40 px buttons; Refresh stays icon-only.

  **Current gap:** Rescan uses 12px instead of the shared 14px text; editor actions can occupy two rows instead of the title row.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R34 — FAIL**

  **Expected:** Buttons within the same action group share dimensions, icon size, padding, font, border radius, and alignment. Use a common width for adjacent labeled actions sized for the longest label; changing primary/danger/secondary styling must not change geometry. Icon-only groups use consistent square hit areas, and their icons and controls align with neighboring actions.

  **Current gap:** Rescan and New Configuration widths differ within the same group. Certificate Delete/New dimensions match in the measured state.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R35 — PARTIAL**

  **Expected:** Match Network Manager's shared buttons and refresh controls exactly by reusing its components and styles. Place Refresh Every, countdown, manual Refresh, and item count in the top-right heading action area, never in the filter/content row.

  **Current gap:** Shared components exist but Rescan and several workflow actions bypass their shared presentation/placement.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R36 — PARTIAL**

  **Expected:** Position the item count immediately right of Refresh. Hover/focus help must render above navigation and avoid clipping; use a body overlay with bounded placement rather than click-only explanations.

  **Current gap:** Help hover overlay clears navigation at z-index 2147483647. Count position fails at narrow widths.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R39 — FAIL**

  **Expected:** Fill the available viewport. Panels extend to the available bottom edge instead of stopping at an arbitrary content height.

  **Current gap:** At 600px every page expands beyond the viewport. Desktop primary panels reach the shared available bottom edge.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R40 — FAIL**

  **Expected:** The available viewport height is also the outer shell's maximum height. Account for Rancher's host chrome in native mode and the preview chrome in standalone mode; additional content must not expand the document into vertical page scrolling.

  **Current gap:** Mobile breakpoint explicitly enables automatic shell height and visible overflow, defeating viewport containment.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R41 — PARTIAL**

  **Expected:** Use internal panel scrolling. In a master/detail view, align both panels to the same bottom edge; the list scrolls independently, and details scroll when content exceeds the panel.

  **Current gap:** Desktop route/detail bottoms align and list scrolls internally. Snapshot operations can produce adjacent nested scrollbars.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R42 — PARTIAL**

  **Expected:** Bound overflowing inventories, forms, and detail content to the remaining panel height and use the shared custom scrollbar styling. Keep headings, actions, and filters visible while that content scrolls.

  **Current gap:** Desktop inventories/forms are bounded, but very little usable detail height remains at 720px and the mobile shell scrolls externally.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R43 — PARTIAL**

  **Expected:** Use `min-height: 0` / `min-width: 0` behavior in flex/grid content so long inventories do not push the shell beyond the viewport. Keep scrollbar gutters stable where appropriate.

  **Current gap:** Desktop flex/grid constraints use minimum zero sizes; the 600px override removes the bounded shell behavior.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R44 — FAIL**

  **Expected:** Adapt layouts at smaller widths without clipping actions, filters, or dialogs.

  **Current gap:** 600px pages overflow vertically; 800px counts wrap, and populated certificate/port editor controls wrap at 1280px.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R45 — FAIL**

  **Expected:** Use consistent card borders, rounded corners, spacing, input heights, and form alignment. Align controls even when labels wrap onto multiple lines.

  **Current gap:** Rancher URL input is native white and inline; Rescan sizing differs. Main schedule/mapping controls otherwise share alignment.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R46 — PARTIAL**

  **Expected:** Inherit Rancher's active theme, tokens, typography, and host viewport in embedded pages; scope styles to the plugin. Standalone previews use the observed compact Network Manager dark presentation as their fallback.

  **Current gap:** Scoped variables are used, but important action/help/count colors have hardcoded dark fallbacks; installed light theme was not tested.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R48 — FAIL**

  **Expected:** Keep collapsed sections visually connected with one divider between adjacent sections.

  **Current gap:** Expanded Help sections show duplicated divider lines; shared Overview collapsible sections use a single divider.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R49 — PARTIAL**

  **Expected:** Use title case for button and status labels. Keep explanatory text concise and practical.

  **Current gap:** Most visual buttons use title case, but Connection editor title, some state text and corrupted snapshot gate labels remain inconsistent.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R50 — PARTIAL**

  **Expected:** Use green for verified good/ready states, amber for pending/partial states, red for failures, and neutral styling for unknown or inapplicable states. Pair color with a readable label.

  **Current gap:** Overview and diagnostic severity badges use colors; certificate grid Ready/Pending and rollout state text are not consistently badge-styled.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R51 — PARTIAL**

  **Expected:** Status banners tint the entire banner background for their severity, matching Network Manager's full-width coverage notices. Pending/partial verification uses the amber/yellow warning surface, not only amber text or a colored border; errors use the corresponding error surface. Preserve readable contrast in both themes.

  **Current gap:** Dark preview severity banners tint their full background; native theme contrast remains unverified.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R52 — PARTIAL**

  **Expected:** Keep badges and attachment counts compact and on one line. Enlarged badges should have a deliberate purpose rather than making every status compete with the page heading.

  **Current gap:** List badges are compact on their own row; selected connection header badge/title crowding needs review at 1280px.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R53 — PARTIAL**

  **Expected:** Use the whole amber warning background for pending/partial verification. Management backend unavailable is a full red error banner. Each top-of-page banner type has its own Settings visibility checkbox; hiding a banner does not change status or authorize writes.

  **Current gap:** Coverage warning uses a full amber background. Missing/unavailable dependencies are not consistently reflected in scoped badges/notifications.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R54 — FAIL**

  **Expected:** Every yellow/amber warning or red error notification at the top of a page is clickable and keyboard accessible. Open the exact affected item's Create, Edit, or repair workflow directly, so the user can create, update, or fix it. Preserve cluster, namespace, resource identity, and relevant filter; select/reveal the item and prefill known context where applicable. Missing configuration opens its Create/setup flow; existing invalid configuration opens its Edit/fix flow. Multiple affected items open the scoped issue list with direct per-item fix actions. When the correction is external or no editor exists, open that item's specific diagnostic/recovery instructions. Avoid generic landing pages when a direct destination exists. Navigation must retain normal draft, authorization, review, snapshot, and confirmation gates; clicking the notification does not apply a fix. Other top-of-page alerts also open their relevant item/view or guide section.

  **Current gap:** Coverage banner opens a gap list, but gaps do not lead directly to the exact fix editor; other read-failure notices are static.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R55 — PARTIAL**

  **Expected:** The authenticated visual reference is `https://rancher.cormierconsulting.io`. Read-only inspection on 2026-10-11 found Lato 14 px typography and active tokens: body `#25282f`, body text `snow`, box `#171c22`, input `#25282f`, border `#38404b`, muted `#8f8f9c`, primary `#2f68df`, link `#9bbffd`. Embedded views consume these tokens dynamically; standalone previews use the observed theme as their fallback. Keep the normal host menu's group label and disclosure control separate, selected route behavior synchronized, and group expansion consistent with Rancher. Store this reference and observations, never credentials or copied authentication tokens.

  **Current gap:** Current preview resembles native dark navigation; live host theme values, focus/disabled states and light scheme need installed verification.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R59 — PARTIAL**

  **Expected:** Use Rancher's existing top-level multi-select namespace filter as the single namespace control for embedded pages. Omit duplicate page-level namespace selectors and filter every inventory, overview, diagnostics view, operation, and relevant count from the host context directly. Match namespace/project/user/system/cluster scopes. Combine namespace selections as OR, with other page filters as AND. The standalone preview supplies one global namespace control in its simulated host header. Verify the native store contract.

  **Current gap:** Standalone global picker is shared and captures use All Namespaces. Authenticated Rancher namespace changes in both directions were not tested.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R62 — PARTIAL**

  **Expected:** Include plugin-specific filters such as protocol, service/port configuration, zone, record type, component, severity, or generation source when applicable.

  **Current gap:** Overview protocols/ports and certificate/diagnostic filters exist; Snapshots lacks a dedicated Manual/Automatic generation filter.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R74 — PARTIAL**

  **Expected:** Review the exact affected resources before a bulk delete; preserve unrelated objects and Secrets.

  **Current gap:** UI reviews selected resources and excludes Secrets, but backend recovery snapshot coverage is not revalidated for general snapshot deletion.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R75 — PARTIAL**

  **Expected:** Distinguish observed resources, working drafts, validated pending proposals, and examples in both labels and counts. Inferred associations must not be presented as durable ownership.

  **Current gap:** Labels distinguish drafts/examples, but saving issuer/port proposals mutates the same inventory arrays used to represent current configuration.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R92 — PARTIAL**

  **Expected:** Each Overview variant supports keyword search across relevant names, namespaces, and identifiers, and consumes the single host namespace filter from section 4.

  **Current gap:** Overview keyword search consumes preview global namespace scope; installed host picker synchronization needs validation.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R94 — PARTIAL**

  **Expected:** Clicking an actionable card opens the corresponding page with the relevant filter.

  **Current gap:** Errors and pending cards navigate with meaningful scope; Referenced Certificates opens all certificates without a reference-only filter.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R98 — PARTIAL**

  **Expected:** Link Kubernetes resources to their native Rancher detail pages in the active cluster.

  **Current gap:** Native detail URL builder uses active cluster context; actual installed link targets were not verified.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R99 — FAIL**

  **Expected:** Namespace, workload, pod, Service, node, Secret-reference, and other Rancher resource references are clickable native detail links wherever a destination can be resolved. Use active cluster context and stable resource identity; standalone previews use the configured Rancher URL. Disclose unavailable destinations rather than rendering misleading links; show Secret metadata only.

  **Current gap:** Several namespace/resource references remain plain text, notably diagnostics and snapshot operation lists, instead of native detail links.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R105 — FAIL**

  **Expected:** Reuse form spacing, labels, help, validation feedback, and action placement across editors.

  **Current gap:** Forms differ in input styling and action placement; certificate/port forms wrap header controls and Settings URL is unstyled.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R108 — PARTIAL**

  **Expected:** Retain user-entered names and overrides. Provide an explicit Use Suggested Name action rather than overwriting a customized name when another selection changes.

  **Current gap:** Conditional generation preserves manual Secret-name overrides, but an explicit Use Suggested Name control is not consistently provided.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R111 — PARTIAL**

  **Expected:** Validate dependencies, incompatible options, missing references, and conflicting mappings before creating a rollout proposal. Repeat authoritative validation on the server before writes.

  **Current gap:** Local model validates mapping/dependency constraints; authoritative live backend validation and ownership revision checks are not verified.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R112 — PARTIAL**

  **Expected:** Offer Save Draft And Leave, Discard Changes, and Stay On This Page when navigation would lose unsaved changes. Cover both the plugin's controls and native Rancher route changes.

  **Current gap:** Actual connection leave prompt showed Save Draft/Discard/Stay; other forms register the guard. Native/browser-unload integration remains unverified.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R114 — FAIL**

  **Expected:** Keep Cancel beside the other form actions as an outlined/secondary button.

  **Current gap:** Shared header CSS overrides secondary Cancel styling, making it solid blue like primary actions.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R116 — PARTIAL**

  **Expected:** Distinguish saving a draft from publishing/applying it. Disable live actions without a working, authenticated backend; saving local state must not claim a live resource was changed.

  **Current gap:** Draft saving and Apply are separated; live Apply is disabled without backend capability. Real authenticated execution is absent/unverified.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R117 — PARTIAL**

  **Expected:** Integration editors that configure a connection provide **Test Connection** using the current unsaved settings. Show the tested scope, result, and observation time; invalidate the result when connection settings change. Distinguish network reachability from authentication and the required service operations. Testing does not save or mutate managed configuration, and a missing backend cannot report a successful test.

  **Current gap:** Relevant provider configuration exposes credentials as references, but has no current-settings Test Connection with freshness/retest feedback.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R119 — PARTIAL**

  **Expected:** All unapplied managed changes are saved as drafts and visible in Pending Rollouts, including incomplete drafts labeled Needs Completion. Validate a draft into a reviewable proposal before enabling Apply. A form save stages the change without applying it. Apply from Pending Rollouts starts the backend operation, visible in Running Processes with its actual state and results. This includes ordering and configuration changes: the snapshot/revision gate runs before execution, and active navigation reflects confirmed configuration rather than an unapplied draft. Local display preferences and non-mutating tests do not create rollouts.

  **Current gap:** Pending proposals and simulated processes exist; current-state arrays can change before Apply and actual backend execution/readback is not verified.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R121 — PARTIAL**

  **Expected:** Provide the affected resource list, scope, current/proposed configuration, and downloadable manifests or equivalent native configuration before application.

  **Current gap:** Affected scope and proposed manifests are available, but authoritative before/after ownership data requires a real backend.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R123 — PARTIAL**

  **Expected:** For reusable configurations, show affected consumers before updating them. Editing a preset alone does not silently update existing consumers; reconfiguration is an explicit reviewed operation.

  **Current gap:** Consumers are exposed in reconfiguration review, but saved presets update current preview inventory before reviewed Apply.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R124 — PARTIAL**

  **Expected:** Validate the complete affected group before applying it. Aim for consistent group changes and report partial failures truthfully when the backend cannot provide transactions.

  **Current gap:** Local affected-group validation is tested. Live transactional/partial failure reconciliation is not proven.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R125 — PARTIAL**

  **Expected:** Detect concurrent edits or changed dependencies and require a fresh review instead of overwriting them.

  **Current gap:** Local dependency changes invalidate review. Real resourceVersion checks against concurrent cluster writes are not tested.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R126 — PARTIAL**

  **Expected:** Detect Helm/Fleet/controller ownership and route edits through the owning source or clearly explain the reconciliation consequence before enabling a conflicting mutation.

  **Current gap:** Helm ownership is displayed; routing live changes through Helm/Fleet/controller source is not implemented/verified in preview.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R127 — PARTIAL**

  **Expected:** Track submitted work on the required Running Processes page, including operation, namespace/scope, status, start time, affected resources, progress when known, and configuration details.

  **Current gap:** Page exists with operation/status/times. Actual asynchronous backend jobs are not connected; available activity is simulated.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R130 — PARTIAL**

  **Expected:** Store snapshots in a dedicated persistent server location, outside rotating logs. Confirm backend storage before satisfying any backup gate. Keep the volume in an independent backup policy; replication/persistence alone is not a backup.

  **Current gap:** Dedicated snapshot directory and persistent volume configuration exist; independent host backup/migration coverage was not proven.

  **Responsibility:** Mixed: agent storage/recovery checks plus user approved storage target.

  **What you need to do:** Identify a disposable test PVC/volume, applicable quotas and the independent backup/migration policy. Approve the concrete test capture/restart/recovery scope; production volumes are not required.

- [x] **R132 — FAIL**

  **Expected:** Capture persisted pre-change configuration separately from local proposals and declared dependencies. Include Secret manifests/values only with Include Secrets; otherwise retain references and disclose omitted credential coverage. Exclude application/PV data. List unavailable Secrets and the observation time.

  **Current gap:** Capture reads arrays already updated by saved proposals, allowing proposed values to masquerade as persisted pre-change configuration.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R135 — PARTIAL**

  **Expected:** Passwords are transient capture/export inputs: do not place them in drafts, browser storage, logs, or the archive index. Clear them on completion/cancellation. Never emit an unencrypted Secret-inclusive file when encryption fails. Verify that correct-password recovery succeeds and wrong/missing-password access fails before treating encrypted backup creation as successful.

  **Current gap:** Password handling clears transient inputs and avoids saved index fields; a full runtime browser-memory/log audit was not performed.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R137 — PARTIAL**

  **Expected:** Provide listing, search, scope/generation filters, manual capture, downloads, uploads, inspection, comparison, selected restoration with dependencies, merge, protected backup deletion, automatic scheduling, and retention cleanup.

  **Current gap:** Listing/search/scope/merge/restore/ZIP work locally; dedicated generation filter is absent and server deletion coverage is insufficient.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R140 — PARTIAL**

  **Expected:** Use the common header actions/help/refresh/count shell. New uses a plus; Delete uses a red trash action with matching geometry. Scope filters include Manual or Automatic generation and date ranges with calendar selection, optional times, Clear Range, and convenient start-to-end selection.

  **Current gap:** Common heading, icon actions, count, Group By and date range exist; generation filter and workflow header placement are incomplete.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R141 — FAIL**

  **Expected:** For reconfiguration, rollback, restoration, bulk deletion, and ordering changes, verify a matching snapshot captured within the previous 24 hours for the complete affected configuration. Recheck coverage, age, and revisions at execution time. Changes invalidate coverage; a recent timestamp alone is insufficient.

  **Current gap:** Client gates compare content/age, but proposed/current conflation and server deletion's age-only recovery check violate full persisted affected-scope validation.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R143 — PARTIAL**

  **Expected:** Restoration reviews affected items/dependencies and what will be overwritten. Require a fresh current-state snapshot and explicit overwrite confirmation. Block uncovered consumers, missing dependencies, and newer conflicting edits.

  **Current gap:** Selection/diff/current-state backup gate and confirmation are present, but authoritative current baseline and final live revision checks are unverified.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R145 — PARTIAL**

  **Expected:** Prepare restoration drafts in Pending Rollouts; Apply is a separate reviewed backend operation tracked in Running Processes. Preserve capture provenance.

  **Current gap:** Restoration prepares pending drafts. Separate live backend Apply and actual Running Processes readback remain unavailable/unverified.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R147 — PARTIAL**

  **Expected:** Begin with Verify Snapshot Passwords when preparing selected sources. List every protected snapshot with its own password input, a Test Password action, and an adjacent Apply To All Snapshots action. Applying a password never verifies it. Provide Test All Passwords and show actual archive-decryption results per snapshot. Editing or copying passwords invalidates prior verification. Reverify before continuing; do not rely on a nonempty field or cached success alone.

  **Current gap:** Dedicated password verification supports encrypted sessions; actual UI traversal used unencrypted safe fixtures and source count showed zero before accepting two verified sources.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R149 — PARTIAL**

  **Expected:** Merge opens a dedicated page in the shared shell. Its navigable stepper is Override Priority, one selection step per relevant item type, Review Differences, Final Summary. Each plugin adapter supplies its item types, selection order, stable identities, and dependency relationships in its own standard.

  **Current gap:** Dedicated navigable per-type wizard exists and is visually reviewed; issuer identity collision prevents correct flattening in some namespaced cases.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R150 — FAIL**

  **Expected:** Highest-priority sources override lower ones by stable item identity, taking a complete item from the winning source; missing items come from lower sources. Support drag ordering and accessible keyboard controls.

  **Current gap:** Highest source priority is implemented, but profile identity issuer-profile/name omits namespace and collapses unrelated profiles.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R152 — PARTIAL**

  **Expected:** Automatically include known required dependencies; block unresolved dependencies. Keep selection, comparison, summaries, and backup output consistent.

  **Current gap:** Known dependencies are expanded and missing ones block merge/restore; namespace-colliding profile identity can corrupt the effective dependency set.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R153 — PARTIAL**

  **Expected:** Changed Secrets default to keeping readable current credentials; selecting a snapshot version requires an explicit choice. Read current versions of every source Secret as well as currently referenced Secrets, including after references change. Failed reads cannot silently reuse stale credentials. If current values are unavailable, preserve the saved version in the backup and disclose the gap. Matching Secrets keep their original capture provenance. Merge never writes live credentials and follows the same Include Secrets/encryption contract as capture.

  **Current gap:** Current credentials take precedence where readable and saved provenance is retained. The live authenticated Secret-read path was not tested in the browser.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R154 — FAIL**

  **Expected:** Compare the effective flattened selection against current configuration, side by side, showing additions/content changes only. Shared IDs alone are not conflicts; matching and current-only items are excluded and never implicitly deleted. Ignore transient controller status/resource-version changes in comparisons.

  **Current gap:** Comparison omits persistent metadata.labels; a metadata-only Service change is wrongly reported Unchanged and may disappear from review.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R155 — PARTIAL**

  **Expected:** Final confirmation states scope, precedence, added/changed counts, and whether originals are retained. Offer Remove These Snapshots When Merged; partial merges that omit configuration retain originals. Save durably before any source removal. Cleanup failure leaves a successful save intact and permits separate cleanup without retrying the merge. Preserve per-item capture dates through merges and subset selection: merging old content does not make its coverage fresh.

  **Current gap:** Durable merge/provenance/omission protection exists. General original-deletion recovery content is not validated server-side.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R157 — PARTIAL**

  **Expected:** Show per-resource coverage and snapshot history. The coverage display checks the last seven days: green matching, amber partial/differing, red no recent applicable copy. This display window is separate from the 24-hour mutation gate. Multiple snapshots may collectively cover known configuration; fixtures do not prove live backup.

  **Current gap:** Seven-day status/history UI works; identity/content omissions can produce inaccurate matching coverage.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R165 — PARTIAL**

  **Expected:** Immediately below both panels, provide a separate row spanning 100% of the combined width, divided into three equal columns: Available Drive Space, Largest Snapshot, and Estimated Run Out Of Space. No storage figures belong inside either schedule panel. Format examples (illustrative, never hardcoded): `Available Drive Space: 950.8 GB / 1.1 TB`; `Largest Snapshot: 555.6 KB · Approximately 1,711,350 More Snapshots Fit`.

  **Current gap:** Storage has a full-width three-column row, but its default collapsed disclosure hides the required figures until opened.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R166 — PARTIAL**

  **Expected:** Available storage means bytes writable by the service account at the configured destination: available filesystem space bounded by any smaller remaining PVC, dataset, volume, tenant, or application quota. Do not show parent drive capacity as backup capacity or double-count replicas. Required limits that cannot be measured show Unavailable with a reason, never zero or a fabricated exhaustion date.

  **Current gap:** Effective configured quota and filesystem free bytes are combined; real service-account/PVC volume-limit discovery was not tested in deployment.

  **Responsibility:** Mixed: agent storage/recovery checks plus user approved storage target.

  **What you need to do:** Identify a disposable test PVC/volume, applicable quotas and the independent backup/migration policy. Approve the concrete test capture/restart/recovery scope; production volumes are not required.

- [x] **R175 — PARTIAL**

  **Expected:** For a delayed data request (300 ms default), show a centered loading indicator over a blurred/dimmed page with an accessible loading status. Preserve the underlying editor and data rather than remounting them. Fail an unanswered request after 60 seconds with a visible timeout message; retry failed reads every 60 seconds except confirmed source disconnections, which retry every five seconds and restore the regular five-minute refresh after verified recovery. Show count spinners only during delayed requests; confirmed failures remain red between attempts. Retry until successful or cancelled. Show the retry countdown, prevent overlapping requests, abort abandoned requests, and ignore late responses. Clear the overlay on response/cancellation. Do not automatically replay timed-out rollout writes; reconcile their backend operation status before any explicit retry.

  **Current gap:** Delayed overlay/timeout/retry code exists; actual slow backend focus/retry transitions were not forced in this audit.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R176 — FAIL**

  **Expected:** Reserve loading indicators for actual delayed requests (300 ms default); idle, unconfigured sources and retry countdowns are not loading. Keep confirmed failures visible between attempts. Missing configuration requires configuration, not probes.

  **Current gap:** Count spinner follows global refreshing immediately rather than only its delayed associated data request.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R177 — PARTIAL**

  **Expected:** Diagnostics follows Network Manager's filter layout with keyword search, multi-select namespace scope from Rancher's global selector, log source, severity (Debug, Info, Warn, Error), and lookback. Discover relevant running resources and controller replicas as sources via the backend, and label unavailable collections distinctly. The navigation badge counts only warnings/errors over the rolling last 24 hours, independent of view filters: neutral zero, yellow warnings-only, or red combined warnings and errors when any error exists. Identify scope (browser vs managed-resource logs).

  **Current gap:** Aligned filters and host scope exist locally; real Rancher controller replica discovery and live logs are not connected.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R182 — PARTIAL**

  **Expected:** Every top-of-page notification/banner type has its own labeled visibility checkbox in Settings. New banner types must add the matching preference rather than relying on a single global hide switch. Apply preferences consistently across pages and persist them per browser; hiding a banner does not alter underlying status or bypass required validation, backup, or write controls.

  **Current gap:** Preview, snapshot, inspection and read failure controls exist; all dependency warning types are not implemented as independently controlled notifications.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R185 — PARTIAL**

  **Expected:** Provide the Rancher URL and other relevant connection/configuration settings on the shared Settings page, alongside per-banner visibility preferences.

  **Current gap:** Rancher URL and visibility controls exist; functional management connection configuration/testing is not connected.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R188 — NOT_VERIFIED**

  **Expected:** Reuse Rancher's authenticated session and enforce the active user's permissions for both reads and writes. Loading an authenticated UI is not sufficient backend authorization.

  **Current gap:** No authenticated native read/write or server authorization acceptance test was performed; preview cannot prove enforcement.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R189 — PARTIAL**

  **Expected:** Keep backend credentials and private keys out of browser state, repository files, plaintext exports, and logs. The explicit Include Secrets encrypted-backup flow is the exception for recovery exports; never display its values in the UI. Show Secret reference names/keys rather than Secret values.

  **Current gap:** Encrypted explicit recovery path is supported and screen values are redacted; complete browser/log credential isolation requires live integration validation.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R191 — NOT_VERIFIED**

  **Expected:** The plugin manages configuration; managed routing/DNS must continue if its UI or management API fails.

  **Current gap:** Management runtime is separate architecturally; real routing continuity during UI/API failure was not exercised.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R192 — PARTIAL**

  **Expected:** Use versioned extension assets and a Helm chart registering `UIPlugin`. Publish the Rancher `files.txt` plus `plugin/` layout, not merely a standalone JavaScript URL.

  **Current gap:** UIPlugin chart/assets structure is present; native published files and clean install verification were not run.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R193 — PARTIAL**

  **Expected:** Separate UI registration, asset hosting, management backend, and managed workloads. Clearly document which chart installs which resources; registration alone does not install those dependencies.

  **Current gap:** Deployment roles are documented; chart registration/runtime separation still needs an installed acceptance check.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R197 — PARTIAL**

  **Expected:** Match the Network Manager development workflow: `npm install` (or `npm ci` with the lockfile), `npm run preview`, and `npm run build:preview`. Pin dependencies and retain the lockfile.

  **Current gap:** Shared npm scripts and lockfile are present and build passes; clean dependency installation was not repeated on the dirty workspace.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R198 — NOT_VERIFIED**

  **Expected:** `npm run preview` must start a usable browser-based plugin UI directly from the local project after dependency installation. It must work without Docker or Docker Compose, container image builds, a full application deployment, or a Kubernetes/Helm installation. Optional container/backend integration previews may supplement this npm workflow but cannot replace it or become prerequisites. Use clearly labeled fixtures/local adapters for unavailable services so pages, navigation, forms, selection actions, and draft flows can be previewed locally.

  **Current gap:** The audit ran a local built UI, not a fresh npm preview with Docker stopped. Optional backend startup failure remains a source-level concern.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R230 — PARTIAL**

  **Expected:** Each plugin folder supports `npm run preview`; repository-root `npm run preview` launches all registered plugins together for cross-plugin consistency checks. Support choosing named plugins and stop only processes started by that run. Present the selected plugins in one browser page, with side-by-side and full-width views that retain each plugin's active state. Prepopulate one temporary project-owned session datasource using the shared contract, with separate logical plugin records and snapshot directories. Saves persist within that session without changing the seed fixtures; retain session files after stopping. Start preview-only labels and banners disabled, while identifying mock data in the suite shell. This display preference must not disable mock data or real issue notifications.

  **Current gap:** Suite supports registered plugin selection/session state in source; cross-plugin side-by-side behavior and process ownership were not visually tested in this Network-only audit.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R201 — PARTIAL**

  **Expected:** Use one shared datasource contract for normalized inventory, saved state, refresh, capabilities, and reviewed writes. Project-owned JSON mock sources are editable and saveable through npm previews, including provenance/schema information. Persist valid edits atomically with revision conflict checks and visible failures. Native Rancher API adapters implement the same contract through authenticated reads and reviewed writes; changing providers must not require rewriting page UI. Credentials, passwords, and decrypted Secret values must never enter mock files.

  **Current gap:** Swappable inventory/state contract exists, but concrete authenticated native provider is not end-to-end verified.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R231 — NOT_VERIFIED**

  **Expected:** Every feature and ability must have representative demo data pulled from its authoritative source where available, scrubbed before persistence, and saved in one project-owned global local demo database/data file shared by the plugin suite. Include the states needed to exercise the feature, such as populated and empty inventories, dependencies, drafts, warnings, errors, and operation results. Preserve source identity, capture time, schema version, and the scrubbing rules; label synthetic scenarios and never present them as live observations. Remove real credentials, Secret values, private keys, personal information, and sensitive identifiers; use safe replacements that retain referential consistency. Track and synchronize the global demo file with Git LFS and include its tracked pointer in the repository, so a normal checkout with LFS provides the prepopulated data. Document LFS setup/pull and report missing LFS content clearly. Root and per-plugin npm previews consume this same global source through the swappable datasource contract; preview saves use editable local/session copies rather than overwrite the distributed seed. A new feature is incomplete until its representative data, scrub/validation checks, and UI tests are included.

  **Current gap:** Global Git LFS feature-scenario completeness, authoritative scrubbing and missing-LFS startup need a separate fixture audit; small merge fixtures do not prove every feature's demo coverage.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R202 — PARTIAL**

  **Expected:** Keep the standalone Rancher-like shell outside native integration; reuse the manager's Vue page components for the preview and native routes. Native pages use Rancher's own chrome.

  **Current gap:** Standalone chrome is outside the shared Dashboard. Actual native header/sidebar inheritance was not visually inspected.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R203 — PARTIAL**

  **Expected:** Interface preview startup must not require cluster credentials, Windows connectivity, the managed service, a live management backend, or any Docker/test containers. Label sample inventory and simulated status. Document browser-only preview state separately from backend-confirmed durable snapshots.

  **Current gap:** Preview needs no cluster credentials, but optional local snapshot helper startup can reject Vite setup; failure-tolerant startup needs a test.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R205 — NOT_VERIFIED**

  **Expected:** Verify native integration, authorization, live observation, server validation, and result readback before marking a live feature implemented.

  **Current gap:** Native integration, permissions, server validation and result readback remain required before declaring live readiness.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R206 — NOT_VERIFIED**

  **Expected:** Deliver an installable Helm-based package that deploys the application's runtime and registers its Rancher management interface in the native left navigation. Build the actual extension bundle, page routes, Explorer menu registration, and operator-compatible extension chart; a generic workload chart or Vite preview alone does not register a Rancher UI extension. Declare the compatible Rancher version and required extension operator/CRDs. When Rancher's management cluster and workload cluster differ, explicitly target both: a Helm release only creates resources in its target cluster. Keep one documented installation workflow without claiming a single ordinary release can implicitly configure another cluster. Release acceptance includes a clean Helm install, visible native menu/routes, theme/namespace integration, refresh recovery, upgrade, and uninstall checks. See [Rancher's extension packaging](https://extensions.rancher.io/extensions/v2/publishing) and [native side-menu registration](https://extensions.rancher.io/extensions/next/api/nav/side-menu).

  **Current gap:** Packaging source exists; no clean install/upgrade/uninstall or runtime/register acceptance test was performed.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R207 — PARTIAL**

  **Expected:** [ ] Native group opens Overview; menus, resource identities, and counts use the correct context.

  **Current gap:** Preview manager opens Overview and scoped counts exist; hidden ownership and native context/authorization require fixes/verification.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R208 — FAIL**

  **Expected:** [ ] Shared heading/actions/help, viewport layout, internal scrolling, and responsive behavior work.

  **Current gap:** Shared desktop shell works, but mobile overflow, action wrapping, Rescan sizing and panel workflow actions fail measured requirements.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R210 — PARTIAL**

  **Expected:** [ ] Filters/search/grouping honor scope; icon actions do not accidentally toggle rows.

  **Current gap:** Local filters/grouping and action event isolation work; live host namespace bidirectional synchronization remains unverified.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R213 — PARTIAL**

  **Expected:** [ ] Keyboard navigation, labels, focus, dialogs, and non-color status descriptions are usable.

  **Current gap:** Labels, focus popup and guards were checked; corrupted snapshot gate text and untested full keyboard/native accessibility prevent full acceptance.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R214 — PARTIAL**

  **Expected:** [ ] New/edit forms preserve intentional overrides and guard unsaved navigation.

  **Current gap:** Clean/edit guard flow works locally, but explicit suggested-name reset and native navigation behavior need completion/verification.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R216 — PARTIAL**

  **Expected:** [ ] Working drafts, validated proposals, submitted processes, examples, and durable snapshots are distinct.

  **Current gap:** Labels distinguish working/pending/process/snapshot states, but current inventory arrays still absorb unapplied issuer/port proposals.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R217 — PARTIAL**

  **Expected:** [ ] Changes expose affected resources, ownership, before/after review, and concurrency validation.

  **Current gap:** Local affected/diff views exist; authoritative ownership/revision and persisted-current separation are incomplete/unverified.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R218 — FAIL**

  **Expected:** [ ] Applicable mutation gates verify recent full-scope backup and recheck before execution.

  **Current gap:** Pre-change baseline conflation and server age-only deletion check prevent acceptance of full-scope execution backup verification.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R221 — PARTIAL**

  **Expected:** [ ] ZIP/Include Secrets encryption, recovery, provenance, merge, and presence-only banner rules work.

  **Current gap:** Encryption/ZIP/provenance/presence checks pass existing tests, but targeted namespaced issuer and persistent metadata regressions fail.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R222 — PARTIAL**

  **Expected:** [ ] Storage reports effective writable quota and uses complete ZIP sizes for estimates.

  **Current gap:** Configured writable quota/ZIP estimate logic works; default collapsed display and actual deployed quota verification remain open.

  **Responsibility:** Mixed: agent storage/recovery checks plus user approved storage target.

  **What you need to do:** Identify a disposable test PVC/volume, applicable quotas and the independent backup/migration policy. Approve the concrete test capture/restart/recovery scope; production volumes are not required.

- [x] **R223 — PARTIAL**

  **Expected:** [ ] Common pages, contextual Help, per-banner Settings, and scoped Diagnostics follow this standard.

  **Current gap:** Help, Settings and Diagnostics use shared shell, but styling/dividers/count state/resource links are not fully consistent.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R224 — FAIL**

  **Expected:** [ ] Yellow/red top-of-page notifications open the exact item Create/Edit/fix flow with scope preserved, keyboard access, and the normal mutation review gates.

  **Current gap:** Warning/error notices do not all open scoped item fix editors with mutation review preserved.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R225 — NOT_VERIFIED**

  **Expected:** [ ] Backend authorization and credential handling are verified; hidden notices do not change capabilities.

  **Current gap:** No installed authenticated backend permission matrix/credential handling validation was performed.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R226 — NOT_VERIFIED**

  **Expected:** [ ] Managed service operation continues during UI/management failure.

  **Current gap:** Managed traffic during real UI/backend failure remains untested.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R227 — NOT_VERIFIED**

  **Expected:** [ ] Native release packaging and installation are verified separately from standalone preview/build.

  **Current gap:** Native publication and installation were not performed; successful standalone build is not release evidence.

  **Responsibility:** Mixed: agent implementation plus user test-environment authorization.

  **What you need to do:** Confirm non-production Rancher target/disposable namespace and authorized role-based test identities; approve test-only deployment/mutations when a concrete package/test plan is ready. No secrets in chat.

- [x] **R228 — PARTIAL**

  **Expected:** [ ] Repository-owned local interface preview starts and builds using the shared npm workflow.

  **Current gap:** Local built UI and build pass; clean npm preview startup on a fresh environment remains unverified.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R232 — NOT_VERIFIED**

  **Expected:** [ ] Every feature has scrubbed representative scenarios in the repository's global Git LFS demo database/data file; previews consume it through the shared provider.

  **Current gap:** No complete global LFS scenario/scrubbing/provider acceptance run was performed.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.

- [x] **R229 — NOT_VERIFIED**

  **Expected:** [ ] `npm run preview` provides usable plugin UI with Docker stopped and without backend, cluster, container-build, or deployment prerequisites.

  **Current gap:** No Docker-stopped/backend-absent fresh npm preview acceptance test was performed.

  **Responsibility:** Agent: local implementation or evidence.

  **What you need to do:** None. The standards already specify the expected result; this is not blocked on credentials, a design decision, or production access.
