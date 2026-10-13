# Recover routing configurations without the application

New captures use a ZIP containing `index.json`, `configuration.json`, and
`manifests.yaml`. Include Secrets encrypts the entire payload as the outer ZIP's
`backup.zip` entry. Keep the password separately; recovery needs an AES-capable ZIP
reader, first unlocking the outer archive and then extracting the inner archive.
Wrong or missing passwords cannot recover protected backups. The npm preview stores
archives under `.local/preview-snapshots/network-manager/`; the optional container
stores them on its mounted snapshot volume. Download the whole ZIP from Snapshots.
Passwords and decrypted Secret values are never saved in project fixtures.

The instructions below also cover previously saved legacy JSON/YAML backups.

The following historical instructions describe legacy JSON/YAML recovery. Current
shared requirements, including ZIP export and optional encrypted Secret capture,
are maintained in the [Snapshots standard](../RANCHER-PLUGIN-DESIGN.md#8-snapshots-schedules-restoration-and-recovery).
These legacy recovery instructions are implementation evidence, not an exception
to that contract. Current encrypted ZIP round-trip and password rejection are tested.


Each legacy stored snapshot has a JSON index and a separate multi-document YAML
file under `/var/lib/simple-network-manager/snapshots`. The YAML can be read
without Network Manager. Snapshots also offers both downloads.

Both formats preserve inspected route and Certificate specifications
and local drafts, plus known Services, Middleware, TLS options, IngressClass and
issuer specifications needed by those routes. The JSON index also keeps application
port configurations, issuer profiles and pending proposals. Keep both files to
recover application settings as well as Kubernetes manifests. It does not fetch
a fresh live configuration. Original YAML comments, complete labels/annotations,
Helm values and application data are not included. Readable referenced Secret
manifests/values are included when captured through native Rancher access; the
preview cannot recover credentials missing from its inspection. Backups may
contain private keys, tokens and passwords, so restrict access to both files. Inspect the
coverage before treating it as a recovery backup. Older reference-only snapshots
do not gain missing manifests retroactively.

For an observed object that also has a proposed local edit, the YAML retains the
observed pre-change version. The JSON index keeps the edited draft separately.
Restoring within the preview restores local configuration and review drafts;
it does not apply Kubernetes resources.

## Docker

From the development directory, use PowerShell to copy the snapshot files:

```powershell
New-Item -ItemType Directory -Force -Path .\recovered-snapshots
$previewContainer = docker compose -f compose.preview.yaml ps -a -q preview
docker cp "${previewContainer}:/var/lib/simple-network-manager/snapshots/." .\recovered-snapshots
```

This also works while the container is stopped. If the container was removed,
recreate it with the same Compose project and retained `snapshots` volume, then
copy the files. Do not remove that volume. Back it up independently according to
your host's backup policy. See [Docker container copy](https://docs.docker.com/reference/cli/docker/container/cp/).

## Kubernetes hosting

The optional preview uses a persistent volume claim at the same directory.
If the application pod is unavailable, mount the retained claim read-only in a
recovery pod appropriate to your storage provider, or restore its volume backup.
Read the YAML files from that mount. Application availability is not required
to inspect them; volume retention and backup coverage depend on your deployment.

## Manually restore reviewed manifests

First inspect the YAML, choose the correct cluster context and check every
namespace. For Helm or Fleet managed objects, restore the owning chart values
or Git source as well so reconciliation retains the intended configuration.
Make sure required Services, CRDs, Middleware and TLS Secrets are available.

Example commands for a selected backup file:

```powershell
kubectl config current-context
# Remove Secret documents you do not intend to replace before applying.
kubectl apply --dry-run=server -f .\recovered-snapshots\selected-backup.yaml
kubectl diff -f .\recovered-snapshots\selected-backup.yaml
# Apply only after reviewing the desired restoration:
kubectl apply -f .\recovered-snapshots\selected-backup.yaml
```

These commands are instructions for a manual recovery; this project does not
execute them. Apply updates or creates the listed objects; it does not remove
extra resources created after the snapshot. Review those separately. See
[Kubernetes declarative configuration](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/declarative-config/).


## Ordered snapshot merging

Merge Snapshots opens a page with a separate selection step for each item type,
including Secrets. Order sources highest priority first,
select desired changed items and dependencies (matching items are retained
automatically and hidden from selection), review only additions/changes against
current configuration, then confirm. The result is one new JSON/YAML pair;
merging does not overwrite current configuration. Original capture dates are
preserved, including when an input is already a merged snapshot. Unchecked
changed Secrets keep readable current credentials. Explicit selection chooses
the snapshot version; matching Secrets remain automatically included. Secret
values are hidden in the comparison, but included in recovery files. Select the new
snapshot to prepare restoration drafts separately.

Original removal is optional and occurs only after a durable merge save. A merge
that excludes items cannot remove its sources. After a cleanup failure, keep the
saved merged snapshot and retry source removal without creating a second merge.
Size displays the combined JSON and YAML byte counts, automatically using KB,
MB, GB or TB for larger files.
