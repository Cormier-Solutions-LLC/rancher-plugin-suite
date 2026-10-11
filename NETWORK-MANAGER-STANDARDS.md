# Network Manager Standards

Status: Network Manager-specific design requirements and variations; not a claim
that every feature is implemented or deployed.
Updated: 2026-10-11.
Shared standard: [Rancher Plugin Design Standard](RANCHER-PLUGIN-DESIGN.md).

This file records routing/certificate requirements, domain-specific behavior, and
variations of the shared patterns. Common navigation, page layout, actions, grids,
namespace context, checkboxes, Reorder, forms, Pending Rollouts, Running Processes,
Snapshots, Diagnostics, Settings, Help, refresh, authorization, and packaging inherit
the main standard. No exception to shared review, backup, or authorization gates
is granted here. A proposed conflicting variation requires the user's decision.

Shared page contracts are linked from this file rather than copied. Maintain local
setup and implementation behavior in the [development README](simple-network-manager-dev/README.md),
recorded checks in the [implementation review](simple-network-manager-dev/IMPLEMENTATION-REVIEW.md),
and existing-format recovery commands in the [recovery runbook](simple-network-manager-dev/RECOVERY.md).

## 1. Network-specific navigation and resources

These requirements specialize the shared standard for routing and certificates.

### Navigation and inventory

- Required inventory pages: Overview, TLS & Certificates, TLS Issuer Profiles,
  Port Configurations, followed by the shared Pending Rollouts, Running Processes,
  Snapshots, Diagnostics, Settings, Help ending. Older preview menu order is evidence,
  not an exception to the shared navigation contract.
- Connection Editor is hidden from the sidebar. Route Map, Routes, and Services & Destinations
  were removed as separate pages.
- Overview combines inspected routing resources and local drafts. Its flow is Incoming Traffic
  → Traefik Listener → Destination Service, with Resource Context alongside it.
- Sidebar counts apply to certificates, pending rollouts, issuer profiles, and port configurations.
  Certificates include observed resources plus unique prepared new-certificate drafts.
- Correlate Ingress, Traefik HTTP/TCP/UDP routes, Middleware, Services, EndpointSlices, listeners,
  Certificates, Issuers, Orders, Challenges, and ownership. Configured mappings and traffic health are separate.

### Reusable port configurations

- Support named configurations containing several TCP/UDP ports, comma-separated numbers,
  inclusive ranges, and selection of multiple configurations together.
- Import unmatched observed Service ports as Detected configurations. Rescan adds newly unmatched
  configurations while preserving existing edits/references. Never infer application protocol from a port number/name.
- Display imported Service names separately from namespaces. New configurations default to Global;
  existing scopes are immutable. Identical names are allowed in different scopes.
- Select TCP/UDP transport separately from application behavior. TCP supports plain forwarding,
  HTTP, HTTPS, and TLS termination. Preserve the distinction between TLS termination and passthrough.
- Show inbound port, public Traefik listener, destination Service port, and target/endpoint port distinctly.
  A blank destination port uses the inbound number only when the Service exposes matching transport/port.
- Support mapping to another uniquely labeled port and HTTP redirects to a selected HTTPS mapping.
  Reject missing destinations, chains, mismatched transports, overlapping conflicting actions, duplicate
  listeners, and missing backend ports. Plain TCP forwarding does not convert HTTP to HTTPS.
- Reconfiguration reviews generated drafts and observed associations separately. Observed associations
  may overlap and are not durable ownership. Update the reviewed group consistently; leave other versions unchanged.

### Issuers, connection publishing, and certificates

- Support multiple issuer profiles, Let's Encrypt staging/production, account email, GoDaddy DNS
  validation or Traefik HTTP validation, and downloadable cert-manager issuer drafts.
- Open issuer setup after selecting a profile or New Issuer. Prefill from known configuration;
  credential/account selectors show references only and offer metadata-only inline Add drafts.
- Accept multiple profile base domains separated by commas/newlines. Connection base-domain options
  derive from the selected issuer's configured domains; DNS solver selectors do not prove issuance will succeed.
- Use relative subdomains: an empty list includes the base and `www`; `@` explicitly includes the
  base in a named list. Suggest route names from destination/namespace while retaining custom names.
- Select namespace, Service, exposed Service port, and ingress class from inventory. Preserve
  existing route path rules, middleware references, and additional destinations during edits.
- Offer compatible Ingress/Traefik routing types and Automatic selection for combined HTTP/TCP/UDP mappings.
- Generate appropriate HTTP/TCP/UDP routes and shared Certificates when eligible; redirect resources
  include the required RedirectScheme Middleware.
- Allow requesting a new Certificate or reusing inspected Certificates in the destination namespace.
  Reuse checks all hostname coverage, including single-level wildcard rules, and references existing TLS Secrets.
- Support several certificates for independent domains, splitting Traefik groups or using multiple
  Ingress TLS entries as appropriate. Complex negated match rules require separate review.
- Generate default certificate Secret names from namespace and certificate name; retain manual overrides.
- Issue/Reissue reviews issuer, domains, actual Certificate identity, and Secret reference. Live reissue
  invokes cert-manager renewal and watches status; it does not delete TLS Secrets as a renewal shortcut.
