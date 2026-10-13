"""Keep ARC capacity warm, then release it after an hour without job activity."""

import datetime as dt
import json
import os
from pathlib import Path
import ssl
import urllib.parse
import urllib.request

UTC = dt.timezone.utc
LAST_ACTIVE = "runners.cormierconsulting.io/last-active-at"


def timestamp(value):
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def decide(runner_set, runners, now, warm_count=16, idle_seconds=3600):
    """Runner replacement timestamps also capture jobs completed between checks."""
    annotations = runner_set["metadata"].get("annotations", {})
    stored = annotations.get(LAST_ACTIVE)
    last_active = timestamp(stored) if stored else now
    busy = 0
    for runner in runners:
        # ARC creates a fresh runner after every completed job while minRunners > 0.
        # Using creation time conservatively extends the grace period on retries too.
        last_active = max(last_active, timestamp(runner["metadata"]["creationTimestamp"]))
        status = runner.get("status", {})
        if status.get("jobId") and status.get("phase") not in ("Succeeded", "Failed"):
            busy += 1
    if busy:
        last_active = max(last_active, now)
    idle_for = (now - last_active).total_seconds()
    desired = warm_count if idle_for < idle_seconds else 0
    return desired, last_active.isoformat().replace("+00:00", "Z"), busy, idle_for


def main():
    namespace = os.environ["RUNNER_NAMESPACE"]
    name = os.environ["RUNNER_SET"]
    warm_count = int(os.environ.get("WARM_RUNNERS", "16"))
    idle_seconds = int(os.environ.get("IDLE_SECONDS", "3600"))
    service_account = Path("/var/run/secrets/kubernetes.io/serviceaccount")
    token = (service_account / "token").read_text().strip()
    context = ssl.create_default_context(cafile=str(service_account / "ca.crt"))
    base = "https://kubernetes.default.svc/apis/actions.github.com/v1alpha1/namespaces/" + namespace

    def request(path, data=None):
        headers = {"Authorization": "Bearer " + token}
        if data is not None:
            headers["Content-Type"] = "application/merge-patch+json"
        req = urllib.request.Request(
            base + path,
            data=json.dumps(data).encode() if data is not None else None,
            headers=headers,
            method="PATCH" if data is not None else "GET",
        )
        with urllib.request.urlopen(req, context=context, timeout=20) as response:
            return json.load(response)

    runner_set = request("/autoscalingrunnersets/" + name)
    if runner_set["spec"].get("maxRunners", 0) < warm_count:
        raise RuntimeError("maxRunners is smaller than WARM_RUNNERS; leaving scaling unchanged")
    runners = []
    path = "/ephemeralrunners?labelSelector=actions.github.com%2Fscale-set-name%3D" + name
    while True:
        page = request(path)
        runners.extend(page["items"])
        continuation = page.get("metadata", {}).get("continue")
        if not continuation:
            break
        path = "/ephemeralrunners?labelSelector=actions.github.com%2Fscale-set-name%3D" + name
        path += "&continue=" + urllib.parse.quote(continuation, safe="")

    # The time is sampled after all successful reads. API errors never cause scale-down.
    now = dt.datetime.now(UTC)
    desired, last_active, busy, idle_for = decide(runner_set, runners, now, warm_count, idle_seconds)
    current = runner_set["spec"].get("minRunners", 0)
    stored = runner_set["metadata"].get("annotations", {}).get(LAST_ACTIVE)
    if current != desired or stored != last_active:
        patch = {
            "metadata": {
                "resourceVersion": runner_set["metadata"]["resourceVersion"],
                "annotations": {LAST_ACTIVE: last_active},
            },
            "spec": {"minRunners": desired},
        }
        request("/autoscalingrunnersets/" + name, patch)
    print(json.dumps({"busy": busy, "idleSeconds": max(0, int(idle_for)),
                      "minRunners": desired, "lastActiveAt": last_active}), flush=True)


if __name__ == "__main__":
    main()
