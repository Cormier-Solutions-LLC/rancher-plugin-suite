# Local DNS prototype validation

Validated on 2026-10-11 with the documented `scripts/Test-Prototype.ps1` entry point.
Result: **25 checks passed, zero failed**. Both .NET projects built with zero warnings
and errors. Compose configuration validation passed. All six test containers were
confirmed stopped afterward; their independent volumes remain available for inspection.

Engine: `technitium/dns-server:15.6.0`, pinned to:

```text
sha256:1045db38fd2f2e4d9578f9168b7eb4862575469ed0ffc79e03f36bdc772a93b5
```

The build references were extracted from that image, not downloaded from a different
server version. The fixture App package includes the required dependency manifest.
Machine-readable results and the package are generated under ignored `artifacts/`.
Administrator credentials and server libraries are ignored and are not included here.

## Evidence established

- Three independent secondary servers transfer and answer source records.
- Internal `.io` precedes internal `.com`; both precede public suffix candidates.
- Dotted and multi-level names keep their exact question; internal FQDN misses can
  obtain fresh source records or fall through to the public fixture.
- A/AAAA, cross-zone CNAME chains, preserved questions, synthetic aliases with AD
  cleared, terminal NODATA, and bounded CNAME-loop failure behave as specified.
- Source records added before the next transfer are available through the source
  query tier. Positive source-cache records expire at their original short TTL.
- Cached public answers and cached source NXDOMAIN do not outrank newly transferred
  internal positives. All definitive negatives remain NXDOMAIN; source transport
  failure remains SERVFAIL when no later candidate resolves.
- Nonrecursive requests preserve ordinary authoritative semantics.
- TCP resolution and a large A RRset through the UDP/TCP retry path retain the answers.
- Cached source data remains usable during source downtime; fresh public fallback
  during the outage completes within the four-second test budget (about one second).
- Restarting one DNS server during source downtime loads its retained zones and
  continues answering. Stopping one server leaves the other two answering independently.
- Restarting the source and resynchronizing all three servers propagates an updated
  record to each instance.

## Limits of these results

The source and public resolver are Technitium fixtures on an isolated local Docker
network. This establishes the selected engine's basic transfer/persistence and App
behavior, not Windows DNS compatibility or Google DNS integration. The tests use
two forward zones and ordinary fixture records, not every controller zone/type.

All containers run on one host. This is not Kubernetes, physical-host, storage,
Traefik, MetalLB, Omada, or management-endpoint HA proof. Source return was tested
with an explicit resync; automatic Windows NOTIFY/IXFR recovery remains to be verified.
Longer outages past SOA expiry and production cache/reload/DNSSEC behavior remain open.
No native Rancher UI or Windows record-management adapter has been built in this proof.

The next live prerequisite remains verifying management through `kubcontroller`
at `10.99.15.50` during controller01 loss, before deploying the LAN DNS service.

## Locally runnable interface

The repository-owned Vue/Vite preview was verified on 2026-10-11 using
`npm install`, `npm run build:preview`, and `npm run preview`. It serves the
clickable interface at `http://127.0.0.1:5174`, independently of the DNS engine tests.
Browser checks passed for navigation, hidden source and record editor views,
record drafts, drag and keyboard ordering, Cancel, dirty-only Save, snapshot review,
sidebar updates after Save, persistence after reload, and a narrow layout.
No browser runtime errors were observed. Icons are bundled locally; this preview
does not depend on the conversation renderer or its runtime.

These are sample-data UI checks. Local storage for drafts, order, and preview
snapshot metadata does not establish durable backend snapshot storage, native
Rancher registration, or live Windows DNS management.

## Standards alignment pass — 2026-10-11

Current status and pending review decisions are recorded in
[STANDARDS-REVIEW.md](STANDARDS-REVIEW.md). Earlier preview behavior above is
historical: order Save now stages a pending draft, and the shared preview source
owns sample data/state. It does not apply ordering to live DNS.

Both the Vite preview and native UMD extension build pass. Versioned native assets
include `files.txt` and `plugin/dns-manager-0.1.0.umd.min.js`. The build reports its
bundle-size performance warning; the extension was not published or installed.
Helm lint/template pass offline with an explicit endpoint, and an empty endpoint
is rejected. This proves packaging/rendering, not installed menu or live API behavior.

Six focused project tests pass: ZIP contents/recovery, whole-payload encrypted
Secrets, password validation, presence-only Secret coverage, persistent server
restart/merge/quota behavior, and independent selection of records sharing an owner.
The shared `test:snapshots` suite also passes three tests covering both projects'
local encrypted recovery, verified-source merge, destination storage, restart,
and cleanup. Isolated tests use temporary owned directories and loopback services.

Browser checks verify Reorder visibility after selection, keyboard movement,
dirty-only Save, Cancel, numeric sorting, searchable namespace choices and Escape,
locked existing record identity, preservation of unsaved values during refresh,
navigation discard, and specific alert guidance. No live DNS operation was attempted.

Further Snapshot component/server edits are paused pending shared-file ownership.
Native menu count placement and Snapshot panel action placement also await user
review. Full authenticated snapshot/restore, native namespace/theme integration,
Windows operations, rollout execution, and Kubernetes HA acceptance remain pending.
