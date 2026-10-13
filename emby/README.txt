Emby migration: proxmox09 LXC 105 -> existing RKE2 Kubernetes cluster

Confirmed source: Emby 4.9.3.0; program data /var/lib/emby ~989 MiB.
Original guest root filesystem ~3.7 GiB used of 50 GiB allocated.
Kubernetes config: 20 GiB RWOP Longhorn, 3 replicas, Retain reclaim policy.
NFS: 10.99.2.109:/mnt/network-share/Proxmox/private/other.
Keep NAS library path /mnt/remote-other; media mount read-only.
LXC guest identity 999:990 -> host/NFS identity 100999:100990.
Container official image pinned to verified 4.9.3.0 SHA-256 digest.
No GPU, Live TV, DLNA, or host networking requested.

Applied: namespace.yaml, storage.yaml, migration-pod.yaml, workload.yaml,
ingress.yaml (including hostname-scoped HTTPS redirect middleware).
StatefulSet is active at one replica; pod emby-0 healthy on kubworker02.
Server display name explicitly set to Emby in persistent system.xml so it stays
stable across pod restarts/worker changes. Verified via HTTPS public-info API
after graceful restart; source server ID and version remained unchanged.
AD DNS emby.cormierconsulting.io resolves to 10.99.15.50; HTTP redirects to HTTPS.
TLS certificate Ready=True; trusted HTTPS web page returned 200 without bypass.
HTTP public-info API through HTTPS matched source version 4.9.3.0 and server ID
149659aba28a460ea325b592a9ebb3d8. Certificate expires 2027-01-09 UTC and cert-manager
manages renewal. No public Internet exposure or public A record was changed.
All 16 current workers mounted the NFS export and read a media file using
100999:100990. Temporary worker check DaemonSet was removed after passing.
Config-volume move tested from kubworker15 to kubworker14: marker SHA-256
unchanged and NAS staging folder still readable. Longhorn volume healthy.
The temporary staging pod was removed after that test; the Emby StatefulSet
has no fixed worker assignment, node-local media volume, or hostPath.
NAS access survives worker changes while server 10.99.2.109 and its export stay
available. New workers need the same NAS routing/firewall/export authorization,
NFS CSI support, and Longhorn prerequisites; validate with verify-worker-share.yaml.
Abrupt node failure can take longer than a graceful move due to safe volume detach.
After explicit user approval on 2026-10-11, cluster Longhorn setting
node-down-pod-deletion-policy was changed from do-nothing to delete-statefulset-pod.
This enables automatic deletion of terminating StatefulSet pods on down nodes
so their volumes can detach and replacements can start on available workers.
It also affects other Longhorn-backed StatefulSets, as reviewed with the user.
Graceful config relocation was tested earlier; no abrupt server failure test was
performed. Recovery can take several minutes. An unreachable but running node
may require fencing to prevent an old writer continuing during a network partition.
Applied policy and rollback JSON files are documented in failover-review.txt.
Post-change checks: live policy matched, all 19 nodes Ready, every StatefulSet
had its desired Ready replicas, Emby Ready on kubworker02 with zero restarts,
Longhorn config volume healthy with three replicas, NAS/config accessible,
and trusted HTTPS public-info API returned Emby with original server ID/version.
Recovery test on 2026-10-11: temporarily excluded the current physical server
for Emby only. StatefulSet replaced emby-0 from kubworker02/proxmox01 onto
kubworker03/proxmox02. Longhorn detached/reattached the existing config volume.
All checks passed 87 seconds after initiating the move (not a measured playback
outage): Ready pod, unchanged server name/ID/version through trusted HTTPS,
matching config marker SHA-256, existing library DB, and actual NAS media read
as 100999:100990. Temporary scheduling restriction was removed; a final rolling
restart returned Emby to kubworker02. Final health and media checks passed,
volume remained healthy with three replicas, and test marker was removed.
This validates controlled cross-server recovery. Abrupt node-loss handling and
the Longhorn node-down deletion path were not exercised by this test.
Transcoding scratch: separate 20 GiB bounded ephemeral emptyDir (not config PVC).
Both /config and /var/lib/emby mount the config PVC to preserve absolute data paths.

Migration record and remaining source retirement:
1. DONE: export-source.sh paused source Emby and created a private NAS archive.
   Folder mode 700, archive mode 600. Failed export restarts source automatically.
2. SHA-256 verified: db3a80ea7504736df65478d5736c071158827d8651723d43df700ddb6663e341.
   DONE: archive 654318653 bytes restored into the originally empty config PVC.
   Restored data measured 980.9 MiB; full checksum and gzip checks passed.
   Config filesystem root ownership prepared as 100999:100990 before extraction.
3. DONE: paths preserved, restored ownership 100999:100990, network settings set
   to reverse proxy mode, advertised HTTPS hostname and public HTTPS port 443.
   Previous system.xml retained privately at /config/.migration/.
4. DONE: temporary migration pod deleted; desired workload.yaml replicas=1 applied.
5. DONE: matching server ID/version, successful startup, readiness, non-root NAS
   read and transcoding scratch write. A 3-second CPU/libx264 transcode from a NAS
   media file passed; output 116151 bytes and test file removed afterward.
   Authenticated client login/full playback acceptance remains a user check.
6. DONE: Ingress routing, HTTP -> HTTPS redirect, cert-manager TLS and web UI 200.
7. DONE: user added AD DNS A record; hostname resolves to 10.99.15.50.
8. PENDING: user Proxmox terminal block to disable source Emby, set CT105 onboot=0,
   gracefully shutdown CT105 and verify stopped. Retain source disk and backups.

Rollback before production writes:
  kubectl scale statefulset/emby -n emby --replicas=0
  Wait until pod emby-0 is gone, then on proxmox09:
  pct start 105  # only if guest is stopped
  pct exec 105 -- systemctl start emby-server
  Restore previous routing/DNS if switched.
Never run both restored and source servers together under the same server identity.
After production writes on Kubernetes, preserve new config first and reconcile
it before reverting; the old source copy will be stale.

Recovery artifacts from the prior root-disk restore test:
  Original CT105: retained 50 GiB guest; source Emby stopped after export.
  Temporary CT100: stopped, 20 GiB, onboot=0; retained recovery copy.
  /var/lib/vz/dump/emby-105-rootdisk20.gghnqr/
  vzdump-lxc-105-2026_10_11-02_56_27.tar.zst
  Full backup succeeded and archive integrity / isolated restore were verified.

Do not bulk-apply the whole directory; ingress and restore/start sequencing matter.
workload.yaml declares the final desired one-replica state.
