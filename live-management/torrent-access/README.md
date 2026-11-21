# qBittorrent and Cormier Access

Traefik serves `https://torrent.cormierconsulting.io/` through the Access gateway. The gateway requires a signed Access identity with the canonical owner subject and the God claim. It checks the current Access account state before creating a session and rechecks it during the session. The browser receives an eight-hour gateway session cookie. The gateway keeps qBittorrent credentials and backend cookies server-side.

The session store lives in one gateway replica. A gateway restart requires users to sign in again. The gateway runs independently of the qBittorrent and Gluetun Pod.

## Build and configure

Run from this directory with Node 24 and the production Kubernetes context.

```sh
npm ci
npm test
npm run build
kubectl -n torrent create configmap torrent-access-gateway --from-file=gateway.mjs=dist/gateway.mjs --dry-run=client -o yaml | kubectl apply -f -
```

The Access client registry needs the confidential client `qbittorrent`, token endpoint authentication `client_secret_post`, and the exact redirect URI `https://torrent.cormierconsulting.io/_access/callback`. Preserve existing clients when updating the registry. The `torrent-access-credentials` Secret in the `torrent` namespace contains three keys.

| Key | Value |
| --- | --- |
| `owner` | Canonical Access God subject |
| `client-secret` | Secret for the Access `qbittorrent` client |
| `backend-password` | qBittorrent `admin` Web UI password, at least 32 characters |

qBittorrent 5.2 or later must have HTTP Basic authentication available to the gateway. Keep local and subnet authentication bypass disabled. Copy updated Access SDK modules from the owning Access repository and run the gateway tests when its protocol changes.

## Deploy

1. Apply `gateway.yaml` and wait for `kubectl -n torrent rollout status deployment/torrent-access-gateway`. After a ConfigMap update, restart only that gateway deployment to load the new bundle.
2. For a first cutover from a direct qBittorrent Ingress, apply `stage.yaml`. Sign in at `/_access/login?verify=1` and confirm the browser renders the qBittorrent version. This stage routes only Access paths.
3. Apply `ingress.yaml`, then verify the anonymous root offers Access sign-in and the anonymous `/api/v2/torrents/info` returns HTTP 401.
4. Apply `../torrent-webui-access-policy.yaml` and `peer-service.yaml`. The policy limits port 8090 to the gateway. The existing LoadBalancer stays on `10.99.15.51` and exposes peer port 9254 over TCP and UDP. Remove the temporary objects with `kubectl delete -f stage.yaml` if they were created.
5. Verify God sign-in reaches the Web UI, Gluetun reports healthy, and the original qBittorrent process and torrent inventory are still present.

To recover from a gateway release failure, restore the last working gateway bundle and restart the gateway deployment. Keep the peer Service and the gateway-only backend policy in place.
