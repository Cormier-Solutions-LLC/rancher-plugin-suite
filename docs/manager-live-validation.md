# DNS and Network Manager live acceptance

Requested October 11, 2026. Active work; do not interpret installation as completion.

The baseline cluster is RKE2 v1.35.7+rke2r1 with 19 Ready nodes and Rancher v2.15.1.
Existing running workloads were ready at initial inspection. The managers and
shared UI were not installed. They now load native authenticated inventory in
Rancher. Windows record writes and selective restore now pass live tests.
Fresh automatic capture and selective restore pass API tests. Native Rancher
HTTP/HTTPS/TCP/UDP publication, HTTP/HTTPS edit and selective recovery, route
deletion, certificate creation/renewal/deletion, and DNS record CRUD now pass;
additional native lifecycle, authorization and application paths remain pending.

Native issuer creation, validation-method edit and deletion now pass. Certificate
dependency rejection and saved-profile cleanup are verified; HTTP-01 certificate
issuance reached the real staging ACME server but failed because the isolated
test hostname has no public A/AAAA records. Local challenge routing passed;
public issuance success remains pending.

Current health checkpoint: October 13, 2026, 00:24 UTC. All 19 nodes and 20 certificates
were Ready, all inspected workloads and PVCs were ready/bound, all attached
Longhorn volumes were healthy, and all 18 discovered HTTPS and one HTTP endpoint were reachable
without server errors. Both test snapshot schedules are disabled with no saved
last-run error. The goal remains active; the unchecked acceptance items are
pending. Browser sign-in has been restored; Rancher shows the repaired realtime
gateway active with three ready replicas. Traefik now preserves client addresses,
with dynamic qBittorrent proxy trust restricted by a persistent network policy.
Two controlled proxy replacements and the final production address checks passed.
Application workflow testing continues.
Plex/Tautulli connectivity and real media-range checks now pass. Representative
Plex and Emby HTTPS HLS transcoding, codec validation and owned-session cleanup
also pass, with existing watch data preserved. Open WebUI
authentication passes, but inference is blocked by unavailable external model
servers and an empty model list. This dependency received an Alexa alert.
Current installed versions: DNS Manager 0.1.25, Network Manager 0.1.25 and Common
UI 1.0.2. Restricted-user browser inventory, namespace filters, refresh, access
revocation and initial permission errors now pass. The temporary account and
TLS test alias were removed; the original fixture route was restored.

Acceptance scope:

- [x] Shared UI and both managers installed, cached, and visibly loading in Rancher.
- [x] Live inventory, namespace filtering, refresh and permission failures.
- [ ] Network deployment, HTTP/HTTPS/TCP/UDP routing, certificate validation,
      edit/delete, rollback and reconciliation using isolated test resources.
- [x] DNS engine deployment with persistent independent replicas and source integration.
- [x] DNS record types, suffix policy, NXDOMAIN/NODATA, caching, TCP/UDP, transfer
      recovery, source outage, replica restart and rolling update.
- [x] Authenticated Windows inventory/edit/transfer/NOTIFY and controller recovery.
- [ ] Snapshots, encryption, scheduling, merge, selective restore, quota and restart.
- [ ] Rancher native lifecycle, dependencies, authorization and error paths.
- [x] Managed forward/IPv4 reverse/IPv6 reverse zone creation and deletion, owned
      parent delegation cleanup, protected original zones, and replica confirmation.
- [x] Deleted previously manager-owned zone restoration with supported records and replica readback.
- [x] DNS navigation Apply, full snapshot restore, interrupted-confirmation reconciliation and native route handoff.
- [x] Installed DNS credential references, fresh encrypted manual/native capture, unattended capture and backend restart recovery.
- [ ] Executable DNS source lifecycle and credential-reference/Secret restoration Apply.
- [ ] Cluster networking, storage, certificates, monitoring and other workload health.
- [ ] Physical failure-domain and management-endpoint availability verified.
- [ ] Document DNS cutover requirements and remaining limitations; send Alexa outcome.

Keep fixtures isolated from production DNS and existing routes. Record concrete
tests and failures below. An untested path remains unverified. Exhaustive testing
of every possible failure is not a finite acceptance criterion; the matrix above
covers the requested operational paths and known design gates.

## DNS cutover preparation

Cutover is pending. The current shared resolver Service is dns-system/dns-manager,
with VIP 10.99.15.58 on both TCP and UDP port 53. Its independent replica VIPs are
10.99.15.55–57. The Windows zone source remains domain02.cormierconsulting.com at
10.99.3.2. These addresses are inventory facts, not a request to change DHCP now.

- Preserve the current Omada/DHCP resolver list, DNS search suffixes, lease duration,
  conditional forwarders and static client resolver settings before any change.
  Keep the original resolver list as the rollback values. Record which VLANs and
  static clients would be affected; public authoritative DNS is a separate change.
- First use one disposable client configured explicitly with 10.99.15.58. Verify
  exact internal names, reverse lookup, public recursion, DNSSEC responses, short
  names with the actual client search list, and TCP fallback. Check every intended
  client subnet rather than assuming a test from the management subnet covers it.
- For domain clients, additionally verify AD service discovery, authentication,
  domain-controller selection and secure dynamic registration against Windows.
  Preserve Windows as the authoritative write target for AD zones; transferred
  read replicas do not establish secure dynamic-update compatibility by themselves.
- Confirm the selected client behaves correctly when one DNS replica disappears,
  when the Windows source is unreachable, and when the Kubernetes management
  endpoint changes controller. Container and endpoint tests already passed; abrupt
  physical-host failure and actual client lease renewal remain unverified.
- Stage one intended DHCP scope, renew only the disposable client's lease, and
  check its effective resolver/suffix settings and applications. Expand only after
  the client checks pass. On failure, restore the captured scope values and renew
  the same client before considering wider rollout.
- DNS-01 public certificate creation and renewal passed. HTTP-01 public issuance
  still needs a disposable publicly resolvable hostname and an externally reachable
  port-80 challenge path. Internal challenge routing passed; an NXDOMAIN test
  hostname cannot prove public HTTP-01 success. Do not change unrelated public
  records or switch production certificate issuers as a workaround.
- Keep encrypted snapshots, selective restore receipts and the pinned working
  manager/engine versions available throughout cutover. Choose durable snapshot
  scheduling and retention before relying on unattended recovery; the acceptance
  schedules are currently disabled after their tests.

No client, DHCP scope or public DNS cutover has been performed. External model
servers, authenticated NAS/Windows management and the outstanding physical-device
checks remain separate application dependencies in the evidence below.

Evidence recorded October 12, 2026:

- Three DNS engines, independent retained Longhorn volumes, separate replica
  VIPs (.55–.57), shared .58, physical-zone placement and a two-replica PDB.
  Windows transfers are restricted to the 19 cluster node addresses. NOTIFY
  packets reach the engines from the actual Windows source after preserving
  source IP with Local service traffic policy. LAN/DHCP DNS has not changed.
- The pinned upstream 15.6.1 image passed 25 isolated policy, transport, outage
  and recovery tests. Live A/AAAA/CNAME/TXT/MX/SRV/PTR plus SOA/NS passed over
  TCP and UDP on all four VIPs. The update assertion failed: retained records
  changed only after approximately 120 seconds. This remains an acceptance
  failure on the upstream image. A zone-scoped AXFR compatibility image passed
  the same 25 isolated tests, 20 live candidate assertions, then 101 live
  record/transport/update/deletion assertions across all VIPs. The slowest
  successful retry took 4,972 ms. All four source/replica zone serials matched.
  The reproducible build pins source commit and base image; it changes only
  transfer mode for explicitly configured Windows zones. DNS cutover stays pending.
- Kubernetes management endpoint .50:6443 uses TLS passthrough to all three
  controllers with verified CA and server name. Temporarily removing one
  controller endpoint passed ten health calls, then its endpoint was restored.
  This tests endpoint failover; physical host failure remains unverified.
- Rancher's Import YAML created the isolated `manager-acceptance` namespace,
  fixture configuration, two-replica Deployment and Service. Both pods became
  ready in different physical zones. API publication, HTTP/HTTPS traffic, ACME
  issuance, valid edits, invalid backend rejection, rollback and stale-review
  rejection passed. Native Rancher HTTP/HTTPS publication also passes; native
  TCP/UDP publication, deletion, editor mapping retention and selective recovery
  subsequently passed as recorded below.
- Native Rancher snapshots persisted one network inventory snapshot and one
  transferred DNS inventory snapshot. Encryption, scheduling and restart
  recovery subsequently passed API tests. Snapshots omit credential
  values unless explicitly captured under the encrypted backup workflow.
- Network API tests verify dry-run-before-write, conflict handling, retained
  partial receipts, prohibited credential deletion, and review-time UID/version
  checks. Failed inventory reads retain the last successful document.
- Local test logs and JSON results are in `.local/manager-installation`; secrets
  remain local and are excluded from this report. No whole-system completion
  or exhaustive-failure claim is made while any acceptance item remains open.

- 123 further live assertions passed: DNSSEC positive/negative responses, shared
  VIP queries throughout one replica restart, retained internal data and public
  resolution during a proven candidate-only Windows source connection outage,
  and source connection recovery. The temporary outage policy was removed.
- Both live snapshot services passed encrypted archive/unlock/wrong-password,
  merge, recovery-backed deletion, persistent schedule, encrypted automatic run
  after a new pod became Ready, and real 1 GiB quota checks. Only synthetic test
  credential data was used. Test schedules were disabled afterward. Automatic
  fresh unattended capture and selective live restore subsequently passed as
  described below. Fresh unattended credential-value capture is unsupported.
- Snapshot service accounts can read/update only their own named password vault;
  cross-manager Secret reads and arbitrary Secret creation are denied. Password
  rotation preserves old archive references under resource-version checks.
- Workloads/PVCs and all certificates passed readiness checks; attached Longhorn
  volumes were healthy. HTTPS route reachability verified public TLS certificates.
  Windows Admin Center's stale external endpoint was corrected to 10.99.5.3,
  restoring its sign-in page. Its backend now verifies the actual public
  certificate instead of skipping certificate verification. Endpoint-specific
  authenticated MCP/realtime operations remain unverified.
- Rancher UI work is waiting for renewed user sign-in after session expiry. The
  old bootstrap password was rejected; no account password was reset. An Alexa
  input notification was accepted by Home Assistant. Backend work continues.

- The durable Windows bridge passed A/AAAA/CNAME/TXT/MX/SRV/PTR create,
  update, TTL readback and deletion, plus propagation across all four DNS VIPs.
  Unauthorized zones, stale SOA serials, missing/incomplete zone snapshots and
  invalid SRV targets were rejected before writes. Seven records from an earlier
  failed test were removed using exact identities proven by its applied receipt.
  Selective restore through the actual manager adapter restored an A record and
  TTL while preserving an unrelated newer TXT record; both test records were
  then removed with a new durable snapshot.
- DNS Apply now uses server snapshot coverage, refreshed configuration checks
  and Windows operation receipts. Queue response loss checks the original job ID
  without replaying submission, and unresolved drafts cannot be submitted twice.
  Running Processes shows real queue history. Apply snapshots exclude credentials;
  encrypted copies stay available for manual backup but cannot authorize bridge
  writes. The Windows bridge can write records in the four authorized zones;
  zone creation/deletion and source replacement remain separately unsupported.
- Network DELETE dry runs must put dryRun=[All] in DeleteOptions. A live isolated
  test proved the query alone removed a test route; the body fix preserves it
  during validation. No production route was affected. Service dependencies now
  validate port/protocol and reviewed revision before any mutation.
- TCP/UDP routes passed 16 round trips through .50 on reserved ports 15001/15002.
  UDP deletion initially failed: new datagrams still reached the removed route.
  Upstream Traefik retains a handler when its entrypoint is omitted from the
  replacement UDP handler map. The pinned-source 3.7.12-udp2 compatibility image
  is now deployed on all three proxies. Isolated tests reproduced the upstream
  failure and verified the correction. Live HTTP/HTTPS/TCP/UDP publication,
  deletion and rollback subsequently passed. UDP tests wait for every proxy's
  configuration to converge before checking VIP traffic.
- Traefik startup now waits for an authenticated, CA-verified Kubernetes API
  readiness response through its local TCP route before the pod becomes ready.
  The startup-only check uses its existing service account. A live rolling
  upgrade sampled 1,120 API and HTTPS requests with zero failures.
- Current published and Rancher-cached versions are DNS 0.1.8 / Network 0.1.24. DNS UI
  tests passed 67 cases, and live-management contracts passed 24 cases. Browser
  sign-in is restored; no credential was reset or auth bypassed.

- DNS unattended scheduling now reads the two authorized observation ConfigMaps
  directly with its projected service-account credential and verified cluster CA.
  It refuses stale, unavailable or replaced sources instead of silently reusing
  saved records. A protected live schedule captured a Windows record changed after
  saving its scope, including its new TTL and newer SOA serial. Run Now likewise
  captured fresh records; source replacement was rejected without altering the
  schedule. Unapplied proposals were excluded. The test schedule was disabled and
  its exact fixture record removed. DNS credential values are not read unattended.
- Windows bridge restart exposed a missing-field recovery error that stalled
  inventory refresh. Interrupted jobs now normalize their receipt/error fields,
  retain their recovery state, and never replay writes. The live restart test
  passed with a deliberately incomplete Running job, fresh authenticated inventory,
  and proof that the proposed record was never created. Its test-only queue entry
  was archived locally and removed. A new DNS controller pod resumed reconciliation
  with all three replicas reachable.
- Both snapshot servers passed isolated 8 KiB quota exhaustion, concurrent saves,
  and an injected metadata rename failure. Existing archives stayed readable,
  quotas were respected and no incomplete archive or temporary file remained.
  The failed-commit temporary-file cleanup fix is deployed in pinned image
  manager-snapshot-api:2026.10.12-4. Real production quota exhaustion was not forced.
- All four MCP hosts passed CA-verified TLS, rejection of missing/invalid
  credentials, authenticated initialization, initialized notification and actual
  tool catalogs. Counts were 25 default/admin, six observer and 11 phone tools.
  Observer tool names matched its configured allowlist. Existing credentials were
  used only in memory; tests did not execute browser actions or queue phone work.
- Four isolated WSS sessions passed 32 text round trips, ping/pong and clean
  closure through the manager's HTTPS route with public certificate verification.
  This verifies network transport; authenticated realtime application workflows
  remain separate and unverified.
- Selective network restoration used a durable saved archive, selected the HTTP
  route and automatically included its Service dependency, then restored through
  the live adapter. A newer unrelated UDP edit survived and actual HTTP traffic
  returned to the saved behavior. Restore preparation now drops captured UID,
  resource version, controller metadata and status; current review-time UID/version
  checks still protect against concurrent changes. Saved metadata formerly blocked
  restoration after a legitimate later edit. Configuration and adapter tests pass.
- Protected automatic network capture now reads current Services, routing,
  certificate/issuer resources and the named admin's saved manager configuration
  through verified in-cluster TLS. Its service account cannot write routes, read
  unrelated Secrets or read another manager owner's state. A one-minute live
  schedule captured a route created after saving its scope and refreshed the port
  catalog, with namespace isolation and no unapplied proposals. Fresh Run Now
  passed; cached credential values were rejected without updating the schedule.
  The test schedule was disabled and its owned route removed after a durable
  backup. The configured unattended owner is user-jccb4; other owners require
  matching explicit configuration and named read authorization.

- Certificate renewal now submits cert-manager's manual Issuing condition with
  reviewed UID/version, domain, issuer and Secret checks. Lost responses are
  reconciled without replay. Old Ready conditions do not count as renewal;
  a newer Ready revision is required. An isolated live certificate renewed from
  revision 1 to 2, with a changed publicly verified HTTPS fingerprint. Invalid
  Secret references and replayed reviews were rejected before writes.
- Restored Secret data and annotations are removed from persisted manager drafts.
  Reloaded proposals require fresh encrypted unlock and cannot apply an empty
  Secret accidentally. A live temporary manager-state test verified redaction,
  retained in-memory values and blocked reload; its exact ConfigMap was removed.
- Port catalog create/edit/delete, mixed catalog and route publication, actual
  HTTP traffic and stale manager-state rejection passed live tests. Profiles do
  not create Traefik listeners. Missing listener publication now rejects a mixed
  route/catalog batch before any mutation; zero writes and route absence were
  verified against the live cluster. Incomplete or changed listener rollouts
  likewise reject publication under isolated contract tests.
- Native Rancher HTTP creation, durable configuration backup, reviewed Apply,
  Running Processes and persisted history passed. Traffic to the new isolated
  manager-native-acceptance route returned manager-acceptance-v1. The native
  editor exposed a permanently disabled Publish button; version 0.1.9 corrects
  it to queue the proposal and open Pending Rollouts for backup and reviewed
  Apply. The corrected button was verified in the authenticated browser.
  Native HTTPS creation and public certificate issuance then passed. Google DNS
  saw the challenge before Cloudflare; cert-manager completed once propagation
  reached both configured resolvers, without a LAN DNS change. Native HTTP edit
  moved the fixture to a new hostname and left the old hostname returning 404.
  Selective restore included only the original route and its Service dependency;
  reviewed Apply restored the old hostname and removed the edited match. A stored
  snapshot that no longer matched the review was correctly rejected. A fresh
  snapshot satisfied the gate. Native deletion subsequently passed as recorded below;
  additional native catalog/certificate controls remain pending.
- Native edit navigation exposed a false unsaved-changes prompt after saving.
  Version 0.1.10 still showed the prompt because queued editor watchers ran after
  the reset. Version 0.1.11 waits for those watchers before clearing dirtiness.
  Build and configuration checks pass. Native 0.1.11 retesting passed: real unsaved
  edits prompt, Stay retains the edit, and Publish reaches Pending without a
  false prompt. The isolated unapplied proposal was backed up and removed.
  Manifest exports now accurately describe proposal content and
  whether Secret values are included, instead of labeling every export preview.
- DNS 0.1.5 fixes remembered Snapshots overriding explicit Rancher routes. All
  67 UI tests pass, including route precedence while retaining drafts and density.
  Native Overview, Zones and record editing now render the selected page.
  Refresh and accessibility labels accurately describe live observations.
- Native DNS creation passed the complete zone backup gate and applied one A
  record, manager-native-dns-acceptance.cormierconsulting.io -> 192.0.2.220,
  TTL 60. Windows and all four Kubernetes DNS VIPs returned that exact address
  and TTL over both UDP and TCP (10 checks). Native edit and cleanup also passed
  as recorded below.
- Native deletion of one isolated unapplied network guard-test proposal passed
  a fresh server snapshot gate. No cluster route was changed by that proposal.
- Native DNS edit and exact deletion also passed. The changed A record and TTL
  were verified on Windows and every Kubernetes DNS VIP over UDP/TCP; deletion
  returned NXDOMAIN on all 10 combinations. Rancher retained all three Applied,
  1/1, Windows-readback receipts and no pending proposal. All four zone record
  sets and unrelated TTLs match the original pre-create backup after cleanup.
  SOA serials advanced normally. A concurrent SOA/configuration change during
  deletion review was rejected before queue submission; refresh and a new
  complete backup allowed the reviewed deletion to finish.
- Network 0.1.12 adds preparation of an existing connection's deletion. It
  queues only the selected route with its observed UID/resourceVersion; it
  never includes a Service, Certificate or Secret. Conflicting pending edits,
  missing live identity, and non-routing resources are rejected. Configuration
  tests and the extension build pass. Native deletion passed in 0.1.13 after
  connecting the authenticated identity described below.
- The native 0.1.12 deletion control safely rejected missing object versions in
  the stable display projection without creating a proposal. Network 0.1.13
  retrieves reviewed route identity from the authenticated adapter separately
  from the stable backup projection. The real source and all 24 live-management
  contracts pass. Native review now shows exactly one Delete target with UID,
  resourceVersion and explicit Service/Certificate/Secret preservation.
- Native 0.1.13 route deletion passed with one Kubernetes Delete/readback receipt,
  no pending proposal, and HTTP 404 for the deleted hostname. Metadata-only API
  reads verified the fixture Service, unrelated HTTPS route, Certificate and
  TLS Secret retained their original UIDs. HTTPS still served the fixture with
  public certificate validation. Fresh health checks afterward passed all 19
  nodes, 20 certificates, inspected workloads/PVCs and attached Longhorn volumes,
  plus 18 HTTPS and one HTTP endpoint. Acceptance remains active for the unchecked
  native permission/lifecycle, application and physical-domain scenarios.
- Native port configuration creation rejected an out-of-range port, retained the
  editor for correction, and saved a reviewed TCP/UDP bundle scoped only to
  manager-acceptance. Another namespace did not list that bundle. A complete
  server snapshot gate preceded the saved catalog receipt.
- Native TCP/UDP publication rejected a destination port missing from its Service.
  Corrected mappings used manager-test-tcp:15001 -> tcp-echo:9001 and
  manager-test-udp:15002 -> udp-echo:9002. The original isolated routes were first
  backed up and deleted through Rancher; all three proxies stopped UDP forwarding
  and six VIP probes confirmed absence. Only the new native routes were then
  applied, and three proxy observations plus six TCP/UDP VIP echo checks passed.
  Both editors retained their exact listener, destination and route type.
- Native cleanup removed both new protocol routes with Delete/readback receipts;
  all three proxies and six VIP probes again confirmed absence. Selective native
  restoration from snapshot 534b4afd-bd04-47fa-93e8-c82c717bcdd1 included only the
  original two protocol routes and their fixture Service dependency. No publication
  or deletion proposals from that older snapshot were restored. Reviewed Apply
  completed, and the original route names, three proxy observations and six VIP
  echo checks passed. Evidence: native-protocol-{before,absent,after,cleanup,restored}.json.
- Network 0.1.14 refreshes authenticated inventory before Rescan and reports
  live versus preview discovery accurately. Failed reads leave the catalog and
  edits intact. It reuses the authenticated inventory already loaded by Dashboard
  during page mounting, retains regular refreshes, and excludes empty certificate
  references from the Overview certificate count.
- Cleanup found that catalog deletion correctly rejected publication references,
  but no native action removed saved publication drafts. Network 0.1.14 adds a
  snapshot-gated, reviewed draft removal that updates only owner state with CAS
  and verified readback, preserves every Kubernetes resource, rejects changed
  drafts and rejects attached resource operations. All 26 live-management tests,
  configuration checks and the extension build pass. Native draft removal passed
  a fresh snapshot gate and persisted readback. The original protocol routes,
  fixture Service and unrelated HTTPS route retained their exact UIDs, resource
  versions and specifications. Other drafts and the three predefined profiles
  were unchanged. Native catalog editing also passed: name/revision changed,
  scope stayed locked, mappings and deployed resources were preserved. Remaining
  acceptance items above stay pending.
- Native catalog deletion passed after removal of its publication reference. Only
  the owned custom profile disappeared; all three predefined profiles, unrelated
  drafts and deployed resource UIDs/versions/specifications matched the baseline.
- Native Rescan found a TCP Service created after the page loaded. Fresh live
  discovery inspected 94 Services and added 65 metadata-only configurations;
  a second scan added zero. Predefined profiles, drafts and deployed resources
  were unchanged. The native editor rejected publication for that discovered
  port because no Traefik listener exposed it. No rollout or route was created.
  The unsaved draft was discarded and the owned discovery Service was deleted
  using UID/resourceVersion preconditions with 404 readback. Native cleanup also
  removed its detected configuration after fresh backup and confirmed readback.
  There are no remaining discovery fixtures, validation drafts or pending changes.
  The other 64 detected configurations describe actual Services and are retained.
  All deployed baseline resources, unrelated drafts and predefined profiles remain
  unchanged. No LAN/DHCP DNS change was made.
- Browser automation intermittently timed out while navigating between native
  manager pages. Fresh DOM reads showed the requested navigation had completed;
  no mutation was blindly replayed. The page becomes interactive afterward.
  Distinguishing browser-control latency from manager rendering remains pending.
