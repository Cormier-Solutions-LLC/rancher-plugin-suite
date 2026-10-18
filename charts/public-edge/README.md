# Public Web Access

This Helm release provides a separate public HTTP/HTTPS gateway in front of the
existing private Traefik service. Only exact `publicHosts` are forwarded. Creating
an Ingress or publishing a DNS record does not add a hostname to this allowlist.

The initial allowlist is `proofing.cormierconsulting.io` and
`invoicing.cormierconsulting.io`. Other hostnames remain available on the existing
LAN Traefik VIP. The public gateway closes HTTP requests without an approved Host,
rejects absent/unapproved TLS SNI, and requires HTTPS SNI and Host (HTTP/2
`:authority`) to identify the same approved hostname. Parser errors such as
duplicate/missing Host headers are closed without an HTTP response. Clients can
still connect to the public IP with an approved SNI and Host: this policy controls
application publication, while application login continues to control users.

## Control the allowed domains

In Rancher, open **Apps > Installed Apps > public-edge > Edit/Upgrade** in the
`public-edge` namespace and edit the Helm values YAML:

```yaml
publicHosts:
  - proofing.cormierconsulting.io
  - invoicing.cormierconsulting.io
```

Add only hostnames intended for public use, and ensure the matching private
Traefik route exists. Remove a name to withdraw it; `publicHosts: []` denies all.
Wildcards, duplicate entries, uppercase configuration names, and configuration
injection are rejected by the values schema. Client hostname matching is case
insensitive. Only standard `:80`/`:443` Host suffixes are accepted.

CLI equivalent (PowerShell, from the repository root):

```powershell
& '.tools/helm/windows-amd64/helm.exe' upgrade --install public-edge `
  charts/public-edge -n public-edge --create-namespace `
  -f path/to/reviewed-public-values.yaml --wait --timeout 5m
kubectl wait certificate/public-edge -n public-edge --for=condition=Ready --timeout=180s
```

Use a reviewed values file containing the entire current domain list and Service
settings. Helm values are the policy source; direct edits to the generated
ConfigMap are not a supported policy update. A checksum triggers a rolling reload.
Old workers have a ten-second shutdown limit; Kubernetes allows up to 45 seconds
for terminating pods. Complete the rollout before reporting a revocation complete.
Adding names may require waiting for the new certificate before the new names work.

## Staging and router cutover

The chart defaults to `service.type: ClusterIP`, intentionally unreachable from
the internet. Issue the certificate using the existing `letsencrypt-prod`
ClusterIssuer and GoDaddy DNS-01 solver. No GoDaddy credentials are mounted into
the public gateway. Its pod has no Kubernetes service-account token.

Before publishing, inspect Omada DHCP leases/reservations and the MetalLB pool,
select a free address, and reserve/exclude it from DHCP. Do not assume that a free
MetalLB allocation is free of LAN clients: the current pool overlaps the LAN DHCP
range. Set the reviewed values to:

```yaml
service:
  type: LoadBalancer
  loadBalancerIP: VERIFIED_FREE_RESERVED_LAN_IP
```

Apply and verify the gateway at that VIP before changing NAT. Back up Omada's
current forwarding, UPnP, DMZ and IPv6 firewall configuration. Redirect TCP 80/443
on **both WAN1 and WAN/LAN2** to the gateway VIP on ports 80/443. Remove or disable
any alternate internet-facing path to the shared Traefik listener; inspect other
forwards, automatic mappings, and IPv6 before claiming that only these applications
are reachable externally. Keep the private Traefik Service, routing and LAN DNS
unchanged. Public A/AAAA records identify the reachable WAN addresses, never this
private VIP. DNS records alone are not an access control.

Before adding Invoicing's missing public record, read the live GoDaddy zone and
capture the exact affected record set for rollback. Add only the approved name
using the existing Secret-backed GoDaddy access, after the gateway cutover is
verified. Preserve unrelated DNS and certificate-validation TXT records. A public
DNS/DDNS reconciliation controller is separate future work; this chart enforces
the HTTP/TLS allowlist and does not update GoDaddy A/CNAME records automatically.

## Validation

```powershell
node scripts/test-public-edge.mjs
kubectl port-forward service/public-edge -n public-edge 18080:80 18443:443 --address=127.0.0.1
# In another terminal:
node scripts/verify-public-edge-live.mjs
```

The first test runs the actual pinned Nginx image against a synthetic HTTPS backend
and tests HTTP/1.0, HTTP/1.1, HTTP/2, TLS SNI, spoofed headers, WebSocket upgrades,
revocation and deny-all. It uses Docker, bundled Helm, and Git's OpenSSL by default;
set `HELM` and `OPENSSL` to override executable paths.

The live test checks the actual Proof Studio and Ledger responses with trusted
certificates, derives other hostnames from current Ingress/IngressRoute resources,
and verifies their denial. To test the published gateway VIP or actual WAN address,
set `PUBLIC_EDGE_TARGET`, `PUBLIC_EDGE_HTTP_PORT=80`, and
`PUBLIC_EDGE_HTTPS_PORT=443`. A LAN/hairpin WAN test is not external acceptance:
repeat approved and denied-host checks from independently hosted external probes,
including manually supplied private Host headers. Check local admin access via the
original Traefik VIP separately. Do not mistake successful staging tests for router
cutover or external validation.

Private reports are stored under `.local/public-edge/`. No synthetic keys or
production TLS keys are committed.

## Operations and recovery

Three gateway replicas spread across physical-host zones. A PodDisruptionBudget
keeps at least one available during voluntary disruption. HTTPS to Traefik verifies
the backend certificate against the public hostname; proxy headers are overwritten
at this boundary. The NetworkPolicy restricts pod egress to DNS and Traefik.
Certificate files are read from the mounted cert-manager Secret at handshake time
with a thirty-second Nginx certificate cache, so renewal needs no key copying.
Readiness checks Nginx itself, not the applications behind it.

For an app incident, restore the previous reviewed Helm values with `helm rollback`
and verify both the Deployment and Certificate. A certificate SAN addition/removal
may still need issuance before the restored names work. Keep the old gateway
certificate in cert-manager's normal renewal path.

If the new gateway fails during router cutover, the pre-cutover NAT destinations
are `10.99.15.50:80` and `10.99.15.50:443` on both WANs. Restoring those values
restores the previous broad web exposure too. For a security containment event,
disable the external HTTP/HTTPS forwards instead, preserving LAN administration.
