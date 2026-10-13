# DNS audit visual and test evidence

71 inspected screenshots, 41 geometry views, 270 measured assertions (266 passing, 4 failing). Geometry thresholds supplement visual review; they do not prove backend/native acceptance. The 200 px schedule-height check is a diagnostic usability threshold, not a quoted pixel requirement.

## Measured failures

- desktop-snapshots: **numeric-align-right** — measured values in layout-evidence.json.
- desktop-snapshots: **schedule-usable-height** — measured values in layout-evidence.json.
- tablet-snapshots: **numeric-align-right** — measured values in layout-evidence.json.
- mobile-snapshots: **numeric-align-right** — measured values in layout-evidence.json.

## Inspected screenshots

- [01-overview](screenshots/01-overview.png): Overview; viewport 1280×720; document 1280×720.
- [02-sources](screenshots/02-sources.png): Sources; viewport 1280×720; document 1280×720.
- [03-zones](screenshots/03-zones.png): Zones; viewport 1280×720; document 1280×720.
- [04-zone-io](screenshots/04-zone-io.png): cormierconsulting.io; viewport 1280×720; document 1280×720.
- [05-zone-io-replication](screenshots/05-zone-io-replication.png): cormierconsulting.io; viewport 1280×720; document 1280×720.
- [06-zone-com](screenshots/06-zone-com.png): cormierconsulting.com; viewport 1280×720; document 1280×720.
- [07-zone-ad](screenshots/07-zone-ad.png): _msdcs.cormierconsulting.com; viewport 1280×720; document 1280×720.
- [08-zone-reverse](screenshots/08-zone-reverse.png): 3.99.10.in-addr.arpa; viewport 1280×720; document 1280×720.
- [09-record-create](screenshots/09-record-create.png): Record Draft; viewport 1280×720; document 1280×720.
- [10-pending-empty](screenshots/10-pending-empty.png): Pending Rollouts; viewport 1280×720; document 1280×720.
- [11-processes](screenshots/11-processes.png): Running Processes; viewport 1280×720; document 1280×720.
- [12-snapshots-empty](screenshots/12-snapshots-empty.png): Snapshots; viewport 1280×720; document 1280×720.
- [13-snapshot-gate](screenshots/13-snapshot-gate.png): Snapshots; viewport 1280×720; document 1280×720.
- [14-snapshot-options](screenshots/14-snapshot-options.png): Snapshots; viewport 1280×720; document 1280×720.
- [15-snapshot-password-mismatch](screenshots/15-snapshot-password-mismatch.png): Snapshots; viewport 1280×720; document 1280×720.
- [16-snapshot-capture-result](screenshots/16-snapshot-capture-result.png): Snapshots; viewport 1280×720; document 1280×720.
- [17-snapshots-populated](screenshots/17-snapshots-populated.png): Snapshots; viewport 1280×720; document 1280×720.
- [18-snapshot-unlock](screenshots/18-snapshot-unlock.png): Snapshots; viewport 1280×720; document 1280×720.
- [19-snapshot-comparison](screenshots/19-snapshot-comparison.png): Snapshots; viewport 1280×720; document 1280×720.
- [20-snapshot-restore-selected](screenshots/20-snapshot-restore-selected.png): Snapshots; viewport 1280×720; document 1280×720.
- [21-snapshot-diff-scrolled](screenshots/21-snapshot-diff-scrolled.png): Snapshots; viewport 1280×720; document 1280×720.
- [22-diagnostics](screenshots/22-diagnostics.png): Diagnostics; viewport 1280×720; document 1280×720.
- [23-settings](screenshots/23-settings.png): Settings; viewport 1280×720; document 1280×720.
- [24-help](screenshots/24-help.png): Help; viewport 1280×720; document 1280×720.
- [25-help-snapshots](screenshots/25-help-snapshots.png): Help; viewport 1280×720; document 1280×720.
- [26-source-create](screenshots/26-source-create.png): Create Source; viewport 1280×720; document 1280×720.
- [27-source-edit-test](screenshots/27-source-edit-test.png): Edit Source; viewport 1280×720; document 1280×720.
- [28-unsaved-leave](screenshots/28-unsaved-leave.png): Edit Source; viewport 1280×720; document 1280×720.
- [29-zone-create](screenshots/29-zone-create.png): Create Zone; viewport 1280×720; document 1280×720.
- [30-pending-incomplete](screenshots/30-pending-incomplete.png): Pending Rollouts; viewport 1280×720; document 1280×720.
- [31-pending-review](screenshots/31-pending-review.png): Pending Rollouts; viewport 1280×720; document 1280×720.
- [32-zones-selected](screenshots/32-zones-selected.png): Zones; viewport 1280×720; document 1280×720.
- [33-zone-reorder](screenshots/33-zone-reorder.png): Zones; viewport 1280×720; document 1280×720.
- [34-zone-order-review](screenshots/34-zone-order-review.png): Zones; viewport 1280×720; document 1280×720.
- [35-zones-empty-filter](screenshots/35-zones-empty-filter.png): Zones; viewport 1280×720; document 1280×720.
- [36-overview-lower](screenshots/36-overview-lower.png): Overview; viewport 1280×720; document 1280×720.
- [37-snapshots-selected](screenshots/37-snapshots-selected.png): Snapshots; viewport 1280×720; document 1280×720.
- [38-merge-passwords](screenshots/38-merge-passwords.png): Snapshots; viewport 1280×720; document 1280×720.
- [39-merge-incorrect-password](screenshots/39-merge-incorrect-password.png): Snapshots; viewport 1280×720; document 1280×720.
- [40-merge-priority](screenshots/40-merge-priority.png): Snapshots; viewport 1280×720; document 1280×720.
- [41-merge-review](screenshots/41-merge-review.png): Snapshots; viewport 1280×720; document 1280×720.
- [42-merge-summary](screenshots/42-merge-summary.png): Snapshots; viewport 1280×720; document 1280×720.
- [43-merge-config-selection](screenshots/43-merge-config-selection.png): Snapshots; viewport 1280×720; document 1280×720.
- [44-merge-changed-diff](screenshots/44-merge-changed-diff.png): Snapshots; viewport 1280×720; document 1280×720.
- [45-record-edit-a](screenshots/45-record-edit-a.png): Record Draft; viewport 1280×720; document 1280×720.
- [46-record-edit-cname](screenshots/46-record-edit-cname.png): Record Draft; viewport 1280×720; document 1280×720.
- [47-record-edit-aaaa](screenshots/47-record-edit-aaaa.png): Record Draft; viewport 1280×720; document 1280×720.
- [48-record-edit-srv](screenshots/48-record-edit-srv.png): Record Draft; viewport 1280×720; document 1280×720.
- [49-record-edit-ptr](screenshots/49-record-edit-ptr.png): Record Draft; viewport 1280×720; document 1280×720.
- [tablet-overview](screenshots/tablet-overview.png): Overview; viewport 768×900; document 768×900.
- [tablet-zones](screenshots/tablet-zones.png): Zones; viewport 768×900; document 768×900.
- [tablet-snapshots](screenshots/tablet-snapshots.png): Snapshots; viewport 768×900; document 768×900.
- [tablet-diagnostics](screenshots/tablet-diagnostics.png): Diagnostics; viewport 768×900; document 768×900.
- [tablet-settings](screenshots/tablet-settings.png): Settings; viewport 768×900; document 768×900.
- [tablet-help](screenshots/tablet-help.png): Help; viewport 768×900; document 768×900.
- [mobile-overview](screenshots/mobile-overview.png): Overview; viewport 480×800; document 480×800.
- [mobile-zones](screenshots/mobile-zones.png): Zones; viewport 480×800; document 480×800.
- [mobile-snapshots](screenshots/mobile-snapshots.png): Snapshots; viewport 480×800; document 480×800.
- [mobile-diagnostics](screenshots/mobile-diagnostics.png): Diagnostics; viewport 480×800; document 480×800.
- [mobile-source-editor](screenshots/mobile-source-editor.png): Create Source; viewport 480×800; document 480×800.
- [mobile-help-dialog](screenshots/mobile-help-dialog.png): Create Source; viewport 480×800; document 480×800.
- [50-global-namespace-filter](screenshots/50-global-namespace-filter.png): Zones; viewport 1280×720; document 1280×720.
- [51-user-namespace-empty](screenshots/51-user-namespace-empty.png): Zones; viewport 1280×720; document 1280×720.
- [52-snapshot-date-filter](screenshots/52-snapshot-date-filter.png): Snapshots; viewport 1280×720; document 1280×720.
- [53-snapshot-calendar](screenshots/53-snapshot-calendar.png): Snapshots; viewport 1280×720; document 1280×720.
- [54-zone-delete-review](screenshots/54-zone-delete-review.png): Zones; viewport 1280×720; document 1280×720.
- [55-snapshot-delete-review](screenshots/55-snapshot-delete-review.png): Snapshots; viewport 1280×720; document 1280×720.
- [56-overview-source-fallback](screenshots/56-overview-source-fallback.png): Overview; viewport 1280×720; document 1280×720.
- [57-overview-lookup-policy](screenshots/57-overview-lookup-policy.png): Overview; viewport 1280×720; document 1280×720.
- [58-record-create-mx](screenshots/58-record-create-mx.png): Record Draft; viewport 3430×1244; document 3430×1244.
- [59-record-create-txt](screenshots/59-record-create-txt.png): Record Draft; viewport 3430×1244; document 3430×1244.

## Geometry replay

[dns-manager-dev/tests/ui/browser-layout-probe.mjs](../../../tests/ui/browser-layout-probe.mjs) is the read-only real-browser probe. Run it through CUA against each visible route at 1280×720, 768×900 and 480×800, using the isolated audit preview. Save each returned object to layout-evidence.json and rerun npm run test:ui and npm run test:ui:gaps. This is an evidence replay workflow; npm/Vitest does not silently launch or drive a browser. JSDOM unit tests exercise actual Vue/UI behavior but cannot validate pixels.
