#!/usr/bin/env python3
"""Validate or install the pinned Wazuh agent in one Proxmox QEMU guest."""

import argparse
import base64
import binascii
import ipaddress
import json
from pathlib import Path
import re
import shlex
import subprocess
import sys


INSTALLERS = Path(__file__).resolve().parents[1] / "action1"
SSH_OPTIONS = ("-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=8",
               "-o", "StrictHostKeyChecking=yes")

DEBIAN_BOOTSTRAP = r"""
set -euo pipefail
IFS= read -r enrollment
config=/var/ossec/etc
password_file=$config/authd.pass
if [[ -n "$enrollment" && ! -e "$password_file" && ! -L "$password_file" &&
      ! -e "$config/ossec.conf" &&
      "$(dpkg-query -W -f='${db:Status-Status}' wazuh-agent 2>/dev/null || true)" != installed ]]; then
    mkdir -p -- "$config"
    (
        umask 077
        set -o noclobber
        { printf '%s' "$enrollment" | base64 --decode; printf '\n'; } > "$password_file"
    )
fi
unset enrollment
export WAZUH_VALIDATE_ONLY="$1"
exec /bin/bash -s
"""

WINDOWS_BOOTSTRAP = r"""
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$enrollment = [Console]::In.ReadLine()
$installer = [Console]::In.ReadToEnd()
if ($enrollment -and -not (Get-Service -Name WazuhSvc -ErrorAction SilentlyContinue)) {
    $programFiles = [Environment]::GetFolderPath('ProgramFilesX86')
    if (-not $programFiles) { $programFiles = $env:ProgramFiles }
    $directory = Join-Path $programFiles 'ossec-agent'
    $path = Join-Path $directory 'authd.pass'
    if (-not (Test-Path -LiteralPath $path) -and
        -not (Test-Path -LiteralPath (Join-Path $directory 'ossec.conf'))) {
        New-Item -Path $directory -ItemType Directory -Force | Out-Null
        $acl = [Security.AccessControl.FileSecurity]::new()
        $acl.SetAccessRuleProtection($true, $false)
        foreach ($sid in 'S-1-5-18', 'S-1-5-32-544') {
            $identity = [Security.Principal.SecurityIdentifier]::new($sid)
            $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'Allow'))
        }
        $bytes = [Convert]::FromBase64String($enrollment)
        try {
            $stream = [IO.FileStream]::new($path, [IO.FileMode]::CreateNew, [Security.AccessControl.FileSystemRights]::Write,
                [IO.FileShare]::None, 4096, [IO.FileOptions]::None, $acl)
            try {
                $stream.Write($bytes, 0, $bytes.Length)
                $stream.WriteByte(10)
            } finally {
                $stream.Dispose()
            }
        } finally {
            [Array]::Clear($bytes, 0, $bytes.Length)
        }
    }
}
Remove-Variable enrollment
& ([ScriptBlock]::Create($installer)) -ValidateOnly:$validateOnly
"""


def ssh(entry, command, *, payload=None, timeout=20):
    result = subprocess.run(
        ["ssh", *SSH_OPTIONS, "--", entry, shlex.join(command)],
        input=payload if payload is not None else b"", capture_output=True, timeout=timeout,
    )
    if result.returncode != 0:
        detail = result.stderr.decode(errors="replace").strip()
        raise RuntimeError(detail or f"Proxmox SSH command exited with status {result.returncode}")
    return json.loads(result.stdout)


def guest_command(entry, vmid):
    status = ssh(entry, ["pvesh", "get", "/cluster/status", "--output-format", "json"])
    inventory = ssh(entry, ["pvesh", "get", "/cluster/resources", "--type", "vm", "--output-format", "json"])
    guest = next((item for item in inventory if item.get("vmid") == vmid), None)
    if not guest or guest.get("type") != "qemu" or guest.get("template") or guest.get("status") != "running":
        raise RuntimeError(f"VM {vmid} must be a running QEMU guest")
    node_name = guest["node"]
    node = next((item for item in status if item.get("name") == node_name and item.get("type") == "node"), None)
    if not node or not node.get("online") or not re.fullmatch(r"[A-Za-z0-9-]+", node_name):
        raise RuntimeError(f"Owner node {node_name} is unavailable")
    return guest, node


