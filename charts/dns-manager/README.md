# DNS Manager Helm chart

Registers the `dns-manager` UIPlugin on the Rancher management cluster in
`cattle-ui-plugin-system`, targeting Rancher 2.15.x and Extensions API 3.
This chart registers the interface only; it does not deploy a DNS engine or grant
resource permissions. Native installation and live adapters require validation.

Build versioned assets using `npm run build:extension` in `dns-manager-dev`.
Publish the resulting directory containing `files.txt` and `plugin/` to a location
reachable by Rancher's UI plugin operator. Set `plugin.endpoint` to that URL.

```sh
helm upgrade --install dns-manager ./charts/dns-manager \
  --namespace cattle-ui-plugin-system --create-namespace \
  --set plugin.endpoint=https://extensions.example.com/dns-manager/0.1.0
```

Replace the example URL with the actual published assets. A blank endpoint fails
chart rendering. Review the [plugin README](../../dns-manager-dev/README.md) and
[shared standard](../../RANCHER-PLUGIN-DESIGN.md) before live installation.
