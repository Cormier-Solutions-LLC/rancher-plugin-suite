# Shared YugabyteDB application database

YugabyteDB is the default database for new relational applications in this
cluster. This deployment was commissioned on 2026-11-08. Application cutovers and
independent recovery checks are recorded below; preserve source recovery data.

## Topology and budget

Internal YSQL endpoint: `ysql.yugabyte.svc.cluster.local:5433`.
YugabyteDB 2026.1.2.0-b137, pinned image digest:
`sha256:b6dba322c7340e1a87affd9b4715fa938354b6ab81b0b0833b07f6b5d085e274`.

| Physical host | Worker placement | Data nodes | CPU per data node | RAM per data node | Master |
| --- | --- | --- | --- | --- | --- |
| proxmox07 | kubworker11/12 | 2 | 2.1 | 3 GiB | 0.5 CPU / 1 GiB |
| proxmox08 | kubworker13 | 2 | 3.3 | 17 GiB | 0.5 CPU / 1 GiB |
| proxmox09 | kubworker15/16 | 2 | 2.1 | 16 GiB | 0.5 CPU / 1 GiB |

Each pod also has a 5m CPU / 16 MiB cleanup sidecar. Total steady allocations:
16.545 CPU and 76,944 MiB, below 15% of each participating physical host.
Requests equal limits. PriorityClass-scoped ResourceQuotas cap each host's
accounting group; a namespace quota also bounds the universe total. No pod
preempts other workloads.

Worker14 was fenced during commissioning and remains excluded. Both proxmox08 data nodes
therefore share worker13; they remain one physical-host failure domain.
Other hosts are excluded from this first deployment because of CPU limits,
storage latency or shared NFS dependencies. Do not silently expand placement.

## Replication, storage and security

RF3 explicitly requires one replica in each of `onprem.lab.proxmox07`,
`onprem.lab.proxmox08`, `onprem.lab.proxmox09`. Three masters use those same
failure domains. One host loss retains a majority; two host failures do not.
With exactly three placement domains a missing third copy cannot be restored
until its domain returns or placement is deliberately expanded.

StorageClass `yugabyte-local-xfs-retain` uses one Longhorn replica, strict-local
placement, the `thin` disk tag, XFS and Retain. These worker disks were verified
as local Proxmox Thin volumes on the participating hosts, not NFS. Data volumes
start at 20 GiB per data node; masters have 5 GiB each. RF3 provides roughly
40 GiB of unique data+indexes before operational headroom. This is a small
commissioning cluster, not the full-size SQL Server replacement.

Both node-to-node and client-to-server TLS are enabled. NetworkPolicy limits
ingress to this universe and approved application namespaces. SQL readiness
checks execute `SELECT 1` over a local authenticated-administration socket;
container Running alone is not database readiness. Administrator credentials
are in `yugabyte/yugabyte-admin`; never print or distribute them to applications.
Certificate rotation requires a controlled rolling restart before expiry.
Both `durable_wal_write` and `require_durable_wal_write` are enabled on masters
and data servers. Same-site replication alone does not replace durable WAL writes.

## Application provisioning

Create a separate database and role for each application. For small application
databases, evaluate colocation to avoid unnecessary tablet overhead. Require
TLS hostname/CA verification and use the existing PostgreSQL-compatible driver
only after exercising application-specific behavior against the running YSQL
version. Database migrations must run deliberately and handle supported
transaction retries; never suppress advisory-lock or constraint errors.

## Migration status

- Licensing: live on the shared cluster; source/target and independent restore
  verified. Native driver commit, reconnect/read and rollback passed.
- TableLink: live connection uses the shared cluster; empty first-run database
  restored independently and native Npgsql TLS/connection test passed. Owner
  installation remains unclaimed. The YugabyteDB-specific schema initializer and
  journal were qualified and commissioned without creating an owner account.
- World Simulator: live on the shared cluster; all 55 documents and independent
  restore verified. Native Npgsql readiness passed after the application restart.
- Harbor: live on `registry_live_20261108`; final frozen-source fingerprints and
  independent restore verified (49 tables, 30,968 rows). Authenticated projects,
  native API create/read/delete and normal core/exporter rollout passed. The
  credential-free override is in `applications/harbor-values.json`; reconcile
  Helm with that override after the source-retirement HA gate.
- Proof Studio: final source snapshot restored twice (50 tables, 1,411 rows).
  Native runtime credentials, TLS, advisory locks, commit/read and rollback
  passed; the normal application is live and HTTPS readiness passed.
- Invoicing: live on YugabyteDB through the trusted SQLite/PostgreSQL/YugabyteDB
  provider registry. Final frozen transfer verified 85 application tables,
  2,085 rows and four invoices; ongoing application writes change row counts.
  Historical records, implicit row IDs, foreign keys, totals and encrypted
  integration credentials were verified. Original SQLite files and credential
  key remain on the application PVC and have encrypted off-cluster recovery
  copies. Portable backup/restore and real PostgreSQL/YSQL connection-loss
  tests passed. HTTPS readiness queries the database.

All five legacy PostgreSQL instances are retired: four Kubernetes StatefulSets
and the World Simulator Docker container. Their original PVCs/named volume,
credentials and encrypted off-cluster source archives remain for recovery.
Invoicing keeps its original SQLite files and matching credential key.

## Reproducible operations

