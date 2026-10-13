# Common Manager UI Helm chart

Registers the independent `rancher-common-ui` UIPlugin in the Rancher management cluster. Target: Rancher 2.15.x / Extensions API 3; shared presentation API 1, stable version 1.x. The chart installs only its UIPlugin, without asset hosting, workloads, RBAC, Secrets, or manager releases.

Build and publish the common versioned `files.txt` and `plugin/` directory, then install this release before either manager. `plugin.endpoint` is required. The UIPlugin annotation declares shared API 1; managers check this and the version during Helm installation and browser startup.

See [installation, independent upgrades, cache reloads, and rollback](../../rancher-common-ui/README.md). Keep package version, chart appVersion, and published asset path synchronized. Do not overwrite a version's published assets.
