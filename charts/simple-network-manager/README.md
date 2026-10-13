# Network Manager

Native Rancher UI extension scaffold, targeting Rancher 2.15.x and Extensions API 3.
Install once on the Rancher management cluster in `cattle-ui-plugin-system`.
The chart registers a `UIPlugin`; it does not install or modify Traefik, MetalLB,
cert-manager, routes, or credentials.

This first version displays a **static design preview** with selected routing
examples from the October 11, 2026 cluster inspection. It has no live inventory,
traffic telemetry, or edit operations. Counts and certificate states are examples,
not current cluster status.

Before installation, build and publish the extension assets using the development
project in `simple-network-manager-dev`. Set `plugin.endpoint` to the published
directory containing `files.txt` and `plugin/`. A blank endpoint fails rendering.
Publishing and installation are separate follow-up steps.

The extension uses Rancher's existing authenticated UI session. The chart grants
no Kubernetes permissions. Live data access and mutations must enforce the active
user's permissions when implemented.

## Required common UI release

Install and enable the separate [Common Manager UI](../../rancher-common-ui/README.md)
release before this manager. The chart checks the management cluster's UIPlugin
for API 1, a compatible stable 1.x version, and enabled state. The manager's browser
initialization also requires the loaded common runtime; it has no private UI fallback.
Common UI upgrades and rollbacks update only that release, followed by a Rancher
browser reload. This manager chart registers only its own UIPlugin.

For offline lint or `helm template`, use `--set commonUI.verifyInstalled=false`.
Keep the default cluster prerequisite check for installation. The offline switch
never disables the browser dependency gate.
