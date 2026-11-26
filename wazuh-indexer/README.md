# Private Wazuh search backend

Wazuh 4.14.11 runs in the existing opensearch namespace with three Wazuh
Indexer pods using OpenSearch 2.19.7. The indexer pods run on kubworker02,
kubworker04, and kubworker14 in three physical zones. Each uses a retained
16 GiB strict-local Longhorn volume. Each Proof Studio shard has one
replica. One Wazuh manager and one native Wazuh Dashboard use the same
indexer. The generic OpenSearch Dashboards service uses the matching 2.19.7
version and the same cluster.

- Wazuh console: https://wazah.cormierconsulting.io
- Search API: https://opensearch-api.cormierconsulting.io
- Generic Dashboards: https://opensearch.cormierconsulting.io

The Wazuh console's Windows DNS A record points to the private Traefik VIP
10.99.15.50. The ingress enforces the existing private-networks middleware,
uses a certificate obtained with DNS-01, and verifies the dashboard backend
certificate and hostname. Keep the Wazuh hostname out of the public DNS
address records and the public gateway allowlist. The manager API is
reachable within Kubernetes from the native Dashboard. Agent enrollment
and event ports have no external exposure in these manifests.

The initial Wazuh Indexer admin password comes from
opensearch/opensearch-admin-password, which also holds the legacy OpenSearch
credential for rollback. After an in-dashboard Wazuh password change, the
opensearch/copy-admin-password.ps1 helper can still return the initial value.
On an existing Wazuh installation, the bootstrap job restores the admin
backend role and preserves the current password. The backend role maps to
all_access. Keep it assigned when editing the user in the dashboard.
Native and generic Dashboards use a separate kibanaserver credential.
Wazuh Manager uses a separate ingest credential scoped to wazuh index
patterns, and its API uses separate admin and dashboard credentials.
Proof Studio uses its existing scoped credential and the Wazuh CA. The
Security plugin verifies HTTP hostnames and uses a private CA and a
dedicated node DN for inter-node mTLS. The bootstrap client certificate
is for administration only.

A named Wazuh administrator needs the indexer admin backend role and a
manager dashboard role mapping from the exact OpenSearch `user_name` to
the manager's administrator role. The native dashboard sends this identity
to the manager using `run_as`. On the current deployment, the built-in
`wui_opensearch_admin` mapping covers `admin`, and
`wui_opensearch_acormier` covers `acormier`. If restoring without the
manager's retained data, recreate the named mapping after restoring the
indexer account.

## Restore or redeploy Wazuh

Verify the three workers have schedulable thin Longhorn disks in distinct
zones. The namespace quota reserves seven claims and 112 GiB, including
the retained legacy OpenSearch claims. Keep the Wazuh CA secret and data
claims together for disaster recovery. For an existing Wazuh cluster,
apply the manifests with the launch ConfigMap's bootstrap value disabled.

For a fresh recovery with no Wazuh cluster metadata, initialize the
wazuh-indexer-launch ConfigMap with bootstrap=enabled before applying
indexer.yaml. Set it to disabled after all three nodes have formed one
cluster. Do not enable bootstrap on attached data from an existing cluster.

1. Apply certificates.yaml, indexer.yaml, dashboards.yaml,
   traefik-transports.yaml, and wazuh-console.yaml.
2. Run seed-secrets.ps1 to create missing Kubernetes secrets and stage
   the bootstrap source. Apply bootstrap-job.yaml only for intentional
   bootstrap or principal reseeding. Confirm the job completes, then
   remove the temporary wazuh-indexer-proof-bootstrap Secret.
3. Apply wazah-certificate.yaml. After cert-manager reports Ready,
   apply wazah-private-ingress.yaml. Keep the private Windows DNS record
   listed above. In the existing opensearch-pilot-private NetworkPolicy,
   preserve the exclusions for wazuh-dashboard and wazuh-manager so that
   their dedicated ingress policies are effective.
4. Run proof-canary.ps1 against the deployed job template. Verify the
   authenticated subject and the source fingerprints before routing the
   scheduled job or private search hosts with switch-proof-and-ingress.ps1.

Verify that a manager-generated alert appears in a wazuh-alerts-* index.
Filebeat's output test validates the connection. Publishing the alert also
exercises the on-connect pipeline setup and the bulk write permissions.

The indexer has certificate hot reload enabled. Renewed manager API and
dashboard certificates require a rollout of the corresponding workload to
load the new leaf certificates. The in-cluster CA remains stable through
leaf rotation.

## Cutover evidence and rollback

On 2026-11-26 the canary indexed all 13 Proof Studio rows using the existing
application credentials. An anonymous request, a mismatched TLS hostname,
the security administration API, and an unrelated index were rejected.
The scheduled run and post-cutover verification both matched all 13
source fingerprints. The private Wazuh console accepted authenticated
HTTPS, its pod verified the manager API certificate and credentials, and
Filebeat verified TLS 1.3 to the indexer. The public gateway rejected
the Wazuh hostname and neither tested public resolver returned an address.

The original 3.9.0 StatefulSet, Dashboards, and operator are scaled to zero.
Their three retained claims still hold the old cluster for rollback. An
encrypted workstation export under %LOCALAPPDATA%/Codex/SearchRecovery
contains the old Proof Studio index, query diagnostics, and security audit
documents. Its bytes and document counts were checked on readback. Keep
the old claims while the recovery window is open.

For rollback, scale the opensearch-operator deployment to one and let it
reconcile the original OpenSearchCluster. Wait for the old indexer and
Dashboards to serve authenticated HTTPS. Run
switch-proof-and-ingress.ps1 -Rollback, then verify a scheduled sync before
making any further changes. The CDC Data Research workloads remain retired.

## Action1 agent scripts

Save `action1/install-or-update-debian.sh` as a Bash script for Debian endpoints
and `action1/Install-OrUpdate-Windows.ps1` as a PowerShell script for Windows
endpoints. The scripts install a missing Wazuh agent and upgrade an older
agent to 4.14.11. They leave equal or newer installed versions in place.
Existing agents keep their manager and enrollment settings. New agents
use `wazah.cormierconsulting.io` by default.

Fresh installations open outbound TCP 1514 (events) and 1515 (enrollment)
to the manager IPs in Windows Defender Firewall or in UFW when it is
active. The Debian script relies on the existing egress policy when
another firewall manages the host. Both scripts test the two connections
before running the installer. The private manager listener must be
reachable from each endpoint.

Stage a nonempty enrollment password file on each fresh endpoint through
an approved secret channel. On Windows use `%ProgramFiles(x86)%\ossec-agent\authd.pass`
(`%ProgramFiles%` on 32-bit Windows) and restrict access to SYSTEM and
administrators. On Debian, stage a root-owned file at
`/var/ossec/etc/authd.pass` with mode 0600. The installer grants the Wazuh
group read access before starting the service. Keep the password out of
Action1 script bodies, arguments, output, and Git. Verify agent check-in
in Wazuh after installation. Action1 success verifies local installation
and service startup, or reports a pending Windows reboot.

For a package-only preflight, run Debian with `WAZUH_VALIDATE_ONLY=1`
and Windows with `-ValidateOnly`. When the manager is upgraded, update
the target versions and SHA-512 digests from the Wazuh package list.
