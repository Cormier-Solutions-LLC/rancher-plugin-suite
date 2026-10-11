# DNS Manager development project

Selected DNS engine: Technitium DNS Server 15.6.0 / .NET 10, pinned by image digest.
The project contains a standalone interface, a buildable native Rancher extension,
and an isolated DNS-engine/policy prototype. Live installation, Windows management,
and Kubernetes HA acceptance remain pending. Shared requirements live in
[Rancher Plugin Design Standard](../RANCHER-PLUGIN-DESIGN.md); DNS behavior lives in
[DNS Manager Design](../DNS-MANAGER-DESIGN.md).

See [standards alignment and review items](STANDARDS-REVIEW.md) for the current
implementation boundary and decisions awaiting review. A successful bundle build
is not evidence of successful native installation or live DNS management.

## Run the clickable interface locally

Use the same Node workflow as Network Manager. Requires Node 24 or newer:

```powershell
cd C:\Users\acormier\Documents\ChatGPT\Kubernetes\dns-manager-dev
npm ci
npm run preview
```

Open **http://127.0.0.1:5174**. Stop with **Ctrl+C**. Network Manager uses 5173.
The standalone wrapper loads `pkg/dns-manager/pages/Dashboard.vue`; simulated
Rancher chrome appears only in standalone mode. Current preview inventory and
saved state use the shared project-owned source at
`../preview-data/data/dns-manager.json`, editable through the preview mock-data UI.
These are sample configurations; they do not write to Windows DNS or Kubernetes.

The shared preview launcher starts a loopback snapshot service on port 5184 and
stores sample backups under `../.local/preview-snapshots/dns-manager/`. If that port
is occupied, resolve the conflicting process before starting another preview;
do not treat a different healthy service as this project's own service. The
standalone `npm run preview:backups` launcher is an alternative for a separate
backup-service session, not an additional process to run beside automatic startup.
It uses `../.local/dns-preview/snapshots/` and a default 256 MiB quota. Both services
are development tools; production authentication and authorization are pending.

Reorder appears after grid selection. Drag any part of a row, or use arrow keys
on its handle. Save appears only when order changes and stages a reviewed draft
in Pending Rollouts. Cancel discards the proposal. Active ordering changes only
through a backend-confirmed Apply; that operation is unavailable without the live
management backend and durable snapshot/revision gate. Record selection identifies
owner, type, and value, so multiple records with one owner remain separate.
Existing record owner/type and source identity names stay locked in their editors.

Local backups use ZIP with an index, independent configuration, and manifests.
Secret-value backups require a strong confirmed password and encrypt the entire
payload inside a generic AES-256 ZIP envelope. Secret capture and restoration
from live Rancher require an authenticated adapter; plaintext Secret resources
cannot enter persisted preview drafts. Storage availability is measured at the
writable backup destination and bounded by configured quota. These development
checks do not establish production restore or scheduler acceptance.

## Build and check the interface

```powershell
npm run build:preview
npm run build:extension
npm test
```

Preview assets are written to `dist-preview/`. The native build writes the versioned
`dist-pkg/dns-manager-0.1.0/` directory with `files.txt` and `plugin/` assets.
The [Helm chart](../charts/dns-manager/README.md) registers those published assets
as a Rancher UIPlugin. It requires an operator-selected reachable endpoint.
Registration alone does not deploy the DNS runtime, Windows adapter, storage,
or authenticated management API. No assets have been published or installed by
these local build commands.

## Run the local proof

Requires PowerShell 7, .NET 10 SDK, and Docker Desktop with Linux containers running.
From the workspace root:

```powershell
./dns-manager-dev/scripts/Test-Prototype.ps1
```

The script extracts the matching build libraries from the pinned image into the
ignored `.local/dns-prototype/lib` folder, generates an ignored local administrator
password, builds the App and test gateway, and starts this project's containers.
The harness creates and resets only the fixture zones in this explicitly named
`dns-manager-prototype` project. It stops the project on exit and retains its volumes.
Do not replace fixtures with real endpoints to run this harness: it creates/deletes
test zones and records. Keep the password file with its retained fixture volumes.

The five DNS servers share an internal Docker network with no external route.
A small test gateway accepts host connections on `127.0.0.1` only and proxies to
fixed fixture destinations; it does not accept arbitrary forwarding targets.
The public fixture simulates the response tier intended for Google DNS. No live
controller, Omada setting, Kubernetes resource, or production VIP is changed.

| Fixture | API port | DNS TCP/UDP port | Persistent volume |
|---|---:|---:|---|
| Source controller simulator | 15380 | 15353 | source |
| Public resolver simulator | 15381 | 15354 | public |
| DNS instance 1 | 15382 | 15355 | dns01 |
| DNS instance 2 | 15383 | 15356 | dns02 |
| DNS instance 3 | 15384 | 15357 | dns03 |

The App package and timestamped machine-readable results are written under ignored
`artifacts/`. The package contains the App DLL, its required `.deps.json` manifest,
and a fixture-only configuration. Shared server libraries stay outside the package.

## Implemented policy

The App uses a nonrecursive direct query for local authoritative records, a separate
nonrecursive source client/cache, and a separate recursive public client/cache.
Raw single-label A/AAAA queries try internal `.io`, internal `.com`, public `.io`,
then public `.com`. Each internal candidate checks replicated data before the source.
Names containing dots remain exact. Short answers preserve the original question
and add a CNAME pointing to the selected candidate; they do not rewrite record owners.
Authoritative FQDN NXDOMAIN is intercepted by response post-processing because
Technitium returns local negative answers before calling request-handler Apps.

NOERROR/NODATA is terminal: an existing internal IPv4-only host does not acquire a
public IPv6 address. Source timeouts permit later candidates, but an unresolved
source failure is SERVFAIL rather than a definitive NXDOMAIN. CNAME depth is bounded,
each upstream attempt has a timeout, and every policy execution has a total budget.
Public/source caches stay independent and do not extend short TTLs. Synthetic
responses clear AD; this prototype does not implement DNSSEC validation.

`testing` and `testing.` are identical on the DNS wire. Client search-list expansion
may send an FQDN before the server sees the original short input. Actual client and
Omada behavior must be verified before promising the end-to-end short-name sequence.

## Remaining production proof

- Windows zone inventory, transfer authorization, IXFR/NOTIFY behavior, reverse/AD
  record coverage, restricted record editing, and secure dynamic-update boundaries.
- DNSSEC validation, additional record types (including SRV/MX/PTR/TXT), delegation
  and special-use name handling, cache limits, policy reload concurrency, and abuse controls.
- Kubernetes placement across physical hosts, Longhorn recovery, SOA expiry handling,
  rolling updates, Traefik/MetalLB TCP and UDP failover, and Omada upstream selection.
- First verify the `kubcontroller` management endpoint survives controller01 loss.
  Three standalone DNS containers on one Docker host do not prove Kubernetes HA.
- Native Rancher authorization, snapshots/restoration, atomic ordering and per-instance
  reconciliation. Native page registration and local bundles exist; installed host behavior remains unverified.

Consult [validation evidence](VALIDATION.md) for the bounded claims established so far.

An interactive DNS Manager interface design preview is available in this chat.
It demonstrates navigation, source/record draft editors and the shared Reorder
interaction with sample data. Its local preview snapshots and saved order do not
replace the authenticated management backend or its durable snapshot requirement.
See the [shared preview reference](../RANCHER-PLUGIN-DESIGN.md#dns-manager-preview-and-local-development-reference)
for historical interface evidence and remaining native integration work.
