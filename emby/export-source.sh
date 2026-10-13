#!/usr/bin/env bash
# Run on proxmox09. Keeps source Emby stopped after a successful export.
# Restarts source automatically if the export fails.
set -euo pipefail
test "$(hostname -s)" = proxmox09
test "$(pct status 105)" = "status: running"
pct exec 105 -- bash -s <<'EMBY_EXPORT'
set -euo pipefail
emby_stage=/mnt/remote-other/.emby-k8s-migration-20261011
test -d "$emby_stage"
test "$(stat -c %u "$emby_stage")" = 999
test "$(stat -c %a "$emby_stage")" = 700
test ! -e "$emby_stage/emby-programdata.tar.gz"
test "$(dpkg-query -W -f='${Version}' emby-server)" = 4.9.3.0
systemctl is-active --quiet emby-server
trap 'emby_rc=$?; if [ "$emby_rc" -ne 0 ]; then echo "Export failed; restarting source Emby."; systemctl start emby-server; fi; exit "$emby_rc"' EXIT
systemctl stop emby-server
if systemctl is-active --quiet emby-server; then
  echo "Emby did not stop; refusing to copy live data."
  exit 1
fi
runuser -u emby -- sh -c '
  set -e
  umask 077
  cd /mnt/remote-other/.emby-k8s-migration-20261011
  tar -czf emby-programdata.tar.gz.partial -C /var/lib/emby .
  gzip -t emby-programdata.tar.gz.partial
  mv emby-programdata.tar.gz.partial emby-programdata.tar.gz
  sha256sum emby-programdata.tar.gz > emby-programdata.sha256
  stat -c "%u:%g %a %s %n" emby-programdata.tar.gz
  cat emby-programdata.sha256
'
printf '\nExport complete. Source Emby remains stopped for Kubernetes restore.\n'
systemctl is-active emby-server || true
EMBY_EXPORT
