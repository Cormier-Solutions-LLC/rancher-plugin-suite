# Rancher Plugin Design Standard

Status: reusable design specification, derived from the current Network Manager design.
Captured: 2026-10-11.
Last updated: 2026-10-11. Maintain this document as implementation proceeds.
Applies to: our custom Rancher UI plugins, beginning with Network Manager and DNS Manager.

## 1. Purpose and source of requirements

Build managers that feel like part of Rancher and share navigation, layout, tables,
forms, review, backup, and operation tracking. Users should manage the relevant
system from one interface without losing their working changes.

This document consolidates the specifications recorded in the local Network
Manager README and shared components. It does not claim to reproduce requirements
that exist only in another conversation and are not recorded in these files.
The current implementation is evidence of the design, not proof that live features
are complete. A prototype limitation must not become a permanent product requirement.

Sources:

- [Network Manager Standards](NETWORK-MANAGER-STANDARDS.md) and [implementation notes](simple-network-manager-dev/README.md).
- [Current navigation](simple-network-manager-dev/pkg/simple-network-manager/navigation.ts)
  and [native Rancher registration](simple-network-manager-dev/pkg/simple-network-manager/product.ts).
- [Shared page shell](simple-network-manager-dev/pkg/simple-network-manager/pages/Dashboard.vue).
- [Reusable page components](simple-network-manager-dev/pkg/simple-network-manager/pages/).
- [Shared behavior and state](simple-network-manager-dev/pkg/simple-network-manager/data/).
- [Action styling](simple-network-manager-dev/pkg/simple-network-manager/styles/actions.css)
  and [scrollbar styling](simple-network-manager-dev/pkg/simple-network-manager/styles/scrollbars.css).
- [Manual recovery requirements](simple-network-manager-dev/RECOVERY.md).
- [DNS Manager design](DNS-MANAGER-DESIGN.md) and [local prototype notes](dns-manager-dev/README.md).
- [Network Manager preview evidence](simple-network-manager-dev/IMPLEMENTATION-REVIEW.md).

The [2026-10-11 Network Manager compliance audit](simple-network-manager-dev/docs/audit-2026-10-11/report.md)
contains a pinned copy of this standard, a requirement-by-requirement assessment,
visual evidence, reproducible regression tests, and a remediation plan. Its local
preview results do not certify native installation or live execution.

Shared requirements apply where the feature is relevant. A DNS plugin does not
need certificate-issuance or routing forms simply because Network Manager has them.
Plugin-specific pages and resource semantics belong in that plugin's own specification.
Update this shared standard whenever an accepted cross-plugin behavior changes;
update the affected plugin specification in the same change. Record what is required,
what has been implemented, and what has been verified separately. Local fixture tests
do not establish production availability or external-system compatibility. Keep
prototype limitations visible without converting them into product requirements.
This file is the authoritative home for common-page requirements, including
Pending Rollouts, Running Processes, Snapshots, Diagnostics, Settings, and Help.
Plugin documents retain domain-specific resources, adapters, operation semantics,
and implementation evidence, and link here instead of maintaining competing copies.
An explicitly accepted revision supersedes an older requirement; preview behavior
does not. Ask the user to resolve conflicting requirements without an explicit
supersession before choosing one. Historical evidence remains historical.

## 2. Native integration and navigation

