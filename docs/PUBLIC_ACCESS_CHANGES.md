# Public application allowlist

Requested October 18, 2026: only `proofing.cormierconsulting.io` and
`invoicing.cormierconsulting.io` should be accessible externally. Missing Host
requests must be dropped. Keep local access to other services and let the owner
control the public domain list.

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
- [ ] Sign in to the Omada controller; review DHCP, NAT, UPnP/DMZ and IPv6.
- [ ] Reserve a free gateway VIP, expose the gateway, verify its service path.
- [ ] Move both WANs' web forwards from shared Traefik to the public gateway.
- [ ] Add Invoicing's missing public DNS record with a scoped GoDaddy update.
- [ ] Verify approved and denied hosts from independent external locations.
- [ ] Verify original LAN admin routes and preserve rollback evidence.

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

The staged Service is **ClusterIP only**. The router is still forwarding TCP
80/443 to the shared Traefik VIP `10.99.15.50`. The requested restriction is
**not yet enforced on the internet**. The Omada session requires sign-in; the
owner was asked to sign in while staging and testing continued.

The initial public lookup found Proofing at `68.203.6.96` and no public A record
for Invoicing. Re-read DNS and WAN state at cutover; these are point-in-time
observations, not configuration constants. No public DNS records or router
settings were changed during staging.

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