- Native certificate renewal passed through reviewed Rancher Apply. The isolated
  `manager-native-https-tls` Certificate advanced from revision 1 to revision 2;
  Running Processes reported a newer Ready revision at 100%, with an accepted
  readback receipt. Traefik served a different leaf fingerprint with validated
  public TLS. Nine HTTPS checks passed throughout the 40-second observation
  window, and the Certificate UID, Secret UID/reference, issuer and domains were
  preserved. The passive observer never submitted or replayed renewal.
- Native standalone certificate creation rejected duplicate names and an invalid
  Kubernetes name while retaining the editable draft. The corrected
  `manager-native-certificate` requested only its explicit acceptance subdomain.
  Reviewed Apply created one Certificate. It became Ready at revision 1 after
  DNS-01 propagation reached both configured public resolvers. No LAN/DHCP DNS
  change was required, and issuance was not replayed while propagation was pending.
- Native HTTPS editing selected that existing standalone certificate and changed
  the owned route hostname/Secret reference without modifying either Certificate.
  Six fixture responses and six rejected old-host matches passed with public TLS
  validation. Native selective recovery from snapshot
  `f2be3068-1268-407d-9fab-e80a0bda9093` restored the original route and its Service;
  another twelve TLS checks passed, with route UID and Service UID/spec retained.
  Automatic dependency selection also queued certificate and issuer drafts. Only
  the route and Service were applied; the three extra drafts were backed up and
  discarded through Rancher, leaving the existing issuer and Certificates intact.