`deploy.py --base --apply` applies the budget, storage, certificate and endpoint
resources. `deploy.py` renders and server-validates the pinned official chart;
`--apply` deliberately changes the deployment. `--host 07`, `08` or `09` scopes
one host. Set `KUBERNETES_SERVER` only when a particular controller endpoint is
needed; otherwise kubectl uses the current context. Python requires PyYAML and
Helm must be on PATH or supplied through `HELM_PATH`. Downloaded charts and
rendered files stay under ignored `.local/yugabyte-render`. The chart archive is
verified against its pinned SHA-256. Configure RF3 placement explicitly with
`yb-admin modify_placement_info onprem.lab.proxmox07:1,onprem.lab.proxmox08:1,onprem.lab.proxmox09:1 3`
using the three master addresses and the mounted node certificates.

`install-backup.py` provisions the least-privilege backup reader, encryption-key
Secret, script and PVC. A newly installed nightly schedule starts suspended; an existing
schedule retains its state unless `--enable-schedule` is explicitly supplied. It never replaces missing
recovery keys when backup storage already exists. Export the key securely off
cluster, grant the reader CONNECT to each application database, and verify an
encrypted backup plus independent restore before enabling the schedule. The
backup PV uses Retain; seven-day retention applies only to generated archive
pairs. A backup PVC in this cluster is not an off-site copy.

For large PostgreSQL imports, create primary keys before copying data and use
bounded COPY transactions (`yb_default_copy_from_rows_per_transaction=1` for the
Proof Studio migration). Adding a primary key after large rows are loaded can
produce an oversized table-rewrite RPC. Source comparison hashes are calculated
in a materialized CTE before sorting, so the legacy database need not spill
complete document records to temporary disk. No records are filtered or rewritten.

YSQL 2026.1 disables transactional DDL. Proof Studio's PostgreSQL migration
runner is not qualified for that behavior; its production Helm values disable
automatic migrations on the already restored schema. Future schema changes
require explicit qualification and hash verification before rolling the app.

## Driver and recovery qualifications

Invoicing plugins are trusted server modules registered before startup; they are
not uploaded or executed through HTTP. Each supplies connection, initialization,
snapshot and restore behavior. The existing synchronous statement interface uses
a worker and one pinned PostgreSQL connection. Business transactions remain on
one session. Failed mutations and uncertain commits are never automatically
replayed. A lost transaction requires rollback before later operations reconnect.
An interrupted open write held conflicting keys for about 60 seconds in the
YSQL backend-termination test. Load-test this adapter before high-throughput use.

Proof Studio's large document SELECTs are bounded with database settings
`yb_fetch_row_limit=0` and `yb_fetch_size_limit=16777216`; full document fingerprints
passed through both 3 GiB coordinators. COPY TO in this release does not honor
that bound. Backups therefore use TLS-verified coordinator host lists on hosts
08 and 09, whose read buffers accommodate the largest response. This list must
be revisited when resizing nodes or loading larger records.

Nightly backups enumerate the six live application databases explicitly and run
at 03:00 America/Chicago. They stream SQL through gzip and AES-256-CBC with
PBKDF2, then authenticate ciphertext with a separately derived HMAC-SHA256 key.
The manifest also records plaintext SHA-256 and length. Encrypted archives and
the escrowed encryption key are copied outside Kubernetes for the restore drill.
Restore qualification verifies authentication, decompression and digest, then
loads all COPY records and logical constraints into an isolated PostgreSQL 17
container. Physical YSQL primary-key order, LSM/ybgin index/tablegroup metadata and
optimizer statistics require PostgreSQL-specific normalization; index keys and
logical constraints remain intact, and statistics are regenerated with ANALYZE.
This verifies SQL recovery, not application asset files or registry blob storage.

To restart the existing local World Simulator deployment, use
`applications/start-worldsim.py --base <existing-compose.yaml> --image <verified-image>`
with kubectl access. It loads credentials from Secrets into process environment
and stores only the public CA under ignored `.local/yugabyte/ca.crt`. It starts
only the application service, leaving the legacy database profile disabled.

## Commissioning evidence, 2026-11-08

Encrypted backups for all six databases passed HMAC, plaintext SHA-256/length,
independent PostgreSQL 17 restore, logical constraint and COPY record-count
checks. The TableLink backup includes both commissioned schema journal entries.
Nightly backups are enabled at 03:00 America/Chicago; preserve external key
escrow and arrange an external scheduled archive copy for ongoing disaster
recovery. The current backup PVC remains in the same Kubernetes cluster.

The failover drill stopped only YugabyteDB's master and both data nodes on
physical proxmox09, including the current master leader. Kubernetes confirmed
all three pods absent. Writes succeeded through the other two hosts, and all
146 acknowledged commits were retained after recovery. Eight probe attempts
failed during the transition; this is not a zero-interruption claim. All six
applications were ready after recovery, all nine database pods returned, and
the cluster reported no dead nodes or under-replicated tablets. The drill did
not power off a physical host or test a site/network partition or two-host loss.

The four old PostgreSQL StatefulSets were deleted only after those gates passed.
Original source PVCs have Retain reclaim behavior and were not deleted. The old
World Simulator database container was removed without deleting its named volume.
Task-created trial databases and temporary migration candidates were removed.
Do not delete retained recovery files or volumes as routine deployment cleanup.
