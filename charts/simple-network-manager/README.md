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