Accepted shared UI review (2026-10-11, completed revision 94): use Network Manager's
menu style and structure, including native right-aligned counts, for both managers.
This supersedes the earlier fixed-left count proposal. See [Network Manager navigation](NETWORK-MANAGER-STANDARDS.md#navigation-and-inventory).
Host menu rendering and its global namespace selector remain authoritative; a
standalone approximation does not establish installed compatibility.


- Register a native UI extension in the selected cluster's Explorer navigation.
- Use an expandable manager group with the application's name. Its label opens
  Overview and reveals the group, including when another child is active; keep
  disclosure controls distinct from route labels and follow native menu behavior.
- Make Overview the default page and clearly indicate the active page.
- Every manager ends with Pending Rollouts, Running Processes, Snapshots,
  Diagnostics, Settings, Help, in that order. Inventory pages and their dynamic
  resource entries precede this shared group. These common pages are specified here.
- Prefer useful flat inventory pages; use nested expandable resource groups where
  relevant. Avoid redundant inventories. Create/Edit routes remain hidden from the
  sidebar and are reached through contextual actions.
- Dynamic resource entries use stable identities, meaningful resource labels,
  and the active user's access, rather than positional indexes.
- Use compact reactive count badges right-aligned after menu labels, following
  Network Manager and the installed Rancher menu. Align counts across top-level
  and nested entries. Disclosure arrows occupy a separate slot without shifting counts.
  Zone/domain entries show scoped record counts. An unavailable inventory is not zero.
- Relevant page header, navigation, and Overview counts share the same scoped data;
  header counts sit immediately after Refresh. Example values are not fixed requirements.
- Keep cluster identity visible and honor Rancher's cluster and namespace context.
- Treat placement near Compliance as the Network Manager reference; validate ordering
  in the installed Rancher version rather than assuming a weight guarantees placement.
- Target the recorded Rancher 2.15.x / Extensions API 3 environment initially;
  recheck compatibility when Rancher or the extension SDK changes.
- Embedded pages inherit Rancher's active color scheme, theme tokens, typography,
  host viewport, and native left navigation. Use supported extension registration
  and routing rather than a second sidebar or global CSS overrides. Groups, nested
  entries, disclosure controls, selected routes, and namespace context follow the
  installed Rancher's menu behavior. Preview chrome is standalone-only. Validate
  requested count placement and loading indicators against native menu capabilities;
  a preview demonstration alone does not prove native navigation support.
- Display counts only when they represent a relevant inventory or operation. Help and Settings
  have no counts. Reuse compact right-aligned navigation badges for domain/zone record counts,
  header counts, and other relevant inventories.
- Use the DNS breadcrumb pattern: clickable manager name returns to Overview, followed by the
  current page; add clickable ancestors for nested editors where relevant. The manager title
  always opens Overview. Breadcrumbs and page headings use the same current route identity.
- Zones is expandable/collapsible, with zone entries nested beneath it and record-count badges.
  Clicking its label opens the inventory; a separate arrow toggles children. Preserve active
  page, persisted order, counts, and expansion preference. Other inventory groups
  may use the same relevant pattern.
- Every page-changing interaction synchronizes the active navigation item, including
  metric cards, grid/resource links, breadcrumbs, contextual Help, and editor actions.
  Hidden Create/Edit routes select their owning visible inventory item. Navigating
  to a child reveals its menu group; manual collapse may highlight the owning group
  while retaining the active child page. Do not highlight multiple unrelated items.
- A count badge is red whenever a required dependency in that inventory/page scope
  is missing, unconfigured, unavailable, or failing. Explain the concrete blocking
  condition in its accessible description and tooltip, even when the item count is
  zero. Preserve the count's original meaning; do not substitute an incident total
  for a zone/record/item count. Optional or merely pending verification retains its
  appropriate separate state. Hiding a banner must not hide this required-failure
  indication. Diagnostics retains its warning/error event-count meaning.
- Loading is a separate count-badge state: show a small spinner in the fixed
  count slot while the associated data is pending, rather than temporarily marking
  it red because readiness is not yet known. Preserve the last known count in its
  accessible description. Once the request resolves, show the actual count and
  health severity; a timeout/confirmed required failure is red. Keep the spinner
  aligned with other count badges and respect reduced-motion preferences.

## 3. Page shell, layout, and styling

- The completed [UI review](docs/ui-comparison-2026-10-11/implementation.md)
  defines shared appearance: DNS shell, headings, grids, forms, notifications,
  settings, and help; Network navigation, action controls, filters, and review
  flow. Use both Summary and Master/Detail overview/detail variants for their
  respective information types. This supersedes earlier screenshot-only visual
  references. Application-specific data, fields, and operations remain local.
- Reuse one page shell across pages and across the standalone preview/native extension.
- Show manager name and cluster context, a clear page heading, a compact Help control,
  page-level actions, refresh controls, and an item count where useful.
- Put all page actions, including Save/Save Draft, Test Connection, Cancel, selection-dependent
  actions, and manual refresh, in the top-right heading action row beside Refresh Every and
  its countdown. Modal confirmation controls remain within their dialog. Buttons in a group
  share width/height, padding, icon sizing, and alignment. Do not duplicate the page title
  inside its panel; retain distinct section headings where they communicate a separate subject.
- Top-right actions that operate without a grid selection may appear whenever
  applicable. Any action that requires selected grid items stays hidden until
  items are explicitly selected; hide it again immediately when selection is cleared.
  This applies to Reorder, Delete, and every other selection-dependent operation,
  including applicable Merge, Apply, Reconfigure, Rescan, or Snapshot actions.
  Do not show a disabled button merely because no items are selected. Once items
  are selected, other unmet prerequisites may disable the action with an explanation.
  Create/New, Refresh, and editor actions use their own applicable context when
  they do not require grid selection.
- Align heading actions with the primary title. New, Merge, Apply, and conditional
  red Delete share one font, icon size, and button height. The Network Manager
  reference uses 14 px text, 18 px SVGs, and 40 px buttons; Refresh stays icon-only.
- Buttons within the same action group share dimensions, icon size, padding, font,
  border radius, and alignment. Use a common width for adjacent labeled actions
  sized for the longest label; changing primary/danger/secondary styling must not
  change geometry. Icon-only groups use consistent square hit areas, and their
  icons and controls align with neighboring actions.
- Use the common plugin's Network-style action buttons and DNS-style refresh
  presentation. Place Refresh Every, countdown, manual Refresh, and
  item count in the top-right heading action area, never in the filter/content row.
- Position the item count immediately right of Refresh. Hover/focus help must
  render above navigation and avoid clipping; use a body overlay with bounded
  placement rather than click-only explanations.
- Contextual Help/More Info uses an accessible circled question mark immediately
  beside its title, field, column, or status. Open a popup with Close and Open Help;
  reuse the relevant Help section. Open Help navigates to and expands that section.
  The Help page itself has no question-mark controls.
- Keep the heading, status information, and filters outside the scrolling content area.
- Fill the available viewport. Panels extend to the available bottom edge instead of
  stopping at an arbitrary content height.
- At desktop widths, the available viewport height is the outer shell's maximum height. Account
  for Rancher's host chrome in native mode and the preview chrome in standalone
  mode; additional content must not expand the document into vertical page scrolling.
- Use internal panel scrolling. In a master/detail view, align both panels to the same
  bottom edge; the list scrolls independently, and details scroll when content exceeds the panel.
- Bound overflowing inventories, forms, and detail content to the remaining panel
  height and use the shared custom scrollbar styling. Keep headings, actions, and
  filters visible while that content scrolls.
- Use `min-height: 0` / `min-width: 0` behavior in flex/grid content so long inventories
  do not push the shell beyond the viewport. Keep scrollbar gutters stable where appropriate.
- Adapt layouts at smaller widths without clipping actions, filters, or dialogs.
  Narrow layouts may scroll vertically to keep stacked panels and forms reachable;
  keep overflow inside wide tables. Schedule and cleanup panels and their action
  groups expand or wrap without horizontal or vertical scrollbars; the page scrolls.
- Use consistent card borders, rounded corners, spacing, input heights, and form alignment.
  Align controls even when labels wrap onto multiple lines.
- Inherit Rancher's active theme, tokens, typography, and host viewport in embedded
  pages; scope styles to the plugin. Standalone previews use the accepted DNS
  layout and light/dark palette with Network navigation and actions as their fallback.
- Use thin dark scrollbars matching the panels. Preserve operating-system forced-color choices.
- Keep collapsed sections visually connected with one divider between adjacent sections.
- Use title case for button and status labels. Keep explanatory text concise and practical.
- Use green for verified good/ready states, amber for pending/partial states, red for failures,
  and neutral styling for unknown or inapplicable states. Pair color with a readable label.
- Status banners tint the entire banner background for their severity, matching
  Network Manager's full-width coverage notices. Pending/partial verification uses
  the amber/yellow warning surface, not only amber text or a colored border; errors
  use the corresponding error surface. Preserve readable contrast in both themes.
- Keep badges and attachment counts compact and on one line. Enlarged badges should have
  a deliberate purpose rather than making every status compete with the page heading.
- Use the whole amber warning background for pending/partial verification. Management backend
  unavailable is a full red error banner. Each top-of-page banner type has its own Settings
  visibility checkbox; hiding a banner does not change status or authorize writes.
- Every yellow/amber warning or red error notification at the top of a page is
  clickable and keyboard accessible. Open the exact affected item's Create, Edit,
  or repair workflow directly, so the user can create, update, or fix it. Preserve
  cluster, namespace, resource identity, and relevant filter; select/reveal the item
  and prefill known context where applicable. Missing configuration opens its
  Create/setup flow; existing invalid configuration opens its Edit/fix flow.
  Multiple affected items open the scoped issue list with direct per-item fix actions.
  When the correction is external or no editor exists, open that item's specific
  diagnostic/recovery instructions. Avoid generic landing pages when a direct
  destination exists. Navigation must retain normal draft, authorization, review,
  snapshot, and confirmation gates; clicking the notification does not apply a fix.
  Other top-of-page alerts also open their relevant item/view or guide section.

### Visual reference, not a mandatory pixel contract

The existing standalone preview uses a roughly 240 px sidebar, 30 px content padding,
12–13 px inventory text, 29 px page headings, 5–7 px corner radii, and blue action/focus
accents. These values provide a starting point; native Rancher layout and responsive
behavior take precedence. Do not copy the standalone fake Rancher sidebar into the native plugin.

- The authenticated visual reference is `https://rancher.cormierconsulting.io`.
  Read-only inspection on 2026-10-11 found Lato 14 px typography and active tokens:
  body `#25282f`, body text `snow`, box `#171c22`, input `#25282f`, border `#38404b`,
  muted `#8f8f9c`, primary `#2f68df`, link `#9bbffd`. Embedded views consume these
  tokens dynamically; standalone previews use the observed theme as their fallback.
  Keep the normal host menu's group label and disclosure control separate, selected
  route behavior synchronized, and group expansion consistent with Rancher. Store
  this reference and observations, never credentials or copied authentication tokens.

## 4. Inventory, search, filters, and tables

- Use automatic grid column widths. Only actual selection columns use narrow fixed widths;
  text columns must not inherit those widths. Align text and its header left, numeric values
  and their headers right. Counts, priority, TTL, and sizes use numeric sorting/alignment.
- Sort file sizes by original bytes; use decimal B, KB, MB, GB, and TB units.

- Provide an Overview summary plus searchable inventory and selected-resource details.
- Use Rancher's existing top-level multi-select namespace filter as the single namespace
  control for embedded pages. Omit duplicate page-level namespace selectors and filter
  every inventory, overview, diagnostics view, operation, and relevant count from the host
  context directly. Match namespace/project/user/system/cluster scopes. Combine namespace
  selections as OR, with other page filters as AND. The standalone preview supplies one
  global namespace control in its simulated host header. Verify the native store contract.
- Use searchable multi-select filters with a selected count, clear-selection action,
  and an understandable empty/default label. Dismiss popovers on Escape or outside interaction.
- Combine selections with OR inside one filter and AND across different filter groups.
- Include plugin-specific filters such as protocol, service/port configuration, zone,
  record type, component, severity, or generation source when applicable.
- Search names and relevant identifiers, labels, destinations, and values.
  Document domain-specific search behavior in the plugin standard.
- Show a Namespace column when namespace is part of the resource's identity; do not
  redundantly embed it in the displayed name. Show shared resources as Global.
- Default configuration inventories to a flat list. Offer Group By Namespace where useful,
  placing Global first. Preserve shared configuration availability within relevant scopes.
- Use a shared grid with sortable labeled columns, visible direction, numeric-aware
  comparisons, and accessible sort state. Do not sort selection/action columns.
- Keep expanded detail rows attached to their parent during sorting and preserve group boundaries.
- Retain headers on an empty grid and show a clear empty/no-matches message.
- Clicking a configuration row opens read-only details. Action icons and selection
  checkboxes must not also toggle or select the row accidentally.
- Keep row action icons right-aligned, horizontal, and unwrapped, with consistent compact
  hit areas, tooltips, accessible names, and visible keyboard focus.
- Add selection checkboxes and Select All only to full inventory grids with meaningful
  selection actions. Compact/embedded tables, summary panels, cards, and detail
  lists do not gain checkboxes merely to make them selectable. Use normal row/card
  activation for details; when selecting in a full grid, apply the displayed scope.
- Explicit grid selection reveals applicable selection-dependent contextual buttons
  in the top-right page action area, including Reorder and Delete. Hide them with
  no selected items; merely opening/highlighting a details-only row is not grid
  selection. Hide inapplicable actions and explain other unmet prerequisites when
  disabling an action for an existing selection. Derive the action's affected
  scope from the explicit selection and show it in review; never silently affect
  unselected resources. Contextual buttons use the same dimensions, icon size,
  padding, and alignment as neighboring actions. Selecting a details-only row
  must not implicitly authorize a mutation.
- Use the DNS Manager preview's native checkbox presentation as the shared checkbox
  reference, superseding older Network Manager checkbox styling. Use real checkbox
  inputs with consistent size, theme, selection-column placement, spacing, and
  vertical alignment in headers and rows; do not substitute decorative checkbox icons.
  Keep checked, unchecked, disabled, focus, and partial-selection states clear.
  Select All reflects the displayed authorized scope and is indeterminate for a
  partial selection. Give every checkbox an accessible label and preserve keyboard
  interaction; selecting it must not also open row details. Reorder mode replaces
  these controls with handles according to the shared ordering standard.
- Review the exact affected resources before a bulk delete; preserve unrelated objects and Secrets.
- Distinguish observed resources, working drafts, validated pending proposals, and examples
  in both labels and counts. Inferred associations must not be presented as durable ownership.
- Match the user's [filter-row reference](docs/design-reference/network-manager-filter-row.png):
  labels above the controls, consistent control height/borders/padding, a leading
  disclosure arrow for multi-select namespace choices, and evenly spaced columns
  aligned along their control bottoms. Diagnostics orders these as Search,
  Lookback (hours), Log source, Severity on one row when space permits. Controls
  fill their columns and wrap responsively rather than clipping or changing size.

### Shared rank/priority editing: Reorder

This is a shared requirement for every plugin whenever a collection has a configurable
rank, priority, or manual order. Each application must explain what that order controls;
display/navigation order must not silently become service execution or DNS lookup order.

- Put **Reorder** in the top-right page action area when manual ranking is supported
  and grid items are selected, following the shared selection-dependent visibility
  rule. Delete follows the same rule; Create remains independent of selection.
- Normal mode shows row selection checkboxes; Reorder appears only with an explicit
  selection. Entering reorder mode replaces every row's selection checkbox with a
  drag handle and removes the Select All control. Selection enables entry into the
  ordering workflow; the complete authorized collection remains its reviewed scope.
- Clicking Reorder hides the Reorder button and shows Cancel in that action area.
  Create/Delete and bulk selection are unavailable while ordering is being edited.
- Entering reorder mode alone does not show Save. Show Save beside Cancel only when the
  proposed order differs from the persisted order. Moving rows back to the original order hides Save again.
- Support drag-and-drop ordering and a keyboard-accessible equivalent using the same handles.
  Show the intended drop position and keep the moved row's details attached to it.
- During reorder mode, the whole row is a drag target: users can grab it anywhere,
  not only by its handle. Keep the handle as a visual cue and keyboard control;
  suppress normal row navigation/selection while dragging and retain Cancel/Save semantics.
- Capture the persisted order and its revision on entry, and edit a separate local proposal.
  Dropping a row changes only that proposal; it must not write through automatically.
- Reorder the complete authorized collection in persisted priority order. Suspend table sorting,
  grouping, filtering, and pagination that would conceal or rearrange members during editing;
  do not silently renumber rows outside the user's writable scope.
- Cancel discards the proposed order, restores the persisted order and normal controls,
  and writes neither ordering configuration nor a rollout. Existing selection/view context may
  be restored for items that still exist. Guard navigation away from a changed proposal like any other form.
- Refresh may update status information but must not replace a proposed order. If membership,
  permissions, or the persisted revision changes, mark the proposal conflicted and require review
  against the current collection before saving; never silently overwrite concurrent changes.
- Save reviews the previous/proposed order and affected scope, then stages the
  ordering draft in Pending Rollouts. Apply there uses the standard snapshot flow:
  validate or capture a recent matching snapshot of persisted configuration, confirm
  storage, recheck coverage/revision, and persist the complete ordering configuration
  through the backend. Include stable IDs, order/ranks, scope, and revision.
- Use the existing 24-hour/full-coverage snapshot requirement for this configuration change.
  A browser-only reorder is not a successful save. Capture the old order, not the unsaved proposal,
  as the pre-change recovery state; store the proposed order separately in the change record.
- While saving, prevent duplicate submission and further dragging. Leave the proposal available
  with an error if validation, backup, or persistence fails. Do not report success before backend acknowledgment.
- After staging Save, return to normal mode, restore checkboxes, and recalculate
  action visibility from the current selection; Reorder/Delete stay hidden when
  nothing is selected. Hide Save/Cancel; active navigation retains the applied order. Update navigation
  only after Apply confirms persistence. The applied order must survive reloads
  and manager/backend restarts and be included in snapshot restoration.

| State | Row control | Top-right ordering actions |
|---|---|---|
| Normal, no selection | Selection checkbox | Applicable Create; Reorder/Delete hidden |
| Normal, items selected | Selection checkbox | Applicable Create, Reorder, and Delete |
| Reordering, unchanged | Drag handle | Cancel |
| Reordering, changed | Drag handle | Save and Cancel |
| Saving | Disabled drag handle | Busy/disabled Save and disabled Cancel |
| Save succeeded or canceled | Selection checkbox | Applicable Create; Reorder/Delete only with selection |

## 5. Overview and resource details

- Support two Overview design variants within the shared shell: **Summary** (DNS
  Manager's metric cards followed by flow/status and summary panels) and
  **Master/Detail** (Network Manager's metric cards and filters above a left
  selectable inventory and right details panel). These are reusable design patterns,
  not a requirement for an application to offer a runtime layout switch. Keep the
  current DNS Summary arrangement; choose the variant appropriate to the application.
- Each Overview variant supports keyword search across relevant names, namespaces,
  and identifiers, and consumes the single host namespace filter from section 4.
- Use compact statistic cards for actionable inventory, errors, related resources, and pending changes.
- Clicking an actionable card opens the corresponding page with the relevant filter.
- Overview exposes resumable working drafts and validated pending changes distinctly.
- Present the configured flow and resource context together where the application has a flow.
  Do not imply configured references prove successful traffic or service availability.
- Resource context includes namespace, owning application/controller, and applicable change state.
- Link Kubernetes resources to their native Rancher detail pages in the active cluster.
- Namespace, workload, pod, Service, node, Secret-reference, and other Rancher
  resource references are clickable native detail links wherever a destination
  can be resolved. Use active cluster context and stable resource identity;
  standalone previews use the configured Rancher URL. Disclose unavailable
  destinations rather than rendering misleading links; show Secret metadata only.
- Deep links into history/snapshots retain the selected resource scope and provide Clear Filter.
- Use collapsible detail sections to keep the default view readable; define
  domain-specific sections and their default expansion in the plugin standard.
- Open concrete HTTP/HTTPS address links in a new tab. Wildcards, regular expressions,
  raw TCP/SNI, and UDP addresses are references, not fabricated web URLs.
- Show internal Service addresses and forwarded endpoint addresses separately; resolve named
  ports from actual metadata, bracket IPv6 addresses, and explain unavailable/headless addresses.
- Address display is not a reachability check. Show the observation time/source when applicable.

## 6. Forms and working drafts

- Reuse form spacing, labels, help, validation feedback, and action placement across editors.
- Start each new-resource editor with a clean form. Preserve context for intentional edits.
- Keep immutable identity fields locked on existing resources.
- Retain user-entered names and overrides. Provide an explicit Use Suggested Name action
  rather than overwriting a customized name when another selection changes.
- Populate dependent selectors from inventory and the selected profile/scope.
- Inline Add actions may create related drafts; distinguish these from persisted live resources.
- Validate dependencies, incompatible options, missing references, and conflicting mappings
  before creating a rollout proposal. Repeat authoritative validation on the server before writes.
- Offer Save Draft And Leave, Discard Changes, and Stay On This Page when navigation would
  lose unsaved changes. Cover both the plugin's controls and native Rancher route changes.
- Allow incomplete working drafts to be resumed from Overview. Explain their persistence lifetime.
- Keep Cancel beside the other form actions as an outlined/secondary button.
- Refresh must preserve field values, active drafts, selection, and the editor instance.
- Distinguish saving a draft from publishing/applying it. Disable live actions without a working,
  authenticated backend; saving local state must not claim a live resource was changed.
- Integration editors that configure a connection provide **Test Connection** using
  the current unsaved settings. Show the tested scope, result, and observation time;
  invalidate the result when connection settings change. Distinguish network reachability
  from authentication and the required service operations. Testing does not save or
  mutate managed configuration, and a missing backend cannot report a successful test.

## 7. Pending rollouts, processes, and change review

- Separate incomplete working drafts from validated pending rollout proposals.
- All unapplied managed changes are saved as drafts and visible in Pending Rollouts,
  including incomplete drafts labeled Needs Completion. Validate a draft into a
  reviewable proposal before enabling Apply. A form save stages the change without
  applying it. Apply from Pending Rollouts starts the backend operation, visible
  in Running Processes with its actual state and results. This includes ordering
  and configuration changes: the snapshot/revision gate runs before execution,
  and active navigation reflects confirmed configuration rather than an unapplied
  draft. Local display preferences and non-mutating tests do not create rollouts.
- Collect relevant creates, edits, reissues, configuration changes, deletions, and restore
  proposals in one review location. Repeated saves replace the same proposal rather than duplicating it.
- Provide the affected resource list, scope, current/proposed configuration, and downloadable
  manifests or equivalent native configuration before application.
- Keep the pending counter shared between navigation and Overview. Examples do not count as changes.
- For reusable configurations, show affected consumers before updating them. Editing a preset
  alone does not silently update existing consumers; reconfiguration is an explicit reviewed operation.
- Validate the complete affected group before applying it. Aim for consistent group changes and
  report partial failures truthfully when the backend cannot provide transactions.
- Detect concurrent edits or changed dependencies and require a fresh review instead of overwriting them.
- Detect Helm/Fleet/controller ownership and route edits through the owning source or clearly
  explain the reconciliation consequence before enabling a conflicting mutation.
- Track submitted work on the required Running Processes page, including operation,
  namespace/scope, status, start time, affected resources, progress when known, and configuration details.
- Do not invent progress percentages or completion. Label simulated processes as simulations.
- Keep session rollout/rollback history distinct from durable configuration snapshots.

## 8. Snapshots, schedules, restoration, and recovery

Snapshots is the shared durable configuration-backup page. Implement the Network
Manager workflows through each plugin's domain-specific capture/restore adapter;
the earlier implementation deferment is lifted. Required behavior and current
preview capabilities remain separate. Older JSON/YAML workflows must adopt the
shared ZIP/encryption contract rather than define a second standard.

### Capture, format, and credentials

- Store snapshots in a dedicated persistent server location, outside rotating
  logs. Confirm backend storage before satisfying any backup gate. Keep the volume
  in an independent backup policy; replication/persistence alone is not a backup.
- Export ZIP files containing the configuration index and independently readable
  manifests/configuration. Include Secrets is an explicit checkbox, default off;
  non-secret configuration is always included. A second downloaded copy is optional;
  a download-only workflow requires acknowledgment that the files were saved.
- Capture persisted pre-change configuration separately from local proposals and
  declared dependencies. Include Secret manifests/values only with Include Secrets;
  otherwise retain references and disclose omitted credential coverage. Exclude
  application/PV data. List unavailable Secrets and the observation time.
- Create Snapshot, Run Now, Save Schedule, and Enable first open the same modal
  asking whether to Include Secrets (default off). Selecting Include Secrets shows Password and
  Confirm Password fields and a locally evaluated strength bar beneath the password
  field. Show a readable strength label and mismatch feedback, with accessible
  labels/focus. Confirm requires matching passwords and the shared strength policy;
  Cancel clears both passwords and returns Include Secrets to unchecked.
- Secret-inclusive backups require password encryption of the entire backup payload,
  including the index, configuration, and Secret manifests. Use AES-256 encrypted
  ZIP entries through a maintained implementation, not legacy ZipCrypto or a UI-only
  password check. Keep all recovery content in one encrypted payload entry (for
  example backup.zip inside the outer ZIP) with a generic filename, because ordinary
  ZIP encryption leaves entry names/metadata visible. See [WinZip encryption format](https://www.winzip.com/en/support/aes-encryption/)
  and [ZIP directory visibility](https://kb.winzip.com/en/130859).
- Manual passwords are transient capture/export inputs: do not place them in drafts,
  browser storage, logs, or the archive index. Clear them on completion/cancellation.
  Protected schedules persist passwords only in backend Kubernetes Secrets, with
  immutable per-credential references retained by each protected archive so rotation
  does not break older ZIPs. Encrypt saved schedule sources containing Secret values.
  Browser state, schedule JSON, indexes and logs hold references only. The local preview
  substitutes an encrypted private mock secret store; it must never silently replace
  live Kubernetes Secret storage. Automatic recovery may resolve the saved reference.
  Never emit an unencrypted Secret-inclusive file when encryption fails. Verify
  that correct-password recovery succeeds and wrong/missing-password access fails
  before treating encrypted backup creation as successful.
- Secret references alone are not restorable credentials. Redact Secret values and
  annotation values in all on-screen comparisons, including last-applied annotations;
  retain full captured manifests only within appropriately protected recovery content.

### Inventory and page actions

- Provide listing, search, scope/generation filters, manual capture, downloads,
  uploads, inspection, comparison, selected restoration with dependencies, merge,
  protected backup deletion, automatic scheduling, and retention cleanup.
- Default to Created descending using raw timestamps, including within namespace
  groups and on a fresh open. Refresh preserves an explicit user-selected sort.
- Size sorts numerically by the complete stored/exported ZIP bytes and uses decimal
  B, KB, MB, GB, and TB. Legacy JSON/YAML pairs display their combined byte size
  explicitly; they do not supply the complete-ZIP size used by current capacity estimates.
- Use the common header actions/help/refresh/count shell. New uses a plus; Delete
  uses a red trash action with matching geometry. Scope filters include Manual or
  Automatic generation and date ranges with calendar selection, optional times,
  Clear Range, and convenient start-to-end selection.

### Change gates and restoration

- For reconfiguration, rollback, restoration, bulk deletion, and ordering changes,
  verify a matching snapshot captured within the previous 24 hours for the complete
  affected configuration. Recheck coverage, age, and revisions at execution time.
  Changes invalidate coverage; a recent timestamp alone is insufficient.
- Select a stored snapshot or upload its index; automatically compare saved/current
  affected content side by side. YAML alone does not establish capture age or scope.
  Mismatching configuration cannot satisfy the mutation gate.
- Restoration reviews affected items/dependencies and what will be overwritten.
  Require a fresh current-state snapshot and explicit overwrite confirmation.
  Block uncovered consumers, missing dependencies, and newer conflicting edits.
- Require explicit Secret selection/confirmation for credential replacement. Managed
  resource deletion never removes Secrets. Never silently restore unrelated objects
  or remove resources created after the selected snapshot.
- Prepare restoration drafts in Pending Rollouts; Apply is a separate reviewed
  backend operation tracked in Running Processes. Preserve capture provenance.
- Provide recovery instructions for obtaining files without the application and
  restoring reviewed native configuration, including owning Helm/Fleet sources.

### Ordered snapshot merge

- Begin with Verify Snapshot Passwords when preparing selected sources. List every
  protected snapshot with its own password input, a Test Password action, and an
  adjacent Apply To All Snapshots action. Applying a password never verifies it.
  Provide Test All Passwords and show actual archive-decryption results per snapshot.
  Editing or copying passwords invalidates prior verification. Reverify before
  continuing; do not rely on a nonempty field or cached success alone.
- Warn explicitly which snapshots will not be processed and why (missing password,
  incorrect password, unreadable archive). Include unencrypted snapshots normally.
  Only protected snapshots with a successfully supplied password enter the merge;
  skipped snapshots never enter priority, selection, provenance, output, or source
  deletion. Require at least two eligible sources. Keep the exclusion warning through
  final review. Passwords remain only in session memory and are never saved in drafts,
  preview source files, browser storage, logs, or exported metadata.
- Merge opens a dedicated page in the shared shell. Its navigable stepper is
  Override Priority, one selection step per relevant item type, Review Differences,
  Final Summary. Each plugin adapter supplies its item types, selection order,
  stable identities, and dependency relationships in its own standard.
- Highest-priority sources override lower ones by stable item identity, taking a
  complete item from the winning source; missing items come from lower sources.
  Support drag ordering and accessible keyboard controls.
- Every selection step shows only additions/content changes. Matching items remain
  in the final backup automatically. Skip types with zero additions/changes; a fully
  matching merge goes directly from priority to review and final confirmation.
- Automatically include known required dependencies; block unresolved dependencies.
  Keep selection, comparison, summaries, and backup output consistent.
- Changed Secrets default to keeping readable current credentials; selecting a
  snapshot version requires an explicit choice. Read current versions of every
  source Secret as well as currently referenced Secrets, including after references
  change. Failed reads cannot silently reuse stale credentials. If current values
  are unavailable, preserve the saved version in the backup and disclose the gap.
  Matching Secrets keep their original capture provenance. Merge never writes live
  credentials and follows the same Include Secrets/encryption contract as capture.
- Compare the effective flattened selection against current configuration, side by
  side, showing additions/content changes only. Shared IDs alone are not conflicts;
  matching and current-only items are excluded and never implicitly deleted.
  Ignore transient controller status/resource-version changes in comparisons.
- Final confirmation states scope, precedence, added/changed counts, and whether
  originals are retained. Offer Remove These Snapshots When Merged; partial merges
  that omit configuration retain originals. Save durably before any source removal.
  Cleanup failure leaves a successful save intact and permits separate cleanup
  without retrying the merge. Preserve per-item capture dates through merges and
  subset selection: merging old content does not make its coverage fresh.
- Protect unsaved merge choices using the common draft/leave guard and register the
  merge editor as a hidden route. Merging, restoration preparation, and Apply remain
  separate actions.

### Coverage notification and gap review

- Show per-resource coverage and snapshot history. The coverage display checks the
  last seven days: green matching, amber partial/differing, red no recent applicable
  copy. This display window is separate from the 24-hour mutation gate. Multiple
  snapshots may collectively cover known configuration; fixtures do not prove live backup.
- Make the banner clickable and keyboard accessible. Green opens the inventory;
  partial/missing/outdated coverage opens a dedicated summary/diff page using the
  Snapshots shell. Group missing, outdated, and changed items into collapsible
  sections by type; hide matching/recently covered items. Compare uncovered items
  with their latest applicable stored version, redacting Secret values.
- For this notification only, Secrets use backup presence rather than freshness or
  content differences. A Secret with captured values in an applicable stored backup
  is excluded from freshness/difference totals, even after rotation. References
  without captured values remain missing-backup gaps, including with Include Secrets
  off. Record missing/omitted recovery coverage in the index and recovery comments.
  This presence-only rule never relaxes restore dependencies or write validation.
- Resource history links retain selected scope and provide Clear Filter. Network
  Manager defines its resource-specific badge layout in its own standard.

### Automatic capture, cleanup, and storage

- Place Automatic Snapshot Schedule and Automatic Snapshot Cleanup side by side
  at the bottom, each occupying 50% of the row. Align configuration fields left,
  actions right, and use compact retention units. Beneath each panel's controls show
  only its next date: Next Snapshot in the capture panel and Next Delete in the
  cleanup panel. Put explanatory/status paragraphs about server scheduling,
  browser closure, capture source, recovery copies, retention protection, and
  estimation assumptions in a help icon beside the corresponding panel title,
  linking to the relevant guide section. Errors remain visible and actionable.
- Enabled is a green badge; Disabled is red. Loading/unknown has a distinct state.
- Persist enabled state, interval, scope, and capture source on the server; run with
  the browser closed. Support minutes, hours, days, weeks, and calendar months with
  month-end clamping. Disclose whether the source is fresh live state or saved inspection.
- Cleanup is disabled by default. Protect the newest applicable snapshot for each
  known scope/configuration item and retain originals required by partial merges.
- Immediately below both panels, provide a separate row spanning 100% of the
  combined width, divided into three equal columns: Available Drive Space,
  Largest Snapshot, and Estimated Run Out Of Space. No storage figures belong
  inside either schedule panel. Format examples (illustrative, never hardcoded):
  `Available Drive Space: 950.8 GB / 1.1 TB`;
  `Largest Snapshot: 555.6 KB`. Do not display an approximate snapshots-fit
  message, a separate Snapshot Storage title, or the enabled/saved hosting-server
  sentence. Keep schedule action buttons together and left-aligned when their
  group wraps; retain actionable errors. Neither schedule panel nor its action group
  may have a scrollbar; wrap controls and allow normal page scrolling.
- Available storage means bytes writable by the service account at the configured
  destination: available filesystem space bounded by any smaller remaining PVC,
  dataset, volume, tenant, or application quota. Do not show parent drive capacity
  as backup capacity or double-count replicas. Required limits that cannot be
  measured show Unavailable with a reason in live mode. Until capacity is available,
  local previews populate a marked mock capacity; actual configured quota supersedes
  the mock. Never silently present mock capacity as a live measurement.
- Measure the actual mounted filesystem containing the resolved snapshot-save
  directory (including PVC/bind mounts/symlinks); report effective available bytes
  and that destination's total capacity. Do not substitute the host's root disk,
  browser disk, or a different mount. Apply smaller known quotas and disclose them
  through contextual Help. Refresh from backend measurements rather than fixtures.
- Estimates use the largest complete saved ZIP, effective available bytes, and the
  saved enabled cadence. Without a size or enabled schedule, show no prediction.
  Explain competing usage and cleanup assumptions in contextual Help rather than
  helper paragraphs. Refresh measurements in place after capture, cleanup, schedule
  changes, and normal refresh. An estimate is not a promise of available capacity.
- If the computed exhaustion date is more than one calendar year from the
  measurement time, display `∞` instead of a distant date; retain the full estimate
  for accessible help. At exactly one year or sooner, show the localized date/time.
  Unknown size, unavailable space, or a disabled schedule remain Unavailable or
  Not Scheduled as appropriate; never turn unknown estimates into infinity.

## 9. Refresh, diagnostics, settings, and help

### Refresh and loading

- Provide a shared manual Refresh action and Refresh Every selector.
- Default to five minutes. Offer Off, 30 Seconds, 1 Minute, 5 Minutes, 15 Minutes, and 1 Hour.
- Show a fixed-width `MM:SS` countdown driven by a clock deadline, avoiding accumulated timer drift.
  Interval changes and manual refresh reset it; Off displays `00:00`.
- Update data in place without page reloads, editor remounts, or replacement of unsaved form state.
- Prevent overlapping refresh work. Show busy/error feedback and retain existing data on failure.
- For a delayed data request (300 ms default), show a centered loading indicator over a
  blurred/dimmed page with an accessible loading status. Preserve the underlying
  editor and data rather than remounting them. Fail an unanswered request after
  60 seconds with a visible timeout message; retry failed reads every 60 seconds
  except confirmed source disconnections, which retry every five seconds and restore
  the regular five-minute refresh after verified recovery. Show count spinners only
  during delayed requests; confirmed failures remain red between attempts. Retry
  until successful or cancelled. Show the retry countdown, prevent overlapping
  requests, abort abandoned requests, and ignore late responses. Clear the overlay
  on response/cancellation. Do not automatically replay timed-out rollout writes;
  reconcile their backend operation status before any explicit retry.
- Reserve loading indicators for actual delayed requests (300 ms default); idle,
  unconfigured sources and retry countdowns are not loading. Keep confirmed failures
  visible between attempts. Missing configuration requires configuration, not probes.

### Diagnostics

- Diagnostics follows Network Manager's filter layout with keyword search, multi-select
  namespace scope from Rancher's global selector, log source, severity (Debug, Info, Warn, Error), and lookback. Discover relevant
  running resources and controller replicas as sources via the backend, and label unavailable
  collections distinctly. The navigation badge counts only warnings/errors over the rolling
  last 24 hours, independent of view filters: neutral zero, yellow warnings-only, or red combined
  warnings and errors when any error exists. Identify scope (browser vs managed-resource logs).
- Diagnostics defaults to a 24-hour view. Each adapter documents its available
  retention/lookback limits in its plugin standard.
- Make badge scope, time window, and separate severity counts accessible. Keep its
  rolling 24-hour total independent of view filters while honoring host namespace/access
  scope. Unavailable log data is not a verified zero.
- Clearly label demo logs, static inventory, simulated operations, and unverified observations.
  A refresh of static/demo data must not claim a fresh live cluster inspection.
### Settings

- Persist display preferences per browser, including Preview, snapshot status banner, and cluster
  inspection notices as separate controls. These controls change presentation, not access or write capability.
- Every top-of-page notification/banner type has its own labeled visibility checkbox
  in Settings. New banner types must add the matching preference rather than relying
  on a single global hide switch. Apply preferences consistently across pages and
  persist them per browser; hiding a banner does not alter underlying status or
  bypass required validation, backup, or write controls.
- Default Preview off for standalone test builds and native extension builds. An explicit
  saved preference may enable preview labels and banners; fresh root-suite sessions start
  with them off. This preference changes presentation only. Hidden notices do not turn
  sample data into live evidence, disable mock data, or suppress real issue notifications.
- Standalone resource links may use a configured Rancher origin, validated as an HTTP/HTTPS origin
  without embedded credentials. Native builds use the active Rancher context.
- Provide the Rancher URL and other relevant connection/configuration settings on
  the shared Settings page, alongside per-banner visibility preferences.

### Help

- Help is the final navigation page and has no inventory count or question-mark
  controls. Use collapsible sections for the application's purpose, every page,
  action, resource link, and common workflow; describe each trigger and effect.
- Explain preview versus live capabilities and how to recover or diagnose failures.
  Contextual popups reuse these sections; Open Help navigates to and expands the
  relevant section. Help's application links open the page/section they describe
  and synchronize the active navigation item.

## 10. Authentication, availability, packaging, and implementation boundaries

- Reuse Rancher's authenticated session and enforce the active user's permissions for both reads
  and writes. Loading an authenticated UI is not sufficient backend authorization.
- Keep backend credentials and private keys out of browser state, repository files,
  plaintext exports, and logs. The explicit Include Secrets encrypted-backup flow
  is the exception for recovery exports; never display its values in the UI.
  Show Secret reference names/keys rather than Secret values.
- Read public certificate metadata only; do not return private keys or provider credentials.
- The plugin manages configuration; managed routing/DNS must continue if its UI or management API fails.
- Use versioned extension assets and a Helm chart registering `UIPlugin`. Publish the Rancher
  `files.txt` plus `plugin/` layout, not merely a standalone JavaScript URL.
- All custom manager plugins, including Network Manager and DNS Manager, must
  reference the common UI project, `rancher-common-ui`, for shared page shells,
  layouts, controls, tables, dialogs, notifications, settings presentation, and
  contextual help. Keep application-specific data, fields, operations, permissions,
  and adapters in each manager. Shared visual choices are taken from the completed
  [UI comparison report](docs/ui-comparison-2026-10-11/report.html); that review
  selects presentation and does not redefine application-specific behavior.
- Package the common UI project as its own Rancher UI plugin with separately
  published versioned assets and a separately managed Helm release. Both managers
  require that plugin to be installed, enabled, loaded, and API-compatible before
  their interfaces initialize. Declare the runtime dependency and supported API
  version range in each manager's package/installation contract and enforce it
  during loading. Missing, disabled, failed, or incompatible dependencies must
  produce an actionable installation/recovery message instead of starting a
  partially functional manager or silently using a private fallback copy.
- Common UI upgrades and rollbacks within the supported API range must take effect
  without rebuilding or upgrading either manager's Helm release. A source import,
  shared npm package, or Helm subchart that embeds a private UI copy in each manager
  is insufficient by itself: both managers must consume the installed common
  plugin at runtime. Document the load order, compatibility policy, cache/reload
  behavior, and independent install/upgrade/rollback workflow. Verify both managers
  against the same installed version, including missing/incompatible dependency
  recovery. Blocking a manager interface must not interrupt managed routing/DNS.
- The [common UI project](rancher-common-ui/README.md) implements this runtime
  dependency with API 1 / stable 1.x compatibility. Both managers must keep their
  declared requirement, consumer bridge, initialization gate, and Helm prerequisite
  validation. Presentation controls/styles belong in the common plugin; manager
  adapters may supply domain data, callbacks, labels, and fields, but must not ship
  private fallback copies. Follow the documented separate-release install, upgrade,
  rollback, and browser-reload procedure. Local artifact/runtime and Helm lookup
  tests validate this contract; release acceptance still requires live Rancher
  loading and independently upgraded common assets with unchanged manager releases.
- Separate UI registration, asset hosting, management backend, and managed workloads. Clearly
  document which chart installs which resources; registration alone does not install those dependencies.
- Reuse existing infrastructure rather than adding another ingress, database, or monitoring stack
  merely to support a manager page.
- A standalone preview uses the same components with isolated fixture data and clearly declared
  capabilities. Keep unauthenticated preview hosting private and free of live cluster credentials.
- Every custom Rancher plugin must include a repository-owned, locally runnable standalone
  interface preview. An inline mockup alone does not satisfy this requirement.
- Match the Network Manager development workflow: `npm install` (or `npm ci` with the lockfile),
  `npm run preview`, and `npm run build:preview`. Pin dependencies and retain the lockfile.
- `npm run preview` must start a usable browser-based plugin UI directly from the
  local project after dependency installation. It must work without Docker or
  Docker Compose, container image builds, a full application deployment, or a
  Kubernetes/Helm installation. Optional container/backend integration previews
  may supplement this npm workflow but cannot replace it or become prerequisites.
  Use clearly labeled fixtures/local adapters for unavailable services so pages,
  navigation, forms, selection actions, and draft flows can be previewed locally.
- Document the preview URL, prerequisites, commands, and how to stop it with Ctrl+C.
  Bind to `127.0.0.1` by default and use a documented, distinct port so managers can run together.
  Network Manager uses 5173; DNS Manager uses 5174. Fail clearly on a port conflict.
- Each plugin folder supports `npm run preview`; repository-root `npm run preview`
  launches all registered plugins together for cross-plugin consistency checks.
  Support choosing named plugins and stop only processes started by that run.
  Present the selected plugins in one browser page, with side-by-side and full-width
  views that retain each plugin's active state. Prepopulate one temporary project-owned
  session datasource using the shared contract, with separate logical plugin records and
  snapshot directories. Saves persist within that session without changing the seed
  fixtures; retain session files after stopping. Start preview-only labels and banners
  disabled, while identifying mock data in the suite shell. This display preference
  must not disable mock data or real issue notifications.
- Use one shared datasource contract for normalized inventory, saved state, refresh,
  capabilities, and reviewed writes. Project-owned JSON mock sources are editable
  and saveable through npm previews, including provenance/schema information.
  Persist valid edits atomically with revision conflict checks and visible failures.
  Native Rancher API adapters implement the same contract through authenticated
  reads and reviewed writes; changing providers must not require rewriting page UI.
  Credentials, passwords, and decrypted Secret values must never enter mock files.
- Every feature and ability must have representative demo data pulled from its
  authoritative source where available, scrubbed before persistence, and saved in
  one project-owned global local demo database/data file shared by the plugin suite.
  Include the states needed to exercise the feature, such as populated and empty
  inventories, dependencies, drafts, warnings, errors, and operation results. Preserve
  source identity, capture time, schema version, and the scrubbing rules; label
  synthetic scenarios and never present them as live observations. Remove real
  credentials, Secret values, private keys, personal information, and sensitive
  identifiers; use safe replacements that retain referential consistency. Track
  and synchronize the global demo file with Git LFS and include its tracked pointer
  in the repository, so a normal checkout with LFS provides the prepopulated data.
  Document LFS setup/pull and report missing LFS content clearly. Root and per-plugin
  npm previews consume this same global source through the swappable datasource
  contract; preview saves use editable local/session copies rather than overwrite
  the distributed seed. A new feature is incomplete until its representative data,
  scrub/validation checks, and UI tests are included.
- Keep the standalone Rancher-like shell outside native integration; reuse the manager's
  Vue page components for the preview and native routes. Native pages use Rancher's own chrome.
- Interface preview startup must not require cluster credentials, Windows connectivity,
  the managed service, a live management backend, or any Docker/test containers.
  Label sample inventory and simulated status.
  Document browser-only preview state separately from backend-confirmed durable snapshots.
- Keep preview/build, publication, installation, and live execution distinct. Do not describe a
  generated draft or compiled library as deployed functionality.
- Verify native integration, authorization, live observation, server validation, and result readback
  before marking a live feature implemented.
- Deliver an installable Helm-based package that deploys the application's runtime
  and registers its Rancher management interface in the native left navigation.
  Build the actual extension bundle, page routes, Explorer menu registration, and
  operator-compatible extension chart; a generic workload chart or Vite preview
  alone does not register a Rancher UI extension. Declare the compatible Rancher
  version and required extension operator/CRDs. When Rancher's management cluster
  and workload cluster differ, explicitly target both: a Helm release only creates
  resources in its target cluster. Keep one documented installation workflow without
  claiming a single ordinary release can implicitly configure another cluster.
  Release acceptance includes a clean Helm install, visible native menu/routes,
  theme/namespace integration, refresh recovery, upgrade, and uninstall checks.
  See [Rancher's extension packaging](https://extensions.rancher.io/extensions/v2/publishing)
  and [native side-menu registration](https://extensions.rancher.io/extensions/next/api/nav/side-menu).

## 11. Network Manager-specific reference

Network Manager inherits sections 2–10. Its routing inventories, Master/Detail
Overview, port configurations, issuer/certificate workflows, snapshot adapter,
and documented variations are maintained in
[Network Manager Standards](NETWORK-MANAGER-STANDARDS.md).
The [development README](simple-network-manager-dev/README.md),
[implementation review](simple-network-manager-dev/IMPLEMENTATION-REVIEW.md), and
[recovery runbook](simple-network-manager-dev/RECOVERY.md) record local commands and
implementation evidence rather than competing shared requirements.

## 12. DNS Manager-specific reference

DNS Manager adopts the common pages and interaction rules in sections 2–10.
Its fixed inventory pages are Overview, Sources, and Zones; zones are nested
directly beneath Zones, always visible without a separate collapse control, followed by the shared ending from section 2.
Create/Edit Source and record editors are hidden contextual routes.

Maintain zone identity/priority, source integrations, records, replication/expiry,
DNS serving, the capture/restore adapter's resource semantics, and HA/lookup policy
in [DNS Manager Design](DNS-MANAGER-DESIGN.md). Domain-specific semantics must not
create alternate common-page layouts or bypass shared rollout/backup gates.

## 13. Review checklist for each new plugin

Use this as an acceptance checklist, not a claim that the current previews satisfy live integration.

- [ ] Native group opens Overview; menus, resource identities, and counts use the correct context.
- [ ] Shared heading/actions/help, viewport layout, internal scrolling, and responsive behavior work.
- [ ] Grids sort correctly, retain empty headers, and keep expanded rows with their parent.
- [ ] Filters/search/grouping honor scope; icon actions do not accidentally toggle rows.
- [ ] Top-right selection-dependent actions, including Reorder/Delete, are hidden
  without explicit grid selection and disappear when selection is cleared.
- [ ] Ranked collections use the shared top-right Reorder/Cancel/dirty-only Save flow;
  order persistence, conflict detection, snapshot recovery, and related navigation are verified.
- [ ] Keyboard navigation, labels, focus, dialogs, and non-color status descriptions are usable.
- [ ] New/edit forms preserve intentional overrides and guard unsaved navigation.
- [ ] Refresh keeps drafts/selection intact and accurately identifies source/freshness.
- [ ] Working drafts, validated proposals, submitted processes, examples, and durable snapshots are distinct.
- [ ] Changes expose affected resources, ownership, before/after review, and concurrency validation.
- [ ] Applicable mutation gates verify recent full-scope backup and recheck before execution.
- [ ] Snapshots survive application restart and support recovery without the manager.
- [ ] Schedules/cleanup run with the browser closed, disclose source, and protect retained coverage.
- [ ] ZIP/Include Secrets encryption, recovery, provenance, merge, and presence-only banner rules work.
- [ ] Storage reports effective writable quota and uses complete ZIP sizes for estimates.
- [ ] Common pages, contextual Help, per-banner Settings, and scoped Diagnostics follow this standard.
- [ ] Yellow/red top-of-page notifications open the exact item Create/Edit/fix flow
  with scope preserved, keyboard access, and the normal mutation review gates.
- [ ] Backend authorization and credential handling are verified; hidden notices do not change capabilities.
- [ ] Managed service operation continues during UI/management failure.
- [ ] Native release packaging and installation are verified separately from standalone preview/build.
- [ ] The separately installed `rancher-common-ui` plugin supplies shared UI at runtime;
  both managers enforce its supported API range and show actionable dependency failures.
- [ ] A compatible common UI Helm upgrade/rollback updates both manager interfaces
  without rebuilding or upgrading their releases; missing/incompatible dependency
  recovery and continued managed-service operation are verified.
- [ ] Repository-owned local interface preview starts and builds using the shared npm workflow.
- [ ] Every feature has scrubbed representative scenarios in the repository's global
  Git LFS demo database/data file; previews consume it through the shared provider.
- [ ] `npm run preview` provides usable plugin UI with Docker stopped and without
  backend, cluster, container-build, or deployment prerequisites.

## 14. Maintaining this specification

Use this document when designing future plugins. Record intentional shared design changes here;
keep application-only rules in the corresponding application's specification. Preserve the distinction
between a requirement, a preview implementation, and a verified live capability. Treat captured source
files as references that may evolve, rather than freezing every implementation detail as a universal rule.

Keep normative shared requirements in their relevant sections instead of appending
competing dated rule sets. Link plugin specifications and implementation notes to
those sections. Preserve historical evidence as evidence; do not rewrite it to
claim a new requirement was implemented or verified. Changes to the standard are
documentation changes until the relevant implementation and release checks pass.

Consolidated on 2026-10-11 from the Snapshot merge update, shared Reorder evidence,
accepted interface refinements, and both managers' documentation. The user resolved
zone priority to control both the default Zones grid and sidebar order.

## Shared Reorder preview evidence — 2026-10-11

Historical DNS preview checks exercised checkbox-to-handle replacement, keyboard
and drag ordering, dirty-only Save, Cancel, editor navigation, a narrow layout,
and browser-only pre-change snapshot/order demonstration. These establish sample
interaction evidence, not backend concurrency, durable backup/order, or native
Rancher integration. The current required flow stages Save in Pending Rollouts;
only confirmed backend Apply changes the active navigation order.

## DNS Manager preview and local development reference

Network Manager's pending alignment decisions and implementation gaps are tracked
in its [standards alignment review](simple-network-manager-dev/STANDARDS-ALIGNMENT-REVIEW.md).
That implementation review is subordinate to this standard and does not replace
the shared acceptance requirements.

Historical prototype evidence and local development reference, subordinate to
the current requirements in sections 2–10. DNS engine proof remains in its own
specification and validation notes.

### Interface preview

The repository-owned Vue/Vite preview reuses the manager page component. It offers
Overview, Sources, Zones with always-visible indented zone entries, record grids/editors,
Pending Rollouts, Running Processes, Diagnostics, Settings, and Help. Snapshots is an
historical placeholder in the initial preview; current requirements authorize
its implementation through the shared snapshot adapter. Inventories, serials, replication, and serving
status are sample data; source addresses retain the agreed design values. Drafts are
browser-local and live Apply remains disabled without the authenticated backend.
Source Test Connection reports Not Verified when that backend is absent. The preview
must not claim a live Windows edit, DNS failover verification, or durable backup.

### Local interface development

From `dns-manager-dev`, run `npm install` (or `npm ci`), `npm run preview`, and
`npm run build:preview`. Node 24 or newer is required. DNS preview uses
`http://127.0.0.1:5174`; Network Manager uses 5173. Build assets go to `dist-preview`.
The reusable page is `dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue`; the
standalone shell wrapper is `dns-manager-dev/preview/Preview.vue`. Native mode uses
Rancher chrome and the same manager components; packaging/routes still require
separate validation. Startup needs neither live credentials nor DNS test containers.
Browser storage contains only preview drafts/preferences/metadata, not live Secrets.

Initial historical preview checks exercised a browser-only order/snapshot demonstration.
The revised workflow stages ordering in Pending Rollouts and retains the applied menu
order until backend Apply. Earlier demonstration evidence does not prove this live gate.


### Follow-up UI choices (2026-10-11)

These refinements supersede earlier presentation choices where they conflict.
Both managers require the separately installed `rancher-common-ui` plugin and use
its DNS-style manager/page breadcrumb and identical grid typography, colors,
spacing, row rules, filters and containers. Preserve each Overview's existing
layout and ordering while applying DNS colors and component styling. Network
Overview has the namespace-scoped route count beside its menu item. Network
collapsible detail sections have space around their panel boundaries.

Navigation has a divider below Overview and above Pending Rollouts on every page.
DNS zone entries remain visible directly beneath Zones; only the manager group
uses its normal host collapse control. All count badges use Network's rounded
badge palette. The top-right count exactly matches its active menu item's number,
style and severity and does not become a filtered grid count. Do not repeat a
count above the snapshot grid. Error takes precedence over warning: red for
errors, yellow for warnings. Diagnostics counts only scoped warnings/errors from
the last 24 hours, independent of table filters; red for any errors, yellow for
warnings only and green when clear. Future, invalid and older events are excluded.
Native navigation retains Rancher's renderer; common styles decorate only the
manager-owned counts and divider positions.
