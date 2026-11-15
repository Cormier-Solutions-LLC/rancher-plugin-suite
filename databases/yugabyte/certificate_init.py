"""Harden the pinned chart's certificate initializer for repeated startup."""


def harden_certificate_init(command):
    """Return a fresh command, rejecting unexpected upstream script changes."""
    script = command[-1]
    old_link = "ln -sF /mnt/disk0/certs /opt/certs/yugabyte"
    new_link = """# Replace the link itself, never create a link inside its directory target.
ln -sfnT /mnt/disk0/certs /opt/certs/yugabyte
# Older retries can leave this self-link; remove only that exact symlink.
if [ -L /mnt/disk0/certs/certs ]; then
  if [ "$(readlink /mnt/disk0/certs/certs)" != /mnt/disk0/certs ]; then
    echo "Unexpected certificate symlink; refusing to modify it" >&2
    exit 1
  fi
  unlink /mnt/disk0/certs/certs
fi"""
    old_mode = "chmod 600 /mnt/disk0/certs/*;"
    new_mode = """# Do not follow symlinks: chmod on a directory removes traversal permission.
find /mnt/disk0/certs -maxdepth 1 -type f -exec chmod 600 {} \\;
chmod u+rwx,go-rwx /mnt/disk0/certs"""
    for old, new in [(old_link, new_link), (old_mode, new_mode)]:
        if script.count(old) != 1:
            raise ValueError("Pinned chart certificate initializer changed")
        script = script.replace(old, new)
    return [*command[:-1], script]
