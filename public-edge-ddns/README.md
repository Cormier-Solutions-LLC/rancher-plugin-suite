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

GoDaddy Domains v3 uses a dedicated production Personal Access Token with
`domains.domain:read` and `domains.dns:update`. Store it under `token` in the
`public-edge/public-edge-ddns-godaddy-v3` Kubernetes Secret. The Job mounts the
token as a read-only file and has no Kubernetes API token or RBAC permissions.
Rotate the token by updating this Secret before it expires. The cert-manager
DNS webhook uses its own credential.

## Shared edge model

- `ddns_edge.cormierconsulting.io` is the only A record maintained for WAN IPv4.
- Every hostname in `public-edge-config/public-hosts.json` is a **direct CNAME**
  to that owner. Existing chained aliases are retargeted and missing aliases created.
- Both IP services must agree on a valid public IPv4 address.
- Discover public GoDaddy NS delegation through Google and Cloudflare DNS over
  HTTPS, then query both authoritative DNS servers directly on port 53. This
  bypasses private split DNS and recursive cache delay. The nameservers must agree.
- Verification and dry runs make **zero GoDaddy API calls**. For DNS drift,
  the updater reads only the affected owners through the v3 `name` filter.
  An ordinary WAN address change takes one filtered GET and one PUT by record ID.
- API writes occur only for records whose DNS data differs from the desired model.
  Authoritative DNS verifies each accepted write. Removed names are left untouched.
- Check every changed owner through authoritative DNS and GoDaddy before writing.
  Conflicting record types, inconsistent answers, or multiple A records on the
  shared owner stop the run.
- Replace an existing application A or CNAME by ID using a v3 PUT. For multiple
  application A records, save the full record set and TTLs, remove the extra A
  records, then replace the last one with the CNAME. The shared A is verified
  before application aliases are updated. The state PVC retains the original
  records if a conversion is interrupted.
- Recheck each name immediately before changing it. Already-correct names are
  skipped, while unexpected concurrent changes abort the plan for a fresh retry.
- The exact `ddns_edge` spelling, including its underscore, is preserved.
- GET and PUT use bounded retries for transient network and server errors.
  After an ambiguous POST or DELETE, the next run checks authoritative DNS again.
  Monthly quota exhaustion
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

Run from the repository root against the intended cluster.

```powershell
node --test public-edge-ddns/updater.test.mjs
node public-edge-ddns/manage.mjs stage
node public-edge-ddns/manage.mjs preview
```

The preview uses the v3 script and can run before the token is provisioned.
Inspect the preview Job's logs and wait for its Complete condition.

Generate the production token in the [GoDaddy Developer Portal](https://developer.godaddy.com/en/docs/api-users/auth/how-to).
To add it directly to Kubernetes from PowerShell, use the masked prompt below.

```powershell
$pat = Read-Host 'GoDaddy production PAT' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pat)
try {
    @{
        apiVersion = 'v1'
        kind = 'Secret'
        metadata = @{ name = 'public-edge-ddns-godaddy-v3'; namespace = 'public-edge' }
        type = 'Opaque'
        data = @{ token = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(
            [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr))) }
    } | ConvertTo-Json -Depth 5 -Compress | kubectl apply --server-side --field-manager=public-edge-ddns-credential -f -
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    $pat.Dispose()
}
```

Installation verifies that the PAT Secret is present and suspends the schedule.
Run once and inspect the logs and Complete condition before re-enabling it.

```powershell
node public-edge-ddns/manage.mjs install
node public-edge-ddns/manage.mjs run
kubectl logs -n public-edge job/JOB_NAME
kubectl wait -n public-edge --for=condition=complete job/JOB_NAME --timeout=200s
node public-edge-ddns/manage.mjs enable
kubectl get cronjob,jobs -n public-edge
```

Job logs show the desired records and confirm authoritative DNS read-back after
each write. Look for `Completed reconciliation` or `Completed public DNS verification`
in a successful Job's logs. Recursive resolvers can cache the previous DNS answers
until their TTL expires.

For future script updates, stage and preview first, then install, verify a manual
run, and enable. The mounted hostname list updates when changed in Rancher.

After GoDaddy restores quota, bypass the persisted cooldown for one explicit run:

```powershell
node public-edge-ddns/manage.mjs suspend
node public-edge-ddns/manage.mjs run --force-api-retry
```

This permits one manual attempt before the daily cooldown expires. Successful
reconciliation clears the cooldown. Enable the schedule after the Job completes.
The 1 GiB `public-edge-ddns-state` Longhorn PVC stores v3 cooldown and DNS recovery
in `godaddy-v3-quota.json`. The legacy `quota.json` still holds earlier recovery data.

## Pause and rollback

```powershell
node public-edge-ddns/manage.mjs suspend
```

Suspending prevents future scheduled runs; inspect and wait for any active Job
before restoring DNS. Restore only the changed type/name record sets from the
saved pre-change records through GoDaddy. Delete only records created by the run
when the recovery record set for that owner is empty. Enabling scheduling resumes
reconciliation to the current WAN IPv4 and direct application CNAMEs.

To retire this updater after suspending it and checking active Jobs, delete only
its CronJob, NetworkPolicy, `public-edge-ddns-v3-script` ConfigMap, and
`public-edge-ddns-godaddy-v3` Secret. The `public-edge-ddns-state` PVC contains
quota cooldown and migration recovery state and can be removed separately when retiring the updater. Do not delete `public-edge-config` or
`public-edge-tls`. Guest 9001 remains independently responsible for
`vpn.cormiersolutions.com`.

[GoDaddy v3 DNS record documentation](https://developer.godaddy.com/en/docs/api-users/domains/manage/dns)

[Kubernetes CronJobs](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)

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
