#!/usr/bin/env bash
set -euo pipefail

version=4.14.11-1
manager=${WAZUH_TARGET_MANAGER:-wazah.cormierconsulting.io}
validate_only=${WAZUH_VALIDATE_ONLY:-0}

enrollment_file=/var/ossec/etc/authd.pass

if (( EUID != 0 )); then
    echo "Run as root." >&2
    exit 1
fi

case "$(dpkg --print-architecture)" in
    amd64)
        architecture=amd64
        checksum=be316bf792cf03c5af52d82b989d73771c47d3aab3e847bd97d5bfe65903fb3d510d5959348d69a3d23ab8e648161c716dd07e1d261856538315918e8e370ca6
        ;;
    arm64)
        architecture=arm64
        checksum=4e22844696a1269cbbee20c2c322cf7ed68874dd3460add77afbdd2767be722f6c47ed6d0996cf6d1a925d4b0b6e1adf3d1df52ede63ffabc62402b1b9c50f67
        ;;
    *)
        echo "This script supports amd64 and arm64 Debian packages." >&2
        exit 1
        ;;
esac

if [[ "$(dpkg-query -W -f='${db:Status-Status}' wazuh-manager 2>/dev/null || true)" == "installed" ]]; then
    echo "This host runs the Wazuh manager package. Refusing to install the conflicting agent package." >&2
    exit 1
fi

installed_version=
if [[ "$(dpkg-query -W -f='${db:Status-Status}' wazuh-agent 2>/dev/null || true)" == "installed" ]]; then
    installed_version=$(dpkg-query -W -f='${Version}' wazuh-agent)
    if dpkg --compare-versions "$installed_version" ge "$version"; then
        echo "Wazuh Agent $installed_version is already installed. Target is $version."
        exit 0
    fi
fi

fresh_install=0
if [[ -z "$installed_version" && ! -f /var/ossec/etc/ossec.conf ]]; then
    fresh_install=1
fi

if (( fresh_install )) && [[ "$validate_only" != 1 ]]; then
    mapfile -t manager_addresses < <(getent ahosts "$manager" | awk '$2 == "STREAM" && !seen[$1]++ {print $1}')
    if (( ${#manager_addresses[@]} == 0 )); then
        echo "Wazuh manager '$manager' did not resolve to an IP address." >&2
        exit 1
    fi

    if command -v ufw >/dev/null && [[ "$(LC_ALL=C ufw status)" == 'Status: active'* ]]; then
        for address in "${manager_addresses[@]}"; do
            ufw allow out proto tcp to "$address" port 1514:1515 comment 'Wazuh agent manager'
        done
    fi

    for port in 1514 1515; do
        if ! timeout 5 bash -c 'exec 3<>"/dev/tcp/$1/$2"' _ "$manager" "$port" 2>/dev/null; then
            echo "Wazuh manager '$manager' is unreachable on TCP $port. Check the endpoint firewall and the manager's private listener." >&2
            exit 1
        fi
    done

    if [[ ! -f "$enrollment_file" || ! -s "$enrollment_file" || -L "$enrollment_file" ]]; then
        echo "Stage the Wazuh enrollment credential at '$enrollment_file' through a secure channel before installing." >&2
        exit 1
    fi
fi

package="wazuh-agent_${version}_${architecture}.deb"
package_url="https://packages.wazuh.com/4.x/apt/pool/main/w/wazuh-agent/$package"
work_dir=$(mktemp -d)
trap 'rm -f -- "$work_dir/$package"; rmdir -- "$work_dir"' EXIT
chmod 0755 "$work_dir"

curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
    --connect-timeout 10 --max-time 120 --retry 2 --output "$work_dir/$package" "$package_url"
chmod 0644 "$work_dir/$package"
printf '%s  %s\n' "$checksum" "$work_dir/$package" | sha512sum --check --status

if [[ "$validate_only" == 1 ]]; then
    apt-get --simulate --no-remove install "$work_dir/$package"
    echo "Validated Wazuh Agent $version. No package changes were made."
    exit 0
fi

apt_options=(--yes --no-remove -o DPkg::Lock::Timeout=60 -o Dpkg::Options::=--force-confold)
if (( fresh_install )); then
    WAZUH_MANAGER="$manager" DEBIAN_FRONTEND=noninteractive apt-get "${apt_options[@]}" install "$work_dir/$package"
else
    DEBIAN_FRONTEND=noninteractive apt-get "${apt_options[@]}" install "$work_dir/$package"
fi

actual_version=$(dpkg-query -W -f='${Version}' wazuh-agent)
if [[ "$actual_version" != "$version" ]]; then
    echo "Expected Wazuh Agent $version, found $actual_version." >&2
    exit 1
fi

if (( fresh_install )); then
    chown root:wazuh "$enrollment_file"
    chmod 0640 "$enrollment_file"
fi
systemctl enable wazuh-agent
systemctl restart wazuh-agent
systemctl is-active --quiet wazuh-agent
echo "Wazuh Agent $actual_version is running. Verify agent check-in in the Wazuh console."
