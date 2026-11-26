# Public application dynamic DNS

Current layout:

```text
application hostname --CNAME--> ddns_edge.cormierconsulting.io --A--> current WAN IPv4
```

Only `ddns_edge` changes its A-record address when the WAN IP changes. Application
records are created or repaired as direct CNAMEs to it. DNS verification does not
use GoDaddy's domain/zone API.

`public-edge/public-edge-ddns` is a Kubernetes CronJob that reconciles the public
IPv4 address every five minutes. It reads `public-hosts.json` directly from the
existing `public-edge-config` ConfigMap at the start of each Job. Continue managing
the public hostname list through the Public Web Access Helm app in Rancher.

The updater uses the existing cert-manager GoDaddy credential, copied into a
separate Secret in `public-edge`. Credentials are mounted as a read-only file;
the Job has no Kubernetes API token or RBAC permissions. When that credential is
rotated, refresh the copied Secret using the installation command below.

## Shared edge model

- `ddns_edge.cormierconsulting.io` is the only A record maintained for WAN IPv4.
- Every hostname in `public-edge-config/public-hosts.json` is a **direct CNAME**
  to that owner. Existing chained aliases are retargeted and missing aliases created.
- Both IP services must agree on a valid public IPv4 address.
- Discover public GoDaddy NS delegation through Google and Cloudflare DNS over
  HTTPS, then query both authoritative DNS servers directly on port 53. This
  bypasses private split DNS and recursive cache delay. The nameservers must agree.
- Verification and dry runs make **zero GoDaddy API calls**. The updater contains
  no GoDaddy GET requests or domain/zone-list reads. An ordinary WAN address
  change requires exactly one successful PUT to `A/ddns_edge`; aliases stay intact.
- API writes occur only for records whose DNS data differs from the desired model.
  Authoritative DNS verifies each accepted write. Removed names are left untouched.
- Before changing anything, preflight all names. Refuse unexpected AAAA, TXT, MX,
  CAA, or delegated NS conflicts rather than deleting unrelated records. The shared
  owner must not be a CNAME or a multi-address A record set.
- A-to-CNAME conversion requires deleting that owner's old A record set before
  putting its CNAME. Save the original authoritative A data and TTL in the state
  PVC first; attempt restoration if CNAME creation fails. A saved recovery snapshot
  remains available after successful migration. These two API writes are not an
  atomic transaction: a short DNS gap can occur during conversion. The shared
  target is created and verified before any application aliases change.
- Recheck each name immediately before changing it. Already-correct names are
  skipped, while unexpected concurrent changes abort the plan for a fresh retry.
- The exact `ddns_edge` spelling, including its underscore, is preserved.
- Transient network/server errors use bounded retries. Monthly quota exhaustion
  persists a cooldown across Jobs with at most one automatic attempt daily (or
  the next UTC month boundary). DNS/IP checks still run every five minutes.
  Dry runs still show the plan during cooldown without contacting the API.
- Failed or deferred DNS updates remain failed Jobs. Credentials and upstream
  error bodies never enter logs. Public DNS backup/recovery data contains no tokens.

Schedule: `*/5 * * * *`, America/Chicago. Overlapping scheduled Jobs are forbidden;
each Job has a three-minute deadline, no Job-level retries, and one-day retention. Successful
and failed history limits are two and three respectively. The pinned Node image
runs without root, privilege escalation, a writable root filesystem, or inbound
network access. Egress permits cluster DNS, public authoritative DNS (UDP/TCP 53), and public HTTPS.

## Installation and validation

Run from the repository root against the intended cluster:

```powershell
node --test public-edge-ddns/updater.test.mjs
kubectl apply --dry-run=server -f public-edge-ddns/resources.json
node public-edge-ddns/manage.mjs install
node public-edge-ddns/manage.mjs preview
```

Installation always suspends the schedule. Inspect the preview Job's logs and
wait for its Complete condition. Preserve the GoDaddy records before applying
changes. To apply once, inspect that Job's logs/read-back, then enable scheduling:

```powershell
node public-edge-ddns/manage.mjs run
node public-edge-ddns/manage.mjs enable
kubectl get cronjob,jobs -n public-edge
kubectl logs -n public-edge job/JOB_NAME
```

Job logs include the previous and desired address for each changed A record, and
confirm read-back from GoDaddy after each write. A Complete Job must also have
the expected `Completed reconciliation` or `Completed public DNS verification`
log entry. Public resolvers can retain
the previous address until its TTL expires.

Deployment credentials move directly between API responses and request stdin;
the installation helper never writes them to disk or logs. To update the script,
run `install`, preview, run, and enable again. Existing mounted host lists do not
require reinstalling the updater when changed in Rancher.

After GoDaddy restores quota, bypass the persisted cooldown for one explicit run:

```powershell
node public-edge-ddns/manage.mjs run --force-api-retry
```

This does not bypass provider limits; it permits one manual attempt before the
daily cooldown expires. Successful reconciliation clears the cooldown. Normal
scheduled Jobs have no override. The 1 GiB `public-edge-ddns-state` Longhorn PVC
stores quota cooldown and DNS migration recovery state, and the container remains without API/RBAC
access. Preserve this PVC on script reinstall so backoff survives pod restarts.

## Pause and rollback

```powershell
node public-edge-ddns/manage.mjs suspend
```

