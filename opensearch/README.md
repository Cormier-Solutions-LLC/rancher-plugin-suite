# Private distributed OpenSearch

OpenSearch and Dashboards 3.9.0, managed by operator 3.0.0 using the official
3.0.14 Helm chart. The chart download is pinned and SHA-256 verified.

## Storage and placement

- Three combined cluster-manager/data/ingest nodes, each requesting 2 CPUs and
  8 GiB RAM with a 4 GiB JVM heap. Required anti-affinity uses physical Proxmox
  zones, not merely Kubernetes VM names. OpenSearch also advertises those zones
  for shard allocation awareness.
- Three **dedicated 30 GiB Longhorn PVCs**: 90 GiB total, approximately 96.6 GB.
  The separate `opensearch-longhorn-retain` class retains volumes if claims are
  deleted. Other applications' disks and the default storage class are untouched.
- A hard namespace quota of 93 GiB keeps requested PVC capacity below 100 decimal
  GB, including the temporary 1 GiB bootstrap claim. The bootstrap claim is removed
  automatically after initialization; its retained PV may remain Released. Preserve
  it until deliberately retiring that bootstrap recovery state.
- Longhorn keeps three copies on distinct physical zones under existing global
  placement rules. Thus 90 GiB of PVC capacity can consume up to 270 GiB of backend
  data space, plus snapshots. Replication does not provide an independent backup.
- The requested **50 GB software/temporary-storage budget** is enforced as
  `limits.ephemeral-storage: 50G` across the namespace. Each search container has
  a 12 GB writable-storage limit. Existing workers provide the OS; there is no
  separate OS PVC. Shared OS files and container image caches are outside Kubernetes
  namespace ephemeral-storage accounting. Kubelet local-storage measurement must
  remain enabled to enforce container eviction limits.
- Existing network-backed block storage is supported through Longhorn. No NFS
  shared filesystem is used as an OpenSearch data directory. Shared PowerVault,
  network and Proxmox storage dependencies still define the actual failure boundary;
  20 Gbps link speed does not establish disk latency, IOPS or backend redundancy.

With one OpenSearch replica and roughly 30% operating headroom, plan around
30–35 GiB of primary indexed data, less system index overhead. Index size can differ
from source document size. Watermarks are 70% low, 80% high and 90% flood stage.
The PVC quota caps allocation, not retained documents. No automatic deletion or
retention policy is configured; establish retention before sustained ingestion.

## Access

- Dashboards: https://opensearch.cormierconsulting.io
- API from LAN/VPN: https://opensearch-api.cormierconsulting.io
- API inside Kubernetes: https://opensearch-nodes.opensearch.svc.cluster.local:9200
  (trust `ca.crt` from the `opensearch-http-cert` Secret).

Internal DNS maps both external names to private Traefik VIP `10.99.15.50`.
Traefik permits private source ranges only. These names are excluded from the
public gateway allowlist. ClusterIP Services do not expose transport or node ports.
NetworkPolicy limits Dashboards ingress to its namespace and Traefik; authenticated
API access is allowed from cluster namespaces. No public DNS A records are created.
Let's Encrypt uses the existing DNS-01 issuer. TLS is enabled for transport, API and
Dashboards; Traefik and Dashboards validate backend CA certificates. The operator
renews generated certificates, and cert-manager renews ingress certificates.

Username: `admin`. Run `./opensearch/copy-admin-password.ps1` to copy the password
without printing it. Passwords are generated into Kubernetes Secrets; demo users
are removed. Create narrowly scoped ingest/application accounts before connecting
real clients. Do not give applications the admin credential.

`index-defaults.yaml` sets one primary shard and one replica for new `app-*`,
`documents-*`, `logs-*`, `events-*`, `traces-*` and `metrics-*` indices. Applications
can provide higher-priority templates. System index templates are left alone.

## Deploy and verify

Prerequisites: existing cluster access, Helm, Node.js 24+, Longhorn, cert-manager,
Traefik, the `letsencrypt-prod` DNS-01 ClusterIssuer and physical zone node labels.
Inspect `kubectl config current-context` before applying to another environment.

```powershell
./opensearch/deploy.ps1
node opensearch/verify-live.mjs
# Optional bounded recovery drill: recreates only opensearch-nodes-0.
node opensearch/verify-live.mjs --restart-one-node
```

For a first installation without DNS records, start `kubectl proxy --port=18089
--address=127.0.0.1` in another terminal and use `-ConfigurePrivateDns`. The DNS helper
uses the existing managed Windows DNS workflow, saves a pre-change backup, refuses
conflicting records and records durable receipts. It does not replay unresolved writes.

Live verification checks trusted HTTPS, API authentication, Dashboards login redirect,
public gateway hostname rejection, green three-node health, physical placement,
internal users, dedicated Longhorn volumes and replica placement, indexing and search.
The optional drill checks a new pod UID, the same PVC UID and preserved indexed data.
It does not simulate physical-host, PowerVault, network or power loss. Each test uses
and removes its own uniquely named index. Reports are written under ignored
`.local/opensearch/` without passwords or security password hashes.

## Recovery and operations

Inspect `kubectl -n opensearch get pods,pvc,opensearchcluster,resourcequota` and
`kubectl -n opensearch describe opensearchcluster opensearch`. Monitor free disk,
JVM heap/GC, indexing rejection, shard health and node availability. This deployment
does not yet add dedicated OpenSearch metric scraping or application/log collectors.

Before storing important data, configure an **OpenSearch-native snapshot repository**
on an agreed NFS or S3-compatible backup target, schedule snapshots and test a restore
to a separate cluster. No native backup/restore has been configured or verified yet.
Longhorn replicas and retained volumes are not substitutes for those snapshots.

For a bad configuration, restore the prior Git manifests and apply them, allowing
the operator to roll nodes sequentially. Keep all data PVCs. Do not downgrade an
OpenSearch image over data migrated by a newer version. Recover incompatible data
from a verified native snapshot into a separate cluster. Do not delete the namespace,
operator CRDs, data PVCs, retained PVs or CA Secrets as a restart procedure.

Official references: [operator release guide](https://github.com/opensearch-project/opensearch-k8s-operator/blob/v3.0.0/docs/userguide/main.md),
[OpenSearch production setup](https://docs.opensearch.org/latest/install-and-configure/install-opensearch/index/).
