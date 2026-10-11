# Network Manager preview verification — October 11, 2026

## Current standards alignment batch

This section supersedes completion claims below for the newer shared standard.
The [alignment review](STANDARDS-ALIGNMENT-REVIEW.md) has three pending decisions:
global namespace/navigation layout; ZIP encryption, Secret coverage and storage;
and incomplete drafts in Pending Rollouts. Full standards alignment is unfinished.

Added contextual Help with Close/Open Help, expandable guide sections, guarded
application links and a clickable manager breadcrumb. Added namespace-aware rolling
24-hour diagnostic totals shared by the preview header/navigation, separate warning
and error counts in accessible text, Debug filtering and namespace columns. Overview's
hour-error shortcut now sets a one-hour Error view while ordinary Diagnostics opens
at 24 hours. The Docker build retains the sibling shared preview-data context.

Configuration tests passed, including diagnostic boundary expiry, active scope,
neutral/warning/error states and exclusion of future/outdated entries. In a separate
Vite tab on port 5188, Open Help navigated to the matching expanded section; its page
link returned to Overview. Help had no count or question-mark controls, and document
bounds matched 1280×720. Searching Diagnostics to zero rows retained its two-incident
count; selecting kube-system showed only its example logs and a neutral zero count in
both locations. The usual dev ports were already occupied and were left running.

The latest native and Docker rebuilds failed after additional ZIP/dependency edits
entered the shared workspace: vue-loader resolves webpack 4 instead of Vue CLI's
nested webpack 5; Docker's isolated build dependencies lack @zip.js/zip.js. These
changes were preserved and the existing Docker preview was left running. The new
alignment additions have not been deployed to port 8088. Earlier successful builds
below are historical evidence, not validation of the current combined workspace.

Visual evidence: [Help guide](../.local/network-standards-help-review.png).
An Alexa Input alert was accepted by Home Assistant. No completion alert was sent.

The authorized UI and configuration-review batch is implemented in the local Docker preview at http://127.0.0.1:8088/.

## Completed and verified

- Shared title-row actions: enlarged plus, red trash-icon Delete matching New and Merge at 40px with 14px labels and 18px icons, refresh interval, MM:SS countdown, icon-only Refresh and count to its right.
- Route certificate and snapshot badges share a dedicated bottom row. Selected-route badges match their status colors.
- Shared configurable inventory filters, optional grouping, certificate issuer/state filters, sortable grids, help controls and persistent empty headers.
- Shared namespace context persists between pages; Global port presets remain available within a selected namespace. Native store synchronization and user/system/resource scopes pass automated checks.
- Bulk selection, Select All and conditional Delete review require a matching fresh backup and explicit item-count confirmation; Secret deletion is prohibited; explicit restoration can queue credential changes.
- Pending Rollouts holds saved proposals; reviewed Preview Apply moves them into explicitly simulated Running Processes. Duplicate/conflicting changes are rejected.
- Known configuration capture includes routes, Certificates, issuer resources/profiles, port configurations, Services and known routing dependencies, plus pending draft manifests.
- Stored JSON/YAML recovery pairs, selective restore with dependency inclusion, side-by-side comparison, authoritative snapshot merge and optional source cleanup.
- Server-side automatic creation and cleanup scheduling survives browser closure and server restart. Retention preserves the newest coverage for each known scope/item.
- Scheduling fields align together on the left; buttons align right. Cleanup Retention Unit is compact. Both panels remain within the viewport.
- Diagnostics defaults to 24 hours, with warning/error counts and severity colors. Preview notices obey the single Preview setting.
- Namespace, owner and Secret references support Rancher links; standalone preview requires its Rancher URL setting.
- Every page's header alignment and viewport boundaries checked at 1280×720: document remains 1280×720 and main panels end at y=690.

## Validation

Passed configuration, snapshot server, change-batch, coverage and namespace-context checks. Native extension and Docker builds passed. Webpack reports bundle-size advisories only. Docker health endpoint reports healthy. Browser console has no errors.

Browser flows verified: new full snapshot, merge while retaining originals, selective Certificate restoration with issuer dependencies, fresh-backup gate, Preview Apply, running-process progression, sorting, empty certificate results, shared namespace filtering, Global presets, Preview visibility and all-page layout consistency. Snapshot cleanup deletion was tested using isolated temporary storage, not user backups.

## Integration boundaries

Cluster inventory and diagnostics remain static inspection/demo data. No cluster changes were applied. Live inventory/log collection, authenticated snapshot hosting for the native extension and actual Kubernetes Apply/controller tracking still require backend integration. Pending proposals and running processes are session-local. Preserve both JSON and YAML recovery files; Readable referenced Secret values are included through native Rancher capture; the standalone preview reports missing credentials. Original YAML comments, Helm values and application data remain outside backups.

Latest polish: snapshot Size reports actual combined JSON/YAML file bytes with numeric sorting. Shared grids preserve matching header/cell alignment and padding (text left, numbers right). Hover/focus help tooltips render above the navigation, stay within viewport bounds, and support Escape. Isolated storage checks cover byte totals and older snapshots without YAML.

Merge verification update: separate type selection steps (issuers, Certificates,
ports, Secrets and other saved item types); matching items hidden in every step
and retained automatically. Isolated GUI merge retained 270 matching items plus
one changed route in a 271-item backup. Pointer drag changed priority, changed-only
review selected the correct winner, and final confirmation saved a JSON/YAML pair
while preserving originals. Core/server tests cover default current-Secret
preservation, explicit snapshot-version choice, redacted comparisons, Secret
YAML round-trip, capture provenance, incomplete credential coverage and scaling
B/KB/MB/GB/TB. Snapshot inventories default to newest-first creation ordering.

Storage/coverage verification: the isolated GUI displayed actual hosting-drive
space and an exhaustion date after enabling the saved schedule; disabling it
removed the prediction. Filesystem tests verify available bytes and the largest
combined JSON/YAML backup. Estimate tests cover first failed scheduled capture,
unknown size, disabled schedules, month-end clamping and date overflow. The yellow
banner opened a sectioned coverage page listing only uncovered Secret references;
matching items were absent. A merge with only one changed Secret skipped all other
selection steps and its comparison showed hidden values. Source Secret credentials
are refreshed in native Rancher even when no current route references them; denied
reads remove stale values and disclose missing credentials. Secret annotation
values are redacted too, including embedded last-applied configuration.
