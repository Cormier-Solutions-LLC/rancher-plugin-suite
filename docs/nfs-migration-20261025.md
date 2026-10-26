# Proxmox09 to Proxmox06 NFS migration

Requested scope: move all guest disks from `proxmox09-nfs` to
`proxmox06-nfs`, including the separate media tree and its NFS clients.

The migration covers 18 sparse 500 GiB disks on VMs 8201–8216. VMs 8207
and 8208 each have two disks. Source allocation was approximately 449 GiB.
Proxmox06 already held another 16 guest disks and retained backup archives;
those are preserved. Disk slot, serial, size, discard and I/O-thread options
are preserved. Stopped VMs 8201–8204 remain stopped; their missing local boot
storage predates this operation.

Native `qm move_disk` tasks retain source disks as `unusedN` recovery entries.
The original disks are point-in-time migration copies and become stale after
the destination receives further guest writes. Configuration backups and
task logs are retained under `/root/nfs-migration-20261025` on Proxmox06 and
`.local/nfs-migration-20261025` in this checkout. The pre-change archive is
`/root/nfs-migration-config-before-20261025.tgz`.

The first copy used a 100 MiB/s cap. At the user's request the remaining batch
was restarted with `--bwlimit 0` and four concurrent native copy tasks. The
two stopped-guest tasks from the capped attempt were canceled through the
Proxmox task API; their original configurations were checked before retrying.
The user subsequently requested two copies at a time without canceling any
existing transfers. The four-copy dispatcher was paused while its native
Proxmox tasks continued. A replacement dispatcher waits for those tasks to
drain, then starts new work only below two active transfers. The copies remain
uncapped; no in-flight tasks were canceled for this concurrency change.

## Media

The existing `Thin/other-recovery` XFS volume contained the prior media copy.
It was inspected read-only, then synchronized without deleting destination
files. Three files totaling 654,318,763 bytes were transferred. File metadata
and extended attributes were checked, and 148 directory default ACLs were
copied and compared directly as POSIX ACL xattrs. Rsync continues to report
an ACL comparison difference between NFS and XFS despite matching raw xattrs;
the separate content/metadata comparison is empty.

The source tree contains 16,386 regular files totaling 3,405,485,042,046 bytes.
SHA-256 comparisons of bounded beginning/middle/end reads passed for 256
distributed files (41,263,613 bytes sampled). This is sampled data validation,
not a full checksum of every media byte.

The 10 TiB volume is mounted persistently by UUID
`4a294907-2324-48aa-bf3e-c09ed7fda911` at
`/mnt/longhorn-remote/private/other`. It is a separate filesystem below the
8 TiB guest-image filesystem, not an additional 3.1 TiB charged to that image
filesystem. Its NFS export is read-only, requires the mount to exist, and
allows the existing private `10.99.0.0/16` clients.

Emby now uses PVC `emby-media-proxmox06` and retained PV
`emby-media-proxmox06-nfs`, with NFSv3/TCP/hard mounting
`10.99.2.106:/mnt/longhorn-remote/private/other`. The container path remains
`/mnt/remote-other`. The old PV/PVC are retained because PV sources are
immutable and are useful for rollback. Emby's config PVC and server identity
are preserved, with one active instance and a ready pre-change CSI snapshot
`emby-before-nfs-migration-20261025`.

All 12 online workers passed read-only mount and media-read checks as Emby's
UID/GID 100999:100990. Four stopped workers were unavailable for live checks.
After cutover Emby became Ready, authenticated HTTPS/API/media checks passed,
the library count remained 4,171, and an authenticated media-range checksum
matched the pre-change response.
Bounded HLS transcoding also passed after cutover; the test session was cleaned
up and the tested item's watch data was unchanged.

## Recovery and capacity

To roll back Emby's media mount, update only its StatefulSet media claim to
`emby-media`, then wait for the single replica to become Ready. Preserve
`emby-config`; do not start the retired source server alongside Kubernetes.

