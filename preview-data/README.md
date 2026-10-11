# Shared preview data and provider contract

Every plugin's standalone preview consumes a document with `schemaVersion`, `pluginId`, `revision`, `updatedAt`, immutable `source` provenance, and `data: { inventory, state }`.

`data/network-manager.json` contains keyed inspection datasets; `data/dns-manager.json` contains zones, records, and the DNS source. State holds saved configuration/drafts/settings. Each preview's Mock Data control can edit and save validated JSON. Saving reloads the interface to initialize all derived views consistently. Finish or cancel an active editor first.

The Vite-only `/__preview-data/<plugin>` API writes only its configured project file. It requires same-origin JSON writes, validates shapes and identifiers, and uses revision checks plus a file lock and atomic replacement. File errors/conflicts remain visible. Download Unsaved Data preserves pending work; Reload Source explicitly discards it. Do not commit personal runtime state or credentials.

## Swapping providers

`createPreviewDataClient` and `createRancherDataSource` expose the same `document`, `loadState`, `saveState`, `reload`, `flush`, `subscribe`, and capability interface. The live provider also exposes `stageChanges`; it rejects direct inventory replacement. Static builds use `createStaticPreviewDataClient` and disclose that edits remain in memory.

Create the live provider with authenticated callbacks, normalize the Rancher observations into the document shape, call `initializeDataSource` before importing inventory-dependent modules, and pass it to the plugin Dashboard's `dataSource` prop. Network state is attached by `connectNetworkState`; DNS attaches the same provider to its controller. Authentication, permission enforcement, resource projection, and server-confirmed Apply remain the deployment adapter's responsibility. Native pages can also use their existing Rancher observation hooks.

Passwords and decrypted Secret values are prohibited in saved JSON. Snapshot passwords exist only in memory during capture/merge and are sent to the local/backend ZIP service only for that operation. Snapshots themselves live in ignored `.local/preview-snapshots/` storage, separately from editable fixtures.

`snapshot-service.mjs` starts the corresponding plugin's Node snapshot service with each npm preview. The service binds to localhost, has a distinct port per plugin, and stops when its owning preview stops. `snapshot-unlock.mjs` implements the shared verification/exclusion policy without persisting credentials.
