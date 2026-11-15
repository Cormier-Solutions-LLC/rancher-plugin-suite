# Public application dynamic DNS

`public-edge/public-edge-ddns` is a Kubernetes CronJob that reconciles the public
IPv4 address every five minutes. It reads `public-hosts.json` directly from the
existing `public-edge-config` ConfigMap at the start of each Job. Continue managing
the public hostname list through the Public Web Access Helm app in Rancher.

The updater uses the existing cert-manager GoDaddy credential, copied into a
separate Secret in `public-edge`. Credentials are mounted as a read-only file;
the Job has no Kubernetes API token or RBAC permissions. When that credential is
rotated, refresh the copied Secret using the installation command below.

## Behavior

- Requires agreement between ipify and AWS Check IP on a public IPv4 address.
- Manages only exact subdomains of the configured `cormierconsulting.io` zone.
- Reads and validates all selected records before making writes.
- Uses GoDaddy's type-and-name-specific PUT endpoint to replace each changed A
  record set atomically. Preserves its TTL; creates missing A records at TTL 600.
- Leaves CNAMEs intact when their target is another managed hostname, and rejects
  cycles, external CNAME targets, mixed CNAME/A records, or multiple A records.
- Makes no writes when the correct address is already present.
- Does not remove records when a hostname leaves the allowlist. It leaves AAAA,
  certificate TXT, unrelated DNS records, router settings, and the gateway alone.
- Exits unsuccessfully on lookup/API/verification failures and never logs
  credentials or upstream error bodies. The next scheduled run retries.

Schedule: `*/5 * * * *`, America/Chicago. Overlapping scheduled Jobs are forbidden;
each Job has a three-minute deadline, one retry, and one-day retention. Successful
and failed history limits are two and three respectively. The pinned Node image
runs without root, privilege escalation, a writable root filesystem, or inbound
network access. Egress permits cluster DNS and public HTTPS.

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
the expected `Completed reconciliation` log entry. Public resolvers can retain
the previous address until its TTL expires.

Deployment credentials move directly between API responses and request stdin;
the installation helper never writes them to disk or logs. To update the script,
run `install`, preview, run, and enable again. Existing mounted host lists do not
require reinstalling the updater when changed in Rancher.

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
`public-edge-ddns-godaddy` Secret. Do not delete `public-edge-config` or
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
