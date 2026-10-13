# Network Manager development

First scaffold for a native Rancher extension. The UI contributes an expandable
group to the selected cluster's Explorer navigation, targeting placement near
Compliance. Exact placement and integration require validation in Rancher 2.15.x.

## Design authority

Shared interface and common-page requirements are maintained in the
[Rancher Plugin Design Standard](../RANCHER-PLUGIN-DESIGN.md), including
[Snapshots](../RANCHER-PLUGIN-DESIGN.md#8-snapshots-schedules-restoration-and-recovery)
and [Refresh, Diagnostics, Settings, and Help](../RANCHER-PLUGIN-DESIGN.md#9-refresh-diagnostics-settings-and-help).
Network-specific requirements and variations are maintained in
[Network Manager Standards](../NETWORK-MANAGER-STANDARDS.md).
This README records local setup and implementation behavior, not a competing standard.
Current npm previews use the shared project-owned datasource and a local encrypted ZIP service.
Remaining native/live acceptance work is documented separately from preview behavior.

The current [standards alignment review](STANDARDS-ALIGNMENT-REVIEW.md) records
the conflicting prior preferences, proposed changes and remaining acceptance work.
Help now provides contextual guide navigation; Diagnostics uses rolling 24-hour
incident counts scoped to the active namespace context, separate from view filters.
Both still describe preview data accurately. These additions do not certify the
project against the entire shared standard.
Preview and native bundles can be built locally. These changes have not been deployed to a live Rancher cluster.

Docker's preview build uses the sibling `../preview-data` directory as an additional
build context, preserving the shared fixture editor and inventory imports. Keep
that sibling directory available when running `docker compose -f compose.preview.yaml build`.

## Npm preview and shared data

Requires Node.js 24+. From this folder run `npm ci`, then `npm run preview` and open
http://127.0.0.1:5173. Stop with Ctrl+C. No Docker, cluster, or backend setup is required;
the local snapshot API starts automatically on 5183. From the repository root,
`npm run setup` installs both plugins and `npm run preview` launches both together at
http://127.0.0.1:5172 in one browser page, with side-by-side and full-width views.
Root runs use prepopulated temporary editable data and snapshots under
`../.local/preview-sessions/<session>/`. Preview labels and banners start disabled;
the suite shell identifies the mock data source.

Mock Data edits save to `../preview-data/data/network-manager.json`; configuration,
drafts and settings persist there across reloads. The shared provider contract accepts
an authenticated Rancher adapter for live reads/staging, whose projection and permissions
must be configured and verified separately. See [shared datasource documentation](../preview-data/README.md).

Create Snapshot and snapshot Run Now prompt for Include Secrets. Including Secrets
requires matching strong passwords and encrypts the complete ZIP. Merge tests each
protected source password, offers Apply To All, and warns about skipped sources;
unencrypted snapshots remain eligible. Passwords never enter saved drafts/source files.
Automatic runs exclude Secret values. Local backup files persist under the repository's
ignored `.local/preview-snapshots/network-manager/` directory. The storage row measures
that destination's actual mount; forecasts beyond one year display ∞.

The subsequent notes include historical implementation observations. This section
describes current npm source persistence and supersedes earlier browser-session-only
or plaintext JSON/YAML backup descriptions.

## Approved standards alignment (2026-10-11)

The three alignment decisions are resolved in [the review](STANDARDS-ALIGNMENT-REVIEW.md).
Native navigation retains Rancher's renderer and right-side counts. The standalone
preview supplies one global namespace picker; individual page bars no longer repeat
it. Inventories precede the common operation/support pages. Incomplete managed forms
appear in Pending Rollouts as Needs Completion and block Apply until validated.
Their saved values can be resumed; display and scheduling preferences are separate.

Editor Save/Cancel actions are in the shared heading, with equal adjacent labeled
action widths. Refresh keeps forms and port configurations, bounds reads to 60 seconds,
ignores cancelled/late responses, and retries failed reads without replaying writes.
The delayed loading overlay and count spinner distinguish pending reads from failures.

Secret notification coverage checks captured backup presence, including older captures;
configuration coverage still checks fresh matching content. The mutation gate remains
separate. Snapshot Storage is a collapsible row below both schedules. Configure
`SNAPSHOT_STORAGE_LIMIT_BYTES` to bound writable capacity; unknown quotas are unavailable.
Docker preview uses a 1 GiB application quota (adjust in compose for your volume).
This prevents interpreting a Docker host's entire disk as dedicated snapshot capacity.

## Current scope

- Overview combines all 35 inspected routing resources, their traffic paths and
  destination references. TLS/certificates and diagnostics have separate pages.
- Searchable multi-select namespace, protocol and Service & Ports filters use
  OR within each selection and AND across filter groups.
- Clickable route list showing the listener, routing rule, destination, and TLS.
- Settings with Let’s Encrypt staging/production, account email, GoDaddy DNS or
  Traefik HTTP validation, and a downloadable cert-manager ClusterIssuer draft.
- Multiple in-memory issuer profiles and a Publish a Service form with a base
  domain and relative subdomains. An empty subdomain list uses the base domain
  and www; @ explicitly adds the base domain to a named list.
- Publication selectors use a metadata snapshot of namespace names, services,
  service ports and ingress classes. Service options follow the namespace;
  route names are suggested from the destination and namespace. Custom route names
  remain unchanged when the selection changes until Use suggested name is clicked.
- Editable named port configurations support multiple TCP/UDP ports, comma-separated
  numbers and inclusive ranges. Several configurations can be selected together.
  Unmatched snapshot service ports are imported as Detected configurations to
  preview first-install discovery. Routing modes are explicitly chosen; imports
  do not guess the application protocol from a port name or number.
- Publication drafts map selected ports to observed public Traefik listeners and
  compatible backend ports. They generate IngressRoute HTTP, TCP and UDP resources,
  with one shared cert-manager Certificate for HTTPS/TLS routes. Missing mappings
  and duplicate listeners block generation. These drafts do not validate live
  route conflicts, DNS, authorization or backend connectivity.
- Generated publications retain configuration references during the browser session.
  Reconfigure shows their current and proposed ports, requires explicit confirmation,
  validates every affected draft and updates them together. Editing a reusable
  configuration alone does not update saved publications. Other configuration
  versions remain unchanged. Missing listeners or backend ports block reconfiguration.
- Reconfigure also lists matching observed routing resources, destinations, ports,
  listeners and ownership from a metadata-only snapshot. These associations are
  inferred from initial port mappings and may overlap across configurations; they
  are not durable application ownership links. Observed resources are never
  updated by this preview. A separate count and explanation distinguishes observed
  routes from editable generated drafts.
- Settings groups separate TLS issuer profiles, port configurations, history
  and diagnostics pages. Issuer setup opens only after selecting a profile or New issuer.
- Reconfiguration requires a snapshot within the previous 24 hours, covering the
  current affected services and configuration. The preview verifies a selected stored snapshot or uploaded JSON index against
  the complete current review and its recorded capture time, or creates a
  configuration snapshot saved on the hosting server by default. Downloading a second copy is
  optional; download-only requires confirmation that the file was saved. It checks
  age again at update time and invalidates coverage if the affected state changes.
  These preview snapshots contain local manifests, inspected route/Certificate
  specifications, service references, and readable referenced Secret manifests; application data is excluded. They are not volume
  snapshots or complete live backups. Live backup verification and restore remain
  integration work; no live snapshot provider is called here.
- Local rollout history records previous configuration versions and affected
  publication manifests. Rollback previews restoration, requires a recent
  snapshot and explicit confirmation, then restores the whole local group.
  Newer edits or additional dependencies block rollback rather than overwriting
  them. Rollout records are session-local; configuration snapshots are stored
  durably by the standalone server and can restore configurations and publication
  drafts after browser reload. Live cluster restoration remains integration work. No cluster resources or application data are restored by the preview.
- Issuer settings prefilled from the observed configuration, with credential and
  account Secret dropdowns showing reference names only. Issuer forms store references; backup files can include readable referenced Secret values.
- Select a profile to refill its form, or use the issuer dropdown to add one.
  Secret and key dropdowns include inline Add actions. These create metadata-only
  local drafts; key lists belong to the selected Secret, and profiles can share
  credential references. The preview never collects credential values or creates
  live Secrets. Named ACME account keys are generated by cert-manager in the live flow.
- A native Helm chart at `../charts/simple-network-manager` registering `UIPlugin`.

The UI **does not read or write live cluster data**. It does not claim request
health or endpoint readiness. Snapshot data is labeled on every page.

## Development

Rancher's official tools support Linux/macOS; use WSL for the full development app
and release packaging on Windows. Node 24 is required. Dependencies are pinned in
the package lock. The generator used was `@rancher/create-extension@3.0.12`.

Use `npm install`, then `npm run preview` for the standalone layout preview.
The standalone preview and Rancher routes share the same Vue component.

Use `npm run build:extension` to compile the local extension library. Full Rancher
development uses `API=<Rancher URL> npm run dev` in Linux/WSL. Do not put tokens or
passwords in repository files.

## Next implementation boundaries

Read inventory through Rancher's authenticated cluster store, honoring namespace
selection and authorization. Correlate Ingress, IngressRoute HTTP/TCP/UDP,
middleware, services, EndpointSlices, listener/service port mappings, TLS secrets,
cert-manager Certificates, Issuers, Orders, and Challenges. Read only public
certificate information; never return private keys or provider credentials.

Separate desired configuration from observed traffic health. Detect Helm/Fleet
ownership before edits. Add server-side validation, change previews, concurrent
edit detection, and verification before enabling writes. Routing continues if
this extension is unavailable.

Publish versioned extension assets before installing the chart. Packaging must
produce Rancher's `files.txt` plus `plugin/` layout (not just a standalone JS URL).
No publishing or installation is performed by the preview/build commands.

## Standalone Docker preview

From this directory, run `docker compose -f compose.preview.yaml up --build -d`.
Open http://127.0.0.1:8088. Stop it with
`docker compose -f compose.preview.yaml down`. The container hosts the same UI
and snapshot data, without Rancher, a kubeconfig, or cluster API access. The
development preview remains at http://127.0.0.1:5173.

For Kubernetes preview hosting, build/push the image to your chosen registry,
replace the image reference in `deploy/preview.yaml`, and apply that manifest
when requested. Access it using
`kubectl -n simple-network-manager-preview port-forward service/simple-network-manager-preview 8088:8080`.
The Service is ClusterIP; no public Ingress or LoadBalancer is created.
The standalone preview is intentionally unauthenticated, and uses static inspected
metadata. Keep it private while reviewing the design.

The SDK dependency installation reported vulnerabilities in the inherited Rancher
development toolchain. Review the dependency audit before release; the preview
runtime image uses Node built-ins to serve static assets and persist configuration
snapshots; it contains no Node development tooling or cluster credentials.

References: [Rancher extension source](https://github.com/rancher/dashboard/tree/master/creators/extension),
[navigation](https://extensions.rancher.io/internal/code-base-works/products-and-navigation),
[release packaging](https://extensions.rancher.io/extensions/next/publishing).

## Configuration review controls

Port configuration Actions use icons with tooltips and accessible labels. Details
expands a read-only row; observed routes and local draft attachments have separate
collapsible lists. Reconfigure also collapses its observed attachment table.

Routing mode selects TCP or UDP. TCP application behavior separately selects
plain forwarding, HTTP, HTTPS, or TLS termination. Port actions can use another
uniquely labelled port's backend mapping or redirect HTTP to a selected HTTPS
label. Redirect drafts include a Traefik RedirectScheme Middleware; TCP port
forwarding does not convert plaintext HTTP into HTTPS. Missing destinations,
chains, transport mismatches and conflicting overlapping actions are rejected.

TLS & Certificates lists public metadata for 17 inspected Certificate resources.
Reissue reviews the actual Certificate name, issuer, domains and Secret reference,
then prepares a downloadable local renewal request. It does not submit renewal
or delete a TLS Secret. Live execution must invoke cert-manager renewal and
watch issuance status; see [cert-manager manual renewal](https://cert-manager.io/docs/reference/cmctl/).

Run `npm run test:configuration` for snapshot time/coverage boundaries, port
link validation, generated redirect resources, atomic rollout and guarded rollback
checks. These tests use local data only.


Navigation keeps Overview and TLS & Certificates. Create new connection, aligned
with the Overview heading, opens the connection editor. Settings
is a separate display-preferences page. TLS Issuer Profiles, Port Configurations, Snapshots and Diagnostics are flat navigation entries. Route Map, Routes and Services &
Destinations pages have been removed. Local drafts remain visible on Overview.
Actions icons stay horizontal; attachment counts do not wrap.

Rescan repeats discovery against the supplied Service metadata and adds unmatched
port configurations while preserving existing edits and references. The preview
uses its static inspection snapshot; live Rancher inventory refresh is not connected.

Configuration rows open their read-only details on click; edit and reconfigure
icons do not toggle the row. Diagnostics has a lookback in hours (0.25–168),
component and severity selectors. Logs are explicitly labelled demo entries,
not captured cluster logs. Live log streaming and refresh are not connected.

Configuration search matches names, labels, services and partial port numbers:
443 also matches 4433 and 8443. Publishing derives base-domain choices from the
selected issuer's DNS-zone selectors; those selectors guide solver selection
and do not guarantee successful issuance. Configure base domains in issuer profiles; the connection editor always selects
from that profile’s domain list. See [ACME solver selection](https://cert-manager.io/docs/configuration/acme/).

Publishing distinguishes inbound ports, public Traefik listeners and destination
Service ports. Leaving the destination blank uses the inbound port, but the
observed Service must expose that port with matching TCP/UDP transport. Backend
transport follows the inbound transport; HTTP encryption has a separate control.
The chosen listener must expose the configured inbound port.

The standalone shell fills the viewport. Overview keeps its header and filters
fixed and extends Routes and Selected connection to the same bottom edge. Routes
scrolls internally; selected details scroll only when expanded content exceeds
the panel height. Other pages scroll their content below the header. Form rows
and mapping controls share consistent alignment.


## Persistent configuration snapshots

The Docker preview stores JSON snapshot indexes and standalone YAML manifests under
`/var/lib/simple-network-manager/snapshots`, backed by the Compose `snapshots`
named volume. The server creates this dedicated directory automatically; it does
not use rotating logs or guess which log directory is backed up. `SNAPSHOT_DIR`
can override the server location, but the mounted volume must match that path.
Ordinary container replacement and `compose down` retain the volume. Removing
the volume (for example with `down -v`) removes its snapshots. Include this
volume in your host backup policy; persistence alone is not an independent backup.

The optional Kubernetes preview manifest mounts a 1 GiB PVC at the same path,
with a single replica and Recreate updates. A default StorageClass is required.
Migration and protection depend on the selected storage provider and volume
backup policy; these are not automatically configured. This manifest has not
been deployed by this work.

Snapshots lists saved snapshots, allows download and manifest inspection, and
reviews restoration of local configuration and publication drafts. Restore
requires a fresh snapshot of the current state and explicit confirmation.
Additional publications referencing restored configurations block restoration
until their dependencies are covered. The backend confirms storage before the
snapshot requirement is satisfied. Configuration snapshots include readable referenced Secret values; application data and persistent-volume backups are excluded.

Overview's Configuration history action opens Snapshots filtered to the selected
route. Clear filter returns to all records. Existing route edits lock the
namespace and preserve path rules, middleware references and extra destinations.
Save as draft and Cancel operate locally; Publish stays disabled without a live
Rancher connection. Routing rule offers compatible Ingress/Traefik resource types;
Automatic supports combined HTTP, TCP and UDP mappings.

`npm run test:snapshots` verifies actual server storage, restart persistence,
history metadata, reads/downloads, invalid inputs and cross-origin write rejection.
The native extension currently needs a separately configured authenticated
snapshot backend; the extension registration Helm chart does not install this
standalone preview server.

New YAML backups retain observed pre-change routing specifications when the same
object also has a local edit; the JSON index keeps that edit separately. The
preview exports inspected specifications, not original source-file bytes or fresh
live cluster resources. Known Services, Middleware, TLS options, IngressClass and issuer specifications
are included as dependencies. Original comments, complete metadata, Helm values
and application data are not included. Readable referenced Secret contents are included in private recovery files. See [manual recovery](RECOVERY.md)
for reading backup files without the application and reviewing a Kubernetes restore.

TLS issuer profiles support multiple base domains, separated by commas or new
lines. The connection editor derives its domain dropdown from those profiles.
Its existing-certificate selector supports several certificates in the destination
namespace and a Generate new certificate option. Selection fills the issuer
reference automatically. Independent certificate domains generate separate
Traefik route groups, or multiple TLS entries in a Kubernetes Ingress. Every host
must have coverage. Complex negated match rules require separate review before
splitting an existing Traefik route; no live resources are replaced by this preview.

The connection editor resets for each new connection. Leaving unsaved fields
offers Save draft and leave, Discard changes or Stay on this page. Working forms
can be resumed from Overview during the browser session. Reloading does not
persist these working forms. Cancel is an outlined button alongside the other
actions. Existing-connection namespaces remain locked.

Certificate setup can request through an issuer or reuse an inspected Certificate
in the destination namespace. Reuse checks DNS coverage, including single-level
wildcard coverage, and references its TLS Secret without requesting or modifying
a Certificate. Live readiness and Secret availability still require validation.
TLS & Certificates also has Issue new certificate, which prepares a cert-manager
Certificate YAML draft without contacting an issuer.

The Overview error card opens Diagnostics with ERROR severity and a one-hour
lookback. The card is explicitly labelled Demo logs while live logs are not
connected. Scoped thin dark scrollbars match the preview panels, and expanded
attachment sections use a single divider between lists.

### Snapshot comparison and form protection

Reconfiguration can select a stored snapshot or upload its JSON index. The preview validates the recorded creation time (within 24 hours) and compares the entire affected configuration automatically. Differences are listed with side-by-side current and saved content; mismatches cannot satisfy the backup gate. Snapshots provides a separate restoration review, fresh-current-backup requirement and explicit overwrite confirmation. YAML recovery copies remain usable without the application; YAML alone does not establish capture age and application coverage.

Issuer, port configuration, certificate and connection forms offer Save Draft And Leave, Discard Changes or Stay On This Page when edits would be lost. Incomplete working drafts can be resumed from Overview during the current browser session. These working drafts differ from durable configuration snapshots. Generated certificate Secret names include the namespace and certificate name, while manual overrides are retained. Table actions use right-aligned icons with accessible names and tooltips; button labels use title case.

### Overview domain and forwarding details

Domain Details appears above port mappings for the selected route. Concrete HTTP/HTTPS hostname matches open in a new tab beside their corresponding internal Service IP:port and endpoint IP:target-port links. Service addresses also appear in the destination flow card. Named backend ports resolve against inspected Service and EndpointSlice port metadata; IPv6 addresses use brackets. Raw TCP/SNI and UDP mappings remain address references. Wildcards and regular expressions are not presented as directly browsable domains. Internal links require access to the cluster network; displayed addresses are inspection snapshots, not availability checks. Domain Details displays only address/port metadata; Secret values are never displayed there.


### Namespace scopes and pending changes

Port Configurations opens as a flat list with a Namespace column. Imported names contain only the Service name; their namespace is shown separately. Global configurations are available in all namespaces. The namespace filter includes matching scoped configurations and Global presets; Group By Namespace optionally groups the list, with Global first. New configurations default to Global, and existing configuration scopes are immutable. Duplicate names are allowed across separate scopes.

All page panels fill the available viewport and scroll internally. Pending Rollouts appears immediately below TLS & Certificates with a count of saved proposals. It includes connection creation and edits, certificate creation and reissue, issuer profiles, credential references, port configuration edits and restoration proposals. Repeated saves replace the same pending item. Proposed manifests/configuration can be reviewed and downloaded. Incomplete working forms remain working drafts, not validated rollout proposals. Publishing remains disabled without a live backend. Pending Rollouts contains saved proposals awaiting explicit selection and Apply. Running Processes separately tracks submitted operations; in this preview these are explicitly simulated, with no cluster writes. Snapshots contains durable snapshots. Pending changes are session-local and reset on reload.

Overview route cards open connection details directly, without selection checkboxes or a Select All control. Bulk selection remains available in configuration inventory grids.

Overview shows a three-stage traffic path (Incoming Traffic → Traefik Listener → Destination Service), with Resource Context alongside it. Domain Details opens by default per route; Ports & Mappings and TLS & Certificate start collapsed and share single dividers. Only the route-type badge beside the history/edit actions uses a larger font.

Navigation is flat under Network Manager. TLS & Certificates, Pending Rollouts, TLS Issuer Profiles and Port Configurations show right-aligned reactive counts; the certificate count includes observed certificates and unique prepared new-certificate drafts. Rancher uses the native navigation count field.

Refresh Every defaults to five minutes and supports Off, thirty seconds, one minute, fifteen minutes and one hour. Manual and scheduled refresh update the current view in place without reloading or remounting forms. Snapshots reloads saved snapshot metadata and Diagnostics regenerates labelled demo logs; cluster inventories remain static until a live backend is connected.

Empty grids retain sortable headers and show No Results Available. Pending Rollouts has no simulated example rows; preview Apply creates clearly marked simulated Running Processes.

The fourth Overview statistic is Pending Rollouts. It shares the sidebar pending counter and opens the Pending Rollouts page when clicked.

Refresh Every has a fixed-width MM:SS countdown driven by a clock deadline, so delayed browser ticks do not accumulate drift. Interval changes and manual refresh reset the countdown; Off displays 00:00. Certificate status badges use title case and green/amber/red readiness states only for routes expecting a local TLS certificate; raw TCP/UDP and TLS passthrough remain neutral. Clicking the Network Manager header expands its menu and opens Overview.


### Snapshot schedules and display settings

Snapshots shows Manual or Automatic generation, configuration scope, and a date range with optional times. The bottom schedule panel stores its interval (minutes, hours, days, weeks or calendar months), namespace scope, enabled state and source on the snapshot volume. Scheduling runs on the hosting server even when the browser is closed. The preview captures the most recent saved source: imported cluster data remains static until a live connection is implemented. Keep the snapshot volume in the host backup policy.

Settings persists display preferences in each browser. Snapshot status and inspection notices can be hidden separately. Preview Mode controls explanatory preview notices and branding; it does not enable cluster writes or replace demo logs with live logs. The standalone test build defaults to Preview Mode on; native extension builds default off. For a standalone build with notices off by default, set the Docker build argument `SNM_PREVIEW_MODE=false` (or the same environment variable when building with Vite). Saved browser preferences override the build default.


Snapshot status compares configuration fingerprints against saved copies from the last seven days. Green indicates matching coverage, yellow indicates partial or differing coverage, and red indicates no recent applicable backup. Multiple recent snapshots can collectively cover the known configuration. These checks cover saved inspection resources, Service port references, port bundles, issuer profiles and local drafts; they do not verify live cluster state. Referenced Secrets without captured values remain uncovered. Each route has a corresponding badge and expandable snapshot list. Selecting a snapshot opens the Snapshots page filtered to that record.


## Reviewed changes and recovery operations

Shared header actions align with the primary title, with icon-only Refresh,
a minutes:seconds countdown, then the page count. New and conditional red Delete
actions share button sizing. Inventory grids share search, namespace context,
optional grouping, sortable headers and help. Rancher's namespace selection
synchronizes in both directions, including user/system and namespaced/cluster
scopes; Global port presets remain shared when selecting specific namespaces.

Bulk configuration deletion queues proposals and preserves Secrets. Deletion and
Apply require a fresh matching backup and explicit confirmation. Preview Apply
validates conflicts and simulates progress; live cluster submission and controller
tracking are not connected. Proposals and processes are session-local.

Snapshots supports selecting restoration items, automatically including known
dependencies and blocking missing ones. The review compares current and saved
content before preparing proposals. Merge opens its own page in the shared shell,
with the same heading actions, refresh interval, countdown, Help, and right-aligned
count as Snapshots. Its navigable workflow is:

1. Drag sources into override priority, highest first. Move Up/Down buttons and
   Alt + Up/Down provide keyboard alternatives. The highest source containing an
   item supplies that complete item; missing items are taken from lower sources.
2. Review one selection step per item type: TLS Issuers, Certificates, Port
   Configurations, Secrets, then other saved resource/draft types. Each step
   shows only added/changed items. Matching items are hidden and retained
   automatically in the final snapshot. Unchecked changed Secrets keep current
   credentials when readable; explicitly select a Secret to use its snapshot
   version. If current credentials are unavailable, keep the saved version in
   the backup and disclose the limitation. Nothing is applied by merging. Required
   known dependencies are automatically included; missing dependencies block merge.
3. Review the flattened selection against the current configuration side by side.
   Only added or changed items appear; matching items and current-only items are
   ignored. This is not a list of IDs repeated across input files. Transient
   Kubernetes status/resource-version changes are not configuration differences.
4. Confirm the summary and optionally Remove These Snapshots When Merged. Save
   the new JSON/YAML recovery pair before removing originals. A partial merge
   retains originals so excluded configuration remains recoverable. If cleanup
   fails, the merged snapshot stays saved and deletion can be retried separately.

Merging does not restore or apply resources. The merged snapshot can be opened
for selective restoration into Pending Rollouts. Item capture dates survive both
merges and subset selection; combining old copies does not make coverage fresh.
Merge choices participate in the existing unsaved-change prompt and can be saved
as a session draft. Native routing registers the merge page as a hidden route.
Snapshot Size sorts by actual combined JSON + YAML bytes and automatically scales
through decimal B, KB, MB, GB, and TB. Labeled title-bar actions use the same
14 px font, 18 px SVG icon, and 40 px button height, with Delete staying red.

Automatic capture and cleanup schedules sit side by side and persist on the
snapshot volume. Cleanup is disabled by default and protects the newest snapshot
for each known scope or configuration item. Isolated storage tests verify retention,
restart, merge precedence, deletion protection and YAML/JSON recovery pairs.
Diagnostics defaults to 24 hours and counts warnings plus errors over that window;
any error makes the count red, warning-only makes it yellow. Logs remain demo data.

Backup files include TLS Certificate and Issuer/ClusterIssuer YAML, port
configuration metadata, affected route/dependency manifests, and readable
referenced Secrets. Native Rancher capture reads Secret values using the current
user’s access; the Docker preview has no live credentials and reports missing
Secret references. Older snapshots cannot reconstruct absent credentials. JSON
and YAML recovery files are sensitive and remain in private persistent storage.
On-screen comparisons redact Secret values. Explicitly selecting Secrets in a
restoration review queues credential replacements; deletion always preserves
Secrets. Scheduled capture uses the latest source synchronized from the UI, not
a background live-cluster inspection.

Snapshots defaults to Created descending (newest first), including within
namespace groups. Sorting uses creation timestamps, not formatted date strings.
An explicit column sort stays selected during in-place refresh.

Skip item-type steps with zero added/changed items. Their matching items still
persist automatically in the final merged snapshot. A completely matching merge
advances directly from priority to review and final confirmation.

The snapshot coverage banner is clickable and keyboard accessible. Partial
(yellow) coverage opens a dedicated summary/diff page in the shared Snapshots
header shell. Group missing, outdated and changed items into collapsible sections
by item type; hide all matching/recently covered items. Compare each uncovered
item with its latest applicable stored version, redacting Secret values. Green
coverage opens the Snapshots inventory. Missing/outdated coverage opens the same
gap review. Missing referenced Secret values count as uncovered and must be
listed in both the JSON index and YAML recovery comments.

Automatic Snapshot Schedule shows hosting-volume free/total space, the largest
saved combined JSON/YAML snapshot, estimated remaining capture capacity and an
estimated exhaustion date at its saved enabled cadence. Use actual filesystem
available blocks rather than browser storage. Calendar-month schedules preserve
month-end clamping. Label the estimate as before cleanup/other disk usage; do not
claim a prediction when no snapshot size or enabled schedule is available. Space
measurement failure must show Unavailable rather than a fabricated zero. Refresh
measurements in place after capture, cleanup, schedule updates and normal refresh.

When merging, read the current version of every source Secret as well as currently
referenced Secrets so rotated credentials can be preserved even after references
change. Failed reads must not silently reuse stale credentials. Redact Secret
annotation values in on-screen comparisons because last-applied annotations can
contain credential values; retain the complete manifest only in private backups.
