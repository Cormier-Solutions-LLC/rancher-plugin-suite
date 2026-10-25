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

## Guest-disk completion

The batch is in progress. Final configuration, task, filesystem and workload
checks will be recorded here after all 18 native moves complete.
