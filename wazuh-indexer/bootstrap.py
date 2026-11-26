"""Initialize the Wazuh security index and seed the application-specific access."""
import base64
import json
import os
from pathlib import Path
import shutil
import ssl
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

INDEXER_HOME = Path("/usr/share/wazuh-indexer")
CERTS = Path("/etc/wazuh-bootstrap/tls")
HOST = "wazuh-indexer-0.wazuh-indexer-discovery.opensearch.svc.cluster.local"
BASE = f"https://{HOST}:9200"
PROOF_INDEX = "proof-studio-projects-pilot"
PROOF_ROLE = "proof_studio_search_pilot_sync"
SECURITY = "/_plugins/_security/api"

def tls(admin=False):
    context = ssl.create_default_context(cafile=str(CERTS / "ca.crt"))
    if admin:
        context.load_cert_chain(CERTS / "tls.crt", CERTS / "tls.key")
    return context

def request(method, path, body=None, basic=None):
    data = None if body is None else json.dumps(body).encode()
    headers = {"Content-Type": "application/json"}
    if basic:
        token = base64.b64encode(":".join(basic).encode()).decode()
        headers["Authorization"] = f"Basic {token}"
    request = Request(BASE + path, data=data, headers=headers, method=method)
    with urlopen(request, context=tls(admin=basic is None), timeout=12) as response:
        return json.load(response)

def initialize():
    for _ in range(90):
        try:
            request("GET", "/_plugins/_security/authinfo")
            return
        except HTTPError as error:
            if error.code not in (500, 503):
                raise
            # The certificate-authenticated endpoint can return 500 before the
            # security index exists. Verify the uninitialized response separately.
            try:
                request("GET", "/", basic=("admin", os.environ["ADMIN_PASSWORD"]))
            except HTTPError as probe:
                if probe.code == 503 and b"security not initialized" in probe.read().lower():
                    break
                raise
            raise
        except URLError as error:
            if isinstance(error.reason, ssl.SSLCertVerificationError):
                raise
            time.sleep(3)
    else:
        raise RuntimeError("Wazuh security endpoint did not start")

    with tempfile.TemporaryDirectory() as scratch:
        config = Path(scratch) / "security"
        shutil.copytree(INDEXER_HOME / "config/opensearch-security", config)
        # Keep Wazuh's default role definitions without installing default passwords.
        (config / "internal_users.yml").write_text(
            "_meta:\n  type: internalusers\n  config_version: 2\n"
        )
        audit = config / "audit.yml"
        content = audit.read_text()
        if content.count("log_request_body: true") != 1:
            raise RuntimeError("Vendor audit format changed")
        audit.write_text(content.replace("log_request_body: true", "log_request_body: false"))
        subprocess.run(
            [str(INDEXER_HOME / "plugins/opensearch-security/tools/securityadmin.sh"),
             "-h", HOST, "-p", "9200", "-cn", "wazuh-indexer",
             "-cacert", str(CERTS / "ca.crt"), "-cert", str(CERTS / "tls.crt"),
             "-key", str(CERTS / "tls.key"), "-cd", str(config)],
            check=True, timeout=230,
        )

def create_user(name, password, roles):
    request("PUT", f"{SECURITY}/internalusers/{name}", {
        "password": password,
        "opendistro_security_roles": roles,
    })

def main():
    if os.environ["PROOF_USERNAME"] != PROOF_ROLE or os.environ["ADMIN_USERNAME"] != "admin":
        raise RuntimeError("Unexpected bootstrap principal names")
    initialize()
    for attempt in range(20):
        try:
            request("GET", "/_plugins/_security/authinfo")
            break
        except HTTPError as error:
            if error.code not in (500, 503) or attempt == 19:
                raise
            time.sleep(2)
    # Wazuh ships a wildcard user mapping for the username-named index.
    # Clear it so the Proof Studio identity has only its explicitly scoped role.
    mapping = request("GET", f"{SECURITY}/rolesmapping/own_index")["own_index"]
    if "*" in mapping["users"]:
        request("PUT", f"{SECURITY}/rolesmapping/own_index", {
            key: [user for user in mapping["users"] if user != "*"] if key == "users"
            else mapping[key] for key in ("users", "hosts", "backend_roles", "and_backend_roles")
            if key in mapping
        })
    create_user("admin", os.environ["ADMIN_PASSWORD"], ["all_access", "security_rest_api_access"])
    create_user("kibanaserver", os.environ["DASHBOARDS_PASSWORD"], ["kibana_server"])
    request("PUT", f"{SECURITY}/roles/{PROOF_ROLE}", {
        "cluster_permissions": ["indices:data/write/bulk"],
        "index_permissions": [{"index_patterns": [PROOF_INDEX], "allowed_actions": ["crud"]}],
        "tenant_permissions": [],
    })
    create_user(PROOF_ROLE, os.environ["PROOF_PASSWORD"], [PROOF_ROLE])
    try:
        request("GET", f"/{PROOF_INDEX}/_mapping")
    except HTTPError as error:
        if error.code != 404:
            raise
        request("PUT", f"/{PROOF_INDEX}", {
            "settings": {"number_of_shards": 1, "number_of_replicas": 1, "refresh_interval": "1s"},
            "mappings": {"dynamic": "strict", "properties": {
                "fingerprint": {"type": "keyword", "index": False, "doc_values": False},
                "project_id": {"type": "keyword"},
                "status": {"type": "keyword"},
                "title": {"type": "text"},
            }},
        })

    manager_name = "wazuh_manager_ingest"
    request("PUT", f"{SECURITY}/roles/{manager_name}", {
        "cluster_permissions": [
            "cluster_monitor", "indices:data/write/bulk",
            "indices:admin/template/get", "indices:admin/template/put",
            "indices:admin/index_template/get", "indices:admin/index_template/put",
        ],
        "index_permissions": [{
            "index_patterns": ["wazuh-*", ".wazuh-*"],
            "allowed_actions": ["indices_all"],
        }],
        "tenant_permissions": [],
    })
    create_user(manager_name, os.environ["MANAGER_PASSWORD"], [manager_name])
    admin = ("admin", os.environ["ADMIN_PASSWORD"])
    assert request("GET", "/", basic=admin)["cluster_name"] == "wazuh-indexer"
    proof = (PROOF_ROLE, os.environ["PROOF_PASSWORD"])
    identity = request("GET", "/_plugins/_security/authinfo", basic=proof)
    assert identity["user_name"] == PROOF_ROLE and set(identity["roles"]) == {PROOF_ROLE}
    try:
        request("GET", f"{SECURITY}/roles/{PROOF_ROLE}", basic=proof)
    except HTTPError as error:
        if error.code != 403:
            raise
    else:
        raise RuntimeError("Proof Studio can access security administration")
    print("Wazuh security initialized. Proof Studio identity and security API denial verified.")

if __name__ == "__main__":
    main()
