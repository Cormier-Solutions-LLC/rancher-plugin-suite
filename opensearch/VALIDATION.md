# Live acceptance — October 24, 2026

Verified against the RKE2 cluster at 12:16 PM America/Chicago. The detailed
non-secret report is `.local/opensearch/live-verification.json`.

- OpenSearch and Dashboards 3.9.0 are green with 11 OpenSearch nodes: three
  manager-only nodes and eight data/ingest nodes. Managers span three physical
  zones; data nodes span six eligible zones.
- Four data nodes have `storage_domain=proxmox09`; four have
  `storage_domain=proxmox06`. Cluster allocation awareness uses zone and storage
  domain, with both storage-domain values forced.
- The 11 dedicated retained claims are Bound: three 30 GB manager PVCs and eight
  200 GB data PVCs, for 1.69 TB of active OpenSearch PVC allocation.
- The temporary 1 GiB bootstrap claim was removed. Its Retain-policy PV remains
  Released as an explicit recovery artifact outside the active claim quota.
- Every PVC is a healthy Longhorn volume with three running replicas on the
  intended tagged disk pool, copies in three physical zones and a local copy on
  the attached worker. The manager volumes use `thin`; the data volumes use
  `proxmox09-nfs` or `proxmox06-nfs` as declared.
- Private hostname HTTPS, trusted ingress TLS, API authentication, Dashboards
  login and authenticated Dashboards status passed. The public gateway config
  omits both OpenSearch names and rejected both Host headers.
- Only the randomized `admin` and `kibanaserver` internal users exist; bundled
  demo users are absent.
- The application template has four primary shards and one OpenSearch replica.
  A temporary test index allocated exactly one shard copy to every data node;
  each primary/replica pair used different storage domains and physical zones.
  Indexing and full-text search passed, and the test index was removed.
- Recreating `opensearch-data-pve06-0` produced a new pod while retaining the
  PVC UID and test document. The cluster returned to green.
- The operator completed its bootstrap OnDelete pass with `RollingRestart`
  status `Finished`. All OpenSearch pods, both Dashboards replicas and the
  operator were Ready afterward.
- The operator chart passed Helm lint. PowerShell and JavaScript parsing,
  server-side manifest dry runs and Git whitespace checks passed.

The recovery drill covers one normal data-pod recreation. It does not simulate
a physical host, Proxmox storage server, network, PowerVault or power failure.

No ingestion collectors, automatic retention policy, OpenSearch-native snapshot
repository, scheduled native backups, restore drill or dedicated OpenSearch
metrics scrape is configured yet. Configure and test independent native
snapshots before importing important data.
