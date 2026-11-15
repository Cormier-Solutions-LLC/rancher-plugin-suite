"""Regression checks for repeated initialization and the legacy self-link."""
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest

from certificate_init import harden_certificate_init


class CertificateInitTests(unittest.TestCase):
    def test_rejects_unknown_chart_script(self):
        with self.assertRaises(ValueError):
            harden_certificate_init(["bash", "-c", "echo changed upstream"])

    @unittest.skipUnless(os.name == "posix", "requires Linux symlink and mode semantics")
    def test_repeated_startup_repairs_legacy_self_link(self):
        script = """set -eu
mkdir -p /mnt/disk0/certs
chmod u+x /mnt/disk0/certs
ln -sF /mnt/disk0/certs /opt/certs/yugabyte
cp /source/node.crt /mnt/disk0/certs/node.crt
cp /source/node.key /mnt/disk0/certs/node.key
chmod 600 /mnt/disk0/certs/*;
"""
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            certs = root / "disk/certs"
            certs.mkdir(parents=True)
            (root / "opt").mkdir()
            (root / "source").mkdir()
            for filename in ["node.crt", "node.key"]:
                (root / "source" / filename).write_text("regression fixture")
                (certs / filename).write_text("old fixture")
                (certs / filename).chmod(0o660)
            (certs / "certs").symlink_to(certs)
            (root / "opt/yugabyte").symlink_to(certs)
            certs.chmod(0o2600)
            fixed = harden_certificate_init(["/bin/bash", "-c", script])[-1]
            fixed = fixed.replace("/mnt/disk0", str(root / "disk"))
            fixed = fixed.replace("/opt/certs", str(root / "opt"))
            fixed = fixed.replace("/source", str(root / "source"))
            for _ in range(3):
                subprocess.run(["/bin/bash", "-c", fixed], check=True)
                self.assertFalse((certs / "certs").is_symlink())
                self.assertEqual((root / "opt/yugabyte").resolve(), certs)
                self.assertEqual(stat.S_IMODE(certs.stat().st_mode) & 0o777, 0o700)
                for filename in ["node.crt", "node.key"]:
                    self.assertEqual(stat.S_IMODE((certs / filename).stat().st_mode), 0o600)
                    self.assertEqual((certs / filename).read_text(), "regression fixture")


if __name__ == "__main__":
    unittest.main()
