# DNS Manager remediation plan

The requested review/plan is complete. The checked tasks below describe the completed audit. The phases afterward are future product repairs, not unfinished audit work and not a claim that they were implemented.

## Completed review work

- [x] Read and inventory the authoritative standard; distinguish historical reference evidence.
- [x] Add the requested global scrubbed Git LFS demo-data requirement and acceptance item.
- [x] Inspect all fixed DNS pages, all seeded zone pages, hidden editors and snapshot/leave/review workflows.
- [x] Capture visual evidence and measure all visible routes at desktop/tablet/mobile widths.
- [x] Create and run real Vue/UI unit tests plus recorded real-browser alignment assertions.
- [x] Create unsuppressed failing acceptance tests for confirmed gaps.
- [x] Run local backend tests and preview/extension builds; separate local proof from live/native acceptance.
- [x] Record a result, analysis and evidence for all 231 items plus narrative sections.
- [x] Publish the local report and prioritized implementation plan.

## Phase 1 — restore usable core workflows

Address F01, F02, F03, F11 and F15 first.

1. Route `zone:new` to its clean editor before matching zone details. Test actual form controls/submission, not only its heading.
2. Model Working Draft / Needs Completion / Validated Proposal distinctly. Add Resume on Overview/Pending with full values, identity, persistence lifetime and replace-on-save behavior.
3. Inject the unified provider into native/preview pages. Apply successful normalized read results in place without remounting editors or losing selection/order proposals. Refresh snapshots, storage and schedules with bounded cancellation/recovery too.
4. Allocate sufficient height for inventories/schedules/restore review. At narrow widths, move bulky guidance behind contextual help and keep filters reachable. Preserve the user's two schedule panels and full-width storage row at desktop size, with usable responsive behavior.
5. Validate source dependencies and per-record DNS values/TTL/mappings before promoting drafts; repeat authoritative validation on the backend before execution.

**Acceptance:** F01/F02/F03 and relevant geometry/validation tests pass; source/zone/record creation and resume are usable in a fresh distributed demo and real-provider readback refreshes the displayed values.

## Phase 2 — unify common UI behavior

Address F04, F05, F07, F08, F09, F17 and F18.

1. Reuse common action/grid/help/filter components and styles. Remove the outer decorator from Vue-managed tables; retain one sort implementation, right-aligned numeric columns, nonsortable selection/action columns and attached detail rows.
2. Use 18 px icons/40 px action controls; plus for New, red trash for Delete, equal group dimensions and aligned heading placement. Repair UTF-8 gate text.
3. Add searchable multi-select domain filters and generation choices with clear/count behavior. Preserve scope and accessible sort/selection state.
4. Add read-only row details and owner breadcrumbs; separate edit/checkbox interaction. Resolve resource/history links in active cluster context and explain unavailable destinations.
5. Open contextual Help on hover/focus with a bounded overlay and keyboard operation. Fix password-modal focus/return/trap and reusable Include Secrets cancellation.
6. Make Diagnostics badge expose rolling 24-hour scope and severity totals, and discover authorized backend log sources/replicas. Use one consistent count contract.
7. Keep display preferences per browser, with each applicable banner type separately configurable. Give every amber/red repair notice a direct scoped editor/recovery action with normal draft gates.

**Acceptance:** relevant gaps tests pass; visuals and real-browser probes rerun at all three widths; keyboard checks include dialogs/popovers/selection, and filters/counts agree with the defined scope.

## Phase 3 — complete recovery and change lifecycle

Address F06, F10, F12 and F16 before enabling live Apply.

1. Render seven-day resource coverage/history and grouped missing/outdated/changed diff page. Keep this display window separate from the 24-hour mutation gate and preserve Secret-presence semantics.
2. Register merge as a hidden editor route in the common shell. Move page/step actions into the required action area; guard every leaving path and restore saved choices without persisting passwords.
3. Normalize comparison content so capture metadata does not create false changes. Supply current Secret reads and dependency identities through an authenticated backend; never substitute stale credentials after failed reads.
4. Review exact current/proposed resources, dependencies, consumers and ownership. Supply downloadable DNS/native configuration and route controller-owned changes through their source.
5. At execution, enforce permissions, full-scope recent backup, durable storage, authoritative revisions and group validation. Reconcile uncertain writes before retrying.
6. Populate Running Processes with real accepted operation IDs/state/scope/start/results, honest partial failures and separate session rollout/rollback history. Update applied zone grid/sidebar order only after backend confirmation.

**Acceptance:** local and authenticated integration tests prove snapshot encryption/recovery/merge/provenance, invalid passwords excluded, confirmation/dependency gates, conflict handling, ownership and process/readback behavior. Live mutation remains disabled until these checks pass.

## Phase 4 — ship the global demo foundation

Address F13 with the shared provider used by phase 1. SQLite or a validated single global data file can satisfy the standard; choosing the representation is an implementation decision, not a reason to duplicate plugin stores.

1. Define versioned global schema with plugin records and scenarios. Inventory every feature/state needing data: populated/empty, draft/proposal/process lifecycle, errors/recovery, ownership/dependencies, snapshot coverage/password/merge/retention/storage outcomes.
2. Capture authorized authoritative source data where available; replace sensitive identities consistently, remove real credentials/Secret values/private keys/PII, preserve provenance/timestamps and label synthetic scenarios.
3. Add scrub/validation checks and record acquisition/scrubbing rules. Scenarios must retain valid cross-resource references and safe demo credentials only where deliberately synthetic.
4. Track the single distributed seed with Git LFS and commit its pointer/configuration. Document install/pull; fail clearly when pointer content has not been fetched.
5. Point root and per-plugin previews at the same source contract; make editable local/session copies. Preserve atomic save, revision conflicts, clear failures and source history without modifying the packaged seed.
6. Add feature-specific UI tests before accepting a new feature. Native Rancher provider swaps use the same UI contract.

**Acceptance:** fresh LFS checkout prepopulates every feature scenario; missing LFS content has a clear diagnostic; scrub tests reject sensitive payloads; root/per-plugin previews edit the same logical model through isolated copies; live provider swaps do not require page rewrites.

## Phase 5 — native/runtime release acceptance

Address F14. Local bundle builds already pass; publication/installation is a separate controlled release phase.

1. Deliver and document UI asset hosting/registration, authenticated management backend, DNS runtime/Windows adapter and persistent backup storage. Explicitly target management versus workload cluster where they differ.
2. Validate Rancher 2.15.x/Extensions API 3 operator/CRDs, route/default/group behavior, potential duplicate Overview registration, native count loading/severity, theme/namespace/access context and host viewport.
3. Exercise clean install, real observation/readback, permission denial, timeout/source recovery, runtime independence from UI/management failure, owning-source recovery, upgrade and uninstall.
4. Re-run preview with Docker stopped in an appropriate test environment, without stopping the user's unrelated containers.

**Acceptance:** recorded installed-host and runtime evidence closes the unverified-live rows. Build artifacts or sample UI results alone never close them.

## Verification after repairs

Rerun the tests documented in [tests/ui/README.md](../../../tests/ui/README.md), regenerate screenshots/geometry and update every affected requirement disposition. Move repaired acceptance tests into the normal passing suite; leave no hidden/skipped failures. Preserve source hashes and scope of native/backend evidence. Do not count this plan as implementation proof.
