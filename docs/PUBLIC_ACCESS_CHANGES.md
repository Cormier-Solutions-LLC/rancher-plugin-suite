# Public application allowlist

Requested October 18, 2026: only `proofing.cormierconsulting.io` and
`invoicing.cormierconsulting.io` should be accessible externally. Missing Host
requests must be dropped. Keep local access to other services and let the owner
control the public domain list.

The owner subsequently required Plex to remain enabled and existing router
settings to be preserved, then explicitly authorized changing only the TCP
80/443 forwarding destinations. The web allowlist does not govern Plex's
separate TCP 32400 service.

## Change tracker

- [x] Inspect live Traefik routes, listener configuration and preserved source IPs.
- [x] Confirm existing GoDaddy DNS-01 solver and production certificate issuer.
- [x] Add a separate Helm-managed public gateway with an explicit domain list.
- [x] Reject unapproved/missing Host, unknown/absent SNI, SNI/Host mismatches,
  duplicate headers, and forwarded-header attempts to reach private routes.
- [x] Verify actual Nginx behavior, HTTP/2, WebSockets, removal and deny-all.
- [x] Stage privately in Kubernetes; issue a trusted certificate using GoDaddy.
- [x] Verify both actual applications and denial of all 18 other web hostnames.
- [x] Publish a private Rancher chart repository and verify saving the unchanged
  two-domain policy through Rancher's real Edit / Change Version flow.
- [x] Sign in to the Omada controller; review DHCP, NAT, UPnP/DMZ and IPv6.
- [x] Verify the existing DHCP exclusion for the free VIP; publish and test it.
- [x] Move both WANs' web forwards from shared Traefik to the public gateway.
- [x] Add Invoicing's missing public DNS record with a scoped GoDaddy update.
- [x] Verify approved and denied hosts from independent external locations.
- [x] Verify original LAN admin routes and preserve rollback evidence.

## Verified evidence

The pinned official Nginx 1.30.6 image passed 42 local integration checks.
The staged Kubernetes gateway passed 72 checks, including real Proof Studio and
Ledger responses over trusted TLS and HTTP/TLS rejection of all other current
Ingress/IngressRoute hostnames. Three gateway pods and its Certificate were Ready.
Evidence: `.local/public-edge/security-tests.json` and `live-tests.json`.

All 44 existing Ingress/IngressRoute/TCP/UDP route specifications were preserved.
Rancher, Omada, Harbor, Invoicing and Proofing returned HTTP 200 with trusted TLS
through the original private VIP. Evidence: `.local/public-edge/local-preservation.json`.

Rancher showed the release as Deployed after its own Helm upgrade to revision 5.
The `public-web-access` chart repository was Downloaded/True. The existing
extension asset host retained all 63 prior asset maps unchanged and both replicas
were Ready after adding the chart package projection. The publication ledger is
`.local/public-edge/chart-publication.json`.

## Live cutover

The gateway is now a LoadBalancer at `10.99.15.59`, Helm revision 6. Omada
already had the enabled reservation `MetalLB 10.99.15.59 - DO NOT LEASE` with
dummy MAC `02-4D-4C-42-0F-3B`; no DHCP setting or reservation was changed.
No current client or Kubernetes LoadBalancer occupied the address. A stale
Windows neighbor entry became Unreachable before allocation. All 72 gateway
checks passed against the VIP before NAT changed, and against the WAN address
afterward, including missing Host and TLS/Host mismatch tests.

Only the destination IP of these existing enabled TCP rules changed, from
`10.99.15.50` to `10.99.15.59`:

| Existing rule | Interfaces | Source port | Destination |
| --- | --- | --- | --- |
| Rancher Manager HTTP | WAN1, WAN/LAN2 | 80 | 10.99.15.59:80 |
| Rancher Manager HTTPS | WAN1, WAN/LAN2 | 443 | 10.99.15.59:443 |

Rule names, enable states, source ranges, interfaces, destination ports and
protocols were preserved. Plex remains enabled on both WANs, TCP 32400 to
`10.99.15.52:32400`; it was not modified during this cutover. At resumption,
Plex was enabled and UPnP was disabled following the earlier interrupted work.
UPnP was left in that state. One-to-One NAT had no rules, and none of the three
forwarding rules used DMZ. No other router settings were changed during this
approved cutover.