For a guest disk rollback, first quiesce the guest and reconcile writes made
after cutover. The retained source copy alone does not contain those writes.
Use the saved configuration and native disk attachment commands, preserving
the serial and disk slot. Never attach both copies with the same filesystem
UUID to a running guest.

Both Longhorn NFS disk pools now depend on Proxmox06 and its 8 TiB image
filesystem. Their combined provisioned virtual capacity is approximately
17 TiB. Monitor actual filesystem free space and Thin/Thin data/metadata
usage; guest virtual capacity and Longhorn scheduling capacity are not extra
physical capacity. Legacy `proxmox09-nfs` Longhorn tags, StorageClass names and
OpenSearch `storage_domain` attributes remain as compatibility identifiers.
They no longer establish independent Proxmox06/09 storage failure domains.
The original export and media tree remain available for recovery.

During the uncapped batch, Proxmox06's PERC H355-backed volume reached 100%
utilization, approximately 57 MiB/s writes plus 23 MiB/s reads, with roughly
30 ms average physical I/O latency. These are short samples, not sustained
benchmarks. The guest host's uplink is 10 Gb. Disk contention, not the removed
copy cap, limited the observed transfers.

OpenSearch had one unassigned replica for `security-auditlog-2026.10.25`.
Allocation explain dates its I/O failure to 19:07:15 UTC, before this migration
started. All 11 OpenSearch nodes were present. No index data or allocation
settings were changed as part of the NFS move.
After the data pods recovered, a dry run and one native
`POST /_cluster/reroute?retry_failed=true` cleared the exhausted retry count.
At 00:37 UTC on October 26 the cluster was green with all 11 nodes, all
27 primary shards active and zero unassigned shards; two shards were
relocating. No primary was forced, and no index data or allocation settings
were deleted or changed.

## Guest-disk completion

Latest user instruction: **stop the migration**. Both active native copies
(8205/scsi1 and 8207/scsi1) were stopped, and QMP confirmed no remaining block
jobs. Both VMs remain running on the original source disks. The r3 dispatcher
was terminated after those checks, and the completion heartbeat is PAUSED.
Do not resume transfers without a new user request. Six of 18 moves are
verified; 12 disks remain: 8205/scsi1, 8207/scsi1+scsi2,
8208/scsi1+scsi2, 8209/scsi1 and 8211–8216/scsi1. Media cutover is complete.
The following paragraphs retain the operational history before this stop.

The batch is in progress. Six of 18 moves are verified: canary VM 8210,
stopped VMs 8201–8204 and running VM 8206. VM 8206's native task returned
`OK`; its serial, UUID, 500 GiB size and writable mount match baseline, and
its source remains as `unused0`. All four originally stopped guests remain
stopped. VMs 8205 and 8207 currently have two native mirror jobs running;
the remaining disks are queued. All 14 online guest filesystems reported
their original UUIDs, 500 GiB size and writable mount options during the batch.

Destination contention caused new Longhorn replica failures and a stale
iSCSI device for `data-opensearch-data-pve06-0`. New dispatcher starts were
held, preserving all in-flight native tasks. The two running mirror jobs
were temporarily limited to 2 MiB/s using native HMP
`block_job_set_speed mirror-scsi1 2M`; read-back confirmed 2,097,152 bytes/s.
At the user's subsequent request, bandwidth limits were removed and the
two-copy queue resumed at 00:10 UTC on October 26. Native read-back confirmed
speed `0`, meaning unlimited. Keep the two-copy concurrency and do not
silently restore the temporary cap or hold new starts against this instruction.

The already-unavailable OpenSearch pod and the worker08 CSI plugin were
recreated. The worker's mount remained stale. Worker08 was briefly cordoned,
and reserve worker12 was assigned the `data-pve06` pool after verifying its
available capacity (2,591 MiB memory requested before adding the 4 GiB pod).
The existing PVC was attached on worker12; its filesystem mounted successfully
at 23:22:31 UTC. The data pod is Ready again with zero restarts. Worker08 is
uncordoned. At 00:04 UTC Longhorn had improved to 30 attached/healthy volumes
with one still degraded/rebuilding, versus 31 attached/healthy before the batch. The three
detached/unknown and six attaching/unknown volumes predate this change.