def run_on_node(entry, node, command, *, payload=None, timeout=20):
    if not node.get("local"):
        node_name = node["name"]
        address = ipaddress.ip_address(node["ip"])
        command = [
            "ssh", *SSH_OPTIONS, "-o", f"HostKeyAlias={node_name}",
            "-o", f"UserKnownHostsFile=/etc/pve/nodes/{node_name}/ssh_known_hosts",
            "-o", "GlobalKnownHostsFile=none", "--", f"root@{address}", shlex.join(command),
        ]
    return ssh(entry, command, payload=payload, timeout=timeout)


def read_enrollment():
    if sys.stdin.isatty():
        raise RuntimeError("Pipe the base64-encoded Wazuh enrollment credential to stdin")
    encoded = sys.stdin.buffer.read(2049).strip()
    if len(encoded) > 2048:
        raise RuntimeError("Enrollment input is too large")
    try:
        password = base64.b64decode(encoded, validate=True)
    except binascii.Error:
        raise RuntimeError("Enrollment input must be valid base64") from None
    if not password or any(byte in password for byte in (0, 10, 13)):
        raise RuntimeError("Enrollment input must decode to one nonempty line")
    return encoded


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--entry", required=True, help="Trusted Proxmox SSH entry point, e.g. root@proxmox07")
    parser.add_argument("--vmid", required=True, type=int)
    parser.add_argument("--apply", action="store_true", help="Install or upgrade in the guest; default validates the package")
    parser.add_argument("--enrollment-stdin", action="store_true", help="Read a base64-encoded enrollment password from stdin")
    args = parser.parse_args()
    if not 100 <= args.vmid <= 999999999:
        parser.error("--vmid must be a valid Proxmox guest ID")
    if args.enrollment_stdin and not args.apply:
        parser.error("--enrollment-stdin requires --apply")

    phase = "preflight"
    try:
        guest, node = guest_command(args.entry, args.vmid)
        vmid = str(args.vmid)
        os_info = run_on_node(args.entry, node, ["qm", "guest", "cmd", vmid, "get-osinfo"])
        if os_info["id"] == "debian":
            installer = INSTALLERS / "install-or-update-debian.sh"
            shell = ["/bin/bash", "-c", DEBIAN_BOOTSTRAP, "wazuh-bootstrap", "0" if args.apply else "1"]
        elif os_info["id"] == "mswindows":
            installer = INSTALLERS / "Install-OrUpdate-Windows.ps1"
            mode = "$false" if args.apply else "$true"
            encoded = base64.b64encode(f"$validateOnly = {mode}\n{WINDOWS_BOOTSTRAP}".encode("utf-16le"))
            shell = ["powershell.exe", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded.decode("ascii")]
        else:
            raise RuntimeError(f"VM {vmid} reports unsupported guest OS {os_info['id']}")

        enrollment = read_enrollment() if args.enrollment_stdin else b""
        payload = enrollment + b"\n" + installer.read_bytes().replace(b"\r\n", b"\n")
        print(f"{'Apply' if args.apply else 'Validate'} {guest['name']} (VM {vmid}, {node['name']})", flush=True)
        phase = "guest execution"
        result = run_on_node(
            args.entry, node, ["qm", "guest", "exec", vmid, "--pass-stdin", "1", "--timeout", "240", "--", *shell],
            payload=payload, timeout=260,
        )
        if not result.get("exited"):
            raise RuntimeError(f"Guest command may still be running. Inspect VM {vmid} guest process {result.get('pid', 'status')} before retrying")
        for field, stream in (("out-data", sys.stdout), ("err-data", sys.stderr)):
            if result.get(field):
                print(result[field].strip(), file=stream)
            if result.get(field.replace("data", "truncated")):
                print(f"{field} was truncated by the guest agent", file=sys.stderr)
        return result.get("exitcode", 1)
    except subprocess.TimeoutExpired:
        print(f"Proxmox timed out during {phase}. Check VM {args.vmid} before retrying.", file=sys.stderr)
    except (OSError, ValueError, KeyError, RuntimeError) as error:
        print(f"Proxmox Wazuh operation failed during {phase}: {error}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