- Certificate readiness colors apply only where a local certificate is expected. Raw TCP/UDP and
  passthrough remain neutral; coverage, readiness, and Secret availability are distinct checks.

### Existing preview boundaries

The current README describes static inspected inventories, browser-session drafts/pending proposals,
durable server-side configuration snapshots, and server-side snapshot schedules. These have different
persistence guarantees. Live inventory, writes, renewal, health, and restoration need their own integration
and validation. Inspected resource counts are fixture values, not fixed application requirements.

## 2. Overview, inventory, and editor variations

- Use the shared Master/Detail Overview variant: metric cards and filters above
  the left route inventory and right details panel. Clicking a route opens its
  details; this compact route list has no selection checkboxes or Select All.
- Domain Details opens by default; Ports & Mappings and TLS & Certificate start
  collapsed. Route certificate and snapshot badges occupy a separate bottom row.
- Port searches use substring matching: `443` also matches `4433` and `8443`.
  Protocol and Service & Ports filters apply routing-specific semantics while
  inheriting the shared host namespace filter and OR/AND combination rules.
- Existing connection namespaces and port-configuration scopes are immutable.
  Global port presets remain available within relevant selected namespace scopes;
  names may repeat in different scopes. Lock identity during edits.
- Certificate inventory may include observed certificates and unique prepared
  new-certificate drafts, with their states/breakdown distinguished. Do not count
  examples as active resources or duplicate one certificate across those sources.
- Configured listener/route/destination associations describe configuration, not
  successful traffic. Separate observed associations from generated editable
  drafts, and show affected consumers before reviewed reconfiguration.

## 3. Network snapshot adapter

Inherit the [complete shared Snapshot contract](RANCHER-PLUGIN-DESIGN.md#8-snapshots-schedules-restoration-and-recovery).
Network-specific capture and restoration include:

- Observed pre-change Ingress and Traefik HTTP/TCP/UDP routes, Certificates,
  Issuers/ClusterIssuers, port-configuration metadata, issuer profiles, and separately
  recorded publication/working proposals.
- Known Service ports, Middleware, TLS options, IngressClass, issuer, and other
  declared routing dependencies. Include referenced Secret values only through the
  shared explicit Include Secrets/encryption flow; missing values remain recovery gaps.
- Merge selection types ordered TLS Issuers, Certificates, Port Configurations,
  Secrets, then other captured resource/draft types; use each resource's stable
  namespace/kind/name or configuration identity and dependency semantics.
- Overview Configuration History opens Snapshots scoped to the selected route;
  resource badges link to its applicable snapshot list or coverage review.
- Selective restoration queues routing/configuration proposals and explicit selected
  credential replacements. Editing a reusable preset cannot silently rewrite its
  consumers. Preserve ownership and unrelated routes/Secrets.

The current preview uses server-side JSON/YAML pairs and saved inspection data,
and does not supply fresh live capture or the required encrypted ZIP implementation.
Its dedicated path/volume, Docker/PVC recovery commands, and source limitations stay
in the README and recovery runbook. Existing format and implementation evidence do
not override the shared backup contract.

## 4. Diagnostics and notification destinations

Inherit [shared Diagnostics, Settings, and Help](RANCHER-PLUGIN-DESIGN.md#9-refresh-diagnostics-settings-and-help)
and the [yellow/red notification rule](RANCHER-PLUGIN-DESIGN.md#3-page-shell-layout-and-styling).

- Network Diagnostics supports a 0.25–168 hour lookback; its initial view is 24 hours.
  The Overview error card opens ERROR entries from the previous hour. Demo logs
  remain labeled until backend collection is verified.
- A missing issuer/profile notification opens its Create/setup editor; an invalid
  configured issuer/profile opens that exact profile's Edit workflow.
- A missing or invalid port mapping opens the affected connection or port
  configuration editor with the exact scope and mapping selected.
- Certificate warnings/errors open the affected Certificate's details and available
  reviewed Issue/Reissue or repair action; missing credential dependencies open the
  exact reference's permitted setup/detail workflow, showing metadata only.
- Coverage notifications open the shared Snapshot gap review scoped to the affected
  routes/configuration, with direct applicable capture/restore actions. Missing
  backend/connection configuration opens its setup flow; an external system failure
  opens the relevant scoped diagnostic/recovery instructions when no editor exists.
- Multiple-item notices retain a filtered affected-item list and per-item correction
  destinations. Notification activation navigates; the actual operation follows
  the shared draft/review/Apply gates.

## 5. Maintaining variations and evidence

Update this file for Network-specific requirements and the main standard for any
behavior common to the plugin family. Link rather than duplicate common-page rules.
Distinguish an intended design variation from an older preview limitation. Record
implementation and release checks in the evidence files after they actually pass;
documentation consolidation alone does not validate native installation or live writes.

The current [Network Manager alignment review](simple-network-manager-dev/STANDARDS-ALIGNMENT-REVIEW.md)
records pending decisions where newer shared requirements differ from earlier accepted
preview behavior. Help and scoped rolling diagnostics additions are recorded in the
implementation evidence; they do not close ZIP/encryption, native integration or
other remaining acceptance gaps.