The user explicitly requested a one-time stop and restart of the active
VM 8205/scsi1 and VM 8207/scsi1 copies. Both native tasks stopped, QMP showed
no remaining old block jobs, and both running guests still referenced their
original source disks before retry. The obsolete paused dispatcher processes
were then terminated. The fresh `nfs-migration-20261025-two-r2` unit on
Proxmox06 ran `/root/nfs-migration-20261025/schedule-two.py`; it started the
two replacement copies at 00:16 UTC with `--bwlimit 0`. QMP confirmed speed
limit `0` for both. Do not restart either obsolete dispatcher or cancel the
fresh transfers without a new user request. VM 8205's canceled attempt left
an approximately 19 GiB unreferenced partial `vm-8205-disk-1.qcow2`; retain
it pending final verification. Its existing attached destination disk-0 is
unrelated to that partial and must be preserved.

At the user's subsequent explicit request, the same two copies were stopped
and restarted again at 00:37 UTC. Before stopping, native read-back still
showed speed limit `0` for both: no bandwidth cap remained. Both native tasks
then reached terminal interrupted states, QMP reported no old block jobs,
and both guests remained running with their source disks attached and no
guest locks. The paused r2 dispatcher was terminated only after those checks.
The active replacement unit is `nfs-migration-20261025-two-r3`, using the same
two-copy scheduler with `--bwlimit 0`. Native cleanup removed the r2 partials;
the earlier retained 8205 disk-1 partial and all source disks remain preserved.

The earlier offline transfers are not comparable to the current live mirrors
using their displayed 500 GiB provisioned capacity alone. Native task timing
and allocated source-file sizes were:

| VM | Allocated source data | Task duration | Guest state / method |
| --- | ---: | ---: | --- |
| 8201 | 33.2 GiB | 13m 19s | Stopped / offline conversion |
| 8202 | 104 MiB | 13s | Stopped / offline conversion |
| 8203 | 89 MiB | 10s | Stopped / offline conversion |

Sparse empty ranges account for most of the fast logical progress on 8202
and 8203. VM 8201's allocated size divided by elapsed time is approximately
42.5 MiB/s, an estimate rather than measured network throughput. Running
VMs 8205 and 8207/scsi1 had approximately 23.1 and 44.0 GiB allocated and
use live mirrors that also track guest writes. A subsequent destination
sample reached 100% utilization at approximately 95 MiB/s writes plus
4.5 MiB/s reads, with approximately 25 ms write latency. Both source hosts
have healthy bonded 10 Gb links. These observations identify destination
contention and different copy workloads; they do not establish a SCSI
interface speed limit.

A later 10-second sample measured mirror progress of 11.27 MiB/s for 8205
and 18.73 MiB/s for 8207. The destination was 99.9% busy at 35.27 MiB/s
writes and 19.67 ms write latency; the source image volume was only 5.8%
busy. Guest writes on the migrating disks were just 0.01–0.02 MiB/s, so
guest dirtying did not explain that sample's bottleneck. The destination NFS
export is synchronous and Linux reports its block device as write through;
controller cache policy was not independently queried. Total elapsed time
also includes the temporary 2 MiB/s cap and work repeated after the user's
requested restart. VM 8205's smaller allocated size than VM 8201 means
"more data" alone cannot explain the slower 8205 move.

Read-only QCOW2 maps found approximately 21.0 GiB of nonzero-data extents on
8205 versus 33.1 GiB on 8201. Both also contain large explicitly zero-marked
ranges. The live mirror accounts for roughly 250 GiB, which must not be
reported as physical data or measured network throughput.

The chat's five-minute completion follow-up continues the authorized work,
including unlimited copy speed, two-copy scheduling, final live
checks, documentation, Git push and the requested Alexa completion notice.
Final configuration, native task, filesystem and workload checks must pass
before reporting that the whole migration is complete.
