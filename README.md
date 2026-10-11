# Rancher Plugin Suite

Rancher UI plugins, Helm registration charts, shared interface standards, and local previews maintained by Cormier Solutions LLC.

| Plugin | Source | Local preview | Status |
| --- | --- | --- | --- |
| Network Manager | [simple-network-manager-dev](simple-network-manager-dev/README.md) | http://127.0.0.1:5173 | Routing/certificate interface and native extension scaffold |
| DNS Manager | [dns-manager-dev](dns-manager-dev/README.md) | http://127.0.0.1:5174 | DNS interface, native extension scaffold, and separate engine prototype |

These previews use sample inspection data and local drafts. Building an extension does not establish live Rancher integration or authorize cluster changes.

## Run both plugins

Install Node.js 24 or newer, then run from the repository root:

```sh
npm run setup
npm run preview
```

The root preview launches both interfaces and their local snapshot APIs. Docker, Kubernetes, .NET, and cluster credentials are unnecessary. Stop with Ctrl+C. Ports 5173/5174 (UI) and 5183/5184 (snapshot API) must be free; startup fails clearly on conflicts.

Choose a subset with `npm run preview -- dns-manager` or `npm run preview -- network-manager`. Each plugin also supports `npm ci` followed by `npm run preview` from its own folder. Root setup installs both locked dependency sets.

## Editable shared data source

The Mock Data control in each preview edits validated inventory or saved state. Saves update [preview-data/data](preview-data/README.md) inside this project, using atomic writes, provenance metadata, and revision checks. Drafts survive reloads. Conflicting writes are reported and can be recovered rather than silently overwriting newer edits.

Both providers use the same normalized inventory/state contract. [The Rancher adapter](preview-data/data-source.mjs) accepts authenticated read, draft persistence, and reviewed staging callbacks. Those deployment-specific bindings and live validation remain integration work. Pages accept the provider independently of the mock file store. Never put live credentials or decrypted Secret values into fixtures.

## Snapshots

Create Snapshot and the snapshot schedule's Run Now open Snapshot Options. Include Secrets is off by default; enabling it requires a matching strong password and encrypts the complete recovery payload in an AES-256 ZIP. Automatic unattended runs exclude Secret values.

Merges begin by testing protected snapshots individually or together, support Apply To All Snapshots, and list missing/incorrect-password exclusions. Unencrypted snapshots remain eligible. At least two verified sources are required. Skipped originals are retained. Passwords are transient and are not saved in drafts or mock files.

Local ZIP archives, scheduling, and cleanup state are stored under `.local/preview-snapshots/<plugin>/`, excluded from Git. Storage measurements use that destination's actual filesystem and configured quota. Estimates beyond one year display ∞. Built static previews retain in-memory editing; use the npm development preview for durable project data saves.

## Standards and charts

- [Shared Rancher plugin standard](RANCHER-PLUGIN-DESIGN.md): shared pages, controls, previews, snapshots, and datasource rules.
- [Network Manager variations](NETWORK-MANAGER-STANDARDS.md).
- [DNS Manager design and variations](DNS-MANAGER-DESIGN.md).
- [Network Manager Helm chart](charts/simple-network-manager/README.md).
- [DNS Manager Helm chart](charts/dns-manager/README.md).

The charts register UIPlugin assets in Rancher's management cluster. They require published extension assets and a compatible Rancher Extensions installation; they do not deploy the managed networking/DNS engines or grant cluster permissions.

## Build and verify

```sh
npm run test:preview-data
npm --prefix simple-network-manager-dev run test:configuration
npm --prefix simple-network-manager-dev run build:preview
npm --prefix dns-manager-dev run build:preview
npm --prefix simple-network-manager-dev run build:extension
npm --prefix dns-manager-dev run build:extension
```

Shared tests cover editable source persistence/conflicts, provider boundaries, password verification, encrypted ZIP recovery/merge, mounted storage, scheduling persistence, and cleanup. The DNS engine proof has additional .NET/Docker prerequisites documented in its README; it is independent of npm UI previews.
