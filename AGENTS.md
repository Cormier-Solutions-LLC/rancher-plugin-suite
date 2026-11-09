# Application database deployment default

Use the shared YugabyteDB YSQL cluster as the default system of record for new
relational application deployments. Do not provision a dedicated PostgreSQL
StatefulSet by default. Keep one database and dedicated least-privilege runtime
credentials per application; never reuse the YugabyteDB administrator account.

The internal endpoint is `ysql.yugabyte.svc.cluster.local:5433`. Require TLS and
validate the cluster CA and hostname. The CA is managed by cert-manager in the
`yugabyte` namespace. Credentials belong in Kubernetes Secrets, never Git.

YugabyteDB is PostgreSQL-compatible, not feature-identical. Qualify the exact
schema, driver, transaction/locking behavior, migrations and extensions before
cutover. Retain PostgreSQL as a documented exception when compatibility fails;
never bypass locking or data-integrity checks to force a migration.

The cluster uses RF3 with one replica per physical Proxmox host. Its two data
nodes plus master and sidecars must remain within 15% combined CPU and RAM of
each participating physical host. Preserve host placement, accounting quotas,
single-copy strict-local XFS volumes and TLS. Do not use the default three-copy
Longhorn class for YugabyteDB's replicated data.

Before retiring any old database: verify source-to-target data, application
readiness and write behavior, an independent backup restore, and HA behavior.
Never delete an unmigrated source or its recovery data. Follow the user's
explicit deletion scope; otherwise retain source PVCs for recovery.

Deployment details and current verification state: `databases/yugabyte/README.md`.
