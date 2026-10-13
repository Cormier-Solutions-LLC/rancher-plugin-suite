# ARC runner capacity and idle policy

Target: `arc-runners/cormier-runners`, ARC chart/controller `0.14.2`.

## Prebuilt Linux image

The Linux x64 runner now uses the Harbor image recorded by digest in
`image-values.yaml` and `image-release.json`. The reproducible build recipe and
cache layout are documented in `image/README.md`; `image-manifest.json` records
the installed SDK patches and OS packages. CI continues using
`runs-on: cormier-runners`.

The image was tested locally for setup/fallback contracts, PowerShell modules,
all three Playwright engines and Native AOT. A Kubernetes canary also verified
Docker-in-Docker and the shared workspace. All 16 worker nodes were prewarmed
before the Helm image upgrade to revision 10. Temporary validation and prewarm
resources were removed afterwards. Capacity, resource settings, the Docker
sidecar and one-hour idle policy remain in place.

The CI reuse optimizations and versioned image source are in WebSockets-Kubernetes
PR 228. Its full CI currently encounters Harbor secret references and Windows
line-ending assertions that also fail on the recorded main-branch baseline.
The focused setup workflow is used to validate the runner change separately.

Roll back just this image with:

```powershell
.tools/helm/windows-amd64/helm.exe rollback cormier-runners 9 -n arc-runners --wait --timeout 3m
```

Revision 9 retains the 16-runner capacity and idle policy. Do not remove those
resources for an image-only rollback.

## Capacity and idle policy

`scaling-values.yaml` raises capacity from 8 to 16. Apply it as an overlay on
the existing Helm release so the authentication reference, runner image,
Docker sidecar, placement, priority, and resource settings are preserved.
`quota.yaml` raises the matching runner quota to 16 pods, 16 requested CPU,
32 GiB requested memory, and 256 GiB memory limits. The existing priority-class
scope is preserved; the policy jobs are outside that quota.

These are ephemeral, single-job runners. The idle policy retains a pool of
fresh runners, not completed runner pods or their workspaces. ARC 0.14.2
supports `minRunners` and `maxRunners` but has no scale-set idle-delay field.

The CronJob checks once per minute. It sets `minRunners: 16` while jobs are
active or the latest activity is less than 3,600 seconds old, then sets
`minRunners: 0`. New demand still scales the pool up through ARC; the next
check restores the warm pool. The maximum remains 16 in either state.
Shutdown occurs on the first successful check after the idle hour expires.

The `runners.cormierconsulting.io/last-active-at` annotation persists the last
observed activity. Running job assignments refresh it. Runner creation also
refreshes it because ARC replaces runners after jobs, capturing short jobs
that finish between checks. Startup and failed-runner replacement can extend
the grace period conservatively. The first policy run starts a full hour.
Read failures and timestamp errors make the policy fail without changing
scaling. A resource-version precondition prevents overwriting concurrent edits.

The policy can list runners and get/patch only the named runner scale set.
It cannot read secrets or delete pods. It uses a pinned Python image,
verified TLS, a non-root user, and a read-only root filesystem.

## Validation

```powershell
python arc-runners/test_idle_policy.py
kubectl apply --dry-run=server -k arc-runners
.tools/helm/windows-amd64/helm.exe upgrade cormier-runners oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set --version 0.14.2 -n arc-runners --reuse-values -f arc-runners/scaling-values.yaml --dry-run=server --hide-secret
```

## Apply

Back up the current Helm values, runner scale set, and quota first. The initial
backups for this change are in ignored `.local/arc-runners-2026-10-11/`.

```powershell
kubectl apply -f arc-runners/quota.yaml
.tools/helm/windows-amd64/helm.exe upgrade cormier-runners oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set --version 0.14.2 -n arc-runners --reuse-values -f arc-runners/scaling-values.yaml --wait --timeout 3m
kubectl apply -k arc-runners
kubectl create job arc-runner-idle-policy-initial --from=cronjob/arc-runner-idle-policy -n arc-runners
kubectl logs -n arc-runners job/arc-runner-idle-policy-initial
kubectl get autoscalingrunnerset,ephemeralrunnersets,pods,resourcequota -n arc-runners
```

Helm owns the baseline limits; the policy owns the runtime `minRunners` value
and activity annotation. Future Helm upgrades must retain the 16-runner limit.

## Rollback

Remove the CronJob and its jobs first, then restore Helm revision 8 and the
previous quota. Removing policy jobs prevents a last concurrent write.

```powershell
kubectl delete cronjob arc-runner-idle-policy -n arc-runners --cascade=foreground
kubectl delete job arc-runner-idle-policy-initial -n arc-runners --ignore-not-found
kubectl delete -f arc-runners/idle-policy.yaml --ignore-not-found
kubectl delete configmap arc-runner-idle-policy -n arc-runners --ignore-not-found
.tools/helm/windows-amd64/helm.exe rollback cormier-runners 8 -n arc-runners --wait --timeout 3m
kubectl apply -f .local/arc-runners-2026-10-11/quota-rollback.json
```

Restoring the quota restricts new admissions while existing running jobs finish.

## Deployment record

Applied on October 11, 2026 to Helm revision 9. Eight idle-policy tests passed,
and Kubernetes and Helm server dry runs passed before deployment. The deployed
policy successfully read active job assignments and maintained `minRunners: 16`.
All 16 runner pods reached `2/2` readiness, with no pending runners. Completed
jobs were replaced by new running runners during verification.
The full real-time idle hour has not been observed; its boundary was verified
with the policy tests. The initial 50-second job deadline was extended to
180 seconds to accommodate cold image pulls; scheduled jobs then succeeded.
