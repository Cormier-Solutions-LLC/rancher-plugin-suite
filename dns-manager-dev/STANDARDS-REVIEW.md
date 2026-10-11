# DNS Manager standards alignment review

Reviewed 2026-10-11 against `../RANCHER-PLUGIN-DESIGN.md`. This is implementation
evidence and a pending-work list, not an exception to the shared standard.

## User review required

| Item | Conflict or dependency | Proposed decision, awaiting user review |
| --- | --- | --- |
| Native navigation counts | The shared standard requires a fixed left badge column and native Rancher navigation. The installed SDK's host menu renders counts on the right; the standalone DNS menu supports the requested left column. | Keep supported native placement in Rancher and left badges in standalone, or authorize DNS-specific host-menu customization. No customization has been applied. |
| Snapshot schedule/cleanup actions | The shared standard puts every page action in the top-right row. The imported schedule and cleanup panels keep their Save, Enable/Disable, and Run Now controls inside each panel. | Approve an explicit panel-action exception, or move these actions to the page heading. Existing panel controls remain pending review. |
| Snapshot file ownership | Another process changed the same Snapshot components, server, and shared preview wiring during this pass. | Assign one writer: this chat, or the other project/chat. Further Snapshot component/server edits in this chat are paused to avoid overwriting concurrent work. |

These questions were presented in the chat. No response has been received at the
time of this report. No silent exception has been added to the shared standard.

## Implemented and checked locally

| Area | Evidence and boundary |
| --- | --- |
| Native packaging | Explorer routes and product/menu registration compile into a versioned UMD extension; `files.txt` lists the plugin asset. Native pages omit standalone host chrome and consume Rancher theme tokens. Installation is pending. |
| Helm registration | UIPlugin chart lint and offline rendering pass with an explicit asset endpoint; blank endpoint fails. This chart registers the UI only. |
| Navigation and scope | Standalone left badge slots, expandable Zones, active owning menu, manager title to Overview, and footer pages exist. One searchable global namespace selector replaces duplicate page selectors. Native store handling is implemented but needs installed verification. |
| Page layout | Viewport-bounded content, internal scroll areas, labeled filters, top-right main actions/refresh, matched action geometry, and numeric/text header alignment. Current Zones viewport has no document vertical overflow. Snapshot action placement remains under review. |
| Grids and ordering | Sortable headers with accessible direction and numeric comparison; Reorder hidden until selection; whole-row dragging, keyboard movement, dirty-only Save, Cancel, and applied order retained while staging. UI checks passed for selection, keyboard movement, Cancel, and numeric sort. |
| Editor behavior | Existing source identity and record owner/type are locked. Record identity includes owner/type/value. Refresh preserves unsaved values. Unsaved navigation offers Stay, Save Draft And Leave, or Discard. Browser checks verified record fields, refresh preservation, and discard. |
| Alerts and loading | Full warning/error banners open relevant guidance. Missing backend is a confirmed error; delayed reads use separate loading feedback. Request timeout/retry logic exists; real source recovery requires a connected reader. |
| Connection test | Tests entered unsaved settings and explicitly reports Not Verified while the management test adapter is unavailable. It does not fabricate successful connectivity. |
| Local ZIP service | Focused tests pass for archive recovery, durable restart persistence, merge priority, quota exhaustion, encrypted unlock, wrong-password rejection, and Secret presence coverage across age/rotation. Availability is bounded by destination free space/quota. This is development-only storage. |
| Secret handling | Whole-payload AES-256 ZIP envelope and password-strength validation are tested. Live Secret capture is blocked without its authenticated adapter. The DNS staging boundary rejects plaintext Secret values rather than persisting them in preview drafts. |

## Pending implementation or live acceptance

- Resolve the three review items before the affected changes proceed.
- Finish the Snapshot adapter after file ownership is agreed: full coverage/banner
  integration, encrypted merge/restore lifecycle, consistent grid/action styling,
  and acceptance of every imported Network Manager feature. Isolated archive tests
  do not prove the complete page workflow.
- Provide authenticated Rancher/DNS inventory, Windows connection tests, restricted
  record operations, live Secret reads, authorization, and concurrency validation.
  Native inventory remains unavailable until that adapter is connected.
- Implement validated rollout proposals and durable pre-change backup/revision gates,
  backend-confirmed Apply, and real Running Processes. The preview's Apply remains disabled.
- Connect resource logs and discovered log sources; verify severity/lookback and
  scoped rolling 24-hour counts against real managed-resource events.
- Verify loading, 60-second timeouts, five-second source recovery, and return to
  five-minute refresh with actual adapters rather than sample refresh notices.
- Publish operator-approved extension assets, then verify clean Helm install, native
  left navigation and hidden routes, host namespace/project scopes, theme changes,
  upgrade, and uninstall in Rancher 2.15.x. Build and chart rendering are not installation.
- Supply and validate DNS runtime deployment, physical-host distribution, independent
  persistent storage, Traefik/MetalLB TCP and UDP failover, Windows zone synchronization,
  Omada fallback, and controller-loss management access via `kubcontroller`.

## Validation recorded for this pass

- `npm run build:preview`: passed.
- `npm run build:extension`: passed; webpack reports the bundle exceeds its recommended
  size threshold. Versioned assets generated locally; no publication or installation.
- `npm test`: six tests passed, including backup-server restart/quota and record identity.
- Helm lint/template: passed offline; missing asset endpoint rejected.
- Browser checks: selection-dependent Reorder, keyboard movement, Cancel, numeric sort,
  namespace search/Escape, record identity locks, unsaved refresh, discard, alert guidance.

No live Rancher resources, Windows DNS records, Omada configuration, or Kubernetes
serving configuration were changed by this pass. Alexa Input notification through
the requested skill failed TLS connection establishment; delivery was not confirmed.
