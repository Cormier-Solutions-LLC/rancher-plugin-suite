# Private Wazuh search backend

Wazuh 4.14.11 runs in the wazah namespace with three Wazuh
Indexer pods using OpenSearch 2.19.7. The indexer pods run on kubworker02,
kubworker04, and kubworker14 in three physical zones. Each uses a retained
16 GiB strict-local Longhorn volume. Each Proof Studio shard has one
replica. A Wazuh manager master and one worker use the same indexer and
are scheduled on different Proxmox hosts. Each manager has a 32 GiB
volume. The manager cluster port is reachable from the worker inside
Kubernetes. The native Wazuh Dashboard uses the master API.
The private TCP 1514 route balances events across both managers. TCP 1515
goes to the master for enrollment. The generic OpenSearch Dashboards
service uses version 2.19.7 and the same cluster.

- Wazuh console: https://wazah.cormierconsulting.io
- Search API: https://opensearch-api.cormierconsulting.io
- Generic Dashboards: https://opensearch.cormierconsulting.io

The Wazuh console's Windows DNS A record points to the private Traefik VIP
10.99.15.50. The ingress enforces the existing private-networks middleware,
uses a certificate obtained with DNS-01, and verifies the dashboard backend
certificate and hostname. Keep the Wazuh hostname out of the public DNS
address records and the public gateway allowlist. The manager API is
reachable within Kubernetes from the native Dashboard. The same private
hostname and VIP also carry Wazuh agent events on TCP 1514 and enrollment
on TCP 1515. Traefik preserves its private source allowlist and forwards
events to the manager cluster and enrollment to the master. The master
terminates enrollment TLS.

The initial Wazuh Indexer admin password comes from
`wazah/opensearch-admin-password`. Run
`./opensearch/copy-admin-password.ps1 -Namespace wazah` to copy the initial
password. The helper reads the initial value after a dashboard password change.
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

Verify the three indexer workers have schedulable thin Longhorn disks in
distinct zones. The namespace quota reserves seven claims and 112 GiB.
The five current claims use the full storage quota. Keep the Wazuh CA
secret and data claims together for disaster recovery. For an existing Wazuh cluster,
apply the manifests with the launch ConfigMap's bootstrap value disabled.

For a fresh recovery with no Wazuh cluster metadata, initialize the
wazuh-indexer-launch ConfigMap with bootstrap=enabled before applying
indexer.yaml. Set it to disabled after all three nodes have formed one
cluster. Do not enable bootstrap on attached data from an existing cluster.

1. Apply `namespace.yaml`. Restore the existing `wazuh-indexer-ca` Secret
   in the `wazah` namespace for an existing cluster. For a fresh deployment,
   apply `root-ca.yaml` and wait for the CA Certificate to become Ready.
   Apply `certificates.yaml` to issue the leaf certificates.
2. Run seed-secrets.ps1 to create missing secrets and stage the bootstrap
   source. Apply indexer.yaml, dashboards.yaml, traefik-transports.yaml, and
   wazuh-console.yaml. Apply bootstrap-job.yaml only for initial bootstrap
   or intentional reseeding. Remove the temporary wazuh-indexer-proof-bootstrap
   Secret after the job completes.
3. Apply wazuh-workers.yaml. Confirm the worker has synchronized with the
   master. Apply wazah-certificate.yaml, wazah-private-ingress.yaml, and
   search-private-ingress.yaml after the endpoint certificates are ready.
4. Apply wazah-agent-ingress.yaml. For the private `traefik` Helm release
   in `traefik-system`, upgrade using its installed chart version,
   `--reuse-values`, and the wazah-agent-traefik-values.yaml overlay.
   Wait for all Traefik replicas, then check TCP 1514 and 1515 from the LAN
   and verify the dashboard over HTTPS. To withdraw the agent listeners,
   remove those two ports from the Helm release values and the resources
   in wazah-agent-ingress.yaml.
5. Point the Proof Studio sync job at
   `https://wazuh-indexer.wazah.svc.cluster.local:9200`. Apply
   `proof-search-egress.yaml`. Run `proof-canary.ps1 -UseScheduledTemplate`
   to verify the authenticated subject and source fingerprints.

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

The upstream OpenSearch workloads are scaled to zero. The three legacy
Longhorn claims and volumes were permanently deleted after cutover.
The encrypted workstation export under %LOCALAPPDATA%/Codex/SearchRecovery
contains the earlier index documents and diagnostics. The CDC Data
Research workloads are retired.

Wazuh moved from opensearch to wazah by rebinding its four retained
volumes and preserving its CA. The worker has its own volume on another
Proxmox host. Use `/var/ossec/bin/cluster_control -l` on the master to
check membership and compare agent node assignments to validate traffic
distribution. Agent enrollment depends on the single master.

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

## Deploy from Proxmox

`proxmox/deploy-guest.py` uses the Proxmox QEMU Guest Agent to run the same
Windows or Debian installer against a single running VM. It looks up the
VM owner in the cluster and uses the owner's Proxmox-managed SSH host key
when forwarding through another node. The workstation needs Python and
OpenSSH with a trusted Proxmox entry point. The guest needs an enabled,
responding QEMU Guest Agent and outbound access to the package repository
and Wazuh manager.

Set `$ProxmoxEntry` to a trusted SSH target and `$TargetVm` to the VMID you
intend to deploy. The default mode validates the package inside the
guest without changing the installed agent, firewall, or enrollment file.

```powershell
python wazuh-indexer/proxmox/deploy-guest.py --entry $ProxmoxEntry --vmid $TargetVm
```

For an already configured agent, use the same command with `--apply`.
For a fresh agent, pipe the current Kubernetes enrollment secret into an
explicit apply. Proxmox forwards the credential through guest stdin and
the script stages it in a protected `authd.pass` file inside the guest.

```powershell
kubectl -n wazah get secret wazuh-manager-credentials -o 'jsonpath={.data.enrollment-password}' |
    python wazuh-indexer/proxmox/deploy-guest.py --entry $ProxmoxEntry --vmid $TargetVm --apply --enrollment-stdin
```

Verify the VM is active in the Wazuh dashboard after applying. If the
launcher reports a guest execution timeout, check the guest process
status on the owning node before retrying.
