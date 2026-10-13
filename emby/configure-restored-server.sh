#!/bin/sh
# Run inside the migration transfer container after restore-data.sh succeeds.
set -eu
test -f /config/data/library.db
test -f /config/config/system.xml
umask 077
mkdir /config/.migration
cp -p /config/config/system.xml /config/.migration/system.xml.before-kubernetes
# Values match the official 4.9.3.0 Network UI's reverse-proxy mode.
sed -i \
  -e 's#<PublicPort>[^<]*</PublicPort>#<PublicPort>80</PublicPort>#' \
  -e 's#<PublicHttpsPort>[^<]*</PublicHttpsPort>#<PublicHttpsPort>443</PublicHttpsPort>#' \
  -e 's#<WanDdns />#<WanDdns>emby.cormierconsulting.io</WanDdns>#' \
  -e 's#<WanDdns>[^<]*</WanDdns>#<WanDdns>emby.cormierconsulting.io</WanDdns>#' \
  -e 's#<EnableHttps>[^<]*</EnableHttps>#<EnableHttps>true</EnableHttps>#' \
  -e 's#<RequireHttps>[^<]*</RequireHttps>#<RequireHttps>false</RequireHttps>#' \
  -e 's#<IsBehindProxy>[^<]*</IsBehindProxy>#<IsBehindProxy>true</IsBehindProxy>#' \
  /config/config/system.xml
grep -E '<(PublicPort|PublicHttpsPort|WanDdns|EnableHttps|RequireHttps|IsBehindProxy)>' /config/config/system.xml
printf 'Restored server configured for Traefik TLS termination.\n'
