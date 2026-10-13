# Network Manager standards alignment review

Requirements authority: [Rancher Plugin Design Standard](../RANCHER-PLUGIN-DESIGN.md)
and [Network Manager Standards](../NETWORK-MANAGER-STANDARDS.md). Preview evidence
and native acceptance are recorded separately.

## Resolved decisions

All three review questions were resolved by the user on 2026-10-11:

- Interface context and navigation follow Rancher's existing menu style and structure.
  Native right-side counts, normal links and disclosure controls are retained without
  host CSS overrides. One global namespace selector replaces duplicate page controls.
- Snapshots adopt the standard and proposed format: ZIP, optional AES-256 encrypted
  credential-inclusive payload, transient passwords, preserved legacy records,
  Secret backup-presence notification coverage, quota-aware storage and ZIP sizes.
- Incomplete managed working drafts appear in Pending Rollouts as Needs Completion;
  Apply is blocked until they validate. Resume preserves their values and identity.

No backup migration, live Kubernetes mutation, native installation or public
publication was authorized by these decisions.

## Implemented alignment

- Inventory pages precede Pending Rollouts, Running Processes, Snapshots, Diagnostics,
  Settings and Help. Help/Settings have no counts; navigation counts honor host scope.
- The preview has one global scope picker. Embedded inventories read the native host
  namespace cache; OR namespace selections combine with other page filters as AND.
- Working forms count alongside valid proposals. Validating removes the working copy;
  starting another item preserves previously saved drafts. Display/scheduling forms
  remain outside managed-resource pending counts.
- Connection, issuer, port and certificate editor Save/Cancel actions use the shared
  header. Adjacent labeled header actions share measured width, 40 px height, 14 px
  text and 18 px icons. Select All exposes its mixed state and disables on empty grids.
- Hover/focus Help popups include Close/Open Help, render above navigation, and expand
  the matching guide section. The manager breadcrumb returns through the edit guard.
- Diagnostics defaults to 24 hours and uses rolling scoped warning/error counts
  independent of search/filter controls. Debug and namespace identification are present.
- Refresh reads are bounded to 60 seconds, show a delayed 300 ms overlay and count
  spinner, cancel on navigation and reject late commits. Failed reads preserve data
  and retry after 60 seconds (5 seconds for browser-confirmed offline state). Refresh
  never retries saved writes or automatically rescans port configurations.
- New snapshots are ZIP archives. Include Secrets defaults off; credential-inclusive
  payloads require a strong transient password and AES-256 encryption. Secret presence
  coverage rejects reference-only/future captures but does not compare rotated values.
  The separate mutation backup gate still checks age and configuration content.
- Capture/cleanup schedules retain two adjacent panels and green/red status badges.
  A full-width collapsible storage row reports effective quota-bounded capacity and
  complete ZIP size. Docker has a 1 GiB application quota; an unknown quota is shown
  as unavailable. Legacy JSON/YAML records remain readable.
- Shared preview data, container ZIP dependencies and versioned native bundle/files.txt
  build paths are integrated. Updated Help and recovery notes distinguish current ZIP
  behavior from historical legacy behavior. Preview notices sit in the breadcrumb
  row; optional read-failure notices preserve access to the scoped Help topic.

## Native/live acceptance still required

These are integration requirements, not a claim of production verification:

- Install the extension in the target Rancher version and validate actual host routing,
  namespace/access contracts, count health/loading support, themes and package chart.
- Connect authenticated inventory, persistent snapshots, fresh relevant controller
  replicas/logs, live Apply and controller tracking. Preview Apply remains simulated.
- Validate access checks, audit records and backup compatibility with the chosen
  external AES ZIP recovery tool. No credentials or live Secrets were changed here.
- Exercise secondary dialog/read lifecycle under installed navigation. Local reads
  for the shared refresh, snapshot banner and schedule/storage panels are bounded
  and cancelled on unmount. Local verification covers separate schedule dirty state
  and managed editor navigation.

## Verification

See [implementation evidence](IMPLEMENTATION-REVIEW.md) for tests, browser checks and
Docker deployment. Earlier dependency/build failures were repaired; their historical
records do not describe the latest verified build.