At inspection, WAN1 was online at `68.203.6.96`, WAN/LAN2 was inactive with the
private address `192.168.1.152`, and neither WAN showed an IPv6 address. External
acceptance therefore covers the active WAN1 internet path; backup-WAN ingress
and future IPv6 configuration are not verified by this cutover.

The GoDaddy API was read before writing. Only the previously absent
`A/invoicing` record set was added, pointing to the observed WAN1 address with
TTL 600. Proofing's existing A record already matched. A complete read afterward
confirmed every unrelated record unchanged, including certificate TXT records.
Google and Cloudflare returned the new record. Previously cached NXDOMAIN
answers may persist until their negative TTL expires.

External Globalping probes verified the applications with trusted TLS and the
HTTP-to-HTTPS redirects. Final acceptance passed all 48 scenarios with 110 probe
results; both domain names resolved and served their applications from US,
Canadian, German and Australian probes. Every other current web hostname was explicitly sent
to the WAN address over HTTP and HTTPS from US and German probes: HTTP closed
without a response and HTTPS rejected the handshake. Direct-IP and unknown
host requests and a forged forwarding-header attempt were also rejected.
Plex `/identity` returned HTTP 200 over trusted HTTPS on TCP 32400 from US,
Canadian, German and Australian probes. This verifies external service
reachability; it does not simulate authenticated media playback.

After NAT cutover all 44 original route specifications still matched their
baseline, and the five private-VIP endpoints listed above still returned 200
with trusted TLS. Evidence is in `.local/public-edge/`: `external-tests.json`,
`wan-hairpin-tests.json`, `local-preservation.json`, `dns-before.json`,
`dns-cutover.json` and the Omada screenshots. Hostless requests were tested
through the real WAN forwarding path from LAN; Globalping cannot construct
hostless requests, so those particular checks are not independent external
measurements.

The reviewed live Helm policy is `docs/public-edge-live-values.yaml`. To replay
it after reviewing the currently deployed values:

```powershell
& '.tools/helm/windows-amd64/helm.exe' upgrade public-edge charts/public-edge `
  -n public-edge --reuse-values -f docs/public-edge-live-values.yaml --wait
```

The chart defaults remain private staging defaults. Continue controlling the
live `publicHosts` list in Rancher's installed `public-edge` app; retain its
LoadBalancer settings when saving. A Rancher edit is not automatically written
back into this repository's cutover snapshot.

Run `npm run test:public-access-external` for independent internet acceptance.
It uses Globalping measurement credits and tests this initial two-domain policy
plus Plex. Plex's public certificate supplies its `plex.direct` hostname for
discovery; every external HTTPS result must independently validate TLS. Set
`PUBLIC_EDGE_PLEX_HOST` if discovery is unavailable. After a transient failure,
`node scripts/verify-public-edge-external.mjs --resume` retains passing results
less than 30 minutes old and retries the failures. Use it only while the WAN,
deployed policy and router configuration remain unchanged.

For rollback, restore only the two web destination IPs to `10.99.15.50`, leaving
Plex and every other setting untouched. This restores the previous broad web
exposure. For containment, disable only the web forwards instead. Local access
continues through Traefik's original VIP. Restore any later approved application
policy with reviewed Helm values and verify the resulting certificate/rollout.

See `charts/public-edge/README.md` for policy control, deployment, external
acceptance, and rollback. Dynamic GoDaddy A/CNAME reconciliation is separate from
this gateway and has not been implemented by this change.

## Chart publication

The `public-web-access` Rancher chart repository serves immutable chart packages
from the existing private extension asset host. To publish an updated chart, run
`node scripts/publish-public-edge-chart.mjs` after incrementing `Chart.yaml`'s
version. `--prepare-only` packages and validates metadata without changing the
cluster. The publisher preserves existing projected asset maps and records the
deployment and artifact digests under `.local/public-edge/`. It creates no public
route and introduces no repository credentials. Keep old content-addressed packages
available for rollback.
