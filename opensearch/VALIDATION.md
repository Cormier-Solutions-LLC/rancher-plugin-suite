# Live acceptance — October 23, 2026

Verified against the existing RKE2 cluster at 8:26 PM America/Chicago.
The detailed non-secret report is `.local/opensearch/live-verification.json`.

- OpenSearch/Dashboards 3.9.0; cluster green with three data/manager/ingest nodes.
- OpenSearch pods placed on `kubworker15/proxmox09`, `kubworker03/proxmox02`
  and `kubworker01/proxmox01`.
- Three dedicated 30 GiB claims are Bound using `opensearch-longhorn-retain`.
  Each volume is healthy with three running Longhorn replicas in distinct physical
  zones. Total active data PVC capacity is 90 GiB, approximately 96.6 GB.
- Data quota is 93 GiB, below 100 decimal GB, including bootstrap allowance.
  An additional 4 GiB claim was rejected by server dry-run without creating storage.
- Writable-container/temporary-storage quota is 50 GB; active container limits
  total 39 GB. Existing worker OS files and shared image cache are outside this quota.
- Private system DNS resolves both OpenSearch names to `10.99.15.50`. Normal
  hostname-based HTTPS returns the Dashboards login redirect and API HTTP 401.
  Trusted ingress TLS, authenticated Dashboards status and full backend TLS
  verification passed. Only randomized `admin` and `kibanaserver` internal users exist.
- Public gateway positive control passed; both OpenSearch Host headers were rejected
  by its existing hostname allowlist. This was a LAN test of the public gateway VIP,
  not an independent Internet-origin probe.
- Application index template, one search replica, document indexing, refresh,
  full-text search and green shard allocation passed.
- Recreated `opensearch-nodes-0`: the replacement had a new pod UID, retained the
  original PVC UID and preserved the indexed test document. The cluster returned
  to green with all three nodes. The uniquely named test index was removed.
- All 27 pre-existing Longhorn volumes retained their identities and provisioned sizes.
- Helm lint, PowerShell parsing, JavaScript syntax checks, Git whitespace checks
  and a redacted secret scan passed.

This verifies a normal single-pod recreation, not physical-host, PowerVault or
power-loss recovery, nor an uninterrupted-request SLO. One HTTP 502 was observed
while the earlier operator-driven resource update was rolling nodes. Clients should
handle transient connection failures and retries appropriately.

No ingestion collectors, automatic index retention, native OpenSearch snapshot
repository, scheduled native backups, restore drill or dedicated OpenSearch metric
scraping has been configured. These are operational follow-ups before important
or sustained data ingestion. Shared storage/backend failure domains still apply.
