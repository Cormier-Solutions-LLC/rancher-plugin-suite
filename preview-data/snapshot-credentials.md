# Scheduled snapshot credentials

Save Schedule and Enable open the same Snapshot Options dialog as Run Now.
Including Secrets requires a matching strong password. The backend saves that
password in a dedicated Kubernetes Secret vault and saves the source
in an encrypted ZIP. Schedule JSON and snapshot indexes contain only references,
never passwords or Secret values. Each automatic archive retains its own password
reference, so changing the schedule password does not prevent older ZIP recovery.
Only unattended capture resolves that reference automatically. Reading, unlocking
or merging a protected archive requires its password, including inside Rancher.
An empty password never falls back to the scheduling vault.

The UIPlugin charts register browser extensions; they do not deploy this snapshot
backend. In-cluster backend deployment must set `SNAPSHOT_SECRET_NAMESPACE` (or
use the service-account namespace), mount its service-account token and CA, and
The deployed `SNAPSHOT_PASSWORD_VAULT` mode grants `get` and `update` only on the
named vault. The optional standalone immutable-Secret provider instead needs
`create` and `get` in its dedicated credential namespace. Neither needs Secret
list or delete permission.
Use a separate credential namespace/account for each manager. Backend requests
validate the reference prefix, namespace and ownership label. Kubernetes TLS uses
the mounted CA; tokens are reread for rotation. Do not set
`SNAPSHOT_PREVIEW_MOCK_DATA` on a live backend. If Secret storage is unavailable,
protected schedule creation fails rather than saving the password as plaintext.
See [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
and [in-pod API access](https://kubernetes.io/docs/tasks/run-application/access-api-from-pod/).

Local suite previews explicitly enable `SNAPSHOT_PREVIEW_MOCK_DATA=true`. Their
mock secret store lives in the private snapshot directory's `.credentials` folder,
with AES-256-GCM encrypted credentials and a private local master key. Preserve
this directory with the preview snapshot files for recovery across restarts.
It is outside the editable inventory JSON and is not a live Kubernetes Secret.
The local preview also supplies marked 1 GiB mock capacity when no actual quota
is configured; `SNAPSHOT_STORAGE_LIMIT_BYTES` takes precedence. Largest ZIP size
and saved schedule cadence remain the basis of the exhaustion estimate.

Keep referenced Secrets for as long as protected ZIPs need them. Uninstalling the
UI plugin, disabling scheduling or changing passwords must not delete credentials
needed by existing backups. Manual Run Now passwords remain transient and are
not automatically retained. Live authorization and Secret storage must be tested
against the intended backend deployment before treating recovery as verified.

Live Network schedules save a redacted scope template and read routing resources
and the named manager configuration afresh on every run. If Secrets are included,
the backend reads only names referenced by those fresh scoped resources; it never
uses cached browser credentials. Named `get` grants are generated from the live
inventory by `scripts/prepare-network-snapshot-secret-access.mjs`. They provide no
Secret list/write permission. Newly referenced names require reconciling those
grants; an absent or denied name rejects capture without creating a partial
archive. Grant reconciliation does not read Secret contents. Manual encrypted
capture instead uses fresh reads under the active Rancher user's permissions.
