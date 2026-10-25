# Private distributed OpenSearch

OpenSearch and Dashboards 3.9.0 run under OpenSearch operator 3.0.0. The
deployment downloads the official operator 3.0.14 Helm chart and verifies its
SHA-256 digest before installation.

## Topology and capacity

- Three dedicated cluster-manager nodes use 30 GB PVCs, 4 GiB RAM and a 2 GiB
  JVM heap. They do not carry data or ingest roles.
- Eight data/ingest nodes use 200 GB PVCs, 4 GiB RAM and a 2 GiB JVM heap.
  Four use the legacy `proxmox09-nfs` Longhorn disk pool and four use the
  `proxmox06-nfs` Longhorn disk pool. The 2026-10-25 NFS migration moves the
  legacy pool's guest disks onto Proxmox06 as well; these names remain logical
  selectors for existing volumes, not independent physical storage backends.
- Data pods span six eligible physical Proxmox zones. Managers span three
  zones. Proxmox01 and Proxmox02 are currently excluded from this workload's
  placement; the deployment preflight rejects an assignment in those zones and
  maintains the `opensearch-eligible` label on workers in the other six zones.
- OpenSearch allocation awareness uses both the physical zone and
  `storage_domain`. Forced storage-domain awareness separates the two logical
  disk pools. After NFS consolidation both depend on Proxmox06, so it no longer
  provides protection against failure of that shared storage server.
- New application indices default to four primary shards and one replica, so a
  normally balanced index can use all eight data nodes.

The eight data PVCs provide 1.6 TB of raw OpenSearch capacity. One OpenSearch
replica leaves about 800 GB for primary data before operating headroom. With
30% free-space headroom, plan around 560 GB of primary indexed data, less system
indices. Indexed size can differ substantially from source size. Disk
watermarks are 70% low, 80% high and 90% flood stage.

The namespace storage quota is 1,692 GB: 1,600 GB for data nodes, 90 GB for
managers and enough room for the temporary 1 GiB bootstrap claim. It allows 12
claims during bootstrap and 11 afterward. The retained bootstrap PV is expected
to remain Released after its claim is removed. The namespace also has a 100 GB
writable container and temporary-storage quota.

## Longhorn storage

Three retained StorageClasses isolate the workload without changing Longhorn's
cluster-wide defaults:

- `opensearch-manager-longhorn-retain` selects `thin` disks.
- `opensearch-data-pve09-retain` selects `proxmox09-nfs` disks.
- `opensearch-data-pve06-retain` selects `proxmox06-nfs` disks.

Every PVC has three Longhorn replicas with best-effort local placement and a
`Retain` reclaim policy. At full allocation the eight data PVCs can consume up
to 4.8 TB of backend space before snapshots, plus up to 270 GB for manager
volumes. OpenSearch's replica and Longhorn's copies cover different failure
levels. Neither replaces an independent OpenSearch snapshot repository.

The OpenSearch data directory uses Longhorn block volumes. It does not mount an
NFS or SMB filesystem directly. Both Longhorn disk pools now depend on the
Proxmox06 NFS server and the same guest-image filesystem. Existing Longhorn
disk names/tags and OpenSearch node attributes remain unchanged to preserve
volume placement. See [NFS migration](../docs/nfs-migration-20261025.md).

## Private access

- Dashboards: https://opensearch.cormierconsulting.io
- API from LAN/VPN: https://opensearch-api.cormierconsulting.io
- API in Kubernetes: https://opensearch.opensearch.svc.cluster.local:9200

Private DNS maps the two external names to Traefik VIP `10.99.15.50`. Traefik
accepts private source ranges and balances API requests across both data pools.
The names are absent from the public gateway allowlist. Transport, API,
Dashboards and ingress TLS are enabled, and backend certificates are verified.

The administrator is `admin`. Run `./opensearch/copy-admin-password.ps1` to
copy its generated password without printing it. The only built-in accounts are
the randomized administrator and Dashboards service account; demo accounts are
removed. Create narrowly scoped application and ingestion users before loading
real data.

## Deploy and verify

Prerequisites are working `kubectl` access, Helm, Node.js 24+, Longhorn,
cert-manager, Traefik, the `letsencrypt-prod` ClusterIssuer and physical zone
labels. The script verifies every selected worker and required Longhorn disk tag
before changing the cluster.

```powershell
./opensearch/deploy.ps1
node opensearch/verify-live.mjs

# Also recreate one data pod and prove that its PVC and test document survive.
node opensearch/verify-live.mjs --restart-one-node
```

Use `-ConfigurePrivateDns` only for a first installation without the existing
records and while an authenticated `kubectl proxy` listens at `127.0.0.1:18089`.
The DNS helper refuses conflicting records and records the managed DNS backup
and operation receipt under ignored `.local/opensearch/` storage.

Live verification checks trusted private HTTPS, authentication, public-gateway
rejection, green 11-node health, exact manager/data roles, zone and storage
attributes, generated accounts, all 11 PVCs, three tagged Longhorn copies per
volume, cross-zone replica placement, eight-node shard distribution, indexing
and search. The optional drill deletes only one data pod and removes its unique
test index afterward. The non-secret report is
`.local/opensearch/live-verification.json`.

## Operations and recovery

Monitor cluster health, unassigned shards, disk watermarks, JVM heap/GC,
indexing rejections, Longhorn volume health and both backend storage systems.
No collectors, automatic retention policy or dedicated OpenSearch metrics
scrape is included yet.

Before importing important data, configure an OpenSearch-native snapshot
repository on an agreed independent NFS or S3-compatible target, schedule it
and test a restore into another cluster. Longhorn replicas and retained PVCs
are recovery aids rather than independent backups.

For configuration rollback, restore the earlier Git manifests and let the
operator roll nodes sequentially while preserving all PVCs. Do not delete the
namespace, CRDs, PVCs, retained PVs or CA secrets as a restart procedure. Do
not run an older OpenSearch version against data written by a newer version.

Official references: [operator guide](https://github.com/opensearch-project/opensearch-k8s-operator/blob/v3.0.0/docs/userguide/main.md)
and [OpenSearch production setup](https://docs.opensearch.org/latest/install-and-configure/install-opensearch/index/).
