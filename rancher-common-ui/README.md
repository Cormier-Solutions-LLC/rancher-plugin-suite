# Common Manager UI

`rancher-common-ui` is a separate Rancher UIPlugin and Helm release. Network Manager and DNS Manager resolve shared presentation from its loaded runtime; their bundles contain only a small consumer bridge. They have no private fallback controls or shared stylesheet. Application inventory, permissions, forms' business fields, drafts, snapshots, encryption, and operations remain in the managers.

## Build and preview

From the repository root, run `npm run setup`, `npm run build:common-ui`, and `npm run preview`. Setup installs all three locked dependency sets. The Vite asset adapter serves the independently built common bundle under `/common-ui`; it does not compile it into a manager. A standalone assets server is available with `npm --prefix rancher-common-ui run preview` on localhost:5177. The root suite runs on localhost:5172. Static manager preview hosting must also serve the independent common assets at `/common-ui/package.json` and `/common-ui/rancher-common-ui-<version>.umd.min.js`; a manager's static output alone cannot satisfy its runtime dependency.

`npm --prefix rancher-common-ui test` verifies the actual UMD artifact, all exported controls, load order, numeric table sorting, compatible presentation replacement, removal, and incompatible-version recovery. Its Helm test uses real Helm against a local mock API, including server-side lookup. It does not validate a live Rancher installation.

## Runtime contract

The plugin publishes a versioned `rancher-common-ui-<version>` UMD initializer matching Rancher's extension loader. API 1 registers `Symbol.for('rancher.common-ui.runtime')` and dispatches `rancher-common-ui:changed`. Presentation factories receive the consuming manager's Vue runtime, so components participate in that app's reactive state and lifecycle. The common bundle does not ship a second Vue runtime.

Managers require a stable **1.x version / API 1**, enabled and successfully loaded. A dependency gate defers manager content mounting; it observes plugin registry changes and Rancher's loaded-plugin store. Missing, disabled, uninstalled, failed, or incompatible dependencies show installation and reload instructions. A common plugin loaded after a manager can release that gate. Uninstall hooks remove only the registry/style instance they own, so an old hook cannot remove a newer runtime.

Compatible releases keep the exported component names, attributes/events/slots, and DOM helper contracts. Overview and detail have both stacked and master/detail variants; flow has boxed and inline variants. Changes to these contracts require a coordinated manager migration and a new API/major version. Native mode inherits Rancher's theme and chrome; standalone previews use the same common presentation with isolated data.

## Publish and install

Build with `npm --prefix rancher-common-ui run build`. Publish the **contents of `rancher-common-ui/dist/1.0.0/`** to an immutable, versioned extension-assets endpoint reachable by Rancher's plugin operator. Keep `files.txt` and its `plugin/` paths together. Hosting/publishing is a separate action; nothing here starts a public asset host.

Install the common chart first on the Rancher management cluster:

```sh
helm upgrade --install rancher-common-ui ./charts/rancher-common-ui \
  --namespace cattle-ui-plugin-system --create-namespace \
  --set plugin.endpoint=https://extensions.example.com/rancher-common-ui/1.0.0
kubectl -n cattle-ui-plugin-system get uiplugin rancher-common-ui -o yaml
```

Replace the example URL with the actual published endpoint. Wait for asset caching/loading to succeed and enable the extension in Rancher before installing either manager. Each manager chart uses Kubernetes `lookup` to reject an absent, disabled, wrong-API, or incompatible common UIPlugin. A successful registration alone cannot establish that assets load; the browser dependency gate checks runtime availability. Install both manager charts with their own published asset URLs. All three charts register only their own UIPlugin; they do not install managed workloads, grant RBAC, or deploy an asset host.

For disconnected lint/render checks only, pass `--set commonUI.verifyInstalled=false` to manager charts. Ordinary `helm template` cannot read cluster state. This switch does **not** remove browser runtime enforcement and should remain enabled for actual installation. It is not a Helm subchart dependency: the common release is owned and updated independently.

## Independent upgrade and rollback

For a new compatible release, update the common package version and chart appVersion/version together, rebuild, publish to a new immutable URL, then upgrade **only** `rancher-common-ui` with that chart and URL. Do not rebuild or upgrade either manager. Check the UIPlugin cache result, then reload Rancher in each open browser tab: Rancher loads an extension at startup, and an existing tab can retain its previous bundle. Both managers should display the same `data-common-ui-version` and the new common presentation. Runtime change events also support in-process replacement; a browser reload is the operational procedure for Helm updates.

Use `helm history rancher-common-ui -n cattle-ui-plugin-system` to select the previous release, then `helm rollback rancher-common-ui <revision> -n cattle-ui-plugin-system`. Keep the previous immutable assets available, verify caching, and reload Rancher. Manager releases remain unchanged. Keep upgrades and rollbacks within their supported 1.x / API 1 range. Removing or disabling common UI deliberately blocks manager interfaces; routing/DNS workloads are independent of UI registration.

## Design and validation

The accepted design is [recorded by review item](../docs/ui-comparison-2026-10-11/implementation.md), sourced from the user's completed revision 94. The [global standard](../RANCHER-PLUGIN-DESIGN.md) requires this installed runtime for every custom manager plugin. Local builds and tests do not establish live Rancher loading or production installation. Native management bindings remain documented separately by each manager.
