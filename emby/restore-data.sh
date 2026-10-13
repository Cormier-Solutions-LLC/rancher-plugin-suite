#!/bin/sh
# Execute inside the transfer container of pod emby-migration.
set -eu
cd /mnt/remote-other/.emby-k8s-migration-20261011
expected=db3a80ea7504736df65478d5736c071158827d8651723d43df700ddb6663e341
test "$(sha256sum emby-programdata.tar.gz | cut -d ' ' -f 1)" = "$expected"
sha256sum -c emby-programdata.sha256
gzip -t emby-programdata.tar.gz
test -z "$(find /config -mindepth 1 -maxdepth 1 ! -name lost+found -print -quit)"
tar -xzof emby-programdata.tar.gz -C /config
test -d /config/config
test -d /config/data
test -f /config/config/system.xml
du -sh /config
printf 'Restore complete; application is still stopped.\n'