- Certificate/issuer deletion review exposed missing target UID/version retention
  and a dependency garbage-collection risk. Network 0.1.15 copies only identity
  metadata from the authenticated observation into deletion proposals, validates
  the complete selected batch before queueing, and uses preconditioned orphan
  deletion for Certificate, Issuer and ClusterIssuer in both dry run and actual
  Apply. This follows Kubernetes' documented
  [orphan deletion behavior](https://kubernetes.io/docs/tasks/administer-cluster/use-cascading-deletion/)
  and preserves dependent Secrets without reading their values. The 28 live
  management contract tests and configuration checks passed.
- Native deletion protection passed a deliberate metadata-only change to the
  owned Certificate after queueing. The initial review rejected configuration
  drift; refreshed inventory with the original proposal then rejected
  `The target changed: Certificate manager-native-certificate`. No deletion
  timestamp appeared and the owned Secret and unrelated Certificates remained.
  The stale proposal was backed up and discarded, then a fresh proposal retained
  the current UID/version. Native Apply deleted the Certificate with readback;
  Running Processes recorded operation Delete and `readBack: true` at 100%.
  Metadata-only readback verified Certificate 404, the same TLS Secret UID, removal
  of its intentionally added owner reference, and unchanged UIDs/specifications
  for every other Certificate. The acceptance TLS Secret and public issuance
  history are intentionally retained; their credential values were never read.
  The restored HTTPS route still passed twelve validated checks afterward.
- Network 0.1.16 corrects the HTTPS editor's initial certificate choice: an observed
  certificate-backed route selects its existing Certificate rather than displaying
  a misleading new-certificate default. The explicit alternative is labeled
  Update current certificate. The extension build/configuration checks passed,
  Helm revision 18 is deployed, and Rancher loaded the immutable 0.1.16 asset.
  Native retesting passed: the existing Certificate was selected, the explicit
  update option had the corrected label, and an uncovered hostname was rejected
  before queueing. The form retained that hostname for correction; its unsaved
  changes were discarded through Rancher. API readback confirmed the original
  Certificate UID/revision 2, zero pending changes and no validation editor draft.
  Broader issuer lifecycle, permissions, snapshot
  UI scenarios, authenticated application behavior and physical availability
  remain pending in the acceptance matrix above.
- Screenshot verification found unreadable hover rows in Rancher's dark theme:
  the shared runtime used a light fallback while Rancher reported normal color
  scheme. Common UI 1.0.2 now uses Rancher's table-hover token for shared controls
  and native DNS tables, retaining the standalone fallback. All three independent
  runtime integration tests passed. Native Network and DNS rows were verified
  with white text on `rgb(48, 52, 61)`, and both managers loaded the updated
  compatible runtime. Common UI Helm revision 4 is deployed; old published
  versions remain immutable.
- Native DNS Overview incorrectly kept its initial zero backup count after the
  index loaded. DNS 0.1.6 updates that field when the index arrives or changes,
  distinguishes loading and failed storage reads, and recovers when a later
  index update succeeds. Its live footer now describes snapshot scope accurately.
  All 69 DNS UI tests passed, including asynchronous arrival, updates, storage
  failure and recovery. Native 0.1.6 loaded under Common UI 1.0.2 and showed
  `50 Stored Backups`, matching the actual server index, with zero working drafts.
  Three DNS engines were API reachable and all four zones were current on every
  engine. No DNS record or LAN/DHCP configuration was changed by these UI fixes.

- Native issuer lifecycle passed in Rancher using the isolated ClusterIssuer
  manager-native-issuer-staging. Duplicate and invalid issuer names were rejected
  before queuing. A staging HTTP-01 issuer was created through Pending Rollouts
  after a fresh configuration snapshot, became Ready, and generated its own
  account Secret. This verifies account registration, not HTTP-01 certificate
  issuance or internet challenge reachability.
- The staging issuer was edited through Rancher from HTTP-01 to GoDaddy DNS-01,
  using the existing credential reference. The account Secret and issuer retained
  their UIDs; cert-manager reported Ready for the current generation (2).
  No certificate was requested and no public or LAN DNS record changed.
- Issuer deletion could leave a saved profile behind and allowed attempts against
  active certificate dependencies. Network 0.1.17 adds certificate-reference
  checks before proposal creation and an authoritative current Certificate list
  before any Apply dry run or mutation. Kind, namespace and external issuer group
  are distinguished. Denied or malformed dependency reads stop execution.
  Saved-profile deletion is compared against the reviewed state and persisted only
  after the issuer is confirmed absent. Both API and profile readback receipts
  are recorded; partial failures retain accepted resource receipts and proposals.
  Unapplied profiles use a separate profile-removal operation that confirms API
  absence and preserves Kubernetes resources; this branch has API tests, with its
  native browser lifecycle still pending.
- Native production-issuer deletion preparation was rejected with its dependent
  certificates listed. No proposal was queued, no Apply was submitted, and the
  production issuer and other certificate/issuer specifications stayed unchanged.
  The unused staging issuer was then deleted through Rancher with another fresh
  snapshot. Its profile disappeared from owner state, pending changes returned to
  zero, and its account Secret retained the same UID. A test owner reference on
  that owned Secret was removed by Kubernetes orphan deletion, proving preservation
  when an issuer owns the Secret. Only Secret metadata was read or patched.
  Evidence: native-issuer-deleted.json and rancher-native-issuer-deleted.jpg under
  the ignored local evidence directory. The retained account Secret is intentional.
- Native issuer editing exposed empty credential/account dropdowns despite live
  issuer references. Network 0.1.18 merges referenced account names and credential
  key names from authenticated ClusterIssuer specifications, without reading
  Secret values. Rancher then displayed godaddy-api-key/token and the isolated
  account reference, and the edit succeeded. Existing references and keys are
  retained and deduplicated. The cluster resource namespace here is cert-manager.
- All 35 live-management tests and Network configuration checks passed; both
  extension builds succeeded. Helm revision 20 deploys Network 0.1.18, alongside
  DNS 0.1.6 and Common UI 1.0.2. Versioned assets remain immutable. Deployment uses
  server-side apply: client-side apply failed on large asset ConfigMaps because
  its generated annotation exceeds Kubernetes' size limit. The corrected rollout
  completed with two ready asset replicas. Dependency lock versions were also
  reconciled to their existing resolved archive URLs, without dependency upgrades.
- The 12:01 UTC health check found all 19 nodes and 20 certificates Ready,
  inspected workloads/PVCs healthy and attached Longhorn volumes healthy. All 19
  discovered service endpoints remained reachable (18 HTTPS with strict validation
  and one HTTP). Twelve additional HTTPS acceptance checks preserved the original
  route/Service identities and content. Reachability does not establish the
  authenticated application workflows, which remain in the unfinished matrix.

- The unsupported issuer editor and native local-profile removal follow-ups
  below are now resolved. Authorization scenarios, remaining native snapshot
  workflows and authenticated application acceptance remain pending.

Evidence recorded October 12, 2026, 12:33–13:01 UTC:

- Network 0.1.19 rejects unsupported issuer forms and mismatched edit targets.
  Edits preserve additional solvers, account options, solver selectors and user
  metadata. Configuration tests verify these preservation cases. Native tests
  switched from the production ACME editor to two isolated self-signed issuers;
  neither retained the previous settings or offered Save Draft. Live Refresh
  discovered the second fixture while preserving the open production editor.
  Both fixtures were deleted through snapshot-backed native bulk workflows.
  Their saved profiles disappeared, pending proposals returned to zero, and all
  23 other issuer/certificate identities and specifications stayed unchanged.
- Issuer resource links now include Rancher's /dashboard prefix. Direct native
  navigation to the observed global and namespaced resource URLs shows the
  correct Active/Ready resources. The in-app browser did not open a new tab from
  the target-blank link, so popup behavior itself is not claimed verified.
- Native unapplied issuer profile testing created only a saved staging HTTP-01
  profile and proposal; its ClusterIssuer and account Secret remained absent.
  Profile deletion correctly rejected the outstanding Apply proposal. Native
  proposal discard retained the local profile, then snapshot-backed profile
  removal recorded one catalog deletion with readBack=true and zero Kubernetes
  applications. All 23 live issuer/certificate resources remained unchanged.
- Network 0.1.20, Helm revision 22, imports namespaced Issuers as well as
  ClusterIssuers. Selection, bulk selection, local replacement, refresh and
  snapshots distinguish kind, namespace and name. Ambiguous legacy editor names
  fail closed. Prior global issuer snapshot keys remain compatible. The native
  list now shows letsencrypt-prod plus godaddy-webhook-ca and
  godaddy-webhook-selfsign in cert-manager, correctly labelled DNS, CA and Self
  signed. Namespace grouping, namespaced resource navigation, unsupported form
  rejection and switching back to the correct production editor passed.
- A native deletion review for godaddy-webhook-ca was blocked by its existing
  certificate cert-manager/godaddy-webhook-webhook-tls. A fresh saved snapshot
  covers both namespaced issuer profiles independently; no deletion proposal
  was queued and all 23 issuer/certificate resources were preserved. Snapshot
  Secret values were not captured, so the partial credential-coverage notice is
  expected and is not a claim of complete credential recovery.
- The network snapshot service now uses immutable image
  manager-snapshot-api:2026.10.12-6, digest
  sha256:4645e7a9766d8285c9b22ae5d49da8560beafdccf02fd73e8193cd652931d337.
  Fresh unattended capture includes both namespaced issuers and honors scope.
  The deployed Run now path captured all three live profiles from fresh reads,
  excluded pending proposals, preserved all 23 live resources and left the test
  schedule disabled. Native automatic scheduling is still an unfinished check.
- All 39 live-management tests, configuration checks, ten UI contract tests and
  five fresh-source/encrypted snapshot recovery tests passed. Network extension
  build hash is 4fc71ecb02075387. Two asset replicas are Ready with immutable
  ConfigMap manager-extension-assets-c5647c2a96090404 (145 assets). Updating the
  host under its existing field manager resolved a server-side ownership conflict.
  DNS remains 0.1.6 and Common UI remains 1.0.2. LAN/DHCP DNS is unchanged.
- At 12:55 UTC, all 19 nodes and 20 certificates were Ready, inspected workload
  and storage checks passed, and all 19 discovered service endpoints were
  reachable (18 strict HTTPS and one HTTP). Authentication-protected responses
  establish reachability only; the remaining business workflows are unverified.
- At 13:04 UTC, all 18 live Network inventory reads returned Forbidden under
  the existing manager-acceptance/default service account using authenticated
  impersonation. Status messages confirmed resource authorization denial rather
  than denial of impersonation. The last complete inventory remained unchanged
  and subsequent admin refresh recovered, with zero writes, credentials or RBAC
  changes. The verifier compares serialized contents because the adapter returns
  defensive document copies. This is API authorization evidence; restricted-user
  native Rancher behavior and catalog-write permission failures remain unverified.

Evidence recorded October 12, 2026, 13:10–13:56 UTC:

- Reproduced a rollout ordering error: a Kubernetes deletion could precede
  discovering that its owner ConfigMap could not be saved. Network 0.1.21 now
  dry-runs every planned owner-state write and verifies admission read-back before
  any resource write. Mixed-permission unit tests and the live write-denial test
  verify zero resource writes on denied state persistence. The latest live check
  at 13:56 preserved both owner state and the fixture Service.
- Native one-minute automatic capture discovered a namespaced self-signed Issuer
  created after scope save. Its archive retained the correct namespace and no
  unapplied changes. Native deletion and rollout then removed that owned Issuer
  and its profile with independent resource/catalog receipts, preserving all 23
  other issuer/certificate objects. The schedule was disabled after verification.
- Native encrypted Run Now exposed an endpoint mismatch: the fresh unattended
  endpoint correctly rejected browser-captured credentials. Network 0.1.22 routes
  explicit protected manual capture to the encrypted archive endpoint. Rancher
  then saved four freshly read Secret objects. Wrong-password rejection, correct
  unlock and selective-review opening passed in both the API and native UI.
- Native encrypted merge verified source passwords, wrong-password exclusion,
  override-priority controls, item selection and final review. The saved archive
  retained 26 items and both originals; owner ConfigMap revision/content and all
  23 issuer/certificate identities/specifications remained unchanged. No restore
  or cluster apply was performed by merging.
- Network 0.1.23 clears an old unlock error when another read starts; native
  wrong-password then correct-password recovery now removes the stale alert.
  It also saves redacted automatic source templates. Each protected automatic
  run resolves Secret names only from fresh scoped routing/certificate inventory,
  reads their values afresh and fails on a denied, incomplete or mismatched read.
  No cached browser credential fallback is accepted. Named GET grants cover
  the 22 currently referenced Secrets in 17 namespaces, without Secret list or
  write permission. Newly referenced names require reconciling those grants.
- Found and removed implicit protected-archive unlock using the scheduling
  vault. Both backends now require the caller's password for read/unlock/merge;
  only unattended capture resolves the stored scheduling password. Wrong and
  empty passwords fail, including after restart, password rotation and disabling
  scheduling. Older archives remain recoverable with their original passwords.
- Native protected automatic capture saved an isolated TLS Secret reference,
  then captured a rotated synthetic data marker on the next run without changing
  the schedule. Denying that named Secret read rejected source synchronization
  and preserved the schedule plus every archive. Existing 30 route/issuer/
  certificate resources were preserved. The owned route and Secret were deleted,
  their named permission removed, and the scoped schedule disabled.
- All 43 live-management tests, configuration checks and nine fresh-source/
  encrypted recovery tests passed. Network 0.1.23 is Helm revision 25, Rancher
  cached/Ready at generation 25, build hash ef830b29023b41fb. Two asset replicas
  are Ready with ConfigMap manager-extension-assets-c7de6fbe3efd41dd (160 assets).
  Both snapshot backends are Ready on immutable image manager-snapshot-api:
  2026.10.12-7, sha256:e8352ccf715176fd5f9546b13beb9b359119d6b6b22aaabef8fecb08e6e4ec55.
  DNS extension remains 0.1.6; Common UI remains 1.0.2.
- The 13:54 health checkpoint passed 19/19 nodes, 20/20 certificates, workload,
  PVC and attached Longhorn health, plus all 19 discovered endpoints. Protected
  anonymous responses prove reachability only. Native DNS encryption/merge,
  restricted-user Rancher workflows, authenticated application workflows and
  physical failure scenarios remain pending. The goal is active and LAN/DHCP DNS
  has not changed.

- At 13:57, the native all-namespace protected schedule saved an encrypted archive
  with all 22 freshly referenced Secrets across 17 namespaces. It excludes pending
  changes and requires an explicit password for API recovery. The full-scope test
  schedule was disabled, then its original manager-acceptance scope and unprotected
  options restored while remaining disabled. Source backups were retained.
  Rancher now shows Snapshot Ready with 353/353 known configuration items covered.

## Protected DNS recovery and refresh preservation — October 12, 14:32 UTC

- Found and reproduced a backup encryption downgrade in both snapshot servers: a
  merge of protected configuration-only archives could save plaintext when the
  archives contained no Secret objects. Both servers now require a strong output
  password when any source archive is protected. Both managers request protected
  output for those sources, including cleanup recovery retries. Missing/weak output
  passwords are rejected, correct output remains encrypted, and originals remain.
- The regression failed before the fix on both servers (201 instead of 400), then
  all three server/unlock integration tests passed. All 43 live-management tests,
  Network 0.1.24 configuration checks and 70 DNS UI tests passed. DNS 0.1.7 also
  clears a prior failed-unlock error when a new recovery attempt begins.
- Native Rancher DNS recovery used two isolated owned records in cormierconsulting.io.
  The first encrypted capture stored A value 192.0.2.201 with TTL 15; after a backed-up
  change, a second capture stored 192.0.2.202 with TTL 25 plus a newer unrelated TXT.
  Native wrong-password merge verification rejected both archives; correct passwords
  verified both. The older archive had explicit highest priority. The native merge
  retained all five configuration items, saved encrypted output and retained both
  originals without changing live DNS. These archives contain DNS configuration,
  not runtime credential values; DNS credential capture with references remains
  unavailable and fails explicitly.
- The merged archive rejected a wrong restore password and unlocked with the correct
  password without leaving the old error. Only cormierconsulting.io was selected.
  Both preparation and application required durable fresh pre-change backups.
  Pending Rollouts applied and read back one Windows DNS record change, restoring
  the original A value/TTL while preserving the newer TXT and all other records/TTLs
  across all four zones. The exact two owned records were then removed through the
  backed-up adapter, and preservation was checked again. Each of original, changed
  and restored states passed all eight resolver/transport checks (VIPs 55–58, UDP/TCP).
- Found that observation refresh unmounted an active DNS snapshot workflow. A
  regression reproduced loss of a protected backup password dialog. DNS 0.1.8
  updates live inventory and coverage without remounting snapshot history during
  refresh; its existing baseline checks still block stale restore preparation.
  Native manual and automatic 30-second refresh retained the selected restore
  review. The test review was cancelled and the normal five-minute interval restored.
- DNS 0.1.8 is Helm revision 10, cached/Ready at generation 10, build dc6281b6b1773203.
  Network 0.1.24 is Helm revision 26; Common UI remains 1.0.2. Assets use two Ready
  replicas and immutable ConfigMap manager-extension-assets-0e28a4614edf5dab
  (173 assets). Large immutable asset ConfigMaps require server-side apply; a
  client-side apply hit the annotation size limit and was reconciled successfully
  using server-side apply. Both snapshot backends are Ready on version 2026.10.12-8,
  sha256:77e616f756118cab1f51881cfc761abc5e54ef660f5e8f762023f820989186bd.
  An invalid image reference was briefly applied to these two backends and immediately
  corrected to that verified digest; DNS engines and record data were unchanged.
- Evidence is in the private installation directory: native-dns-recovery-tests.json,
  three native-dns-recovery-replicas reports, dns-review-refresh-before.log,
  dns-ui-tests-0.1.8.log and rancher-native-dns-encrypted-merge.jpg.
- The 14:22 health check passed all 19 nodes, 20 certificates, workload/PVC/attached
  Longhorn health and all 19 service endpoints. Anonymous endpoint checks do not
  prove authenticated application workflows. Restricted-user Rancher acceptance,
  HTTP-01 certificate issuance, remaining application business workflows and
  physical failure scenarios remain pending. The goal remains active. LAN/DHCP DNS
  has not changed.

- After fixture cleanup, a native current-configuration backup was saved. Coverage
  was compared against fresh Windows observations (no uncovered entries), then
  Rancher refresh showed Snapshot Ready, 5/5. The brief partial count compared
  fresh backup contents with the older displayed observations. The final source
  owner state has zero drafts and the normal 300-second refresh interval. Both
  automatic schedules remain disabled. Native current backup proof is saved as
  rancher-native-dns-current-backup.jpg.

## Real Rancher authorization and application checks — October 12, 15:01 UTC

- A temporary local Rancher identity signed in through the real HTTPS login API.
  With no assigned cluster role, both manager adapters rejected inventory access:
  19 actual Rancher proxy requests returned 403 and no writes occurred. With an
  isolated read-only role, Network inventory and all four DNS zones loaded. A
  Network state write and DNS queue write returned 403; the DNS queue, fixture
  Service and separate user state stayed unchanged. Secret listing, a named TLS
  Secret read and snapshot proxy access also returned 403. These are authenticated
  API tests; a restricted-user native browser workflow remains unverified.
- The temporary account, RoleTemplate, binding, password Secret and session were
  removed. The revoked session returns 401 and local credential values were erased.
  The initial cleanup removed the RoleTemplate before Rancher's binding finalizer
  finished, leaving the binding terminating. Webhook logs confirmed the missing
  RoleTemplate. Recreating only that owned reference allowed normal finalizer
  cleanup. The acceptance script now waits for each deletion before removing its
  dependencies. Existing users and roles were preserved.
- An isolated namespaced staging HTTP-01 Issuer and Certificate were deployed
  through the manager adapter after a durable backup. The Issuer became Ready;
  Traefik served the exact challenge key with HTTP 200, and an unrelated hostname
  did not serve it. Let’s Encrypt staging then rejected public validation with
  NXDOMAIN for both A and AAAA. Certificate status reported failure and cert-manager
  removed the solver route, which returned 404 afterward. This proves local
  challenge routing and failure handling, not successful public HTTP-01 issuance.
  No public or LAN DNS changed. The owned Certificate, Issuer, account Secret,
  request, Order and Challenge were removed, preserving all 20 existing Certificates.
  Manager deletion intentionally retains recovery resources; the test script uses
  recorded UID and ownership checks to remove only its retained request chain.
- Home Assistant 2026.9.4 passed authenticated REST and six WebSocket commands
  through home-assistant.cormierconsulting.io with trusted TLS, including ping/pong,
  config, states, service inventory, entity registry and integration status. The
  cluster route and existing cloud route expose the same 846 entity IDs and 49
  integration IDs. Anonymous REST receives 401 and an invalid WebSocket token is
  rejected. There are 604 states and 71 service domains. These checks perform no
  device actions. Forty integrations are loaded, seven retry setup and two are
  not loaded; 269 entity states are unavailable. Retry domains are SMLIGHT, OTBR,
  ZHA, WiZ (two entries), Roku and Android TV. The radio endpoint 10.99.11.1 and
  Android TV endpoint 10.99.0.49 also time out from the workstation. The observed
  Home Assistant backend 10.99.0.28:80 responds; the skill's historical 10.99.0.16
  address does not respond on ports 80 or 8123. No endpoint was changed based on
  that stale address, and device integration functionality remains unproven.
- Harbor's existing administrator credential passed HTTPS authentication. Anonymous
  current-user access receives 401; all seven components report healthy. Five
  projects and 27 repositories each expose a readable artifact. An isolated
  synthetic registry repository passed two authenticated pushes, manifest/blob
  digest verification, tag replacement, retrieval of the original digest and
  selective deletion preserving the other digest. No image was run. The owned
  repository was removed and the existing project retained.
- Evidence: rancher-restricted-read-denial-tests.json,
  rancher-restricted-write-denial-tests.json, rancher-restricted-cleanup-tests.json,
  http01-live-tests.json, http01-cleanup-tests.json, home-assistant-route-tests.json,
  harbor-api-tests.json and harbor-registry-tests.json in the ignored installation
  directory. At 14:57, health checks passed 19 nodes, 20 certificates, every tracked
  workload/PVC, attached Longhorn volumes and all 19 service endpoints. Endpoint
  reachability alone does not prove the remaining application business workflows.
  Native restricted-user UI, other authenticated applications, public HTTP-01
  success and abrupt physical failure testing remain pending. The goal stays active.

- The 15:02 checkpoint again passed 19 nodes, 20 certificates, workload/PVC and
  attached Longhorn health, plus all 19 endpoints. Native Rancher Network Manager
  shows 42 routes, 353/353 known configuration items covered and zero pending
  rollouts. DNS Manager still shows 5/5 coverage. Browser evidence is saved as
  rancher-network-after-auth-http01-tests.jpg. Neither manager schedule was enabled.

### Application repairs and realtime gateway acceptance — October 12, 15:36 UTC

- Tautulli's saved HTTP root contained its hostname as a URL path. Normal authenticated
  `/api/v2` calls returned HTML/404. The sole writer was stopped, its config backed
  up privately on the existing PVC, and only the `http_root` line was cleared by
  an owned maintenance pod. The pod was removed and the original replica count
  restored. Five authenticated commands now work through strict HTTPS at the
  normal path; invalid API keys are rejected. History and credentials were retained.
  The configured Plex endpoint 10.99.1.200:32400 remains unreachable from Tautulli,
  so the application integration is still failing despite the repaired route.
  Verify the existing Kubernetes Plex server's identity before changing this target.
- Speedtest Tracker passed authenticated result list/latest/detail reads, missing
  result, malformed Accept and anonymous access tests. A temporary ten-minute
  `results:read` token could not queue a speedtest; job counts did not change.
  Its exact token was removed and revoked access returned 401. The latest scheduled
  run completed with positive upload/download results. No manual speedtest was run.
- The realtime gateway initially delivered a synthetic publication to its publisher
  while another same-tenant client timed out. An isolated Redis primary/replica
  regression reproduced the failure before the fix: StackExchange.Redis publication
  followed a replica subscription and did not reach the primary subscriber. The
  message bus now executes PUBLISH through primary routing. The same regression
  passes, as do all 261 Release tests. The shutdown test was also made to honor the
  configured isolated Redis endpoint instead of using the development default.
- Locked restore, Linux Native AOT publication, Helm lint/render, NuGet audit and
  source scans passed. The first image scan found CVE-2026-84782 in its cached
  OpenSSL base packages. The base was refreshed from Microsoft and pinned to
  sha256:dc5cd0c7d0a39b825312b4f0986d99b9adf9b6a3af69bc23cd345c27d9ed916a;
  the rebuilt image scan has zero HIGH/CRITICAL findings. Ubuntu lists the fixed
  Noble package as 3.0.13-0ubuntu3.16:
  https://ubuntu.com/security/CVE-2026-84782.
- The exact installed Helm chart and original values were privately backed up and
  reconstructed. Ten rendered resources match the original release; the only
  planned resource change is the gateway container image. Helm revision 2 deployed
  successfully with atomic rollback protection and three ready replicas on
  harbor.cormierconsulting.io/automation/cormier-realtime-gateway@sha256:259dc258ac93fd6fb73d1b48a9a16c9d3539aa7963136d7000fde55a0ccd4183.
  Rancher's native Deployment view confirms Active, Ready 3/3, Available 3 and
  zero restarts. Original settings, Secrets, routes and monitoring resources remain.
- Real HTTPS tickets and authenticated WSS passed for seven clients. Six clients
  in an isolated synthetic tenant received 186 verified deliveries, with 30 rotating
  publisher commands plus the initial publication. The seventh, different tenant
  received no event. Invalid/missing sessions, replayed/invalid tickets, invalid
  origins, unauthorized topic/user access and connected-session revocation passed.
  All owned temporary sessions/tickets were removed; production topics were not
  changed. This bounded run and the regression establish the repaired scenario;
  arbitrary outages and every application workflow are not thereby proven.
- The isolated primary, replica, smoke container and Docker network were removed
  by their exact IDs. Existing local containers were retained. The deployable image
  remains in Harbor. No LAN/DHCP/public DNS change was made.
- Evidence in the ignored installation directory: tautulli-http-root-repair-tests.json,
  tautulli-route-tests.json (integration remains failed), speedtest-route-tests.json,
  gateway-replica-regression-before.log, gateway-release-tests.log,
  gateway-deployment-diff-tests.json, gateway-patched-image-scan.json,
  gateway-repository-scan.json, realtime-gateway-tests.json and
  rancher-gateway-replica-fix.jpg. At 15:36 all 19 nodes, 20 certificates, tracked
  workloads/PVCs and attached Longhorn volumes passed; all 19 endpoints responded.
- Remaining work at this checkpoint included Plex identity/reconnection, other authenticated
  application workflows, restricted-user native Rancher UI, public issuance success
  and abrupt physical failure testing. Two optional diagnostics coordination
  publication paths also use subscriber publication and need replica-topology
  review; diagnostics are disabled in production. The overall goal stays active.

### Plex/Tautulli repair and Open WebUI dependency — October 12, 16:01 UTC

- The running Kubernetes Plex server's machine identity matches Tautulli's saved
  server. Its LoadBalancer is 10.99.15.52; the saved 10.99.1.200 address was stale.
  Strict certificate verification succeeds using the existing plex.direct name
  with the current IP. Only Tautulli's IP and URL were first replaced; SSL stayed
  enabled, the server identifier stayed unchanged and configuration/history were
  privately backed up before writing. The maintenance pod was removed and the
  original one ready replica restored.
- A deeper check found the original Tautulli Plex token invalid: Plex's account
  endpoint returned 422, Invalid token. LAN access had masked that problem.
  The current Plex server-owner token validates at Plex's account endpoint, and
  its account ID matches the existing administrator row in Tautulli's history
  database. Only the invalid integration token was replaced with that existing
  verified owner credential, under a stopped sole writer and a private backup.
  No account, password or new persistent credential was created. The maintenance
  pod was removed and Tautulli returned to one ready replica.
- Tautulli now reports a connected server, the matching identity/version, all
  three libraries and an existing active session. Its five authenticated commands
  pass through /api/v2 over verified HTTPS; an invalid Tautulli API key is rejected.
  Plex metadata passes for both movie libraries and the TV library. One actual
  media file per library returned HTTP 206 and exactly 4,096 bytes with a matching
  Content-Range and expected full media size. NAS files exist at the paths saved
  in Plex's database with matching sizes. Playback/watch state was not changed.
- Plex's existing allowedNetworks rule is 10.99.0.0/255.255.240.0. Anonymous and
  invalid-token requests from this trusted LAN succeed. That existing rule was
  retained; these local requests do not establish credential rejection outside
  the trusted LAN. Independent account validation establishes the repaired
  credential's validity. Full playback/transcoding and external-network rejection
  remain unverified.
- Open WebUI passes strict HTTPS, anonymous/invalid-session rejection, a bounded
  300-second administrator session, authenticated model-list access, sign-out and
  immediate rejection of that revoked session. API keys stay disabled, no account
  was created, and the temporary token was erased from the local ledger.
  The model list is empty. The existing lmstudio-external and ollama-external
  EndpointSlices both reference 10.99.1.5 on ports 1234 and 11434; neither service
  responds from Open WebUI. Those ports also fail from the workstation at that
  configured address and the alternate desktop reservation 10.99.5.2. No local
  workstation model server is running. No replacement endpoint/model was guessed.
  Inference requires recovery of the intended external model services. An Alexa
  Alert was accepted by notify.living_room_alexa_speak; it was not a completion
  notification. Other independent goal work remains available.
- Evidence: plex-connectivity-tests.json, tautulli-plex-endpoint-repair-tests.json,
  plex-token-owner-tests.json, tautulli-token-repair-tests.json,
  plex-library-media-tests.json, tautulli-route-tests.json,
  webui-route-model-tests.json and webui-inference-block.json in the ignored
  installation directory. All 19 nodes, 20 certificates, tracked workloads/PVCs,
  attached Longhorn volumes and 19 service endpoints passed the final checkpoint.
  Media filenames and credentials remain private. No LAN/DHCP/public DNS change
  was made. The overall acceptance checklist remains pending where unchecked.

Evidence recorded October 12, 2026, 16:20 UTC:

- A real temporary Rancher local user signed in through an isolated TLS hostname,
  preserving the existing administrator browser session. Rancher's built-in
  `user-base` role enabled browser sign-in without cluster creation or resource
  access. Before the read-only cluster role, the UI showed no clusters and all
  19 manager inventory requests returned 403. With the temporary read-only role,
  the UI showed the local cluster and both managers loaded live inventory.
- Network Manager's native namespace filter narrowed the routing view to five
  isolated `manager-acceptance` routes, excluding production routes. Manual
  refresh retained that filter. DNS Manager showed zero matching zones for the
  test namespace, then four zones and one source under All Namespaces. A denied
  per-user state write appeared as a visible 403; snapshot storage remained
  inaccessible. API checks also proved state/queue writes and Secret reads were
  denied, with no DNS job or per-user manager state created.
- DNS Manager's namespace links used the plural resource route, leaving Rancher
  on Loading. Version 0.1.9 changes that destination to the native singular
  `namespace` route. All 70 UI tests and the extension build passed. Helm revision
  11 deployed successfully; UIPlugin generation 11 is cached/Ready and the asset
  host has two Ready replicas. Following the installed extension's link opened
  the active DNS namespace and its resource inventory.
- Removing the temporary read-only binding caused DNS refresh to fail while
  preserving its last inventory and showing a failed-read banner with a 60-second
  retry. Initial loads of both managers displayed 403 and Retry Live Inventory.
  Deleting the temporary user, role and base binding revoked its API session and
  returned its browser to Log in again to continue. Rancher also removed the
  temporary user namespace; no test identity or password Secret remains.
- The alias used one temporary Windows A record created/deleted through DNS
  Manager with durable pre-change snapshots and Windows receipts. Its selectorless
  Service and EndpointSlice referenced the three existing Ready Rancher pods,
  without changing Rancher's deployment or configured server URL. Cleanup restored
  the original route spec and verified its original fixture response. A mutable
  baseline reference in the cleanup helper was corrected before restoration using
  an independent pre-change backup. LAN/DHCP DNS settings remain unchanged.
- Evidence: rancher-restricted-native-browser-tests.json,
  rancher-restricted-write-denial-tests.json, rancher-restricted-cleanup-tests.json,
  rancher-browser-alias-route-tests.json, rancher-browser-alias-cleanup-tests.json,
  dns-namespace-fix-ui-tests.log, dns-namespace-fix-build.log,
  dns-namespace-fix-upgrade.log and service-health-after-rancher-permissions.log.
  Browser proof includes rancher-dns-namespace-link-after.jpg and the restricted
  inventory, access-revocation and session-revocation screenshots.
- All 19 nodes and 20 certificates remain Ready, inspected workloads/PVCs remain
  ready/bound, attached Longhorn volumes remain healthy, and the 19 discovered
  web endpoints remain reachable. Remaining authenticated application workflows,
  external model availability, public HTTP-01 issuance and physical failure tests
  are still unverified. The goal remains active.

Evidence recorded October 12, 2026, 16:26 UTC:

- Emby 4.9.3.0 passed authenticated server, user and library reads through strict
  HTTPS using its existing integration API key. Anonymous/invalid-key server
  requests and invalid-key media requests returned 401. Its existing mixed library
  reported 4,171 video items. A media range returned 206 and exactly 4,096 bytes
  from the configured NAS-backed file.
- A separate HLS request used a unique acceptance DeviceId and PlaySessionId,
  with stream copy disabled and bounded low-resolution H.264/AAC output. Master
  and media playlists returned 200, and a 94,752-byte segment returned 200. The
  actual segment decoded as H.264 426x240 with AAC audio. Existing watch data was
  unchanged. DELETE ActiveEncodings targeted only the owned device/session and
  returned 204; the encoder count was zero before and after this isolated test.
  No test device persisted. Copied authentication database/WAL, candidate token
  and private media inspection files were removed after the test. No credential,
  user account, library configuration or password was created or changed.
- Evidence: emby-route-media-tests.json, emby-hls-tests.json and emby-hls-owned.json.
  This closes Emby's authenticated read/direct-range/HLS application acceptance;
  it does not verify every hardware decoder, client or possible media format.
  Plex's full streaming/transcoding path and other remaining application workflows
  are still pending, as are the previously reported external model dependency,
  public HTTP-01 issuance and physical failure tests. The goal remains active.

Evidence recorded October 12, 2026, 16:35 UTC:

- Plex passed an isolated HTTPS HLS transcode using a unique session/client ID.
  Master/media playlists and a 37,036-byte owned segment returned 200. The actual
  segment decoded as H.264 320x180 with MP3 audio. The owned transcode was visible
  through Plex's transcode-session API. Watch count, resume position and last-viewed
  values were unchanged. The exact owned stop returned 200 and its session was
  absent afterward. No other session was targeted. Private media-part inspection
  data was removed after use.
- A preliminary stop of a nonexistent test session returned 404 before any encoder
  started. The helper now accepts that expected result separately from an active
  session's successful stop; the unused probe identity was also verified absent.
  Both Plex and Emby helpers refuse to overwrite an unresolved prior test ledger.
- Plex's live preference schema identifies secureConnections=0 as Required,
  explaining the HTTP empty responses. Cloud discovery reports the owned server
  online with HTTPS required and advertises the same verified Plex.direct HTTPS
  VIP. Its TLS/security policy and deployment settings remain unchanged. Remote
  internet connections and every client/media format remain untested.
- Tautulli's five authenticated HTTPS commands still pass after the HLS test and
  recognize the same server and three libraries. Plex remains Ready with zero
  restarts. Evidence: plex-hls-tests.json, plex-hls-owned.json,
  plex-discovery-tls-tests.json and tautulli-route-tests.json. Representative Plex
  direct-range and transcode paths now pass; other pending application workflows,
  the unavailable external model services, public HTTP-01 issuance and physical
  failure scenarios remain open. The goal remains active.

Evidence recorded October 12, 2026, 16:38 UTC:

- The phone MCP endpoint's existing credential passed strict HTTPS calls to
  get_phone_pool_status, list_phone_profiles and list_mobile_tasks. The pool
  reports a concurrency limit of ten, one Ready profile and no queued/active
  jobs at that checkpoint. No workflow was submitted then. The other
  MCP profiles' authenticated catalogs and allowlists remain valid. Browser
  browser tool execution remains unverified. Later phone lifecycle results are
  recorded below.
- Evidence: phone-mcp-read-tests.json and mcp-catalog-inspection-tests.json.

Evidence recorded October 12, 2026, 16:50–17:40 UTC:

- qBittorrent 5.2.4 passed a stopped add, start, bounded download, stop and exact
  owned-hash/file deletion using Debian's official 13.7 net-install torrent.
  About 17.4 MB downloaded; an actual 262,144-byte completed piece read from the
  mounted download volume matched the torrent's SHA-1 piece hash. A full ISO
  download was not tested. All five existing torrents remained present, and
  download/upload limits applied only to the acceptance torrent.
- HTTPS API access initially failed intermittently: eight of 18 fresh requests
  returned 403. One of the three Traefik pod addresses was outside qBittorrent's
  existing 10.77.0.0/20 allowlist. Enabling reverse-proxy address handling with
  the three exact Ready Traefik pod IPs restored 18/18 fresh-session requests.
  Cluster-wide proxy trust was removed. A different pod received 403 when it
  supplied a forged LAN X-Forwarded-For header. The trusted list must be
  reconciled when Traefik pod addresses change. The original
  authentication allowlist, CSRF and Host-header validation were retained;
  qBittorrent was not restarted. Only the two reverse-proxy preferences changed.
- A temporary, strictly scoped header probe established that Traefik receives
  X-Forwarded-For 10.77.10.0 for the LAN workstation because the load balancer
  uses externalTrafficPolicy Cluster. Original-client address preservation is
  still pending and must be tested independently before changing the shared
  Traefik service. The initially added Web UI NetworkPolicy was removed because
  the source-address translation invalidated its LAN-only assumption. The probe
  Service, IngressRoute, NetworkPolicy, listener and commented firewall rule
  were removed. No LAN or public DNS record was changed for these tests.
- Gluetun's local health endpoint returned 200, qBittorrent remained bound to
  tun0, and a container HTTPS request used globally routable VPN egress. A VPN
  outage/kill-switch test while other user torrents run remains unverified.
- Phone MCP invalid input rejection passed for empty actions, unsupported
  action type and invalid profile syntax, with no extra queued jobs. An isolated
  two-second wait-only workflow cloned the existing ready default profile,
  booted successfully, completed once and removed its owned resources.
- The installed phone controller's source matched the local automation source.
  Four regressions initially failed: snapshot lookup errors did not consume an
  attempt and could retry indefinitely, and cancellation could be overwritten.
  Two further boundary regressions reproduced cancellation being lost at phone
  readiness or final-action completion. All seven retry/cancellation/success
  regression tests now pass after fixing those transitions.
- The controller was built and pushed as phone-queue:2026.10.12-retry-fix-3,
  pinned at sha256:5e729643971d4e1bcd988f17d7b4dfb5614707cecf424a561317de1c3c746a94,
  and deployed through Rancher's native Edit Config form. Rancher and Kubernetes
  both verified 1/1 ready with zero restarts. The running source SHA-256 matched
  the built/tested source. Image was the only functional workload change;
  Rancher added the existing automation namespace to the pod template on the
  first form save. The manifests retain the pinned image.
- Both rollouts had zero active queue jobs. SQLite backups were made on the
  original queue PVC, chmod 600 and quick_check verified: queue.before-manager-
  retry-20261012.db and queue.before-manager-final-step-20261012.db. The original
  authentication Secret, pool limit and ready profile were retained. The original
  controller image and intermediate working image remain available for rollback.
- A missing-profile workflow now failed after exactly one attempt without
  creating clone resources. Cancellation during provisioning passed. On the
  final controller, cancellation during the final wait step progressed through
  running, cancelling and cancelled. Its Deployment, Service, PVC, PV and
  Longhorn volume were all removed; the original profile was unchanged.
- Removing runtime pip eliminated four fixable high findings in its vendored
  dependencies. The final Trivy scan reported zero critical and zero fixable
  high findings, plus 44 unfixed high Debian findings. This is not a zero-finding
  image. Harbor's native scan request returned 412 because project 5 has no
  available scanner; native registry scanning remains pending. Registry pull,
  manifest digest verification and the independent image scan succeeded.
- A retained-instance workflow completed successfully on the final controller.
  Releasing that exact owned instance removed its Deployment, Service, PVC,
  PV and Longhorn volume by 17:31:58 UTC. The original profile was unchanged.
- All three owned build Jobs, build pods and immutable source ConfigMaps were
  confirmed absent after cleanup. Final health checks passed at 17:40 UTC;
  full pool concurrency and profile creation/deletion have not been tested.
- Evidence: torrent-lifecycle-tests.json, torrent-proxy-before-tests.json,
  torrent-proxy-after-tests.json, torrent-proxy-repair-owned.json,
  torrent-address-probe-owned.json, phone-workflow-*-tests.json,
  phone-workflow-rejection-tests.json, phone-retry-deploy-owned.json,
  phone-image-scan-cache/phone-retry-image-scan-v3.json and
  rancher-phone-controller-retry-fix.jpg. Private task/profile records and
  preferences are kept in the ignored inspection directory.
  Results and catalog metadata remain in the ignored installation directory;
  credentials were held in memory and were not written into these reports.

Evidence recorded October 12, 2026, 17:42–17:48 UTC:

- Harbor 2.15.2 had no registered scanner because its original Helm values
  disabled Trivy. The matching chart 1.19.2 was retained, and Helm revision 2
  enabled the bundled Trivy adapter with rollback on failure. Server dry-run
  and semantic manifest comparison preceded the change. Existing token
  certificate and registry credential hash were explicitly preserved to avoid
  template regeneration. All prior Secret data/UIDs and PVC UIDs/volume names
  were verified unchanged. The new scanner and its 5 GiB cache PVC are Ready.
- Harbor registered Trivy as the healthy system default and automation project
  scanner. An unauthenticated scan request was rejected with 401. The exact
  pinned phone-controller image was accepted with 202 and completed with
  Success. Native scanning reported zero critical, 44 unfixed high and two
  fixable Unknown findings for liblzma5. Debian's security update
  5.8.1-1+deb13u2 addresses both; a patched image is being prepared.
- All eight Harbor health components passed. Post-rollout synthetic registry
  push/pull, blob and manifest digest verification, tag replacement, selective
  deletion and owned repository cleanup passed. Full cluster and service health
  passed again at 17:47 UTC. LAN/DHCP/public DNS remain unchanged.
- Evidence: harbor-scanner-render-review.json, harbor-scanner-rollout-owned.json,
  harbor-native-scan-tests.json, harbor-api-tests.json, harbor-registry-tests.json
  and service-health-after-harbor-scanner.log in the ignored evidence directory.

Evidence recorded October 12, 2026, 17:49–17:56 UTC:

- Patched the phone image's liblzma5 to Debian security version
  5.8.1-1+deb13u2. The controller source stayed identical; its seven regression
  tests passed again. Actual image inspection verified the patched library,
  absent runtime pip and matching controller source hash.
- Harbor's native scan of the new image completed successfully with zero
  critical and zero fixable findings. It still reports 44 unfixed high,
  60 medium, 62 low and one Unknown finding; these are recorded, not suppressed.
  The image is phone-queue:2026.10.12-security-fix-4, pinned at
  sha256:6cb8437ae7869cb3c2dc19e64a6fbaeaae0f95d090b8d9c402cdea6bc928e7dd.
- Rancher's native Edit Config deployed that exact digest. Kubernetes spec
  comparison confirmed only the image changed; Rancher showed Active, 1/1 Ready
  and zero restarts. Running source hash matched the tested source. An atomic,
  chmod-600 SQLite backup on the original queue PVC preceded the rollout,
  queue.before-manager-security-20261012.db, with quick_check verified and no
  active jobs. Prior pinned images remain available for rollback.
- A fresh two-second wait-only workflow on the security image completed once
  and removed all five owned resources, including its PV and Longhorn volume,
  by 17:55:26 UTC. The original default profile was unchanged. All four build
  Jobs, their pods and eight Job/ConfigMap objects were removed. Temporary
  private copies of Harbor values, manifests and credentials were removed;
  Helm revision 1 remains available for rollback.
- Full phone pool concurrency and profile creation/deletion remain unverified.
  At this checkpoint, qBittorrent's exact trusted proxy addresses still required
  a durable solution for future Traefik pod replacement. The subsequent
  18:03–18:42 evidence below resolves that item.
- Final authenticated phone read checks found zero active jobs and one ready
  profile. Six tested acceptance cases passed, with owned resources removed and
  the original profile preserved. The 17:56 health check again passed all 19
  nodes, 20 certificates, inspected workloads/PVCs/attached volumes and 19 web
  endpoints. Reachability is distinguished from each app's functional evidence.
- Evidence: harbor-native-scan-security-tests.json, phone-security-build-owned.json,
  phone-security-deploy-owned.json, phone-workflow-lifecycle-tests.json,
  phone-acceptance-summary.json, service-health-final-phone-security.log and
  rancher-phone-controller-security-fix.png in the ignored evidence directory.

Evidence recorded October 12, 2026, 18:03–18:42 UTC:

- qBittorrent now trusts the cluster pod CIDR for reverse-proxy address parsing.
  The persistent `torrent-webui-access` NetworkPolicy permits TCP 8090 from
  the original LAN/pod authentication subnets or Traefik's namespace and both
  release labels. Other ports and outbound traffic retain their prior access.
  The original authentication allowlist, host validation, CSRF protection,
  seeding policy and VPN interface binding remain unchanged. Persisted settings
  and the original torrent pod UID were verified; the app was not restarted.
- An unrelated pod outside the original authentication subnet could not reach
  TCP 8090 directly, even with a forged LAN client header. Requests through the
  replacement proxy and final production VIP also rejected that forged header
  with HTTP 403 and strict TLS. Eighteen fresh HTTPS requests and original direct
  LAN access passed after the change. Dynamic trust therefore does not depend on
  retaining three individual pod IPs.
- Two actual Traefik evictions used the disruption-budget API with at least two
  ready proxies throughout. The first replacement passed 40 fresh HTTPS requests
  and six requests addressed directly to its new IP. A separate Local-policy
  canary passed 25 continuous HTTP/source-address/TCP/UDP rounds during the second
  eviction with zero observed failures. These test controlled pod replacement;
  abrupt physical host power failure remains unverified.
- A temporary shared TCP/UDP canary at 10.99.15.59 preserved the actual Windows
  client address, passed six TCP/UDP echoes and authenticated Kubernetes readiness
  checks, and kept all 19 nodes Ready. The original Cluster-policy service hid
  the address behind node SNAT. All six owned canary resources were removed.
- The first production Helm upgrade through the shared management VIP interrupted
  its own API connection and rolled back. Reallocation exposed an existing
  MetalLB conflict: both its canonical address annotation and the legacy
  `spec.loadBalancerIP` declared 10.99.15.50. Ingress was interrupted, and an Alexa
  alert was accepted. The independent controller endpoint remained available.
  Removing the duplicate field restored allocation. A second Helm attempt
  through that controller reintroduced the legacy field from reused release
  settings; the guarded repair removed it again.
- The final persisted override sets `externalTrafficPolicy: Local` and
  `loadBalancerIP: null`. Helm revision 22 deployed through verified TLS at
  controller 10.99.15.11 with the existing Kubernetes server identity. Both
  original Service UIDs, shared VIP, selectors, ports and node ports were
  preserved, and the three-replica Deployment remained unchanged. A server dry
  run with `--reuse-values` and no override file verified that future upgrades
  retain Local policy and the canonical annotation without a legacy address.
  Shared-VIP configuration changes must use an independent management endpoint.
- A fresh isolated production probe confirmed client address 10.99.5.3 reaches
  the backend through VIP 10.99.15.50. Strict HTTPS, six TCP/UDP echoes,
  authenticated API readiness and all 19 Ready nodes passed. The first probe
  request briefly returned 503 while its new endpoint propagated; a read-only
  retry passed. All four production probe resources were confirmed absent at
  18:41 UTC. Rancher shows the original shared Service Active and three Ready
  proxies with zero restarts.
- The torrent inventory decreased from five original jobs to four. Read-only
  inspection of the original preferences and application log confirmed the
  missing job reached the existing ratio limit and was automatically removed
  at 18:15:19 UTC, before the first production source-policy attempt. Tests did
  not issue removal commands for that user job or change the seeding policy.
  The original baseline is retained alongside this explained delta.
- At 18:42 UTC, the production VIP rejected the unrelated pod's forged header
  with HTTP 403, both torrent containers were Ready, and Gluetun health passed.
  A production VPN outage/kill-switch test remains unverified. The 18:41 full
  health check passed 19 nodes, 20 certificates, inspected workloads/PVCs/attached
  volumes and 19 web endpoints. External model availability, full phone profile
  lifecycle/concurrency, physical failure and the unchecked matrix remain pending.
  LAN, DHCP and public DNS remain unchanged; the goal stays active.
- Evidence: torrent-dynamic-proxy-tests.json, torrent-proxy-replacement-tests.json,
  torrent-new-proxy-direct-tests.json, torrent-production-access-tests.json,
  torrent-inventory-change-inspection.json, traefik-local-canary-tests.json,
  traefik-local-failover-tests.json, traefik-production-source-tests.json,
  traefik-client-address-render-review.json, traefik-future-upgrade-tests.json,
  service-health-final-client-address.log and rancher-traefik-client-address.png
  in the ignored evidence directory. Persistent configuration is in
  live-management/torrent-webui-access-policy.yaml and
  live-management/traefik-client-address-values.yaml.

Evidence recorded October 12, 2026, 18:46–19:00 UTC:

- A fresh capacity inspection found an idle phone queue, the configured maximum
  of ten phones and room for twenty additional phones under current node CPU,
  memory and KVM resource requests. The test keeps the pool limit at ten and
  uses only disposable wait actions. Requests to set a negative limit or eleven
  phones were rejected without changing the saved limit.
- The authenticated MCP profile capture created an isolated named profile.
  Its documented capture operation briefly stopped and restarted the primary
  emulator, which returned Ready on the original PVC/PV with its StatefulSet
  specification unchanged. The original default profile and snapshot identities
  remained unchanged. An integrity-checked, chmod-600 queue backup preceded it.
- A clone from that new profile booted, completed its two-second wait once, and
  removed its Deployment, Service, PVC, PV and Longhorn volume. Longhorn copying
  and replica rebuilding delayed startup; this was observed rather than mistaken
  for a completed workflow. The owned profile snapshot and snapshot content were
  subsequently deleted and confirmed absent. Four negative checks rejected
  protected-default creation/deletion, a snapshot outside the requested profile
  and an invalid profile name. Profile lifecycle acceptance now passes.
- Capacity review found that the dispatcher did not count a cancelling phone
  against the pool ceiling. Two tests using the actual dispatcher function and
  a real SQLite queue demonstrated that it could launch another task at the
  configured limit. The query now includes cancelling tasks. All twelve queue
  regression tests passed, including the previous retry/cancellation cases.
- The capacity fix image retained patched liblzma5 and excluded runtime pip.
  Registry digest and running source hash were independently verified. Harbor's
  native scan succeeded with zero critical and zero fixable findings; 44 high,
  60 medium, 62 low and one Unknown unfixed finding remain recorded. Rancher's
  native Edit Config deployed the pinned image with only the image field changed:
  sha256:18b97cc131da6f8341d47a9a6a35148e944ed787df2c77672c2613d06dfe40a2.
  The controller is 1/1 Ready with zero restarts, and deployment/build source files
  use the new digest/tag. All five owned build Jobs and their ten Job/ConfigMap
  resources are absent. The original queue volume and verified backup remain.
- The live capacity test submitted eleven confirmed disposable jobs. Ten clones
  are provisioning and the eleventh remains queued. At 19:00 UTC, all 19 nodes,
  existing application Deployments and 23 original attached Longhorn volumes were
  healthy; only the new clone volumes were still copying/rebuilding. Ten fully
  Ready clones, release/resumption behavior and complete capacity-test cleanup
  remain unverified until the same owned jobs finish. No new batch may be submitted
  to replace this pending test. The goal remains active and DNS remains unchanged.
- Evidence: phone-capacity-inspection.json, phone-pool-limit-rejection-tests.json,
  phone-profile-lifecycle-tests.json, phone-pool-regression-tests.json,
  phone-capacity-build-owned.json, phone-capacity-deploy-owned.json,
  harbor-native-scan-capacity-tests.json, phone-pool-capacity-owned.json,
  phone-capacity-storage-progress.json and rancher-phone-controller-capacity-fix.png
  in the ignored evidence directory. Regression tests are in the automation
  repository's build/phone-queue/tests/test_pool_capacity.py.

- At 19:03–19:05 UTC, nine test clones had finished copying but were detached
  with `copy-completed-awaiting-healthy`; one was already healthy. The installed
  manager is Longhorn 1.12.1. Its documented efficient-cloning behavior and the
  related upstream [attachment issue](https://github.com/longhorn/longhorn/issues/13335)
  were reviewed. A proposed per-volume
  [offline rebuilding](https://longhorn.io/docs/1.12.0/advanced-resources/rebuilding/offline-replica-rebuilding/)
  canary failed its precondition because the volume had already begun attaching.
  No canary or global storage setting was changed. All ten volumes then attached;
  nine remained rebuilding. A persistent storage defect is not established by
  that transient delay. The same eleven jobs remain under observation. Metrics
  API reads returned current observations for all 19 nodes during this load.

Evidence recorded October 12, 2026, 19:10–19:24 UTC:

- Ten clones became simultaneously Ready, completed their wait actions once and
  stayed retained, while the eleventh remained queued. Rancher's filtered native
  deployment inventory showed all ten Active and 1/1 Ready. Storage inspection
  found that three volumes could not schedule their remaining replicas: the
  100% logical allocation limit was exhausted despite about 1,937 GiB physically
  free. This was a scheduling capacity issue; offline rebuilding was not changed.
- Storage scheduling now permits 125% logical allocation for sparse volumes,
  retaining the existing 25% physical free-space guard, 30% disk reservation,
  three replicas and physical-zone anti-affinity. The preflight confirmed ample
  actual headroom and healthy original volumes. Helm revision 7 persisted this
  single setting. Manifest review found only one default-settings ConfigMap
  change, with no workload specifications, images or other settings changed.
  A server dry run using only `--reuse-values` verified upgrade persistence.
  This permits thin provisioning; future actual consumption must still be
  monitored rather than equating requested volume size with bytes currently used.
- At 19:19 UTC, all ten volumes were healthy and clone-copy status was completed.
  Thirty healthy running replicas were verified, with three distinct Proxmox
  failure zones for each clone; all 19 nodes remained Ready. The original profile,
  primary emulator and controller workload specification stayed unchanged
  throughout the test. This proves replica placement, not physical power failure.
- Releasing one retained instance resumed the eleventh job. The trace exposed
  a second dispatcher bug: the new pod appeared before the old terminating pod
  disappeared, producing eleven live pods briefly. Maximum Ready and
  non-terminating counts remained ten. The test deliberately records this as
  failed acceptance rather than redefining the ceiling to ignore termination.
- All eleven jobs ultimately succeeded once. Every owned clone Deployment,
  Service, PVC, PV and Longhorn volume was confirmed absent at 19:24:43 UTC.
  The failed test and its original trace remain retained.
- Three new regressions reproduced the physical-slot problem and dispatch during
  a failed pod inventory read. The dispatcher now counts the union of active task
  IDs and existing non-terminal clone pod IDs, including terminating pods. It
  avoids counting a row/pod twice and permits a requeued task to reuse its own
  slot. Inventory errors stop dispatch for that iteration. All eighteen queue
  tests pass. A new immutable image is building; this second fix is not deployed
  or proven by a new live capacity test at this checkpoint.
- Evidence: phone-pool-storage-tests.json, longhorn-capacity-render-review.json,
  longhorn-capacity-rollout-owned.json, longhorn-capacity-future-upgrade-tests.json,
  phone-storage-scheduling-owned.json, phone-pool-capacity-tests.json,
  phone-physical-pool-regression-tests.json, phone-physical-capacity-build-owned.json
  and rancher-ten-ready-phone-clones.png. The public Helm override is
  live-management/longhorn-phone-capacity-values.yaml. The goal stays active;
  LAN, DHCP and public DNS remain unchanged.


Follow-up October 12, 2026, 19:29–19:35 UTC:

- The physical-slot fix was built as immutable phone-queue digest f7b51a4d175318d405cd55bf54c5bc4cf3f5eea68766fe0561d015601e9a78e1. Runtime source SHA-256 matches 97d5e66947b55180d6a6fa20e9ef2835a397c2e26bdb92fbb110a46bc8c53f95. Harbor Trivy scanning passed with zero critical or fixable findings; 44 unfixed high findings remain. All eighteen source queue regressions pass.
- Rancher native Edit Config saved only the controller image. Deployment UID and every other specification field were preserved; the replacement became Active with one ready replica, and runtime source verification passed. The source repository runtime and build manifests now pin the verified version. Twelve owned build Job/ConfigMap resources were confirmed absent. Five owned private Longhorn Helm render/value copies were removed after successful render, deployment and future-upgrade checks; safe reports and Helm rollback remain.
- A second independent eleven-job capacity test began at 19:31 UTC. Ten clones are provisioning and the eleventh remains queued. All ten volumes have scheduled successfully; clone attachment/replica-health completion is still pending. The original failed capacity trace is retained. Full capacity acceptance must wait for ten ready healthy clones, release-boundary observation, eleventh completion and cleanup.
- Transitional health at 19:35 UTC: all nineteen nodes and twenty certificates Ready, all nineteen web endpoints reachable with eighteen HTTPS certificates verified, original workloads ready and original attached volumes healthy. The expected ten acceptance clones were still starting; this is not an all-workloads-ready checkpoint.
- Evidence: phone-physical-capacity-deploy-owned.json, phone-physical-pool-regression-tests.json, harbor-native-scan-physical-tests.json, phone-pool-capacity-v2-owned.json, capacity-v2-transitional-health-tests.json and rancher-phone-controller-physical-capacity-fix.png. The full goal remains active and DNS cutover is unchanged.


Capacity follow-up October 12, 2026, 19:40–19:41 UTC:

- The second run reached ten Ready retained phones, all ten succeeding once, while the eleventh remained queued. Independent checks verified ten healthy completed clone volumes, thirty healthy running replicas and three physical zones per phone; all nineteen nodes stayed Ready. Native Rancher showed ten Active deployments with one ready replica each, captured in rancher-ten-ready-phone-clones-v2.png.
- Releasing one retained instance resumed the eleventh job. A 117-sample rapid trace included the terminating phone, confirmed it disappeared before the replacement pod appeared, and never observed more than ten live non-terminal pods. The general workflow observer also stayed at ten. Evidence: phone-release-v2-tests.json, phone-release-v2-trace.json and phone-pool-storage-v2-tests.json. The eleventh job is still provisioning; final success, cleanup and acceptance remain pending.


Capacity acceptance October 12, 2026, 19:47 UTC:

- The second full ten-phone test passed. All eleven wait-only jobs succeeded exactly once. Ten phones were simultaneously Ready and retained, the eleventh stayed queued at the ceiling and resumed after release. Maximum Ready, non-terminating and all live non-terminal pod counts were ten; no terminating-pod overlap recurred. The rapid release trace separately proves the released pod was gone before replacement.
- Ten healthy completed clone volumes, thirty running healthy replicas and three distinct physical zones per volume were verified before release. This verifies placement and logical concurrency, not abrupt Proxmox power loss. The Longhorn setting remains 125% logical scheduling, with the original 25% physical free-space guard, 30% reservation and three-replica policy preserved.
- At 2026-10-12T19:47:19.225Z, all eleven owned clone Deployments, Services, Pods, PVCs, PVs and Longhorn volumes were absent. Both original profile and primary workload specifications remained preserved. The original failed first run remains retained. The acceptance summary now includes the verified image, all eighteen source regression tests, profile lifecycle and full pool concurrency, with zero active jobs and one ready default profile. Active-workflow recovery after controller restart still needs an independent live test.
- Fresh final health at 2026-10-12T19:47:39.335Z: nineteen nodes and twenty certificates Ready, all workloads ready and PVCs bound, all attached Longhorn volumes healthy, nineteen web endpoints reachable and eighteen HTTPS certificates verified. Twelve owned build fixtures and five private Helm render/value copies are gone; safe evidence and in-cluster rollback backups remain.
- Evidence: phone-pool-capacity-v2-tests.json, phone-pool-storage-v2-tests.json, phone-release-v2-tests.json, phone-acceptance-summary.json, service-health-tests.json and rancher-ten-ready-phone-clones-v2.png. The broader goal stays active: public ACME issuance, active phone-controller restart recovery, VPN outage/kill-switch behavior, physical failure and external application dependencies remain unverified where recorded. LAN, DHCP and public DNS cutover remain unchanged.


Controller recovery follow-up October 12, 2026, 19:53–20:03 UTC:

- Three source regressions reproduced interrupted running/provisioning tasks being requeued despite exhausted retry budgets, and cancellation remaining stuck after restart. Startup now fails exhausted attempts, requeues only within budget, and makes interrupted cancellation terminal. An attempt selected but not started preserves its budget. Retained successes stay unchanged.
- Retries wait for previous named resources and every old task pod to disappear before creation. They become dispatchable only after prior cleanup completes; cancellation during cleanup takes precedence. Each dispatcher iteration reconciles terminal controller-owned resources, checking task identity, owner labels and derived names; it preserves retained successes, active tasks and unrelated objects. Existing physical-slot counting remains in place.
- Thirty-seven source tests pass against extracted real controller functions and actual SQLite databases, including bounded deletion waits, API-error behavior, foreign-resource preservation and retry/cancellation cases. Retry semantics are documented: a permitted retry starts from the first action, so caller-selected retries may replay actions; default one-attempt work is not replayed after interruption.
- Immutable phone-queue recovery digest 8fe314b5cdada527d6fbb7b8fbd4b34782084fa19c4fddd952daeeecd9765b4b was scanned successfully with no critical or fixable findings (44 unfixed high findings remain). Runtime source SHA-256 4425c5b6f59acc1ffbde054ccb6388b12632f31cf23318dcfdc1b2743096b171 matches the built source. Native Rancher Edit Config changed only the image and returned Active 1/1; all other deployment fields and UID were preserved. Source runtime/build manifests now pin this verified image. Fourteen owned build resources were confirmed absent.
- Three isolated wait-only jobs are provisioning for a live native Rancher restart test: retry budget two, exhausted budget one, and pending cancellation. The primary phone, PVC and default profile remain preserved. These live recovery outcomes are not proven yet. Prior full ten-phone capacity evidence belongs to the preceding capacity image and remains retained.

## Live restart recovery and isolated VPN outage — October 12, 20:15–20:21 UTC

- Native Rancher Redeploy interrupted three running wait-only jobs on recovery image 7. The retryable job completed all six steps on its second attempt; the exhausted job failed after one attempt without replay; the pending cancellation recovered as cancelled after one attempt. The persisted cancellation error confirms that cancellation was interrupted by the controller restart. The replacement controller became Ready. Only Rancher's two restart timestamps changed in the deployment specification. The original primary StatefulSet, PVC and profile were preserved.
- All three owned clone deployments, Services, PVCs and pods, plus all four associated PVs and Longhorn volumes, were confirmed absent at 20:15:06 UTC. No overlapping clones appeared during recovery. Evidence: phone-restart-recovery-tests.json and rancher-phone-controller-restart-passed.png. A fresh health checkpoint passed at 20:15:32 UTC. A distinct eleven-job full-pool run on the current recovery image is in progress; prior capacity evidence remains separately recorded.
- An isolated pod used the exact running production Gluetun digest and its provider environment, including references to the existing VPN credential Secret. Its control API bound only to loopback with temporary authentication restricted to VPN status/start/stop. Ingress was denied; no egress NetworkPolicy was applied, so network policy could not mask an escaping public connection. No production torrent configuration, pod identity or restart count changed.
- Both public TLS connections and both direct UDP DNS queries succeeded before stopping the isolated tunnel. All four were blocked with the tunnel absent, then all four succeeded after restarting it. The owned pod, ingress policy and temporary authentication Secret were confirmed absent. Evidence: vpn-kill-switch-tests.json and vpn-kill-switch-owned.json. This verifies IPv4 outage behavior of the actual image/configuration in an isolated pod. A production tunnel outage was not injected, and IPv6 outage behavior remains unverified.
- Evidence: phone-restart-regression-tests.json, phone-recovery-deploy-owned.json, harbor-native-scan-recovery-tests.json, phone-restart-recovery-owned.json and rancher-phone-controller-recovery-fix.png. The goal remains active; LAN, DHCP and public DNS cutover remain unchanged.

## Full pool on recovery image 7 — October 12, 20:22–20:30 UTC

- A distinct eleven-job run used the current recovery digest. Ten phones became Ready and completed once while the eleventh remained queued. Native Rancher showed all ten deployments Active 1/1. Ten healthy completed clone volumes had thirty running healthy replicas, with three distinct physical zones per volume. All nineteen nodes stayed Ready.
- Releasing one retained clone allowed the eleventh job to start. The 112-sample release trace observed the terminating pod and confirmed it disappeared before the replacement pod was created. The maximum live count, including terminating pods, was ten. The replacement initially waited for Longhorn clone/replica recovery, then became healthy and completed once without intervention. Independent checks again found ten healthy volumes with thirty healthy replicas across three zones per volume.
- All eleven wait-only jobs succeeded on their first attempts. All owned clone deployments, Services, PVCs, pods, PVs and Longhorn volumes were confirmed absent at 20:29:40 UTC. Original profiles, the primary phone and the controller specification were preserved. The pool is idle with one Ready default profile.
- Application health passed with ten retained phones at 20:29 UTC and after cleanup at 20:30 UTC: nineteen nodes and twenty certificates Ready, all inspected workloads and PVCs ready/bound, all attached volumes healthy, and nineteen web endpoints reachable with eighteen HTTPS handshakes verified. This endpoint health check complements the separately recorded authenticated application workflows.
- Evidence: phone-pool-capacity-v3-tests.json, phone-pool-storage-v3-tests.json, phone-replacement-storage-v3-tests.json, phone-release-v3-tests.json, capacity-v3-loaded-health-tests.json, phone-acceptance-summary.json, service-health-tests.json and rancher-ten-ready-phone-clones-v3.png. The summary now selects recovery image 7, records all thirty-seven source regressions and qualifies live restart/capacity evidence by image. Controller restart during an active profile-capture operation remains unverified.
- DNS cutover preparation above records the current resolver VIP, original values to capture for rollback, client and AD gates, and the public HTTP-01 prerequisite. The DNS development README now distinguishes its prototype from the live pinned compatibility image and links to this acceptance record. The full goal remains active; no LAN, DHCP or public DNS cutover was performed.

## Profile-capture recovery and Windows client checks — October 12, 20:35–20:48 UTC

- Native Rancher Redeploy interrupted an active disposable profile operation while its captured snapshot was Ready and the primary phone restart was pending. The controller uses Recreate; its replacement started at 20:35:19 UTC and the same operation finished at 20:35:21.647860 UTC. This establishes that the replacement completed the operation, rather than treating completion before restart as recovery. The snapshot and snapshot-content identities were preserved, and the primary returned Ready with its original StatefulSet specification, PVC and volume.
- Four protected-default, mismatched-ownership and invalid-name checks passed. A wait-only workflow using the recovered profile succeeded on its first attempt. Its clone resources, PV and Longhorn volume were removed; then the disposable profile snapshot and content were removed. The snapshot inventory returned to the exact original UID set with no additional snapshots. The pool is idle with one Ready default profile. Evidence: phone-profile-restart-tests.json and phone-profile-restart-owned.json. The summary now records this recovery phase and current-image profile lifecycle evidence. This live test interrupted primary restoration after snapshot capture; it does not establish every possible interruption phase.
- The actual Windows Resolve-DnsName API passed 64 assertions against VIPs 55–58, using default DNS transport and forced TCP. LDAP domain-controller, Kerberos and global-catalog SRV records, domain-controller A/PTR, NS and SOA answers matched the Windows source. The raw domain02. query preserved the expected internal .io → .com alias chain and terminal address. Source answers remained stable throughout and adapter DNS settings were unchanged. Evidence: windows-dns-client-live-tests.json. Domain authentication, secure dynamic registration, client search-list expansion and DHCP lease renewal remain separate unverified client gates.
- Post-cleanup health passed at 20:43 UTC: all nineteen nodes and twenty certificates Ready, workloads/PVCs ready/bound, attached storage healthy and all nineteen endpoints reachable. No application image or DNS serving configuration changed during this test.
- The acceptance audit confirmed a core lifecycle limitation in the current deployed DNS 0.1.9 bundle: the executable adapter supports record changes and selective record restoration but rejects source configuration and zone-creation proposals. Its Windows bridge is restricted to four fixed zones. DNS credential-reference capture/recovery also remains unavailable as recorded earlier. These management paths stay open; they are not equivalent to an external public-DNS prerequisite and must not be hidden by declaring record CRUD sufficient for all management. Evidence: dns-lifecycle-capability-audit.json, including verification of the currently mounted deployed bundle.
- The goal remains active. The next manager work must address these runtime lifecycle paths; HTTP-01 public reachability, physical-host failure and the documented application dependencies also remain pending. LAN, DHCP and public DNS cutover are unchanged.
- The requested Alexa Alert was accepted for the newly verified deployed lifecycle limitation; its one-time receipt is alexa-dns-lifecycle-alert.json. Current native Rancher readiness after profile recovery and cleanup is captured in rancher-profile-restart-passed.png.

## Managed zone lifecycle — October 12, 21:06–21:37 UTC

- DNS Manager 0.1.11 is cached and Ready in native Rancher (Helm revision 13). Forward-zone creation and deletion passed through its real review, snapshot and Apply controls. IPv4 TEST-NET reverse and IPv6 documentation-prefix reverse zones passed through the authenticated management adapter. All created zones received the existing restricted transfer/NOTIFY policy and were confirmed on all three DNS replicas.
- Eighteen live acceptance checks passed, including fifty authoritative TCP/UDP queries against Windows and VIPs 55–58. Eight rejection checks covered protected original-zone deletion, duplicate/malformed creation, missing or incomplete backups, stale serials, wrong ownership and mixed zone/record batches. A/TXT writes in the newly managed zone also passed. The Windows receipt and persisted replica ownership retain original operation IDs; uncertain create/delete replies fail closed instead of replaying writes or adopting pre-existing zones. Five injected replica tests establish those uncertain-response behaviors; live interruption at every phase remains unverified.
- Windows rejected the initial `.invalid` fixture with native error 123; no zone or zone file existed. Its failed receipt was retained and reconciled using absence evidence, and a preflight now rejects that suffix clearly. A diagnostic child-zone creation exposed Windows automatic parent delegation behavior: deleting the child alone left its parent NS. The exact diagnostic NS was attested and removed, and new managed lifecycle operations now review parent serials, track only their own added NS, and remove only that delegation. The independent child creation/deletion test passed, including parent replication.
- A live single-delegation JSON shape failure was corrected in the Windows bridge. Tests execute its actual inventory publisher with zero, one, multiple and unmanaged delegation cases. Native review now preserves the mounted backup gate during background refresh and prevents duplicate Apply clicks. An actually stale review was rejected before submission, then the refreshed Rancher deletion succeeded once. Seventy-one UI and fifty-three management/fresh-capture regressions passed before deployment; the serialization regression passed after the bridge correction.
- All four owned zone fixtures were removed from Windows and the three replicas. Every original non-SOA record and TTL matched the pre-test baseline, and all sixty-one original snapshot IDs remained. Twenty fixture ZIP backups were saved privately with verified SHA-256 checksums before normal scoped snapshot deletion. The final original-zone configuration backup is retained separately after cleanup. Existing transfer policy, client resolvers, DHCP and public DNS remained unchanged.
- Evidence: dns-zone-lifecycle-tests.json, dns-zone-lifecycle-owned.json, dns-rejected-zone-reconciliation.json, dns-zone-probe-delegation-before.json and dns-zone-bridge-rollout.json under the private manager-installation evidence directory. Current health at 21:37 UTC again passed all nineteen nodes, twenty certificates, inspected workloads/PVCs, attached Longhorn volumes and nineteen web endpoints with eighteen verified HTTPS certificates. A final native Rancher snapshot at 21:38 UTC matches all four current source serials and complete records, bringing the retained index to sixty-two snapshots. Rancher shows 5/5 backup coverage and the four original zones Synced; proof is rancher-zone-lifecycle-cleanup-passed.png.
- The goal remains active. Source create/edit/delete, deleted-zone restoration and credential-reference recovery still require executable backend work. Public HTTP-01, actual domain authentication/dynamic registration/lease renewal, physical-host failure and documented application dependencies remain unverified. Zone lifecycle success does not close those gates.


## Deleted-zone recovery and snapshot runtime hardening — October 12, 2026

- DNS Manager 0.1.13 is installed through Helm revision 15. Native Rancher selected the unchanged Windows source and a deleted, previously manager-owned child zone from a fresh durable backup. Its review, backup, staging and Apply controls produced one actual RestoreZone operation; Windows readback and all three independent replicas confirmed completion. The unchanged source was a no-op, not source lifecycle support.
- Nine live acceptance checks passed, including 100 authoritative TCP/UDP queries against Windows and VIPs 55–58. Recovery retained ten saved records, including SOA, NS and all seven writable types, two A values at one owner, exact TTLs and SOA settings. It assigned new manager ownership and a fresh serial. Five live malformed restores were rejected before zone creation; thirteen additional PowerShell validation cases passed.
- The test exposed a multivalue creation bug: distinct A values at one owner collided in adapter and bridge preflight. Both now key creates by value while updates and deletes retain reviewed target identity. Fifty-seven management/fresh-capture regressions and the existing 71 DNS interface tests passed. Three snapshot integration tests passed for both servers, including encryption, merge, restart and cleanup.
- Cleanup removed the restored test zone and only its owned parent NS record. All four original zones matched their saved non-SOA record/TTL baselines and all 62 original snapshot IDs remained. Fourteen owned test backups were archived privately with SHA-256 readback verification before deletion from the active index. Original Windows and replica ownership tombstones remain for reconciliation provenance.
- Harbor scanned the deployed recovery runtime and found nine fixable high-severity findings. A new immutable runtime uses Node 24.21.0 and updated Alpine libraries, removes unused npm/Corepack packages, and passes plain/encrypted ZIP round trips. Its linux/amd64 Harbor scan completed successfully with zero vulnerabilities. Both existing snapshot StatefulSets now run image 2026.10.12-11 pinned by digest 843c44f6…; their UIDs, remaining specifications, persistent storage and original snapshot indexes (DNS 62, Network 104) were preserved. A new final native DNS backup brings its index to 63 and covers all five current configuration items after fresh observations. Original non-SOA record/TTL baselines still match. The 22:08 UTC health checkpoint passed for 19 nodes, 20 certificates, workload readiness, bound PVCs, healthy attached Longhorn volumes and 19 reachable web endpoints (18 strict TLS HTTPS).
- Scope remains bounded to previously manager-owned deleted zones with supported saved records. Unsupported record types, protected original zones, source replacement, credential recovery, every interruption phase and physical/client/public-DNS gates remain open. The goal remains active.


## DNS navigation apply and recovery — October 12, 2026

- DNS Manager 0.1.17 is installed through Helm revision 18. Native Reorder, keyboard move, Save Draft, Pending Rollouts review, server backup and Apply passed; the applied priority survived page reload. Full native snapshot restore returned the original order with a second durable receipt. All Windows records, including SOA/TTL values, and Windows job IDs remained unchanged.
- Navigation validates a complete zone permutation, reviewed base order, manager identity and a recent server backup of the current applied order. Kubernetes dry-run, resource-version concurrency checks and authoritative readback precede success. A two-phase receipt stays Running with readBack false until completion is independently persisted and confirmed. An injected completion outage accepted the original order write exactly once; native Rancher refresh reconciled that same process without repeating the order write. Malformed/stale proposals, foreign/outdated/encrypted backups, admission/authorization denial and altered readback pass regressions. Four live rejected batches produced no state or DNS mutation. Unchanged source/zone restore dependencies are no-ops; actual mixed DNS mutations are rejected before every write.
- The tests also exposed a native route-transition race: a new page could load five of six restoration drafts while the last save was still pending. The route guard now waits for state persistence. A deferred-save UI regression and immediate native six-item handoff pass. The owned handoff drafts were discarded; no active configuration changed.
- Sixty-five management/fresh-capture tests and 74 interface tests across six files pass. Running Processes counts active work and reports completed progress only for confirmed readback receipts. Builds have three bundle-size performance warnings and no compilation errors. Immutable extension assets retain previous releases.
- Automatic and manual fresh capture read authenticated saved navigation and update corresponding zone priorities. The configured DNS snapshot identity can GET exactly its named state ConfigMap; foreign state, state updates and DNS Secret reads are denied. DNS snapshot runtime image 2026.10.12-12 has a successful Harbor scan with zero vulnerabilities; Network remains on verified image 11. Runtime preparation now retains those versions and the scoped navigation-read binding.
- The interruption/recovery ledger passed nine live checks; the earlier rejected future-dated safety backup attempt is retained as evidence, and made no order write. Owned test backups were privately archived with SHA-256 readback before active-index removal. All 64 baseline snapshot IDs remain, plus one final native six-item backup (65 total). The later handoff test preserved all 65 IDs and exact navigation history. Rancher shows zero pending drafts, four Applied/readback-verified navigation receipts and Snapshot Ready covering 6/6 configurations. The final record/SOA/TTL and Windows queue baselines still match.
- At 22:47 UTC, all 19 nodes and 20 certificates were Ready; inspected workloads/PVCs and attached Longhorn volumes were healthy, with 19 reachable endpoints (18 verified TLS HTTPS). DNS source lifecycle, credential recovery, physical/client/public-DNS gates and external model availability remain open. The goal remains active; no DNS/DHCP/public cutover occurred.

## DNS source management discovery — October 12, 2026

- Read-only authenticated WinRM confirms Domain02 DNS service is Running and returns the four protected authoritative zones plus Windows automatic/TrustAnchors zones. Domain01 hostname resolution fails before WinRM authentication; it is not a verified alternate source. No source settings or DNS zones were changed.
- The current controller and Windows bridge are still explicitly tied to Domain02 and the UI source form does not have an executable source management operation. Source lifecycle requires a real profile/bridge identity, independent connection checks against unsaved settings, review/backup/receipt handling and safe dependency rules. Saving a catalog label alone cannot satisfy that acceptance item. Credential references and encrypted recovery must likewise represent the actual scoped bridge/engine credentials, without placing values in browser drafts or ordinary configuration snapshots.

## Fresh DNS credential capture — October 12, 2026

- DNS Manager 0.1.18 is installed at Helm revision 19. The authenticated controller now publishes the two actual installed dependencies: dns-system/dns-manager-engine-admin (replica administration) and dns-system/dns-windows-bridge-credential (the scoped bridge service-account token). Configuration-only snapshots contain references; Include Secrets requests fresh server reads and AES-256 ZIP encryption. Values and backup passwords are absent from persisted browser state, source identities, metadata and ordinary snapshots. Server-side capture refuses cached Secret values, including values nested in proposals or configurations, and never reads caller-selected Secret names.
- The DNS snapshot service can GET those two named Secrets. Live authorization checks deny foreign Secret reads, Secret listing and credential updates. Type, namespace, name, UID, resource revision, complete key set and bridge service-account annotations are checked before capture. Missing, denied, malformed or replaced credentials stop capture without a cached fallback. An unprotected or weak-password Secret capture cannot create a usable archive.
- Native Rancher New Snapshot/Include Secrets and a live API capture both produced encrypted, recoverable archives of the installed values. Wrong passwords and protected GET without unlocking were rejected. Encoded and decoded Secret values are absent from ZIP bytes; correct-password ZIP recovery matches current installed values. Metadata has two captured-value coverage entries and contains no current payload or password. Rancher reports 8/8 known items covered, including the two credentials. This coverage is capture evidence; credential restoration Apply remains open.
- A separate backend with its own 1 GiB Longhorn PVC performed one real automatic encrypted capture from current Windows observations and current credential reads. The schedule kept a password version in the existing scoped vault and stored only a reference-only template. After disabling the schedule, one owned pod replacement recovered the encrypted archive and vault-backed schedule from persistent storage with no duplicate capture. Seven live schedule/restart/cleanup checks passed. The temporary Deployment, Service, NetworkPolicy, PVC and PV are confirmed gone; only its owned password-vault version was removed. Its verified encrypted archive and private key ledger are retained locally. The production backend index was preserved throughout.
- Snapshot runtime image 2026.10.12-14 is pinned to digest 0927f16f…; its linux/amd64 Harbor scan completed successfully with zero vulnerabilities. DNS StatefulSet UID, other settings, PVC and snapshot IDs were preserved on rollout. Network remains on verified runtime 11. Runtime preparation now preserves DNS 14 and the exact credential-reader binding. Sixty-seven management/fresh-capture tests, 75 interface tests and six snapshot server/encryption/restart/failure tests pass. Builds retain only the three known bundle-size warnings.
- Full original Windows record/SOA/TTL state, queue IDs, saved navigation and both installed credential UIDs, resource revisions and values still match the pre-capture baseline. All 65 existing snapshot IDs remain. Two owned encrypted manual backups are deliberately retained in the active index (67 total), with their password in the ignored private local test ledger, for the next credential-restoration tests. They have not been promoted as evidence of successful restoration. No pending drafts or production credential rotations were introduced.
- The 23:10 UTC health checkpoint passes for 19 Ready nodes, 20 Ready certificates, inspected workload/PVC readiness, healthy attached Longhorn volumes and 19 reachable web endpoints (18 verified TLS HTTPS). DNS source create/edit/delete and executable credential restoration remain the next implementation/acceptance work. Physical/client/public-DNS and external model gates remain open. The full goal remains active; no DNS/DHCP/public cutover occurred.

## DNS native status and restoration guard — October 12, 2026

- DNS Manager 0.1.19 is deployed at Helm revision 20, with both immutable asset-host replicas Ready. Rancher loads the versioned 19 bundle. Healthy Windows management now displays a success banner instead of a red error; unavailable management remains an error. Scoped banner foreground rules override Rancher's inherited button color, restoring readable snapshot coverage and management status text. Network Manager 0.1.24 retains its readable native warning banner.
- Mixed configuration/credential restore selection now fails before staging any item. The native encrypted eight-item review displays an explicit unsupported-credential-restoration message and disables both confirmation and preparation while either credential is selected. Deselecting both credentials removes that block; configuration restore continues to use its existing verified backup gate. Comparison redaction remains in place, review/password dialogs are closed after testing, and production credentials, DNS records/TTLs, queue, navigation, zero pending drafts and the original 65 plus two owned encrypted backup IDs are preserved. This rejection is not successful credential restoration. Service-account UID binding, coordinated engine-password restoration and scoped executable Secret Apply remain implementation work.
- All 78 DNS UI checks pass, including healthy/unavailable banner classification and atomic rejection of mixed Secret restoration. The build succeeds with only the three existing bundle-size warnings. The 23:22 UTC health check reports 19 Ready nodes, 20 Ready certificates, no unready inspected workloads/PVCs, no unhealthy attached Longhorn volumes and 19 reachable endpoints, including 18 verified HTTPS connections.
- Native screenshots: .local/manager-installation/rancher-dns-credential-restore-guard-19.png and rancher-dns-status-19.png. The full acceptance goal remains active; source lifecycle, credential Apply, physical/client/public-DNS and external-service gates remain open.

## Network current configuration coverage — October 12, 2026

- Native Network Manager 0.1.24 coverage identified four unmatched items following earlier infrastructure changes: the new Harbor Trivy Service, both current Traefik Services and one service-reference item. A native New Snapshot with Include Secrets disabled captured All Known Routing Configuration: 333 configuration coverage entries, 94 services and the two pre-existing working drafts across 31 namespaces. The server ZIP and JSON round trip match, contain no Secret values, and the captured three Service specs match fresh live reads with unchanged UIDs/specs.
- Rancher now reports Snapshot Ready, 355/355 known items covered, using this current configuration archive plus prior encrypted Secret-value coverage. That Secret indicator records whether values were backed up; it does not prove equality with today's credentials. The 104 earlier Network snapshot IDs are preserved, with one deliberately retained current archive (105 total). Production resources and prior drafts were not applied or changed. The private verification ledger is .local/manager-installation/network-coverage-24-owned.json; ZIP copy is network-coverage-24-configuration.zip. Native proof is rancher-network-coverage-24-current.png.

## Non-interactive coverage comparisons — October 12, 2026

- A native DNS coverage reload exposed duplicate background encrypted reads opening six password dialogs. Coverage comparison reads now explicitly prohibit interactive unlock in both managers. DNS also stops obsolete loads before fetching versions and no longer starts the same refresh load twice. Missing/encrypted comparisons show an explanatory message while configuration gaps remain visible; explicit snapshot review retains its password dialog.
- DNS Manager 0.1.20 (Helm revision 21) and Network Manager 0.1.25 (revision 27) deploy successfully, with both asset-host replicas Ready. All 81 interface checks pass, including both managers' non-interactive encrypted-read rejection and one-read DNS coverage/navigation behavior. Native DNS 20 displays its encrypted gap without password dialogs, Back To Snapshots works, and an explicit single-dialog unlock successfully opens the eight-item owned archive. No drafts were prepared; the 67 DNS snapshot IDs, credentials and DNS/queue/navigation baselines remain preserved.
- The remaining DNS coverage gap is an identified false comparison: cormierconsulting.com has identical record values/TTLs, 93 records and serial 754 in the saved/current state, but Windows enumerated its record array in a different order. The record-set comparison is confirmed read-only. Stable record ordering must be implemented consistently for UI capture/review and server fresh capture/coverage, then verified through a fresh backup and reload. This remains pending; do not claim current DNS 8/8 or completed acceptance. Private evidence: dns-record-order-coverage-19.json.
- The 23:39 UTC post-deployment health check passes for 19 Ready nodes, 20 Ready certificates, healthy inspected workloads/PVCs and attached Longhorn volumes, plus all 19 web endpoints, including 18 verified HTTPS connections. Native proof: rancher-dns-coverage-no-prompts-20.png. The full goal remains active, with record-order normalization, source lifecycle, executable credential restoration and the existing physical/client/public/external-service gates pending.

- Native Network Manager 25 loads its immutable versioned bundle, remains Snapshot Ready at 355/355 known items with 105 retained snapshots, and its healthy coverage banner opens Snapshots without unlock dialogs. Screenshot: .local/manager-installation/rancher-network-coverage-25-current.png. Rancher was returned to DNS snapshots with no password/review dialog for continued work.

## Canonical DNS capture and coverage loading — October 12, 2026

- The record-order false gap documented above is resolved. One shared canonical DNS record-set helper now serves UI capture, fresh server capture, coverage fingerprints and comparison. It preserves every record, duplicate, value, TTL and serial, and retains navigation order. Sixteen permutations across seven record types, Vue reactive comparison, a reordered observation refresh and actual value/TTL/serial/priority changes pass regressions.
- DNS Manager 0.1.21 (Helm revision 22) and snapshot runtime 2026.10.12-15 deployed successfully. Harbor scanned the linux/amd64 runtime digest ef9360b3… with zero vulnerabilities; its deployed immutable manifest digest is b0eb5446…. The snapshot StatefulSet identity, remaining spec, PVC and all 67 earlier archive IDs were preserved. A native configuration-only backup captures all four current zones plus source and navigation; six configuration fingerprints and the ZIP round trip match fresh observations. The original 67 backups remain, with one deliberately retained current archive (68 total). Native Rancher now shows Snapshot Ready, 8/8 coverage after two reloads; this includes the two prior encrypted credential-value captures and does not assert that current credential values match those old backups.
- Production credential UIDs/resource versions/value digests, all Windows records and serials, queue IDs, saved navigation and zero pending drafts remain unchanged. Private evidence: dns-record-order-21-owned.json and dns-record-order-21-configuration.zip. Native proof: rancher-dns-canonical-coverage-21.png. The credential test ledger explicitly retains the new ordinary archive separately from its two owned encrypted archives.
- DNS Manager 0.1.22 (Helm revision 23) additionally waits for the snapshot index before classifying coverage. Pending reads show Checking Snapshot Coverage instead of a false missing count; the coverage page waits before showing a result and failed index reads cannot claim all items match. All 85 UI tests pass, including deferred and failed reads and usable return navigation. Its build passes with the three known bundle-size warnings. Both immutable asset-host replicas became Ready before Helm installation.
- The 23:56 UTC checkpoint again passes 19 Ready nodes, 20 Ready certificates, inspected workloads/PVCs, attached Longhorn volumes and 19 reachable endpoints, including 18 verified HTTPS connections. Source lifecycle, credential restoration Apply, interruption, physical/client/public-DNS and external-service gates remain open. No resolver, DHCP or public DNS cutover occurred; the full goal remains active.

- Final native DNS 22 proof: rancher-dns-canonical-coverage-22.png. Its first paint displays Checking Snapshot Coverage; the settled coverage page displays no missing configuration, no unlock dialogs, and working Back To Snapshots navigation. The return view reports 68 archives and 8/8 coverage.

## Live DNS credential identity verification — October 13, 2026

- DNS snapshot runtime 2026.10.13-16 is Ready, pinned to manifest digest 50dd21ed… (linux/amd64 6b789285…). Harbor Trivy 0.72 reports zero vulnerabilities. Its image-only compare-and-swap rollout preserved the StatefulSet UID, other spec fields, persistent volume and all 68 original archive IDs. DNS Manager 0.1.22 and Network Manager 0.1.25 remain installed.
- Encrypted bridge credential capture now reads the live named ServiceAccount, authenticates the candidate token through a TLS-verified Kubernetes SelfSubjectReview, verifies the authenticated username/UID/groups and encoded namespace, then rereads account and Secret identities. Deleted/replaced accounts, invalid credentials, denied reads and concurrent UID/revision/value changes reject the whole capture. Configuration-only capture does not read credential dependencies. The capture Role gained only get for dns-system/dns-windows-bridge ServiceAccount; live authorization checks reject account listing and credential updates.
- All 73 management/fresh-capture/canonical-record tests and five encrypted recovery/quota/restart/merge tests pass. A probe inside the deployed backend confirms real token authentication and rejects an invalid token, a replaced account UID in memory and an unrelated account reference. Private runtime probe: dns-credential-binding-runtime-16-probe.json.
- Native Rancher Include Secrets created one encrypted eight-item backup with both current credential values and the actual ServiceAccount UID. Wrong-key ZIP recovery fails, correct-key recovery matches live values, and the index contains no credential values or key. The owned test ZIP was archived privately with SHA-256 readback verification before removing only that test archive from the active index. All 68 pre-test DNS backups, credential values/UIDs, DNS records/serials, queue, navigation and zero drafts remain preserved. Private capture/cleanup proof: dns-credential-binding-16-owned.json and dns-credential-binding-16-native.zip. Native capture screenshot: rancher-dns-bound-credential-capture-16.png.
- A strict older-baseline check flagged the bridge Secret revision at the UTC day boundary. Inspection confirmed unchanged UID/value digest and the kube-apiserver-managed kubernetes.io/legacy-token-last-used label dated 2026-10-13, updated at 00:00:01 UTC. The exact resulting revision is attested separately; original baselines remain immutable, and every unaccounted revision or any value/UID change still fails verification. Both older preservation checks pass after owned test cleanup. Evidence: dns-credential-usage-metadata-2026-10-13.json.
- The 00:12 UTC checkpoint passes all 19 nodes, 20 certificates, inspected workloads/PVCs, attached Longhorn volumes and 19 reachable web endpoints, including 18 verified HTTPS connections. Executable credential restoration remains incomplete: coordinated engine-password recovery, Windows private kubeconfig reconciliation, authenticated Apply and durable interruption receipts still require implementation and acceptance. Source lifecycle and physical/client/public/external-service gates remain open. The goal remains active; no credential rotation or DNS/DHCP/public cutover occurred.

- Final native reload after cleanup confirms 68 retained DNS archives, Snapshot Ready 8/8, connected Windows management and no open dialogs. Proof: rancher-dns-bound-credential-cleanup-16.png. The independent Network index check preserves all 105 archives.

## Rancher caller authorization for credential recovery — October 13, 2026

- An isolated native browser/service probe established that the Rancher-to-Kubernetes service proxy strips bearer and impersonation headers but forwards the authenticated session cookie. Relaying that session to the fixed Rancher endpoint over strict TLS returns the actual user identity, rather than the snapshot backend ServiceAccount. This is an observed deployment behavior, not an assumption about proxy headers.
- Added rancher-recovery-session.mjs: recovery validates the expected Rancher user through SelfSubjectReview and checks every named Secret/account permission through SelfSubjectAccessReview. All operations use that delegated Rancher session and CSRF value; there is no fallback to the backend pod credential. Installed names, namespace, Secret shape and reviewed UID/resource-version concurrency identities constrain writes. Creation requires separate explicit authorization. Default writes are admission dry runs; uncertain actual submissions are redacted and never replayed.
- Six new authorization regressions pass; the full management/fresh-source/canonical-record suite now passes 79 checks. Tests cover absent/foreign/malformed/cross-origin sessions, wrong user/ServiceAccount, denied/indeterminate permissions, unsupported names/namespaces/values, missing CAS identity, explicit create permission and an interrupted write with no replay.
- The actual module also passes through the live Rancher browser in an isolated service with no mounted ServiceAccount token or Secret/write permissions. Delegated reads and dry-run replacements of both installed DNS credentials preserve UID, resource version and values; named account access succeeds. Invalid Rancher sessions and mismatched users are rejected. No actual credential writes occur. Native proof: rancher-dns-recovery-delegation-passed.png; private ownership/results: dns-recovery-delegation-owned.json. All four exact owned ConfigMap/Deployment/Service/NetworkPolicy UIDs and their pods are confirmed absent after normal foreground cleanup.
- Production credential and DNS/navigation/queue baselines and all 68 DNS archives remain unchanged. A transient health observation saw only the terminating owned probe deployment; a fresh checkpoint after confirmed absence passes 19 Ready nodes, 20 Ready certificates, inspected workloads/PVCs, attached Longhorn volumes and 19 reachable web endpoints with 18 verified HTTPS connections. The installed DNS runtime remains 2026.10.13-16 and both manager versions remain 22/25. The new recovery authorization client is verified in isolation and is not yet integrated into an executable restore endpoint.
- Remaining recovery work: encrypted server-side restore transactions, coordinated three-engine password recovery, Windows private kubeconfig reconciliation, durable non-replayed interruption receipts and native restore Apply acceptance. Source lifecycle and physical/client/public/external-service gates also remain open. The full goal stays active; no production credential rotation or DNS/DHCP/public cutover occurred.

## Durable encrypted credential recovery transactions — October 13, 2026

- Added `live-management/dns-credential-recovery.mjs`. Preparation delegates current named credential/account reads and admission dry runs to the authenticated Rancher caller, then encrypts both reviewed before values and target values. Receipts contain names, identities, revisions, operation markers and progress only; credentials, backup keys and Rancher sessions are never persisted in those receipts. A strong backup key must be supplied again after restart. Missing credentials require separate create permission; an unavailable dependency coordinator prevents Apply before mutation.
- Every dependency preparation, Secret write and activation receives a persisted intent before submission. File contents are synced before atomic replacement; Linux parent directories are synced after replacement and active-lease changes. An active lease prevents another transaction from changing dependent systems while recovery remains incomplete. The supported deployment invariant remains one snapshot-server process and one replica with its existing persistent store; multi-process callers for the same transaction are not supported.
- Lost replies remain unconfirmed until independent readback matches the original operation marker, target values and expected identity. Reconciliation never repeats a mutation. Explicit continuation is available only after dependency preparation is independently confirmed and every previously submitted step is resolved; it also rechecks confirmed and still-unsubmitted credentials before proceeding. Already confirmed writes and dependency preparation are skipped. Foreign changes, unresolved activation or changed account identity keep recovery incomplete. Applied requires both dependency confirmation and fresh independent credential/account readback. An Applied receipt is historical evidence, rather than a claim about future system health.
- Sixteen recovery scenarios pass on Windows and in a disposable Linux Node 24.21.0 container with no network, a read-only source mount/root filesystem, non-root execution and temporary test storage. The Linux run exercises directory syncing as well as encrypted persistence/restart, denied access/admission, stale identities, creation, quota exhaustion, duplicate Apply, overlapping transactions, lost replies, partial continuation and foreign changes. The complete management/fresh-source/canonical-record suite passes 95 checks. Linux evidence and source digests: `.local/manager-installation/dns-credential-recovery-linux-tests.json`.
- The 00:37 UTC read-only checkpoint passes 19 Ready nodes, 20 Ready certificates, all inspected workloads/PVCs, healthy attached Longhorn volumes and 19 reachable web endpoints, including 18 verified HTTPS connections. Both DNS preservation checks pass; all 68 DNS archives, production credential values/identities, DNS records, navigation and queue remain preserved.
- This transaction module is not deployed or connected to a production recovery endpoint or native Apply flow. Dependency methods are currently supplied by test fixtures. Coordinated real three-engine password recovery, controller credential reload, Windows private kubeconfig reconciliation and native restoration acceptance remain required. Technitium 15.6.1 documents the authenticated password-change call with current/new passwords in its [versioned API documentation](https://github.com/TechnitiumSoftware/DnsServer/blob/v15.6.1/APIDOCS.md#change-password); actual changed-value acceptance must use isolated engines before production integration. Source lifecycle and physical/client/public/external-service gates remain open. The full goal remains active; this verification performed no production credential rotation or DNS/DHCP/public cutover.

## DNS engine recovery and deployed controller credential reload — October 13, 2026

- The controller previously loaded its admin password once at startup. It now uses `dns-engine-api.mjs`, reads the mounted value for each operation and clears cached engine sessions when that value changes. Authentication failures and transport errors invalidate the affected cached session without automatically repeating the API operation. Requests use fixed installed replica identities, POST form data, bearer sessions and a timeout; redirect following and sensitive API/transport error text are blocked. Temporary recovery login sessions are logged out.
- Added `dns-engine-recovery.mjs` for the engine part of the parent encrypted restore transaction. It authenticates all three engines before any password mutation, durably records each engine intent and confirms each target with a fresh admin-profile login. After an uncertain reply, readback may confirm the target; it never repeats an unresolved mutation. Continuation changes only still-pending engines. Fresh controller confirmation is required before declaring the engine dependency Applied. Passwords and session tokens are absent from its progress receipts. The parent transaction remains responsible for the active lease, authenticated caller, encrypted before/target values and request binding.
- Eleven new regressions pass, bringing the complete management/fresh-source/canonical-record suite to 106 checks. They include mounted-password reload, sensitive response suppression, redirected/unsupported references, no write retry, all-engine preflight, partial interruption/restart continuation, foreign changes, missing controller confirmation, unchanged/missing credentials, mixed current/target engines and malformed non-UTF-8 values.
- Actual Technitium 15.6.1 containers using the same installed pinned upstream digest passed changed-password acceptance. Three engines and a non-root Node test client ran on an internal Docker network with no host ports. An injected lost response after an accepted second-engine change was reconciled and the third engine continued; each engine received exactly one password-change request. Updating the fixture's mounted credential file established three fresh actual admin sessions through the controller's new client. The engines were then restarted, and a separate new client process confirmed the saved receipt, authenticated with the restored passwords, rejected the original passwords and handled repeated/unchanged/missing-Secret cases without further changes. These are isolated engine/client tests, not native Rancher restoration acceptance or a real Kubernetes projected-Secret update. All exact owned containers, anonymous data volumes and the internal network were removed. Private receipt: `.local/manager-installation/dns-engine-credential-recovery-owned.json`.
- The first private-network fixture could not expose API ports through Docker Desktop and stopped before any password changes. Its exact owned resources were confirmed absent; the final fixture places its client on the internal network and exposes no ports. The failed receipt is retained separately by its original transaction ID.
- The production controller reload fix deployed successfully at Deployment generation 6. ConfigMap and Deployment UIDs, engine image, permissions, volumes, replica count and all other workload specification fields were preserved; only controller code, its new API helper and the code-hash rollout annotation changed. The already installed credential-reference helper was preserved. Fresh observations after rollout show all three APIs reachable and Windows management connected. Private before/rollout evidence: `dns-controller-credential-reload-before.json` and `dns-controller-credential-reload-owned.json`. Both DNS preservation checks pass afterward, preserving production credential identities/values, records/serials, navigation, queue and 68 DNS backups.
- Real engine dependency recovery is now implemented and tested in isolation, and controller credential reload is deployed. It is not yet composed with Windows private kubeconfig handoff, the parent recovery endpoint or native Rancher Apply. Missing/invalid Windows credentials need a trusted recovery path independent of that broken token. Native restoration, source lifecycle and physical/client/public/external-service gates remain open. The goal remains active; production engine passwords and bridge credentials were not rotated, and no DNS/DHCP/public cutover occurred.
- The 00:49 UTC post-rollout checkpoint passes all 19 nodes, 20 certificates, inspected workloads/PVCs, attached Longhorn volumes and 19 web endpoints, including 18 verified HTTPS connections. Both server indices preserve their expected totals: 68 DNS and 105 Network archives. Endpoint reachability is a health check; the previously listed functional acceptance gates remain open.

## Windows private credential recovery — October 13, 2026

- Read-only inspection of Domain02 confirms PowerShell 5.1, a running SYSTEM bridge task, the fixed Kubernetes VIP/TLS name and a protected bridge directory granting access only to SYSTEM and Administrators. The bridge invokes kubectl with its private kubeconfig for each operation, rather than caching the token in its PowerShell process.
- Added `live-management/windows-dns-credential-recovery.ps1` as a local primitive for a future trusted recovery agent. It validates installed endpoint/CA/context settings, excludes TLS bypass and executable credential plugins, requires private ACLs and rejects reparse points for state files. A per-recovery active lease prevents overlapping transactions. Before/target values are stored using machine-bound DPAPI encryption with operation-specific entropy; progress receipts contain identity and status without tokens. Bridge quiescence must be supplied by a trusted caller. Candidate authentication precedes file replacement; current bytes must still match the reviewed before state. Replacement uses a synced temporary file and atomic replace/move, followed by byte comparison and authenticated account readback. Unchanged credentials preserve original formatting, bytes and timestamp. Reconciliation confirms the original accepted outcome without rewriting it.
- Eight grouped synthetic checks pass on Domain02's actual PowerShell 5.1: encrypted persistence, idempotency, changed/missing/unchanged files, interrupted readback, foreign changes, overlapping transactions, rejected authentication, foreign endpoints/CA/contexts, TLS bypass, executable credentials and unconfirmed quiescence. Actual tests exposed and fixed long temporary filenames and PowerShell 5.1's empty-string conversion of a null atomic-replace backup path. The helper now uses short same-directory temporary names and an explicit null-string value. Test reporting and parameter forwarding were also corrected.
- Five authenticated check groups pass against the installed cluster using private copies of the real bridge kubeconfig on Domain02. Candidate SelfSubjectReview must identify the installed bridge account UID/name and required groups, and both named bridge ConfigMaps must be readable. Missing and invalid fixture files are restored successfully; an injected post-replacement readback loss is reconciled after reloading the helper without changing the file timestamp. Wrong account identity rejects replacement. SHA-256 readback confirms the installed configuration, kubeconfig and bridge source are unchanged, and its scheduled task remains Running. These tests do not rotate Kubernetes credentials, replace the installed kubeconfig, pause the installed task or change DNS.
- Each remote test directory is uniquely owned, validated within the private bridge directory and removed after acceptance. Before rerunning a failed fixture after a fix, its exact directory absence was independently checked, and its original receipt was archived by transaction ID. Evidence: `windows-dns-credential-recovery-remote-owned.json` and `windows-dns-credential-recovery-auth-owned.json` in `.local/manager-installation`.
- The initial local test lacked an administrator token and left one empty private test directory under the ignored workspace evidence folder (`windows-credential-tests-6fea0cf6-238d-4e8b-9aaf-8a45f6e83457`). Automatic approval review rejected granting the current account access, reporting “blocked by policy”; deletion without permission changes also failed. Its ACL was not subsequently changed. This artifact contains no recovery credentials and is not part of the installed bridge; acceptance proceeded successfully through the existing Domain02 administrative session. Local cleanup remains pending.
- This helper has not been installed into the production bridge or exposed through Rancher. Its trusted authentication/quiescence callbacks and fixed configuration must be provided by the real agent. The independent recovery transport, candidate validation before Kubernetes Secret replacement, coordination with active DNS jobs, actual process-level serialization and composition with engine/server transactions remain required, followed by native Apply acceptance. Local file recovery alone does not establish recovery when the bridge token is invalid and its ordinary polling channel is broken. The complete goal remains active, with source lifecycle and physical/client/public/external-service gates also open.

## Signed token preflight and encrypted Windows channel envelopes — October 13, 2026

- Added `dns-bridge-token.mjs` to verify the saved legacy service-account token's RS256 signature using trusted current cluster JWKS, rather than trusting decoded identity claims alone. It requires the installed namespace/account/Secret names and current account UID, rejects unsupported algorithms/key sources, ambiguous or private signing keys, wrong issuer/audience, malformed encodings and expired/not-yet-valid claims. It returns only verification metadata. This is offline preflight for a missing Secret; authenticated API readback remains mandatory after restoration. Kubernetes documents this distinction in [service-account administration](https://kubernetes.io/docs/reference/access-authn-authz/service-accounts-admin/).
- The parent encrypted transaction now performs this check before preparing any recovery files or dry-run Secret writes, and refreshes the signing keys before Apply, continuation and final readback. `rancher-recovery-session.mjs` delegates the fixed cluster JWKS read through the authenticated caller and only when the installed bridge credential is authorized. A revoked/unavailable signing key prevents dependent-system and Secret changes. Tests use actually signed synthetic fixtures.
- Live read-only verification confirms both the current bridge token and the token in the retained encrypted native backup are signed by the published cluster key and bind to the current account; saved/live values match and a malformed token is rejected. No token, key or complete JWT claims were emitted. Evidence: `.local/manager-installation/dns-bridge-token-signature-tests.json`. This run used the existing strict-TLS local Kubernetes proxy; the new delegated JWKS method still needs native endpoint integration acceptance.
- Added compact JWE envelopes for the future independent Windows channel: `windows-recovery-envelope.mjs` encrypts in Node, and `windows-recovery-envelope.ps1` decrypts on Windows. The fixed suite is RSA-OAEP-256 with A256CBC-HS512 following [JWE](https://www.rfc-editor.org/rfc/rfc7516) and [JWA](https://www.rfc-editor.org/rfc/rfc7518). The recipient uses an ephemeral 3072-bit CNG RSA key whose private material is persisted only through machine-bound DPAPI in a private directory. A pinned public-key thumbprint selects the recipient. HMAC verification precedes CBC decryption; errors are generic. Requests bind transaction/request IDs, caller ID, cluster/account UIDs, a supported action and a validity interval of at most ten minutes. Secret configuration is permitted only in prepare messages.
- Thirteen actual Node-to-Domain02 PowerShell 5.1 cases pass: prepare/commit/reconcile/status decoding, tampered wrapped key/IV/ciphertext/tag rejection, foreign cluster/account/recipient rejection, expiration and algorithm downgrade rejection. Reloading the protected private key preserves its thumbprint and encrypted file. No private key material was returned to Node, no credential plaintext appears in the envelopes, and the exact owned remote key/fixture directory was removed. These are encryption interoperability tests, not a running recovery-agent/polling test. Evidence/source hashes: `windows-recovery-envelope-owned.json`.
- JWE encryption and integrity do not authenticate the publisher: anyone holding the public key can construct an envelope. The real queue must therefore restrict publishers, verify the actual Rancher caller before staging, preserve reviewed source identities and serialize agent work. No new recovery ServiceAccount, queue, persistent agent or production endpoint has been installed yet. Independent polling, pre-write candidate validation on the agent, bridge quiescence, full dependency/transaction composition and native Rancher Apply remain required.
- All 114 management/fresh-source/canonical-record/envelope/token checks pass. The 17 updated encrypted-transaction scenarios also pass on isolated Linux without network access. Both DNS preservation checks pass after live token verification, and both manager indices retain their expected totals (68 DNS, 105 Network). The installed controller and manager versions remain unchanged; production passwords/tokens and DNS/DHCP/public cutover settings were not changed. The full goal remains active with the other previously listed acceptance gates open.

## Independent recovery queue, durable Windows acknowledgements and activation continuation — October 13, 2026

- Fixed the parent recovery continuation gap after partial dependency activation. Reconciliation can now expose `ReadyToContinue` only when the coordinator explicitly attests that all uncertain component intents have been resolved and its next commit resumes pending work without replay. Fresh Secret/account/signature checks remain mandatory. Confirmed Secret writes and dependency preparation are skipped; unresolved writes, missing coordinator evidence and foreign values still block continuation. Final reconciled activation is recorded as Confirmed. Nineteen encrypted-transaction scenarios pass on both Windows Node and an isolated non-root Linux runtime.
- Added `windows-recovery-channel.mjs`: it verifies the actual Rancher caller's bridge-recovery permissions before staging or publishing, persists only an encrypted envelope and sanitized request metadata, pins the request Secret and receipt ConfigMap UIDs, uses reviewed resource-version replacement, preserves an occupied queue until the agent acknowledges its exact envelope, and correlates the digest/action/caller/transaction/request/cluster/account identities. A lost write reply is reconciled by readback; an unconfirmed submission is never repeated. Ten new tests cover authorization, expiration, duplicate calls, receipt forgery/mismatch, foreign resource identities, queue occupancy and accepted/unaccepted lost responses.
- Added `windows-recovery-channel.ps1` for trusted agent request processing. A private durable owner binds each transaction to its original caller and installed identities. Request intent is persisted before local action, and duplicate or interrupted requests cannot replay it. An exact known ciphertext can return its durable acknowledgement after expiry; an expired new request cannot execute. Commit/reconcile require an independently confirmed current Kubernetes Secret target and real candidate authentication providers. The module takes exclusive agent and bridge file locks and retains sanitized request receipts; encryption does not grant publisher authorization.
- The local bridge source now holds the same `bridge-mutation.lock` around its entire iteration and checks `credential-recovery-active.json` before queued DNS work and direct job entry. This source change has not been deployed to the installed bridge yet. Eleven actual Domain02 PowerShell 5.1 acceptance groups pass, including a lost authenticated local commit reply, helper reload/reconciliation with exactly one credential-file write and unchanged timestamp, rejected candidate authentication, foreign caller reuse, crash after durable request intent, expired duplicate acknowledgement, bridge entry-point pauses and a separate PowerShell process holding the shared lock. These tests use synthetic configuration and injected trusted providers; they do not prove a running independent API polling agent. Exact owned private key/fixture directories were removed. Receipt/source hashes: `.local/manager-installation/windows-recovery-channel-owned.json`.
- Added the bootstrap manifest `dns-windows-recovery-channel.yaml`. The independent agent reads only the named request/bridge Secrets, bridge/agent accounts and queue/inventory/receipt ConfigMaps; it updates only the receipt. The snapshot publisher reads/updates only the named request and reads only the receipt. Neither role grants list/create/delete/patch or arbitrary Secret writes. In an owned isolated live namespace, short-lived actual agent/publisher tokens passed identity/UID/strict-TLS checks and 26 API permission checks. Actual encrypted queue write/read, receipt write/read and denied cross-role writes also pass. The installed ordinary bridge is denied access to the production channel names. This follows Kubernetes [named-resource RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/). The fixture namespace was deleted with an exact UID precondition and confirmed absent. The first fixture failed while parsing kubectl's multi-object JSON before installing roles; its owned namespace was confirmed absent before an archived receipt and fresh run. Evidence: `windows-recovery-channel-rbac-owned.json`.
- The production recovery ServiceAccount/token, request Secret, receipt ConfigMap and persistent Windows agent have not been installed. The manifest's separate legacy token needs trusted bootstrap and private installation; losing both polling credentials or the host's DPAPI key still requires trusted operator recovery. Remaining work includes the real independent polling providers and pinned bootstrap, deployed bridge guard, fresh controller confirmation, full coordinator composition, backend/UI endpoints and native Rancher Apply acceptance. The full goal and previously recorded physical/client/public/external-service gates remain open.
- The production JWE authentication helper also matches the independent [RFC 7518 Appendix B.3 vector](https://www.rfc-editor.org/rfc/rfc7518#appendix-B.3), including the expected ciphertext and truncated authentication tag. The fresh health checkpoint at 01:34 UTC confirms 19 Ready nodes, 20 Ready certificates, healthy workload/PVC/attached-volume checks and 19 reachable ingress endpoints (18 strict TLS). DNS state, credential values and original snapshots remain preserved (68 DNS, 105 Network). No production credential rotation or DNS/DHCP/public cutover was performed in these tests.
- All 131 management, fresh DNS/network source, canonical record, token, envelope and channel checks pass; the complete management directory alone contains 115. The 19 Linux transaction checks pass after the final receipt-confirmation fix. Combined read-only checkpoint: `.local/manager-installation/independent-recovery-channel-checkpoint.json`.

## Live independent Windows API recovery and deployed bridge guard — October 13, 2026

- Added `windows-recovery-agent-api.ps1`. Private bootstrap settings pin the cluster, bridge/agent service-account UIDs, request/receipt object UIDs, CA and installed guard digest. Each iteration authenticates the independent agent with a real SelfSubjectReview before reading its fixed queue. Providers check the live bridge account, guarded inventory and queue, record a private Secret UID/data-digest baseline, and confirm the current Secret's exact type/account/CA/namespace/token against the encrypted target before commit or reconciliation. A changed value requires the original transaction marker; unchanged values require the reviewed UID/data baseline. Candidate and final file readback authenticate the actual bridge identity/UID/groups and access both named management ConfigMaps. Applied status performs fresh Secret and credential authentication instead of trusting a historical receipt.
- A valid encrypted request that expired during an outage is now acknowledged as Rejected/Unavailable without creating an owner/lease or executing an action. This allows a protected publisher to proceed with a fresh request. Normal envelope decryption still rejects expiration by default; only the agent's acknowledgement path permits decrypting an expired message after cryptographic, identity, shape and lifetime checks. Known exact completed/interrupted requests retain their previous durable acknowledgements and never replay an action.
- Added production entry script `windows-recovery-agent.ps1`: it restricts the installed namespace and private roots, holds an exclusive poller lock for its lifetime, writes sanitized local health and jitters polling to avoid repeatedly colliding with the bridge's five-second iteration. It has not been registered or started as a production task yet. Startup/source parsing passes; its API/request-processing helpers have the live acceptance below. No independent production token, queue or recipient key has been installed.
- Nine live acceptance checkpoints pass in an exact owned namespace and private Domain02 shadow directories. The ordinary shadow bridge kubeconfig deliberately held an invalid token while the separately authenticated agent read its queue through strict TLS. The actual Windows helper acknowledged an expired encrypted request, staged DPAPI-protected recovery, replaced the shadow credential once and authenticated the real fixture bridge service account. A fresh PowerShell run returned the saved expired duplicate acknowledgement without a write or timestamp change. Fresh Applied status rejected an altered live fixture Secret, then authenticated again after its original values were restored. A second transaction restored a missing shadow kubeconfig. All receipt identities/digests were read back through the real publisher role. Fixture tokens were confined to memory and private remote kubeconfigs; no production credential was changed. The exact namespace and Windows directory were removed, and installed bridge files plus its running task were verified preserved. Evidence/source hashes: `.local/manager-installation/windows-recovery-agent-live-owned.json`. The fixture's guard inventory was supplied explicitly; this test verifies real API providers, not a production polling task or native Rancher Restore.
- The first acceptance launcher used Windows PowerShell's restricted local script policy and failed before initializing a remote directory. Its owned namespace was deleted and remote directory absence was independently confirmed. The corrected launcher uses the existing bundled PowerShell runtime; no machine execution policy was changed. Failed receipt was archived before a new owned fixture.
- Deployed the tested bridge guard to Domain02 using `deploy-windows-bridge-recovery-guard.ps1`. Compared installed/proposed source first: the only changes were the shared lock/lease gates and runtime source-digest attestation. The rollout checks a quiescent queue and private ACL, retains an exact rollback copy, preserves configuration/kubeconfig hashes, stages reviewed bytes and atomically replaces the script. The first attempt stopped before replacement because task cessation was unconfirmed; the original source was independently verified running. The corrected handoff temporarily disables recurring triggers, stops and verifies exact Task Scheduler instances, then restores task enablement and starts the guard. Fresh post-start inventory attests version 1 and source digest `9974e66984331e432868ec53fe812727ae0394ad3fd54fcce642bb8478e962b7`. A separate check confirms one bridge process, enabled task and fresh heartbeat. Queue UID/entry IDs and credential/configuration hashes remain preserved. Private rollback copies remain. Receipt: `.local/manager-installation/windows-bridge-recovery-guard-owned.json`.
- Automatic approval review rejected removal of the unused failed-attempt staging script, stating only `blocked by policy`. The rejected command did not run; no alternate cleanup method was attempted. The staged code file remains private and unused. This does not block trusted agent bootstrap or native integration work.
- Post-rollout DNS credential/record/snapshot preservation checks and all 131 management/fresh-source/canonical/token/envelope/channel checks pass. Inventory delegation-shape tests and complete seven-record-type recovery preflight plus thirteen rejection cases pass. The fresh cluster check retains 19 Ready nodes, 20 Ready certificates, healthy workload/PVC/attached-volume checks and reachable ingress endpoints. The full goal remains active. Next required work is trusted production agent/channel bootstrap, then coordinator/controller confirmation and native Rancher Restore integration; source lifecycle and previously recorded physical/client/public/external-service gates remain open.

## Production independent recovery bootstrap, fresh controller proof and caller-scoped capture — October 13, 2026

- Installed the independent production recovery channel and Windows task using `deploy-windows-recovery-channel.mjs` and `install-windows-recovery-agent.ps1`. Eleven new resources supply the separate agent identity, named encrypted request/agent-only receipt, narrow publisher permissions and immutable public bootstrap. Domain02 stores the independent kubeconfig, machine-DPAPI recipient key and reviewed helper files under a protected SYSTEM/Administrators directory. The registered SYSTEM task holds an exclusive poller lock and reports fresh reachable health. Installation preserves the ordinary bridge configuration and credential-file hashes. Receipt: `.local/manager-installation/windows-recovery-channel-installation.json`. No existing production credential was rotated.
- `windows-recovery-bootstrap.mjs` requires the immutable bootstrap's explicit UID and content digest before accepting its pinned recipient/account/queue identities. Its dedicated strict-TLS transport reloads mounted trust/token files and permits only the three fixed reads and named request replacement. Six tests cover recreation, digest/schema/key changes, fresh trust, unsupported access and error redaction. Installation bootstrap UID: `363856b7-e047-4e49-8087-6806a4d19409`; SHA-256: `ff04e65f2f1a254b681e515aeb59fbdf3a57d3e4d1fbd3a2c20d031441759a0c`.
- The actual registered production poller acknowledged one exact expired encrypted request as Rejected/Unavailable. Publication used the real backend ServiceAccount and verified TLS, object pins and recipient key. The exact owned envelope was cleared after correlated readback; its agent-only acknowledgement remains. No owner lease or credential-file write was created, and both bridge files plus all installed helper digests were preserved. Evidence: `windows-recovery-production-poller-owned.json`. This production probe deliberately did not impersonate a Rancher caller or attempt native Restore.
- Fixed channel authorization so it uses a separate fresh Rancher session capability instead of replacing the parent transaction's selected permissions/create grant. The parent can continue its already authorized engine and missing-Secret work after channel authorization. Missing delegated authorization has no backend-identity fallback. Session/channel regressions pass. The newest session accessor and recovery components remain local until the full recovery runtime is integrated.
- DNS controller generation 7 is Ready with `dns-controller-credential-proof.mjs`. Each replica now authenticates freshly from the mounted password, separately from cached inventory sessions, and emits only positive identity/timestamp evidence. Completion checks require three distinct reachable replicas and recent evidence after activation. The rollout preserves the controller UID, image, RBAC, volumes and other deployment settings. All three installed engines pass fresh authentication. Evidence: `dns-controller-credential-proof-owned.json`. Cached inventory alone can no longer serve as credential-consumption proof.
- Fixed the engine continuation case where all password changes were confirmed but controller confirmation was delayed. Reconciliation exposes ReadyToContinue only after fresh target authentication resolves every engine intent; subsequent commit performs confirmation without repeating password changes. The new regression includes repeated controller delay and restart, retaining exactly three original mutations in the isolated fixture.
- Found and fixed a manual Secret-capture authorization gap: the backend previously used its named Secret read permissions without verifying the Rancher caller's Secret permissions. `rancher-dns-capture.mjs` verifies the actual caller with SelfSubjectReview, checks the three named read permissions and delegates every live Secret/ServiceAccount read through that caller's Rancher cookie. Candidate-token authentication and inventory remain separate backend operations. Denied reads, revoked access between review/read, anonymous/service-account callers and malformed sessions cannot fall back to the mounted backend identity. Cookies and CSRF values are neither logged nor persisted. New/revised protected schedule scope is also reviewed before its saved delegation is accepted; existing unreviewed protected schedules cannot run silently. Scheduled-capture lifecycle acceptance remains to be repeated against the integrated runtime.
- DNS snapshot runtime 2026.10.13-17 is Ready, manifest digest `ea823a6723ed0969dbf50702ed0611aa6758d61618d5d08c1a287e8c73eeb34f`, linux/amd64 digest `f46dfc5036ac782bc46fbe9306022cf89c54221b69c25c2ecab7ad15dce503d0`. Harbor Trivy 0.72 reports zero vulnerabilities. Its image-only rollout preserves the StatefulSet UID, other settings, volume and all 68 original backup IDs. Four actual production capture entry points reject a missing Rancher session with 403 and preserve the index/schedule; evidence: `dns-capture-authorization-17-tests.json`.
- The browser session expired and its old saved password was rejected. The user renewed sign-in in a new in-app browser tab; no account credential was reset. Native Rancher Include Secrets then successfully created one encrypted eight-item backup. Wrong-key decryption fails, correct-key recovery matches both current credentials and the actual bridge account binding, and the index is redacted. The verified test ZIP was retained privately before only that owned test archive was removed from the active index. All 68 original backups, DNS serials/records, credential values/UIDs, navigation and zero DNS drafts remain preserved. Evidence: `dns-credential-binding-17-owned.json`, retained `dns-credential-binding-17-native.zip`, and `rancher-dns-authorized-capture-17.png`. Native DNS returns to 68 backups with 8/8 coverage; Network Manager shows 355/355 coverage and 42 observed routes. Screenshots: `rancher-dns-recovery-checkpoint-17.png` and `rancher-network-checkpoint-17.png`.
- Added the local higher-level `windows-credential-recovery.mjs`. It builds only the installed fixed bridge kubeconfig from the reviewed Secret, binds each transaction to caller/cluster/account/target, persists sanitized request progress and uses the encrypted channel for sensitive staging. It resolves original uncertain publications before proceeding, never resubmits an unresolved write, permits a fresh request only after an expired rejection or proven unpublished expiration, and performs a new status request for completion health. Prepared status can confirm staging before the parent replaces the Secret; only a fresh local Prepared result can permit a failed commit to resume. Foreign/unresolved local state remains incomplete. Nine regressions cover these boundaries, including accepted/unaccepted lost replies, restart, unchanged duplicate commit and no plaintext in progress files. These tests use injected channel/agent state; the higher-level RPC has not been deployed or accepted against the production Windows agent yet.
- All 158 management/fresh-source/canonical-record checks pass. The 47 parent/engine/Windows RPC/channel transaction checks also pass on isolated, non-root, read-only Linux with no network access. Existing encrypted snapshot-server regressions pass for both managers. The fresh 02:52 UTC health checkpoint confirms 19 Ready nodes, 20 Ready certificates, healthy inspected workloads/PVCs/attached Longhorn volumes and 19 reachable ingress endpoints, including 18 verified HTTPS connections. A further read-only checkpoint confirms the running pinned Windows poller, fresh health, no lease, empty queue, preserved bridge file hashes, controller generation 7 with three fresh credential proofs, and 68 DNS/105 Network backups. Evidence: `production-recovery-bootstrap-checkpoint.json`.
- Full native credential Restore is still incomplete. Next work is composing the parent, engine and Windows transactions with current Secret/controller verification, integrating backend/UI recovery endpoints, and testing the complete unchanged/missing/changed/interrupted scenarios through Rancher without rotating existing production credentials. Source lifecycle and previously listed physical failure, AD client/DHCP, public ACME/DNS and external-service gates remain open. DNS/DHCP/public cutover has not occurred; the full goal remains active.


## Composed caller-scoped recovery and native credential Restore - October 13, 2026

- Deployed the parent/engine/Windows coordinator, installed-runtime factory and four caller-scoped Rancher recovery actions. Preparation authenticates selected dependencies before Secret mutation, retains encrypted before/target data and records component intents before submissions. Actual Secret writes use the verified Rancher caller, named authorization, admission and reviewed CAS identities. The mounted backend identity only reads installed bootstrap and publishes encrypted Windows requests; it cannot substitute for missing caller write permission. Activation requires current target Secrets, three fresh controller mounted-password proofs after activation and independent Windows authentication. Original uncertain/foreign outcomes retain their lease and request. Nine composed tests, six API tests and three installed-runtime tests pass; composed external transports are injected and do not establish complete live changed/missing acceptance.
- Fixed two actual signing-key lookup failures: Rancher's discovery proxy returned HTML, and Kubernetes rejected Accept: application/json for JWKS. A fixed strict-TLS GET now uses application/jwk-set+json and mounted cluster trust, after the caller bridge grant. It exposes no caller-selected endpoint or Secret/write transport. Three tests pass. Caller cookies and backup keys are not persisted or logged.
- DNS snapshot runtime 2026.10.13-22 is Ready at StatefulSet generation 21. Manifest digest: bf9cebc7545034acfc3c070870e720de5f5880edbc37cf41b4feeeafb72b4764; linux/amd64: c0444da598edbb16fdb56eff2b852e927b76bce6978bd9f9cfa06e0f7a1ec017. Harbor Trivy 0.72 reports zero vulnerabilities. Its image-only rollout preserves the StatefulSet identity, other spec fields, PVC and all 68 original DNS backups. It extends the installed Windows acknowledgement wait from twenty to sixty seconds while retaining expiry checks, the exact original request and mandatory reconciliation after timeout. The delayed acknowledgement test confirms one original publication without another preparation or write. Runtime 21 supplied the first native acceptance below; runtime 22 follow-up is recorded separately.
- The first actual unchanged caller-API restore completed Applied after original status readback recovered a lost browser reply. Kubernetes Secrets remained unchanged. Independent Windows inspection exposed one unnecessary credential-file rewrite caused solely by JSON property order: token, CA, endpoint, TLS name and context values were preserved. The receipt now honestly records one formatting-only Windows file write. The helper compares fixed canonical fields and preserves exact original bytes for semantically identical configuration. Nine real Domain02 PowerShell checks pass, including nested reordering and exact bytes. Its atomic code rollout preserves ordinary bridge source/configuration and credential hashes. A second actual caller-API restore completed Applied after original reconciliation, with independently verified zero Windows file writes. Evidence: rancher-credential-restore-18-owned.json, windows-restore-formatting-observation.json, windows-dns-credential-recovery-remote-canonical-owned.json, windows-recovery-canonical-helper-owned.json and rancher-credential-restore-canonical-owned.json.
- DNS Manager 0.1.23 is cached and Ready through Helm revision 24. Its immutable package was added to the existing two-replica asset host, preserving the DNS 22, Network 25 and Common UI 1.0.2 bundle digests. Native credential restoration remains separate from configuration drafts, requires fresh encrypted-backup unlock and explicit reviewed confirmation, and persists only sanitized original transaction metadata. Reload keeps the original ID and resets confirmation. Interrupted outcomes expose Status/Reconcile; Continue requires authoritative ReadyToContinue evidence. Cross-tab operation changes, revoked permissions, invalid replies, unwritable journals and uncertain replay fail closed. Leaving the password dialog cancels and clears it. All 96 interface checks, six DNS snapshot checks and the extension build pass; the build retains three known bundle-size warnings.
- Full native unchanged-credential recovery passed with snapshot 737d3512-094e-4742-b370-dbaab8c9c216 and transaction 004adce4-c781-45bb-83ae-2f6944f92c5a. Native Cancel submitted no review. Wrong-key rejection retained the original review ID, which the correct key then unlocked. Reload preserved review, reset confirmation and locked selection. Apply was submitted once and showed Interrupted after delayed Windows preparation. Native Reconcile established ReadyToContinue, and explicit Continue completed only pending steps of the original operation. Rancher displayed Applied with dependencies confirmed. Independent caller status, Secret UID/revision/value hashes, exact agent acknowledgement and Windows inspection prove zero Secret writes, zero Windows file writes, exact original bytes, fresh healthy agent/no lease, preserved navigation/zero DNS drafts and all 68 original backups. Only the exact terminal owned envelope was cleared after correlated readback. Evidence: rancher-credential-restore-ui-owned.json and rancher-dns-credential-review-23.png / rancher-dns-credential-interrupted-23.png / rancher-dns-credential-applied-23.png.
- The management/fresh-source command passes 179 checks and the separate canonical record-identity check passes, totaling 180 across those commands. The isolated non-root, read-only Linux recovery suite passes 69 with no network. The fresh health check reports 19 Ready nodes, 20 Ready certificates, healthy inspected workloads/PVCs/attached volumes, and 19 reachable ingress endpoints including 18 strict HTTPS connections. Reachability is not full endpoint-specific authenticated application acceptance.
- Automatic approval review rejected a diagnostic command to relay a temporarily exported Rancher cookie into the snapshot pod, stating only blocked by policy. That command did not run. The unused private cookie file was removed and in-memory bindings cleared. Diagnosis continued through sanitized server-stage metadata; the cookie was not relayed by another route.
- The complete goal remains active. Full native changed/missing credential restoration and complete isolated composed live acceptance remain unverified; existing production credential values have not been rotated. Source lifecycle, interrupted zone creation, abrupt infrastructure failures, real AD client DNS/DHCP/search-suffix behavior, public ACME/DNS, and previously recorded physical/vendor/external-service gates remain open. DNS/DHCP/public cutover has not occurred.


- Runtime 22 follow-up native transaction 4fe7c5fe-5b9c-47c8-8739-78b4b0609a74 completed directly through Review/Confirm/Apply in 53.931 seconds, with no reconciliation or continuation needed. The caller's original status independently reports Applied with both dependencies confirmed. Secret UID/revision/data hashes, all original backup IDs, navigation and exact Windows file/source hashes are preserved; Secret writes and Windows credential-file writes both remain zero. The running agent is fresh and healthy without a lease, and the exact terminal owned request was cleared. Evidence: rancher-credential-restore-ui22-owned.json and rancher-dns-credential-applied-runtime22.png. The updated production-recovery-bootstrap-checkpoint.json records runtime 22, both native restore paths, 68 DNS/105 Network backups, three fresh controller credential proofs, an empty channel and the fresh 04:31 UTC service-health result. This closes unchanged native recovery and the observed response-window defect; the separately listed changed/missing and broader goal gates remain open.

- Post-rollout native Network Manager 0.1.25 again shows 42 observed routes, Snapshot Ready and 355/355 known configuration items covered. Its two existing drafts and published configuration were not applied or edited by this checkpoint. Screenshot: rancher-network-checkpoint-after-dns23.png. The temporary checkpoint tab was closed, and the authenticated Rancher DNS restore tab was retained for continued goal work.


## Unsaved source connection testing through native Rancher - October 13, 2026

- The old Test Connection read only cached installed observations and rejected any entered endpoint differing from the installed source. Added a caller-scoped read-only source-test API and wired the native editor to send its actual unsaved name, hostname, address and credential reference. SelfSubjectReview identifies the actual Rancher user, named read grants authorize both observation ConfigMaps, and every read is delegated through that caller. Access revocation, replacement or changed installed binding during testing prevents positive evidence. No Secret reads, source writes, DNS jobs or DNS updates are needed. The actual deployed route rejects a missing Rancher session with 403; it has no mounted-identity fallback.
- Added bounded UDP SOA and TCP AXFR protocol probes. A complete transfer requires the original transaction/question, a first apex SOA, matching terminating SOA, apex nameserver data, only in-zone answers and complete message framing. Truncation, refusal, changed serials, empty NoError replies, early disconnects, compression cycles, malformed lengths, byte/record limits and deadlines cannot be called verified. Packet fragments and multiple TCP messages are supported. Entered endpoints must be literal private IPv4 or ULA IPv6 addresses; hostnames and AD zone names are validated separately. The implementation follows [RFC 5936](https://www.rfc-editor.org/info/rfc5936/), including its distinct completion requirements. Zone contents stay in the bounded probe and are not returned or saved as test results.
- Actual read-only probes from the installed snapshot backend confirmed all four Windows zones: cormierconsulting.com (93 record responses, serial 754), cormierconsulting.io (47, serial 287), _msdcs.cormierconsulting.com (13, serial 158) and 99.10.in-addr.arpa (47, serial 196). Each UDP SOA and complete TCP transfer matched. The AD underscore-name rejection discovered in the first run was fixed while controller hostnames retain their stricter validation. Existing Windows TransferToSecureServers restrictions remain unchanged. Evidence and source digest: installed-dns-source-wire-tests.json.
- The preliminary Technitium DNS Client API diagnostic returned NoError with an empty Answer for AXFR despite a nonempty datagram size. It is not used as proof of transfer completeness. The new raw probes independently verify the actual transfer. The vendor API's behavior remains an observation to investigate separately; no engine password or vendor binary was changed by this source-test work. API request semantics were checked against the [versioned Technitium 15.6.1 documentation](https://github.com/TechnitiumSoftware/DnsServer/blob/v15.6.1/APIDOCS.md#resolve-query).
- DNS Manager 0.1.24 is cached and Ready through Helm revision 25. Its immutable package was added to the existing two-replica asset host, preserving the prior DNS 23, Network 25 and Common UI 1.0.2 bundle digests. Snapshot runtime 2026.10.13-23 is Ready at StatefulSet generation 22, preserving the StatefulSet identity/spec except image, PVC, bootstrap pins and all 68 original backup IDs. Image manifest: 93a6a5087c43819daff9334c6e7909b1ae5386c51f1e4c9f446f6f1d9d7e01b9; linux/amd64: 1507db378d2ca1f29b74f542760cef6ee8449e63953183efa17588239780e2ed. Harbor Trivy 0.72 reports zero vulnerabilities.
- Native Rancher verified the installed Domain02 address and credential binding, with separate Verified UDP DNS / complete TCP transfer evidence and fresh installed Windows bridge binding. An unsaved unknown credential reference still passed DNS/transfer but correctly left Windows management Not verified. An unsaved 10.99.3.1 address failed both DNS and transfer rather than reusing installed evidence. Editing invalidated the previous result; pending edit-and-revert replies, duplicate clicks, stale/foreign/inconsistent result data and route-unmount replies are also rejected in interface tests. Returning fields to the installed values passed again; Cancel / Discard Changes returned to the original source row without saving a draft. Screenshots: rancher-dns-source-connected-24.png, rancher-dns-source-unsaved-address-24.png and rancher-dns-source-connected-final-24.png.
- Independent before/after inspection preserves source configuration, all four Windows zone record sets/serials/TTLs, both credential Secret UIDs/revisions/data hashes, DNS queue UID/content, empty recovery channel, navigation, zero DNS drafts, 68 original DNS and 105 Network snapshot IDs. The browser's source observation cache refreshed its live heartbeat: its whole-object hash legitimately changed. That original hash is retained, and the verifier separately requires all cached configuration fields to match the original installed source rather than treating observation timestamps as configuration edits. Evidence: native-dns-source-test-24-owned.json. No credentials, DNS records, source configuration, resolver or DHCP settings were changed.
- Active Directory enumeration currently lists only enabled Domain02 at 10.99.3.2. The 10.99.3.1 DNS address remains unavailable in these direct probes and cannot serve as verified fallback evidence. This has not triggered DNS/DHCP cutover or an assumption that a second DC should be created; source/fallback/infrastructure verification remains pending.
- All 199 management/fresh-source/data-adapter/canonical-record checks, 86 isolated non-root/read-only Linux checks and 101 interface checks pass. Both managers' encrypted snapshot-server tests pass. The extension build passes with the three known bundle-size warnings. The 05:05 UTC health check retains 19 Ready nodes, 20 Ready certificates, healthy inspected workloads/PVCs/attached volumes, and 19 reachable ingress endpoints including 18 strict HTTPS connections. Full source creation/edit/delete, source-qualified multi-source inventory, native changed/missing credential recovery, protected schedule lifecycle, physical/client/public-DNS and other recorded goal gates remain open. The overall goal is active.

- Visual inspection found the initial native result spans running together because they used obsolete local banner classes. DNS Manager 0.1.25 (Helm revision 26, cached/Ready) uses the installed Common UI success/warning/error banners and semantic status/alert roles. The changed source/standards subset passes 54 tests; the extension build passes with the same three size warnings. Real native geometry confirms seven separate evidence rows; valid installed settings render success, while the unknown reference renders warning with Windows management unverified. The exact original source row was restored by Cancel / Discard Changes. Screenshots: rancher-dns-source-connected-25.png and rancher-dns-source-warning-25.png. Both asset replicas are Ready and prior DNS 24 / Network 25 / Common UI 1.0.2 bundles are preserved. Source testing and independent preservation remain passed; source lifecycle is still pending.
- A transient read-only Windows checkpoint inspection failed once without returning a confirmed result. A subsequent direct inspection and fresh checkpoint both confirm the running exclusive agent, healthy heartbeat, no lease and preserved credential/configuration/helper hashes. No task or service was restarted for this observation failure. The original caller-scoped runtime-22 recovery receipt remains readable as Applied with dependency confirmation through runtime 23: source-test-25-recovery-retention.json.

## Registered source catalog and independent activation evidence - October 13, 2026

- Added an immutable registry of installed Windows bridge identities and a separate mutable source catalog. A source draft may select only a registered binding whose hostname, literal private address and credential reference match. Observation/queue/service-account UIDs and bridge code digests are registered separately; editable settings and restored backups cannot supply API paths, accounts, namespaces, credentials or executable settings. Local source transactions require caller authorization, a durable backup, fresh dependency/connection evidence, admission and exact reviewed catalog state. An uncertain accepted submission retains its original marker and lease; reconciliation reads it without replaying the catalog write. These transaction and caller-session modules are tested locally; their installed backend endpoints and native CRUD UI are not implemented yet.
- The source observer verifies catalog/registry pins, immutable registry bytes, independently published Windows host/code/heartbeat identity and actual authoritative UDP SOA serials. It rereads management inventory after probes and rereads the catalog/registry before publishing evidence. Stale/future observations, replaced agents, differing records/serials, concurrent source edits and unavailable channels cannot confirm activation. Zones and records have source-qualified identities, so identical zone names from separate sources remain distinct. Additional observation sources are unpublished; only the pinned existing primary source owns the currently published replicas. This does not establish multi-source publication or credential recovery for additional sources.
- All six proposed resources passed admission again before installation. Installed the registry, revision-zero catalog and named get-only controller/snapshot reader roles/bindings, then deployed the evidence producer at controller generation 8. The existing controller UID, image, mounts, credentials, native replica endpoints and other deployment settings are preserved. Fresh controller evidence confirms one registered source, four qualified zones, matching Windows/DNS serials and three independently authenticated mounted-password replica identities. Windows record sets/TTLs/serials, replica ownership and DNS queue UID/resourceVersion/content match the pre-rollout baseline. The source catalog remains revision zero. Exact resource ownership, write intents, rollback configurations, source hashes and independent readback are retained in dns-source-observer-owned.json; the rollout never submitted a Windows DNS or credential mutation.
- Ten live SubjectAccessReview checks confirm the controller can read the two named source resources, and the snapshot service can read the named registry. Both are denied catalog/registry update; snapshot catalog patch/delete and controller reads of an unregistered observation name are denied. Actual catalog changes must remain delegated to the authorized Rancher caller. Kubernetes admission dry runs and resourceVersion conflict detection follow the [official API conventions](https://kubernetes.io/docs/reference/using-api/api-concepts/). Evidence: dns-source-reader-rbac.json.
- The management/fresh DNS/data-adapter command passes 223 checks; the separate fresh Network/canonical record-order command passes nine, totaling 232 across those commands. The non-root, read-only Linux suite with network disabled passes 117, including actual Unix private-directory and symlink rejection checks. Source observation scenarios include same-named zones on distinct sources, bridge identity replacement, code/host mismatch, offline sources, refused/non-authoritative DNS, changed serials/records, concurrent catalog/registry edits, probe deadlines and empty-catalog consumption. No claim of full native source lifecycle acceptance is made from these injected fixtures.
- After rollout, Rancher's installed 0.1.25 native Test Connection verifies the original Domain02 settings: authoritative UDP DNS, complete TCP AXFR with 93 record responses, and the installed Windows management binding. Cancel returns to the unchanged source row without a draft. Evidence: native-dns-source-observer-proof.json and native-dns-source-observer-connected.png. The 06:18 UTC health check confirms 19 Ready nodes, 20 Ready certificates, healthy inspected workloads/PVCs/attached volumes and 19 reachable ingress endpoints, 18 with strict TLS. Endpoint reachability remains distinct from complete authenticated application acceptance. The renewed recovery checkpoint confirms the healthy independent Windows poller, preserved file hashes, no lease, empty channel, controller generation 8 and all 68 DNS/105 Network backups.
- The full goal remains active. Next required work is installed caller-scoped source transaction endpoints, fresh source-catalog backup/restore capture, native source create/edit/delete/restore and an owned independent source fixture. Multi-source publication, native changed/missing credential restoration, protected scheduling, interrupted zone creation and the previously documented physical/client/public-DNS/external-service gates remain open. DNS/DHCP/public cutover is still pending; no user intervention is currently required for this implementation work.

## Caller-scoped source API and recoverable catalog backup foundation - October 13, 2026

- Added local API actions for fresh source-catalog backup, Prepare, Status, Apply and Reconcile. Real Rancher SelfSubjectReview supplies the caller; request bodies cannot provide a user, account, API path, registry pin or credential value. Registered settings and proposal shape are validated before entering the installed transaction adapter. Response receipts retain only validated operation metadata/settings and suppress upstream error bodies, caller sessions and arbitrary receipt properties. Preparation remains idempotent without an extra live-state comparison that would reject an already completed original operation.
- Dedicated source-catalog capture contains the current applied source configuration, installed catalog/registry UIDs and registry digest, with no pending proposals, DNS mutations or credential values. Validation requires a recent server backup whose original catalog and registered identities match the current reviewed state. Foreign/recreated/stale/future archives, cached different catalog revisions and unrelated restored resources are rejected. The actual manager ZIP encoder/decoder round-trip preserves the complete catalog and pins and passes validation after decoding.
- Source backup capture requires caller read permission; it does not demand source update permission. A session authorized for read-only capture is explicitly unable to submit either admission or actual catalog writes. Failed reauthorization clears prior write capability. Other source actions continue requiring fresh get/update grants. The separately mounted registry reader accepts only a strict-TLS GET of the fixed immutable public registry, reloads current mounted trust, and cannot address catalog, queue, controller, arbitrary ConfigMap or Secret paths. The installed registry's actual UID/bytes/digest validate in a read-only administrative transport check; full mounted runtime use is not deployed yet.
- All 247 management, fresh DNS/Network, data-adapter and canonical-record checks pass in the current worktree. The isolated Linux suite passes 132 with networking disabled, a non-root identity and a read-only filesystem. New API/backup/reader checks cover anonymous/denied/service-account callers, cross-origin sessions, forbidden nested settings, read-only write attempts, expired or changed backup provenance, registry replacement, malformed declarations, interrupted original receipts and response redaction. API transaction callbacks and external transports in these fixtures are injected; these results do not prove native source CRUD acceptance.
- These new API/backup/registry-reader modules are local and are not wired into snapshot runtime 23 or the native 0.1.25 UI. Required next work is the installed transaction factory, caller-authorized dependency/proposal enumeration and controller readback, shared snapshot-volume quota accounting, server integration, an owned second bridge/source fixture, and complete native source create/edit/delete/restore acceptance. The deployed controller remains generation 8 with source catalog revision zero; this foundation work made no production DNS or credential changes. The full goal remains active with the previously recorded wider gates still open.

## Installed source transactions and real restart recovery - October 13, 2026

- Implemented the installed source-management factory, delegated controller/queue/proposal readers, registered-source SOA/complete-AXFR preflight, durable transaction store and shared snapshot-volume accounting. Prepare and Apply verify current dependencies; Apply also revalidates the original backup's continued existence, freshness and identity. Only this caller's exact selected source proposal is excluded from dependency checks. Other users' proposals, changed drafts, legacy unqualified proposals and uncertain DNS jobs remain blockers. Metadata-only ConfigMap enumeration discovers named DNS state without downloading unrelated extension packages, following [Kubernetes metadata-only fetches](https://kubernetes.io/docs/reference/using-api/api-concepts/#metadata-only-fetches). Actual Rancher enumeration returns 105 metadata objects and the one current DNS state; fixture tests reject denied listing, full-object fallback, changed state identities/revisions and partial results.
- Independent activation requires the installed controller's exact original operation marker, target catalog revision/fingerprint and current registered-source evidence. The caller rereads the current catalog after positive controller evidence; a foreign writer cannot turn an earlier observation into success. Lost accepted replies and unavailable activation retain their original lease and reconcile without catalog-write replay. A journal rejection before submission releases its lease only when the actual durable record still proves Prepared. Composed tests exercise the real API, source transactions/store and ZIP archives with injected external transports, including restart, lost reply, expired/deleted backup, revoked rights, shared quota depletion and foreign post-proof changes. DNS and Network encrypted snapshot-server regressions pass. The full management/fresh-source command passes 265 checks; the actual HTTP source-boundary/storage test passes separately. The current non-root, read-only, network-disabled Linux suite passes 151, including a new exact fsGroup-style widening/recovery case.
- DNS snapshot runtime 2026.10.13-24 is installed. Manifest digest: 6dbf47281960725830de2bd542c9dc1f9d92196cd45ee009aee6dbc6da5aeb92; linux/amd64: 73ddb0055415a5e1853480bc0c46a93e1e3f5b9667b9cbd1eb81d057e2145f63. Harbor Trivy 0.72 reports zero vulnerabilities. The rollout initially reaches StatefulSet generation 23 with the same UID/PVC/spec except image and four public catalog/registry/controller pins. All 68 original DNS archives remain. The mounted identity reads only the pinned public registry; real catalog mutations and all dependency/proposal reads remain caller-delegated. The installed source route rejects a missing Rancher session with 403. Build, scan and rollout evidence use the runtime-24 owned receipts.
- Through the signed-in Rancher caller, created a fresh source-catalog ZIP and prepared a metadata-only display-name update without changing the catalog. Original transaction 07d61b06-074a-40d5-96a7-b0497c4bb86d applies once and reaches independently confirmed Applied in 3.672 seconds. Rancher's source row displays the temporary validation name. A second fresh backup supports Restore transaction 6f7170b9-0023-49b1-8755-c608ae9fa499, which restores the original name/settings once and reaches Applied in 21.198 seconds. Catalog revision advances from 0 to 2, and source revision from 1 to 3; these audited metadata changes are recorded, not described as unchanged catalog bytes. Windows zones/records/TTLs/serials, both credential Secret UIDs/revisions/value hashes, queue UID/resourceVersion/content, replica ownership, navigation and zero DNS drafts are independently preserved. All 68 original DNS/105 Network backups remain; two owned source-catalog backups bring DNS archives to 70. Evidence: dns-source-api-live-owned.json and dns-source-api-native-24.json. This is real caller-API acceptance with native row readback; the source CRUD editor/Apply UI is not integrated yet.
- A real backend pod replacement exposes a recovery defect that injected restart tests could not prove: Kubernetes's default fsGroup processing widens the private directories to 2770 and journal files to 660. The strict private-store reader correctly refuses them with 503. The original records and catalog remain intact. Repaired only 39 owned objects beneath the exact source/credential recovery roots, using non-following file descriptors and before-content hashes, preserving all data. Installed fsGroupChangePolicy OnRootMismatch; this behavior follows the [official security-context documentation](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/). The workload reaches generation 24 with its image/identity/PVC/other spec fields preserved. Private directories read back as 700 and files as 600.
- A further exact-UID pod replacement under the repaired policy preserves these private modes and all 70 archive IDs. Both original source receipts are readable as Applied through the actual Rancher session. Repeating Apply on the already completed rename returns its historical receipt without changing current catalog resourceVersion/content or restoring the temporary name. The original credential-recovery transaction 4fe7c5fe-5b9c-47c8-8739-78b4b0609a74 also remains Applied through runtime 24 after these restarts. Receipts: dns-source-runtime-restart-24-owned.json, dns-snapshot-private-permissions-owned.json, dns-source-runtime-restart-24-private-owned.json and dns-source-storage-inspection.json. The first failed readback is preserved as a discovered and repaired defect, rather than counted as successful recovery.
- After restoring the original name, native Rancher again shows Windows DNS, management connected, four transferred zones and 8/8 legacy snapshot coverage. The temporary rename correctly made its legacy source item uncovered (7/8); source-catalog backups are currently a separate scope and stable source-aware UI identities/coverage still need integration. Screenshots: dns-source-api-renamed-24.png and dns-source-api-restored-24.png. The 08:05 UTC health check confirms 19 Ready nodes, 20 Ready certificates, healthy inspected workloads/PVCs/attached volumes and 19 reachable ingress endpoints, 18 with strict TLS. The renewed production recovery checkpoint confirms healthy/preserved Windows agent files, no lease, an empty recovery channel, three fresh controller credential proofs, catalog revision 2 and 70 DNS/105 Network backups.
- The full goal remains active. Required next work is the owned independent second source/bridge fixture, trusted immutable registry extension, native source create/edit/delete/restore controls and stable source-aware snapshot capture/coverage. Native changed/missing credential restoration, protected schedules and the previously recorded infrastructure, physical/client/public-DNS/external-service gates remain unverified. No Windows DNS, credential-value, resolver, DHCP or public cutover change was made by this source API acceptance.

## Native primary-source management - October 13, 2026

- DNS Manager 0.1.27 is installed through Helm revision 28 and UIPlugin generation 28, cached and Ready. The two asset replicas are Ready at Deployment generation 55. Immutable DNS 26, Network 25 and Common UI 1.0.2 bundles remain accessible with their original hashes. Version 26 first enabled the source editor and original-operation review; native inspection discovered that the Sources badge rendered an ID array instead of its count. Version 27 corrects that display, with an added UI assertion. Runtime 24 and the source controller remain unchanged by these UI rollouts.
- Registered source settings now stage typed proposals with stable source IDs and exact expected settings. Browser validators share a pure settings module instead of importing Node socket code. Preparation creates a server source-catalog backup and independently checks the registered bridge. Apply requires an unchecked-to-checked review confirmation and a fresh unchanged catalog/selection. The client persists its original intent in this caller's ConfigMap before each request. A global journal lock fixes lost references from simultaneous distinct reviews. Receipts must match the exact proposed operations and registered settings. Reload validates stored history; unknown replies require original Status/Reconcile and cannot submit Apply again. The adapter rejects changed proposals before Apply, preserves newer/unrelated drafts, reads back accepted lost persistence replies, and serializes completed-draft removal. Unvalidated registry/history disables source writes. Leaving during an in-flight backup prevents subsequent preparation; interrupted responses refresh process observations without losing their original ID.
- The full DNS UI suite passes 109 checks. The full management directory suite passes 257 with one Windows skip for the Linux private-permissions case (258 total). Eight new adapter scenarios cover lost preparation, Apply, journal and cleanup responses; changed proposals; denied admission; CAS conflicts; foreign/mutable identities; altered receipts; and simultaneous reviews. The extension build passes with the three existing bundle-size warnings. These injected transport checks are separate from the native acceptance below. The previous isolated Linux result of 151 remains retained evidence; this turn did not rebuild runtime 24 or rerun that container suite.
- In the real signed-in Rancher editor, the registered endpoint test verifies UDP SOA, a complete TCP transfer of 93 responses and installed Windows management binding. Native transaction 92a450f9-a33a-4eb6-b60a-0b5b7e4e000a updates only the primary source's display name. Preparation leaves catalog revision 2 unchanged, and Apply remains disabled until explicit confirmation. After controller confirmation, Rancher shows the temporary name, one source and four observed zones. Native transaction 7ef02639-4705-40e1-b2cb-a4f6a9733690 restores the original display name through a second reviewed Update. Both show Applied and Readback verified in Running Processes. This is native editor Update/restoration acceptance; it does not prove the separate catalog-snapshot Restore or Create/Delete flows.
- Catalog revision advances from 2 to 4, and source revision from 3 to 5. Independent before/after evidence confirms exact Windows zone/record/TTL/serial fingerprints, both credential Secret UIDs/revisions/value hashes, queue UID/resourceVersion/content, replica ownership, navigation and zero remaining DNS drafts. All 70 original DNS and 105 Network archive IDs remain. Source backups 29cf4732-5ae0-4f9a-b2cb-b49cd54e320b and edafb8ef-f7fa-4338-9230-e19719826fc1 protect the two metadata changes. A native configuration-only ZIP, 914203fe-dfe6-400f-a447-9672952e2212, captures the new stable primary-source identity. The resulting 73 DNS archives retain the originals, and Rancher reports 8/8 known legacy configuration items covered. Full multi-source catalog coverage remains pending. Evidence: native-dns-source-management-27-validation.json, native-dns-source-management-27-browser.json, the versioned UI rollout receipts and native-dns-source-restored-27.png.
- The 09:36 UTC health refresh reports 19 Ready nodes, 20 Ready certificates, healthy inspected workloads/storage and 19 reachable ingress endpoints, including 18 strict TLS connections. Endpoint reachability is not full authenticated application acceptance. The renewed recovery checkpoint verifies the healthy unchanged Windows agent, no lease, empty recovery queue, three fresh controller credential proofs and the current catalog/archive counts. The goal remains active for the independent second bridge/registry, full native Create/Delete/catalog Restore and source-qualified views, changed/missing credential recovery, protected schedules and the previously recorded wider gates. No Windows DNS, credential-value, resolver, DHCP or public DNS cutover change was made.

## Native isolated source lifecycle and registered binding acceptance — October 13, 2026

- DNS Manager 0.1.30 is installed and cached through Rancher. Runtime `2026.10.13-25` is Ready at generation 26, the source controller is Ready at generation 9, and the source catalog is at revision 10. The immutable registry contains the production binding and a second isolated-fixture binding.
- Rancher's native UI completed an isolated source Create, reviewed Delete, catalog-snapshot Restore that recreated the missing source, and final cleanup Delete. All four operations reached Applied with independent readback. Five owned backups protect the lifecycle. The production `Windows DNS` source remained registered, reachable and associated with its four observed zones; no pending rollout or source draft remains.
- Source-specific wire checks passed independently: the isolated fixture served one authoritative zone with a complete two-record AXFR, and the production binding served all four configured zones with authoritative SOA answers and complete transfers. The final catalog contains exactly the one production source.
- Regression results are 262 passing management checks plus one expected POSIX skip, 113 passing UI checks, six passing package unit checks and 153 passing isolated Linux recovery checks. The final health refresh reports 19/19 Ready nodes, 20/20 Ready certificates, healthy inspected workloads/PVCs/attached Longhorn volumes, and 19 reachable ingress endpoints, 18 with strict TLS.
- An initially over-broad test-runner invocation executed live scripts that were outside the intended focused suite. It created one owned test A record and 12 owned snapshots. The record and all 12 snapshots were removed through their supported management paths. DNS and Network archive counts returned to 82 and 105, and the production record set and TTLs match the pre-run baseline. The owned create/delete cycle advanced only the `cormierconsulting.io` SOA serial from 287 to 290, as required by authoritative DNS updates; no stray record remains and all four zones report Synced.
- The renewed recovery checkpoint verifies an idle Windows queue containing only terminal historical jobs, preserved agent/bootstrap identities, catalog revision 10, the completed source lifecycle and the restored snapshot counts. Evidence is retained in `native-dns-source-fixture-30-validation.json`, `native-dns-source-fixture-30-browser.json`, `dns-source-fixture-wire-tests.json`, `installed-dns-source-wire-tests.json`, `accidental-regression-cleanup-owned.json` and `recovery-bootstrap-checkpoint.json` under `.local/manager-installation`.
- No production credential was rotated and no resolver, DHCP or public-DNS cutover was performed. Native changed/missing credential restoration is accepted in the following drill. Abrupt physical-host failure, client/Omada resolver cutover and public-DNS/external-service acceptance remain open before the full goal can be declared complete.

## Native changed and missing credential restoration — October 13, 2026

- Used the retained encrypted credential snapshot `737d3512-094e-4742-b370-dbaab8c9c216` through DNS Manager 0.1.30 in signed-in Rancher. A resumable drill recorded every mutation intent, verified the independent Windows recovery agent and empty request channel before impact, and retained an emergency restoration path.
- Changed the installed engine-admin credential to an owned invalid fixture value. Rancher operation `b575fdae-ac17-4c20-b30a-597070995c42` reviewed it as `Restore Saved Credential`, kept the changed value during review, applied the encrypted saved value once, preserved the Secret UID, and independently confirmed the controller's fresh credential proof. The engine-only transaction correctly left the Windows request channel empty.
- Deleted the installed Windows bridge credential with exact UID/resourceVersion preconditions. Rancher operation `62781ea1-9efa-4ec0-98fe-f46351c77c9b` reviewed it as `Create Missing Credential`, preserved absence during review, recreated it with a new Kubernetes UID and the exact encrypted saved data, and reached Applied only after the independent Windows agent and management binding confirmed the restored identity. The owned encrypted request was cleared after its correlated Applied acknowledgement.
- Final evidence confirms both credential data digests match the encrypted backup, the Windows agent is Running with its exclusive poller lock, no recovery lease/request remains, all 82 DNS and 105 Network snapshots remain, and all four production zones retain authoritative complete transfers. Cluster health remains 19/19 Ready nodes, 20/20 Ready certificates, 19 reachable endpoints with 18 strict TLS connections, and no unhealthy inspected workloads, PVCs or attached Longhorn volumes. Evidence: `.local/manager-installation/native-changed-missing-credential-restore-owned.json` and `.local/manager-installation/production-recovery-bootstrap-checkpoint.json`.
- This drill intentionally changed one credential value and removed/recreated one credential identity before restoring them; it did not rotate either final credential value and did not modify DNS records, DHCP, resolver clients or public DNS. The full goal now reaches the planned-outage and cutover boundary: abrupt physical-host failure, client/Omada resolver cutover and public-DNS/external-service acceptance remain.

## DNS Manager Instances navigation and management links — October 13, 2026

- DNS Manager `0.1.31` adds an `Instances` entry immediately after the zone children in Rancher's native DNS Manager navigation. The page lists all three independent Technitium replicas, their DNS addresses, API reachability, zone convergence, Rancher Service resources and authenticated management links.
- Every zone detail page now includes an Instances table before its record grid. Live acceptance on `cormierconsulting.com` showed all three replicas API-reachable and current at serial `754`. The Instances page showed each replica at `4 / 4 current`.
- Management links use Rancher's authenticated Kubernetes Service proxy for each named `dns-manager-api-N:5380` Service, open in a separate tab and set `noopener noreferrer`. Direct API exposure was not added. The Service proxy returned HTTP 200 with the Technitium HTML interface from the live cluster; the Codex in-app browser blocks rendering internal Kubernetes proxy paths, so visual Technitium login-page rendering could not be accepted there.
- All 114 DNS Manager UI tests pass. Immutable package rollout preserved the prior DNS Manager `0.1.30`, Network Manager `0.1.25` and Common UI `1.0.2` asset digests. The two asset-host replicas reached Ready, and Rancher cached UIPlugin generation 32 at version `0.1.31`.
- Private rollout evidence: `.local/manager-installation/dns-instances-ui-31-owned.json`. The broader installation goal remains active for Omada/client resolver cutover, public edge TCP/80 acceptance and the physical-host failure scenario.

## Network Manager shared 15-minute cache — October 13, 2026

- Network Manager `0.1.26` uses a shared in-browser observation cache for Kubernetes network inventory. The cache is refreshed on a fixed 15-minute schedule, and the active view is updated from the new observation when that refresh completes. Ordinary view auto refreshes read the cache without repeating Kubernetes list calls.
- The Refresh Every control now defaults to `15 Minutes` and describes that it refreshes the current view from the shared cache. The manual Refresh button bypasses the cache, performs an immediate Kubernetes inventory scan, replaces the shared cache and updates the view.
- A deterministic source regression proves cached reloads make no additional Kubernetes reads, manual reloads reread every inventory endpoint and observe changes immediately, and the background callback runs at exactly 900,000 milliseconds. Five source tests and the full Network Manager configuration suite pass; the `0.1.26` extension build succeeds.
- Rancher live acceptance showed `15 Minutes` selected with a running countdown and 42 routes. A manual refresh advanced the observation timestamp from `2026-10-13T21:11:43.516Z` to `2026-10-13T21:12:32.835Z`, and the button reported `Network cache and current view refreshed immediately.` A shortened live UI cycle was not used as acceptance because the browser automation timed out while the snapshot service was busy; the deterministic scheduled-cache test is the interval proof.
- The two immutable asset-host replicas are Ready, Helm release `simple-network-manager` is at revision 28, and Rancher cached UIPlugin generation 28 at version `0.1.26`. The prior `0.1.25` bundle remains available. Evidence: `.local/manager-installation/network-cache-ui-26-owned.json` and `.local/manager-installation/network-cache-ui-26-live.png`.

## Rancher stable patch upgrade — October 13, 2026

- Rancher Manager was upgraded from `2.15.1` to the current stable `2.15.2` chart from Rancher's official stable repository. The exact chart archive was pinned locally with SHA-256 `855cb9be954f65a31b9a8c77f7aebce125c2d7797425257d21d35e3380816ac8`. Its Kubernetes constraint permits versions below 1.37, and the installed RKE2 `1.35.7+rke2r1` is in the supported Rancher 2.15.x range.
- Before mutation, all 19 nodes were Ready without disk, memory or PID pressure; all three Rancher replicas were Ready; and each control-plane node had a scheduled etcd snapshot from `2026-10-13T17:00Z`. The server-side Helm dry run passed and rendered `rancher/rancher:v2.15.2`. The real upgrade used the pinned chart, existing values, a ten-minute wait and automatic rollback on failure.
- Helm release `rancher` completed at revision 2. The original Deployment UID was preserved. All three `rancher/rancher:v2.15.2` replicas are Ready on separate workers with zero restarts, and their latest 300 log lines contain no error, fatal or panic entries. Rancher reconciled Fleet to `0.16.2` and Rancher Webhook to `0.11.3`; both are Ready.
- The upgraded native UI reports `v2.15.2`, the local RKE2 cluster Active and 19 machines. Network Manager still loads 42 routes with `15 Minutes` selected. DNS Manager Instances still shows all three replicas API Reachable, each at `4 / 4 current`, with its Rancher-proxied Technitium management link.
- Full post-upgrade health reports 63/63 Deployments, 12/12 StatefulSets, 12/12 DaemonSets and all 367 active pods Ready; 19/19 nodes and 21/21 certificates Ready; 19/19 configured ingress endpoints reachable with 18 strict-TLS connections; no unhealthy attached Longhorn volumes; and the recovery checkpoint passing with 82 DNS and 108 Network snapshots. Evidence: `.local/manager-installation/rancher-upgrade-2.15.2-owned.json` and `.local/manager-installation/production-recovery-bootstrap-checkpoint.json`.
