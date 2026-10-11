# Network Manager standards alignment review

This review compares the project with the current [Rancher Plugin Design Standard](../RANCHER-PLUGIN-DESIGN.md) and [Network Manager Standards](../NETWORK-MANAGER-STANDARDS.md). Those files remain the requirements authority. Historical implementation notes describe the preview, not acceptance against the newer standard.

## Decisions requested

The following changes conflict with earlier accepted Network Manager preferences. They are proposed, not applied by this alignment batch. Three review questions have been presented together; the Alexa input alert was accepted by Home Assistant. The baseline column describes the project at the start of this review.

| Decision | Current implementation / earlier preference | Standard and proposed result |
| --- | --- | --- |
| Interface context and navigation | Namespace controls on individual pages; right-aligned navigation counts; inventory pages mixed with operation pages. | One global Rancher namespace selector, with a standalone equivalent; no duplicate page namespace selectors. Fixed left count slot before each navigation label. Inventory pages followed by Pending Rollouts, Running Processes, Snapshots, Diagnostics, Settings, Help. |
| Snapshot format, credentials, coverage and storage | Durable JSON/YAML pairs; readable referenced Secrets captured with configuration; freshness/content comparisons include Secrets; storage details below the capture schedule using filesystem free space. | New ZIP snapshots. Include Secrets off by default. Encrypt the complete secret-inclusive payload with AES-256 using a transient password. Preserve legacy records. Secret notification coverage checks backup presence; non-Secret coverage keeps freshness/content checks. Full-width storage row below both schedules, quota-aware effective writable capacity and complete ZIP byte size. |
| Incomplete working drafts | Incomplete saved forms appear as resumable working drafts on Overview. Pending Rollouts contains validated proposals. | Also list incomplete saved forms in Pending Rollouts as Needs Completion. Disable Apply until the form validates; opening it resumes the saved values. |

The snapshot decision does not authorize deleting or rewriting existing backups. Encryption requires a documented password policy, tested archive compatibility and wrong/missing-password handling before acceptance. Scheduled secret-inclusive captures also need a backend credential/unlock contract; passwords must not be retained in browser drafts, local storage or logs.

## Changes that do not conflict

- Add a final Help page, collapsible guidance for pages and workflows, and contextual Open Help navigation. Preserve hover/focus activation and the popup's viewport bounds and high stacking level; add Close and Open Help controls.
- Make the manager breadcrumb return to Overview through the unsaved-change guard.
- Apply the active host namespace scope to Diagnostics and its Overview error metric. Use a rolling clock for the 24-hour incident count, independent of the view filters. Add Debug to the severity choices and identify namespace on log rows.
- Use the same diagnostic count for the preview navigation and header, with neutral zero, amber warnings and red when any error exists. Accessible text includes the time window, demo managed-resource scope and separate warning/error totals.
- Preserve the shared mock-data source imports when building Docker by supplying the sibling preview-data directory as an additional build context.

## Remaining implementation and integration work

These are gaps, not verified capabilities. Decisions above must be resolved before their dependent work proceeds.

| Area | Remaining acceptance work |
| --- | --- |
| Loading and refresh | Delayed 300 ms page overlay/count spinners, 60-second read timeout, visible retry countdown, disconnection-specific retries, cancellation and ignoring late responses. Reads must retain prior data and writes must never be replayed automatically. |
| Counts and access | All inventories and counts must honor active host context and authorization; missing required dependencies must drive accessible red failure states. Native navigation count color/loading support needs validation in installed Rancher. |
| Forms and header actions | Audit every page-level editor action against the header contract; modal confirmations remain in dialogs. Verify adjacent labeled action widths as well as current common height, font and icon sizes. |
| Selection and priority | Indeterminate Select All and affected visible/authorized scope; shared Reorder only for collections supporting manual order, kept distinct from snapshot merge priority. Overview remains free of selection checkboxes. |
| Snapshots | ZIP capture/import/download/storage/API migration, payload encryption/decryption, archive provenance, quota-aware storage estimates and legacy compatibility. Do not report the legacy JSON/YAML preview as compliant. |
| Scheduling | Enabled/Disabled color badges, next-run-only explanatory rows with contextual help, accepted storage layout, and encrypted-capture scheduling behavior. |
| Settings and unavailable sources | Separate visibility preferences for each banner type. Hiding notices must preserve failure badges and capability gates. Show missing backend configuration as unavailable, not verified zero or an active request. |
| Native integration | Authenticated snapshot hosting, fresh inventory across relevant resources/replicas, live Apply and controller tracking, access checks, audit evidence, chart/bundle/files.txt installation and actual Rancher menu validation. These require integration acceptance, not a local preview build alone. |

No live Kubernetes changes, Secret writes, backup migration/deletion or external publication are part of this review. The Docker preview remains distinct from an installed, authenticated Rancher extension.

## Validation evidence

Validation and deployment results are recorded in [IMPLEMENTATION-REVIEW.md](IMPLEMENTATION-REVIEW.md). Completion of the Help/diagnostics additions does not close the decisions or the remaining acceptance work above.

Additional ZIP-backup code and root dependency changes entered the shared workspace during verification. Those edits were preserved. They require integrated review and tests; their presence is not approval of the snapshot decision. The latest Docker build failed to resolve the ZIP dependency from the separate container dependency set. The latest native build failed because vue-loader resolves root webpack 4 while Vue CLI uses nested webpack 5. No updated image was deployed during this alignment batch.
