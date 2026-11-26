"""Verify the deployed Proof Studio sync against the intended Wazuh endpoint."""
import hashlib
import os
from pathlib import Path
import runpy
import socket
import ssl
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import urlopen

EXPECTED_HOST = "wazuh-indexer.wazah.svc.cluster.local"
PROOF_ROLE = "proof_studio_search_pilot_sync"
CA = "/etc/search-trust/ca.crt"

def expect_denied(action, status):
    try:
        action()
    except HTTPError as error:
        if error.code != status:
            raise RuntimeError(f"Expected HTTP {status}, received {error.code}") from None
    else:
        raise RuntimeError(f"Expected HTTP {status}, received success")

def main():
    endpoint = urlsplit(os.environ["SEARCH_URL"])
    if (endpoint.scheme, endpoint.hostname, endpoint.port) != ("https", EXPECTED_HOST, 9200):
        raise RuntimeError("Unexpected canary search endpoint")
    trust = ssl.create_default_context(cafile=CA)
    with socket.create_connection((endpoint.hostname, endpoint.port), timeout=8) as connection:
        try:
            trust.wrap_socket(connection, server_hostname="unused-proof-hostname.invalid")
        except ssl.SSLCertVerificationError as error:
            if error.verify_code != 62:
                raise
        else:
            raise RuntimeError("The Wazuh node certificate accepted the wrong hostname")
    expect_denied(lambda: urlopen(os.environ["SEARCH_URL"], context=trust, timeout=8), 401)

    sync = runpy.run_path(str(Path("/app/sync.py")))
    request = sync["request"]
    identity = request("GET", "/_plugins/_security/authinfo")
    if identity["user_name"] != PROOF_ROLE or set(identity["roles"]) != {PROOF_ROLE}:
        raise RuntimeError("Unexpected Proof Studio identity or role mapping")

    expect_denied(lambda: request("GET", "/_plugins/_security/api/roles"), 403)
    expect_denied(lambda: request("GET", "/wazuh-proof-unrelated-check/_search"), 403)
    sync["main"]()
    indexed = sync["read_index"]()
    expected = {record_id: value["fingerprint"]
                for record_id, value in sync["read_catalog"]().items()}
    if not expected or indexed != expected:
        raise RuntimeError("Indexed Proof Studio records do not match the Yugabyte source")
    summary = "".join(f"{key}\t{indexed[key]}\n" for key in sorted(indexed))
    print("Verified hostname and CA, anonymous rejection, scoped account, unrelated-index rejection,")
    print(f"and exact Proof Studio source parity. records={len(indexed)} sha256={hashlib.sha256(summary.encode()).hexdigest()}")

if __name__ == "__main__":
    main()
