#!/usr/bin/env bash
# Run on kubcontroller01 alongside nfs-media-10.99.1.203.yaml.
# Requires the existing media data at 10.99.1.203:/volume1/Storage.
# Stops on errors; never removes PVs, PVCs, finalizers, or NAS files.
set -euo pipefail
umask 077

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
manifest="$script_dir/nfs-media-10.99.1.203.yaml"
[[ -f "$manifest" ]] || { echo "Missing $manifest" >&2; exit 1; }

check_deployment() {
  local namespace="$1" deployment="$2" expected="$3" actual hpa_targets
  actual="$(kubectl -n "$namespace" get deployment "$deployment" -o jsonpath='{.spec.template.spec.volumes[?(@.name=="media")].persistentVolumeClaim.claimName}')"
  [[ "$actual" == "$expected" ]] || {
    echo "$namespace/$deployment media claim is '$actual'; expected '$expected'. Stopping before changes." >&2
    exit 1
  }
  hpa_targets="$(kubectl -n "$namespace" get hpa -o jsonpath='{range .items[*]}{.spec.scaleTargetRef.kind}{"/"}{.spec.scaleTargetRef.name}{"\n"}{end}')"
  if grep -Fxq "Deployment/$deployment" <<< "$hpa_targets"; then
    echo "$namespace/$deployment has an HPA. Stop its reconciliation before a manual scale-down." >&2
    exit 1
  fi
}
check_deployment plex-server plex-server plex-server-media
check_deployment torrent torrent media-storage

# Save the current objects and original replica counts before any mutation.
backup_dir="$(mktemp -d "$PWD/nfs-media-backup.XXXXXX")"
echo "Backup directory: $backup_dir"
kubectl get pv plex-server-media-nfs media-storage-torrent -o yaml > "$backup_dir/original-pvs.yaml"
kubectl -n plex-server get pvc plex-server-media -o yaml > "$backup_dir/plex-pvc.yaml"
kubectl -n torrent get pvc media-storage -o yaml > "$backup_dir/torrent-pvc.yaml"
kubectl -n plex-server get deployment plex-server -o yaml > "$backup_dir/plex-deployment.yaml"
kubectl -n torrent get deployment torrent -o yaml > "$backup_dir/torrent-deployment.yaml"
plex_replicas="$(kubectl -n plex-server get deployment plex-server -o jsonpath='{.spec.replicas}')"
torrent_replicas="$(kubectl -n torrent get deployment torrent -o jsonpath='{.spec.replicas}')"
printf 'plex-server=%s\ntorrent=%s\n' "$plex_replicas" "$torrent_replicas" > "$backup_dir/replicas.txt"

# Server-side validation, then create the new statically bound volumes/claims.
kubectl apply --dry-run=server -f "$manifest"
kubectl apply -f "$manifest"
kubectl -n plex-server wait pvc/plex-server-media-v2 --for=jsonpath='{.status.phase}'=Bound --timeout=60s
kubectl -n torrent wait pvc/media-storage-v2 --for=jsonpath='{.status.phase}'=Bound --timeout=60s

# Discover each deployment's exact pod selector and stop its old consumers.
plex_selector="$(kubectl -n plex-server get deployment plex-server -o go-template='{{range $k,$v := .spec.selector.matchLabels}}{{$k}}={{$v}},{{end}}')"
torrent_selector="$(kubectl -n torrent get deployment torrent -o go-template='{{range $k,$v := .spec.selector.matchLabels}}{{$k}}={{$v}},{{end}}')"
plex_selector="${plex_selector%,}"
torrent_selector="${torrent_selector%,}"
[[ -n "$plex_selector" && -n "$torrent_selector" ]] || { echo "Missing deployment selectors; stopping." >&2; exit 1; }
kubectl -n plex-server scale deployment/plex-server --replicas=0
kubectl -n torrent scale deployment/torrent --replicas=0

wait_for_pods() {
  local namespace="$1" selector="$2" names
  # Failed/Succeeded pods are terminal; their retained API objects are not active consumers.
  names="$(kubectl -n "$namespace" get pods -l "$selector" --field-selector=status.phase!=Failed,status.phase!=Succeeded -o name)"
  if [[ -n "$names" ]]; then
    # Resource names contain no spaces; deliberate splitting passes each name.
    if ! kubectl -n "$namespace" wait --for=delete $names --timeout=120s; then
      echo "Old $namespace pods did not terminate. Deployments remain scaled down; do not force-delete pods. Paste their status for diagnosis." >&2
      exit 1
    fi
  fi
}
wait_for_pods plex-server "$plex_selector"
wait_for_pods torrent "$torrent_selector"

# Strategic merge changes only the PVC reference on the named media volume.
kubectl -n plex-server patch deployment plex-server --type=strategic -p '{"spec":{"template":{"spec":{"volumes":[{"name":"media","persistentVolumeClaim":{"claimName":"plex-server-media-v2"}}]}}}}'
kubectl -n torrent patch deployment torrent --type=strategic -p '{"spec":{"template":{"spec":{"volumes":[{"name":"media","persistentVolumeClaim":{"claimName":"media-storage-v2"}}]}}}}'
kubectl -n plex-server scale deployment/plex-server --replicas="$plex_replicas"
kubectl -n torrent scale deployment/torrent --replicas="$torrent_replicas"

# Check both applications even if one fails its rollout.
result=0
kubectl -n plex-server rollout status deployment/plex-server --timeout=180s || result=1
kubectl -n torrent rollout status deployment/torrent --timeout=180s || result=1
kubectl -n plex-server get pods -o wide
kubectl -n torrent get pods -o wide
echo "Original PVs, PVCs, Longhorn config volumes and Plex's separate metadata mount remain unchanged."
echo "Backup directory: $backup_dir"
if [[ "$result" != 0 ]]; then
  echo "At least one rollout did not become ready. Paste the new pod Events."
fi
exit "$result"
