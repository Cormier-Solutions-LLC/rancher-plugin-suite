# DNS Manager Design

Status: application design specification; not a claim of implemented or deployed functionality.
Updated: 2026-10-11.
Shared standard: [Rancher Plugin Design Standard](RANCHER-PLUGIN-DESIGN.md).

This document defines DNS-specific resources, adapters, lookup policy, and HA gates.
Common-page and interface requirements are maintained in the shared standard:

- [Navigation and counts](RANCHER-PLUGIN-DESIGN.md#2-native-integration-and-navigation),
  [shell/actions/styling](RANCHER-PLUGIN-DESIGN.md#3-page-shell-layout-and-styling),
  [inventory/filter/selection/Reorder rules](RANCHER-PLUGIN-DESIGN.md#4-inventory-search-filters-and-tables).
- [Overview and resource links](RANCHER-PLUGIN-DESIGN.md#5-overview-and-resource-details),
  [forms and connection tests](RANCHER-PLUGIN-DESIGN.md#6-forms-and-working-drafts),
  [Pending Rollouts and Running Processes](RANCHER-PLUGIN-DESIGN.md#7-pending-rollouts-processes-and-change-review).
- [Snapshots, ZIP/encryption, coverage, merge, restoration, schedules, cleanup, and storage](RANCHER-PLUGIN-DESIGN.md#8-snapshots-schedules-restoration-and-recovery).
- [Refresh, Diagnostics, Settings, and Help](RANCHER-PLUGIN-DESIGN.md#9-refresh-diagnostics-settings-and-help),
  [authentication, Helm packaging, and local previews](RANCHER-PLUGIN-DESIGN.md#10-authentication-availability-packaging-and-implementation-boundaries).

Implement the shared Snapshot workflows using a DNS capture/restore adapter for
source/zone/record configuration, manager ordering/configuration, and dependencies.
The earlier deferment is lifted; implementation and encryption verification remain
pending. The DNS runtime and genuine native Rancher extension must pass the shared
Helm installation workflow plus the DNS-specific integration/HA gates below.
Keep requirements, prototype evidence, and verified live behavior distinct.

## 1. Application and navigation

Build our own native Rancher DNS Manager using the Network Manager's shared page,
form, table, action, refresh, draft, and snapshot patterns.

```text
DNS Manager
├── Overview
├── Sources
├── Zones
│   ├── <first zone in saved priority order>
│   ├── <second zone in saved priority order>
│   └── ...one menu item per existing accessible zone
├── Pending Rollouts
├── Running Processes
├── Snapshots
├── Diagnostics
├── Settings
└── Help
```

Overview, Sources, and Zones are fixed navigation items in that order. Individual
zones form an expandable group beneath Zones, in saved priority order. Clicking the manager header
opens Overview. The earlier top-level Configuration page is superseded by this revision.
Create Source and Edit Source have routes but are hidden from the sidebar.

The common-page ending, contextual Help, counts, selection actions, and
Diagnostics badge inherit the shared standard. Zone count badges show scoped
record totals; retain that meaning when reporting a dependency failure.

Relevant count badges are red when required DNS Manager dependencies are missing,
unconfigured, or failing; describe the concrete issue while retaining zone/record
count meanings. The missing management backend is such a condition in the preview;
it does not establish that the independently served DNS queries are failing.

Zone links use stable identities rather than positional indexes. Use actual zone names
as labels and distinguish source identity if multiple sources later expose the same name.
Refreshes must not alphabetize or reset saved priority. New zones append to the existing
order until explicitly reordered; removed zones leave surviving priorities in relative order.
An unreachable source is not evidence that its zones were deleted: retain the last known
inventory and show its stale/unavailable state rather than removing navigation entries.

## 2. Overview

- Summarize sources, discovered zones, DNS instance serving health, replication state,
  relevant errors, and pending work using the shared Overview patterns.
- Link actionable summaries to Sources, Zones, or the relevant scoped resource/tool.
- Distinguish Windows source availability, replica transfer freshness, SOA expiry,
  and actual DNS serving health. Show the evidence time/source for observations.
- Make resumable working drafts and validated pending proposals distinguishable.
- Keep DNS serving independent of the manager UI and management API.
- Keep the current Summary Overview: metric cards above the DNS Request Path and
  its instance table, followed by Source & Fallback and existing draft summaries.
  The Network Manager Master/Detail Overview is a second shared design variant;
  documenting it does not move the DNS Request Path to a left-hand panel.
- Management Failover: Verification Pending uses the shared amber warning banner
  and its own Settings visibility preference. Hiding it cannot imply verified
  failover or enable unverified DNS actions.
- Yellow/red notifications use the shared direct-fix rule. Missing sources open
  Create Source; invalid existing settings open that source's Edit Source workflow.
  Zone/record issues retain their exact source/zone/record scope and open the
  applicable editor or scoped replication/serving diagnostics. Management-failover
  verification opens the specific management HA verification/recovery instructions.

## 3. Sources

Sources is an integration inventory grid, not a standalone DNS server console.

- Initially support one integration **type**: **Windows Domain Controller**. This
  does not imply the data model is permanently limited to one source instance.
- The initial source is `domain02.cormierconsulting.com`, currently `10.99.3.2`.
- Show source name, integration type, endpoint, availability/last observation,
  discovered-zone count, and row actions. Apply the shared search/grid conventions.
- Create Source is opened from the top-right Create action. Edit Source is opened
  from the source row's Edit action. Both are hidden editor routes with draft/leave guards.
- Source forms configure name, the supported integration type, controller endpoint,
  and the required management/transfer settings. Show credential references rather than
  Secret values; specific connectivity/authentication fields follow the chosen adapter design.
- Inventory all controller-hosted authoritative forward/reverse zones that can be
  synchronized, including separately hosted AD zones such as `_msdcs`.
- Separate management connectivity for Windows record changes from DNS query/zone-transfer
  connectivity. Success on one connection does not prove the others are working.
- Do not claim an edited source is connected, authorized, or syncing until the backend
  has verified those operations. Explain unavailable or unsupported transfer cases per zone.
- Provide a **Test Connection** action in the source editor so the user can verify
  the current entered settings before saving. Test unsaved hostname/address and
  credential references rather than silently using the last saved configuration.
  Show testing, success, partial success, and failure states with actionable details.
  Report DNS connectivity, zone-transfer access, and authenticated Windows management
  separately; one successful probe must not imply the others passed. Display when
  the test ran and invalidate its result after connection settings change. Testing
  must not save the source or alter Windows DNS. An unavailable test backend must
  report Not Verified rather than a simulated successful connection.
- If sources later receive configurable ranking, use the shared Reorder flow. Define its
  operational meaning separately; source display order is not automatically resolver failover order.

## 4. Zones

- Show a grid of the existing accessible zones, including forward/reverse and AD zones.
- Suggested columns: Priority, Zone, Source, Zone Type, Replication Status, Last Successful
  Transfer, and Actions. Instance details can expand rather than overcrowding the grid.
- A zone row opens its scoped zone page; row action icons do not accidentally trigger navigation.
- Provide search and relevant filters using the shared patterns. Normal-mode column sorting
  changes only the current view; it does not change saved zone priority or navigation order.
- Priority controls the order of the zone grid's default view and the per-zone sidebar items.
  It does not change DNS authority, suffix expansion, record selection, SOA values, or
  the local/controller/Google lookup sequence.
- Use stable zone IDs in the persisted ordering configuration. A zone's menu position is
  not part of its DNS identity and must not rename, recreate, or transfer the zone.
- Changes to zone existence or records are separate operations against their writable source;
  reordering changes only DNS Manager configuration.

### Zone ordering

Use the [shared Reorder behavior](RANCHER-PLUGIN-DESIGN.md#shared-rankpriority-editing-reorder)
for the complete authorized zone collection. Zone priority controls both the
Zones grid's default order and the sidebar order, as confirmed by the user on
2026-10-11. A temporary grid-column sort changes only the view. Priority does not
change zone identity, Windows records, or resolver failover. Stage order
changes in Pending Rollouts and update active navigation after Apply confirms persistence.
Keep stable zone IDs, scope, revision, and the applied order in recoverable configuration.

## 5. Individual zone pages

- Generate one accessible child menu item for every existing zone beneath Zones,
  following the persisted priority order. Preserve the active zone by ID when reordered.
- Open a zone-scoped record grid with the shared search, filtering, sorting, actions,
  help, refresh, and draft protections.
- Show the source and per-replica transfer/serial/expiry details independently from
  record data and serving health. Clearly identify stale records or unavailable evidence.
- Record edits target Windows DNS through the authenticated management backend.
  The Kubernetes secondary copies remain read-only and synchronize after source changes.
- Reordering sidebar items cannot alter record priority fields such as MX preference or
  SRV priority/weight; those have DNS-specific semantics and need their own record editor.
- Access source/edit/review tools through contextual page actions, with the shared
  Pending Rollouts, Running Processes, Snapshots, Diagnostics, Settings, and Help pages.

Source, zone, record, and manager ordering/configuration changes follow the
shared Pending Rollouts, snapshot/revision review, and Running Processes flow.
Saving a DNS draft cannot mutate Windows DNS or active DNS serving configuration.
Display preferences and connection tests remain local/non-mutating actions.

## 6. Scope and implementation boundary

This document records the requested application design. The shared Reorder behavior is a
new requirement for our plugin family; its presence in this specification does not mean
it already exists in Network Manager.

The DNS service plan still includes three Kubernetes instances, replicated controller
zones, the Traefik DNS endpoint `10.99.3.1`, and Omada upstreams `10.99.3.1` followed by
`10.99.3.2`. Kubernetes management HA and the requested suffix/fallback lookup behavior
remain part of the DNS implementation work; navigation ordering does not redefine them.

Before treating the UI as live, verify native Rancher integration, backend authorization,
Windows DNS operations, replica synchronization, snapshot persistence/restoration,
concurrent-order handling, and DNS service survival during management/source outages.

## 7. Selected DNS engine and application stack

Selected by the user: use **Technitium DNS Server** as the DNS engine, with a custom C#
DNS App for the lookup policy and our own Rancher UI/management backend. This is a
technology selection based on current documentation and source inspection;
an isolated implementation now exists under [dns-manager-dev](dns-manager-dev/README.md).
Its fixture validation is separate from Kubernetes HA and Windows integration proof.

This refines the earlier BIND + dnsdist proposal. BIND remains a credible alternative,
but Technitium's HTTP API and supported DNS App interfaces fit the custom manager
and offer a path with fewer runtime components.

| Component | Initial deployment | Responsibility |
|---|---|---|
| Technitium DNS Server | Three independent StatefulSet pods | Windows secondary zones, persistent zone data, DNS serving and ordinary caching/forwarding |
| Custom lookup-policy DNS App | Loaded inside every DNS pod | Ordered suffix candidates and controlled local/source/public fallback |
| DNS Manager Rancher extension | Native UI extension | Overview, Sources, Zones, per-zone records and shared review tools |
| DNS management API | Two replicas | Rancher authorization, desired configuration, snapshots, Windows adapter and per-instance Technitium API reconciliation |
| Windows DNS adapter | Restricted management connection to an existing Windows host | Source zone inventory and record changes through Windows DNS management |
| Traefik / MetalLB / Longhorn | Reuse existing infrastructure | DNS endpoint, host failover and replicated per-pod storage |

Use independently persisted configuration/zone directories, with one PVC per DNS
pod. Schedule the three DNS pods on different physical Proxmox failure domains;
use sequential updates and a disruption budget permitting only one voluntary
DNS-pod disruption at a time. Readiness checks locally usable zone data and serving
capability; neither readiness nor liveness requires the source controller to be online.

Each DNS instance transfers directly from Windows DNS over standard AXFR/IXFR,
using DNS NOTIFY/refresh to discover changes. The management backend discovers and
reconciles the zone list; zone transfer alone does not enumerate all Windows zones.
Retain saved zone data on pod restart and serve it within the source zone's SOA
expiry period during source downtime. Freshness/expiry must be visible in the UI.

Do not initially use Technitium's primary/secondary management-cluster feature.
Our backend reconciles the three instance APIs, and every instance independently
obtains its authoritative data from Windows. This avoids making one Technitium
management-primary instance part of the initial dependency chain. Configuration
updates require per-instance acknowledgment/readback; report partial convergence.

Windows remains the writable AD DNS authority. Rancher record edits use the
Windows adapter, then replicate to Technitium. Technitium's API manages its own
secondary configuration/status; it does not by itself supply Windows DNS editing.
AD-integrated secure dynamic updates remain a Windows DNS responsibility.

### Policy extension and proof requirements

Ordinary forwarding is not sufficient to promise the requested policy. Build the
policy through Technitium's supported DNS App interfaces rather than a fork of the
DNS engine. Request handling and response post-processing are available, but their
existence alone does not establish a correct implementation.

For a raw single-label query such as `testing`, preserve this candidate order:

1. Internal `testing.cormierconsulting.io`: local replicated data, then `domain02` on a miss.
2. Internal `testing.cormierconsulting.com`: local replicated data, then `domain02` on a miss.
3. Google `8.8.8.8` for `testing.cormierconsulting.io`.
4. Google `8.8.8.8` for `testing.cormierconsulting.com`.

The internal phase must not recurse to public DNS, and internal/public cache entries
must preserve their source/policy context so a prior public response cannot bypass
the internal stages. Domain names containing dots are queried unchanged, including
multi-level names. A trailing dot controls absolute-name handling at the client,
but `testing` and `testing.` produce the same single-label name on the DNS wire;
the server cannot distinguish those two inputs. Stop at the first appropriate
positive response and respect DNS TTLs.

Before committing to this policy implementation, prove correct handling of A/AAAA,
CNAME chains, dotted and multi-level names, explicit absolute names, DNSSEC/response
flags, NXDOMAIN versus NODATA versus timeout/SERVFAIL, negative caching, UDP truncation
and TCP retry, loop prevention, and bounded latency when the controller is down.
Do not treat every empty answer as the same kind of miss. Record types such as
SRV/MX priority have their own semantics independent of the UI's Reorder feature.

Client suffix expansion can happen before the DNS server receives a query. The
policy can enforce the raw-single-label sequence only when the original single-label
query reaches it. Verify actual Windows/browser client behavior through Omada;
server code cannot reconstruct intent from an already expanded FQDN.

Initial prototype acceptance also includes controller-offline DNS-pod restart with
its retained PVC, one physical-host failure, controller return and zone resync,
and Windows source record changes propagating to all three instances. Existing
Kubernetes cluster DNS remains separate from this LAN DNS deployment.

### Alternatives and evidence

- **BIND + dnsdist:** viable persistent secondary engine plus programmable query policy,
  but requires BIND configuration/control integration and another runtime component.
  dnsdist name rewriting also needs careful response restoration and record-type testing.
- **CoreDNS secondary plugin:** not the initial LAN secondary engine; current official
  documentation states transferred zones are not persisted to disk and only AXFR is supported.
  Restarting during a source outage therefore fails a key requirement without additional work.
- **PowerDNS Authoritative + Recursor:** possible, but separates authoritative and recursive
  roles into additional components without a demonstrated benefit for this initial design.

Primary references checked on 2026-10-11:

- [Technitium features, transfers, HTTP API and DNS Apps](https://technitium.com/dns/).
- [Technitium API documentation](https://github.com/TechnitiumSoftware/DnsServer/blob/master/APIDOCS.md).
- [Technitium request extension interface](https://github.com/TechnitiumSoftware/DnsServer/blob/master/DnsServerCore.ApplicationCommon/IDnsAuthoritativeRequestHandler.cs).
- [Technitium response extension interface](https://github.com/TechnitiumSoftware/DnsServer/blob/master/DnsServerCore.ApplicationCommon/IDnsPostProcessor.cs).
- [Technitium zone persistence implementation](https://github.com/TechnitiumSoftware/DnsServer/blob/master/DnsServerCore/Dns/ZoneManagers/AuthZoneManager.cs).
- [BIND configuration and control reference](https://bind9.readthedocs.io/en/stable/reference.html).
- [dnsdist query/response restart and rewriting](https://www.dnsdist.org/reference/dq.html).
- [CoreDNS secondary limitations](https://coredns.io/plugins/secondary/).

Technitium's site currently lists 15.6 / .NET 10. Pin the tested server version,
DNS App build and container digest together for implementation; do not deploy an
unqualified `latest` image or infer compatibility from documentation alone.

## 8. Implementation order and live HA gates

1. **Verify management failover first.** Use the existing `kubcontroller` name and
   `10.99.15.50` endpoint. Verify Traefik's TCP/TLS-passthrough management path reaches
   every control-plane API on 6443, with the correct certificate SAN and kubeconfig
   endpoint. Prove management access when controller01 is unavailable. Preserve a
   documented direct recovery path because this ingress runs in the managed cluster.
2. Complete the isolated DNS engine/policy proof, then validate actual Windows zone
   inventory, restricted management, transfer permissions, IXFR/NOTIFY, and SOA expiry.
3. Deploy three independently persisted DNS instances on three physical Proxmox
   failure domains. Verify Longhorn placement/recovery, readiness during source downtime,
   sequential rollout, and a disruption budget with two instances available.
4. Verify `10.99.3.1` availability through Traefik/MetalLB for both TCP and UDP 53
   during a DNS-pod, controller, and physical-host outage. Exclude the VIP from DHCP;
   the previous reservation was deleted, but that alone does not exclude dynamic allocation.
5. Verify Omada uses `10.99.3.1`, then `10.99.3.2` when the cluster endpoint is unavailable.
   Check actual gateway behavior and client suffix expansion before changing client DNS.
6. Integrate the native Rancher manager and its authenticated backend, including
   Windows edits, snapshots, saved order, per-instance reconciliation, and restoration.

The initial local tests simulate a controller, public resolver, and three DNS servers
on one host. They do not prove physical-host failover, real AD DNS integration,
Google DNS behavior, Omada failover order, or the live `kubcontroller` management path.

## 9. DNS policy implementation findings

- Use nonrecursive `DirectQueryAsync` to read ordinary secondary authority. The
  `IsLocallyServedZone` helper identifies special-use locally served zones and is
  insufficient as an inventory test for Windows secondary zones.
- A local authoritative NXDOMAIN can bypass request-handler Apps. Handle that
  specific FQDN miss through the supported response post-processor without reentering
  Apps for direct local queries or retrying responses already resolved by the policy.
- An existing name with NOERROR/NODATA is terminal for its requested type. Falling
  through to a public AAAA for an internal IPv4-only host is not acceptable.
- Keep source and public cache contexts separate. Check current local authority
  before cached upstream records so a newly transferred internal record wins.
- Disable the DNS library's ten-second minimum in policy caches; do not extend the
  upstream's short TTL. Timeouts are not definitive negative answers. Never cache
  source/public transport errors as NXDOMAIN.
- Preserve the question and record owners; represent short-name expansion with a
  CNAME. Clear AD on synthetic/unvalidated responses. Production DNSSEC validation
  remains required before claiming authenticated resolution.
- Package the App DLL with its `.deps.json` manifest; the tested server discovers
  assemblies through that manifest. API installation success alone does not prove
  the App loaded, executed, or produced correct answers.

The current App prototype handles recursive IN-class A/AAAA requests. Additional
record types, delegations/special-use domains, cache limits, and safe configuration
reload are required production work, not exclusions from the final DNS service scope.
See [prototype validation evidence](dns-manager-dev/VALIDATION.md) for tests and limits.

Validation recorded on 2026-10-11: the documented local script passed 25 fixture
checks with zero failures and stopped its services afterward. Lookup order,
A/AAAA/CNAME behavior, TTL expiry, negative/error distinctions, UDP/TCP handling,
retained-zone restart during a source outage, independent serving with one instance
stopped, and explicit source-return resync were exercised. Live HA and Windows
integration remain unverified; these results do not close those rollout gates.


The interface-preview and local-development sections formerly numbered 10 and 11
now live in the [shared Rancher plugin standard](RANCHER-PLUGIN-DESIGN.md#dns-manager-preview-and-local-development-reference).
All generic drag-and-drop, selection, Help, refresh, loading, action placement,
and grid rules are maintained there. DNS-specific implementation/run commands
remain available in [the local project README](dns-manager-dev/README.md).
