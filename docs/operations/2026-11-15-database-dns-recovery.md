# YugabyteDB and DNS recovery, 2026-11-15

## YugabyteDB

Three pods on worker13 could not initialize their TLS files. The pinned chart's
initializer created a `certs/certs -> /mnt/disk0/certs` self-link on retries, then
followed it with wildcard `chmod 600`, removing directory traversal permission.
The CA and certificates validated; file ownership already matched UID 10001.

The corrected initializer replaces the ephemeral symlink itself, removes only
the recognized legacy self-link, changes modes only on regular files, and keeps
the certificate directory private and traversable. The deployment renderer now
applies the same correction. Unexpected chart script changes fail closed.

All six StatefulSet templates were staged with OnDelete to prevent simultaneous
rollouts. The three failed pods recovered first. After replication converged,
the six remaining pods were restarted individually, with replication and
Invoicing readiness checked between restarts. Original RollingUpdate strategies
were restored after all nine pods used the corrected template. PVCs, application
records, credentials, CA and existing recovery files were retained.

Verified:

- Three masters and six data servers Ready on the corrected templates.
- No dead data servers and no under-replicated tablets.
- Invoicing's schema tablet has replicas on physical Proxmox hosts 07, 08 and 09.
- A dedicated `provider_test_recovery_20261115_204243` database accepted committed
  writes, returned the committed value through all six SQL coordinators, and
  preserved the value after rollback. That temporary database was removed.
- Invoicing frontend, `/api/health` and `/api/health/ready` returned HTTPS 200.
- Harbor's health API reported every component healthy, including jobservice.
- Two Linux regression checks passed, including three consecutive executions
  starting with the legacy self-link and directory mode 2600. The complete
  renderer passed Kubernetes server-side dry run for all three host groups.

Invoicing had transient readiness failures and container restarts during SQL
coordinator replacement. The recovery does not establish zero-interruption
failover. Harbor remained on v2.15.2; no Harbor upgrade was performed.

Private resource snapshots and verification are under
`.local/yugabyte-recovery-20261115`. The certificate recovery procedure is in
`databases/yugabyte/README.md`.

## DNS engine 2

Volume `pvc-3eb2b8b6-df34-4995-9743-76106d924354` backs
`dns-system/data-dns-manager-engine-2`. Its ext4 filesystem had unattached inode
369 and inconsistent allocation bitmaps/counters. Longhorn replicas reported
healthy while CSI correctly refused to mount the damaged filesystem. The cause
of the filesystem corruption was not established.

With explicit operator authorization, the DNS StatefulSet was temporarily scaled
from three to two replicas, retaining the PVC. Engines 0 and 1 stayed running.
The volume was manually attached on worker02 with no filesystem mounted. A
Longhorn snapshot and a full, private, checksum-verified block image were saved.
Repair was rehearsed on a copy; its subsequent read-only fsck exited zero.
`e2fsck -f -y` then repaired the original unmounted volume; `e2fsck -f -n` exited
zero afterward. Inode 369 was reconnected under `lost+found`, not discarded.

The manual attachment was removed and the StatefulSet restored to three
replicas. Engine 2 mounted the repaired PVC on worker09. One retained zone file,
`cormierconsulting.com.zone`, was present on disk but not loaded by Technitium.
That file was preserved as
`/etc/dns/recovery-20261115/cormierconsulting.com.zone.unloaded`. The missing
secondary was recreated through the authenticated native API using the existing
primary `10.99.3.2` and TCP transfers, matching the healthy replicas. Credentials,
DNS authorization, source-zone records and controller code were not changed.

Verified:

- All three engines Ready; repaired Longhorn volume attached and healthy.
- The controller authenticated to all three engines with existing credentials.
- Four authoritative zones matched the source serial on all three individual
  service IPs (10.99.15.55–57), using both UDP and TCP: `_msdcs.cormierconsulting.com`
  168, `99.10.in-addr.arpa` 229, `cormierconsulting.com` 815 and
  `cormierconsulting.io` 303.
- Each DNS endpoint resolved Invoicing to 10.99.15.50 and resolved `example.com`.

Retained recovery material:

- Longhorn snapshot: `dns-engine2-pre-fsck-20261115`.
- Worker02, reached through Proxmox01 VM 8202:
  `/var/tmp/dns-engine2-recovery-20261115/before-fsck.img` (2,147,483,648 bytes).
- Image SHA-256:
  `f2789a6985db8c2efcbd9b7e295505c3fdcf722bf3cf001255b1734af43a5431`.
- The same private directory contains the manifest, repair rehearsal image,
  repair logs and successful filesystem-check results. The recovery directory
  is mode 700; block images are mode 600.

These recovery copies remain on the existing infrastructure, not off site.
Retain them and the unloaded zone file until an operator approves cleanup.
Restoring a raw image requires stopping engine 2, attaching the correct volume
without mounting it, and reviewing newer DNS changes before overwriting it.
Do not overwrite a mounted volume.

The offline, backed-up repair follows the
[Longhorn filesystem-corruption recovery procedure](https://longhorn.io/kb/troubleshooting-volume-filesystem-corruption/).