Suspending prevents future scheduled runs; inspect and wait for any active Job
before restoring DNS. Restore only the changed type/name record sets from the
saved pre-change records through GoDaddy. If a record did not previously exist,
remove only the newly created A record after suspending the job. Preserve any
CNAME, TXT, or other unrelated record. Unsuspending will reconcile to the current
public IPv4 again.

To retire this updater after suspending it and checking active Jobs, delete only
its CronJob, NetworkPolicy, `public-edge-ddns-script` ConfigMap, and
`public-edge-ddns-godaddy` Secret. The `public-edge-ddns-state` PVC contains
quota cooldown and migration recovery state and can be removed separately when retiring the updater. Do not delete `public-edge-config` or
`public-edge-tls`. Guest 9001 remains independently responsible for
`vpn.cormiersolutions.com`.

API reference: [replace DNS records by type and name](https://developer.godaddy.com/en/docs/references/rest/domains/v1/record-replace-type-name).
Scheduling reference: [Kubernetes CronJobs](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/).

## Deployment verification — November 15, 2026

- Verified: all 12 automated tests and server-side manifest validation passed.
- Verified: the in-cluster dry run selected four hostnames and made no writes.
- Verified: the initial live Job updated Proofing and Invoicing from
  `68.203.6.96` to `24.162.105.215`, created TableLink at that address, and preserved
  Cutaway's CNAME to Proofing. All A-record TTLs are 600 seconds.
- Verified: the complete zone comparison preserved all unrelated DNS records;
  gateway resource specs and `public-edge-config` were unchanged. Private
  before/after evidence is under `.local/public-edge-ddns/` and is not committed.
- Verified: Cloudflare public DNS returned the correct address for all four names.
- Verified: scheduled Job `public-edge-ddns-29913070` completed at 5:10:55 p.m.
  Central, reported all addresses current, and made no changes. The CronJob is
  enabled with schedule `*/5 * * * *`.

## November 25 network-change investigation

The last successful run before investigation was November 22 at 08:35:19 UTC.
Initial pods logged generic network failures. A credential-free probe on the same
worker subsequently verified DNS resolution and HTTPS access to both IP services
and GoDaddy. Both IP services reported `24.162.104.154`; public Proofing DNS still
pointed to `24.242.120.130`.

The live GoDaddy API returned HTTP 429 with `QUOTA_EXCEEDED` and explicitly stated
that the **monthly** request quota was exceeded. With eight hostnames, the old
implementation could perform 16 reads every five minutes (142,848 per 31-day
month). The zone-snapshot implementation reduces unchanged runs to one read.
Restore or increase the account's API quota to permit the pending DNS updates;
the code change does not clear a provider-side exhausted quota.

Added `ui.cormierconsulting.io` through a Helm upgrade preserving all eight existing
hostnames and other values. The gateway now has nine allowed names, and its
expanded TLS Certificate is Ready. The job reads that live list automatically.
Reapply only the script ConfigMap and patch `backoffLimit: 0` for this repair;
the credential and network policy are unchanged. Private diagnostics and Helm
rollback values are under `.local/ddns-network-recovery/`.

### Follow-up request controls

The subsequent public-DNS preflight replaces the fixed monthly polling estimate
above: correct DNS now uses zero GoDaddy calls, and exhausted-quota retries are
limited by persisted cooldown state. The interval remains five minutes.

Verified: all 24 automated tests pass, including zero-call healthy runs, record
drift/new names, managed aliases, resolver failures, pagination, retries, persistent
state reopening, and quota cooldown behavior. In-cluster preview
`public-edge-ddns-preview-1795669277326` made one GoDaddy GET, received the monthly
quota error, and wrote the cooldown to the new bound state PVC. Separate preview
`public-edge-ddns-preview-1795669337855` then reported the persisted cooldown and
**zero GoDaddy requests**. Both correctly remained Failed because public DNS still
needs updating. The enabled CronJob reads the same script and state volume.

This controls future request consumption; it does not restore the exhausted
provider quota or claim that stale/missing public DNS has been repaired. No DNS
write occurred during these previews. Private backups and evidence are under
`.local/ddns-request-guard/`.

### Shared target rollout

Replaced per-application A reconciliation with one shared A owner plus direct
CNAMEs for all nine public edge names. All 21 replacement tests pass, including
single-A WAN changes, zero API reads, migration ordering, rollback, unrelated-record
conflicts, concurrent edits, and authoritative DNS checks. The script ConfigMap
now mounts `authoritative-dns.mjs` alongside the updater, and the updater's isolated
NetworkPolicy permits public DNS on UDP/TCP 53 for direct authoritative queries.

In-cluster dry run `public-edge-ddns-preview-1795669973213` found the shared A owner
correct and eight direct CNAMEs already present; only Cutaway still pointed to
Proofing. It made zero API calls. Manual reconciliation
`public-edge-ddns-run-1795670003994` attempted one CNAME PUT for Cutaway and received
the still-exhausted monthly quota response; no DNS write succeeded. The existing
Cutaway -> Proofing -> ddns_edge chain remained intact. The enabled schedule is
unchanged at five minutes. Once quota is restored, run with `--force-api-retry` to
complete any remaining direct-CNAME repairs without waiting for cooldown expiry.

Private authoritative DNS snapshots and pre-change resource backups are under
`.local/ddns-shared-edge/`. The state PVC preserves the previous records before
future conversions, including original A data and TTL, for recovery.
