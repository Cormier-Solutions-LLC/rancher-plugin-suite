"""Generate the audit checklist from pinned requirements and explicit assessments."""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ASSESSMENTS = r"""
10|PARTIAL|navigation.ts/product.ts|Native registration exists in source; installed Explorer registration and authenticated access were not exercised.
11|PASS_LOCAL|overview screenshots; Preview.vue|Manager label opens Overview independently of its disclosure control in the preview.
12|PARTIAL|all page screenshots; F06|Visible pages highlight correctly; hidden editor/merge/coverage pages lose the owning active entry.
13|PASS_LOCAL|navigation.ts; sidebar screenshots|Required six-page tail is in the specified order.
14|PASS_LOCAL|navigation.ts|Inventories are flat; editor, merge and coverage routes are hidden.
15|NOT_APPLICABLE|navigation.ts|Network Manager has no dynamic per-zone/resource navigation collection; authorization of installed static routes still needs native testing.
16|APPROVED_VARIATION|NETWORK-MANAGER-STANDARDS.md:27|Network Manager explicitly uses native Rancher right-side navigation counts; the shared left-column proposal does not override this approved variation.
17|PARTIAL|F02/F25; responsive/workflow measurements|Shared totals exist, but counts wrap away from Refresh at 800px and merge verification initially reports zero sources.
18|PARTIAL|NamespaceSelector.vue; all-namespace captures|Preview cluster label and global picker are present; real host-store synchronization is not proven by preview interaction.
19|NOT_VERIFIED|product.ts; release plan|Installed placement near Compliance requires the target Rancher instance; preview ordering is not installation evidence.
20|NOT_VERIFIED|package.json; release plan|Recorded target versions are declared; no fresh installed compatibility test was performed.
21|PARTIAL|F20; native Dashboard.vue|Native route reuses pages, but hardcoded dark colors remain and native typography/light theme were not visually verified.
22|APPROVED_VARIATION|Settings/Help screenshots; NETWORK-MANAGER-STANDARDS.md:27|Neither page has an inventory count. Network Manager's approved right-side host count placement applies elsewhere.
23|FAIL|F06; hidden route screenshots|Breadcrumb has manager/current page but no clickable Snapshot ancestor for merge/coverage and no owning ancestor for the connection editor.
24|NOT_APPLICABLE|navigation.ts|Zones and nested record counts are DNS-specific and absent from Network Manager.
25|FAIL|F06; connection-editor/merge-priority/snapshot-coverage screenshots|Hidden page transitions leave no owning sidebar item active; visible page navigation does work.
26|FAIL|F12; PageSummary.vue/navigation-counts.ts|Counts do not consistently expose missing required dependencies in the inventory's own scope.
27|FAIL|F12; PageSummary.vue|Page count uses shared refresh state immediately, not a scoped delayed read; native count loading was not proven.
28|PARTIAL|F01/F02/F07; screenshots|Desktop largely matches the reference, but responsive shell, forms and header consistency remain uneven.
29|PASS_LOCAL|Dashboard.vue; all screenshots|One Dashboard shell is shared by all preview pages and registered native route components.
30|PASS_LOCAL|primary-page screenshots|Manager/cluster, heading, Help, actions, refresh and relevant count are present; Help/Settings omit counts intentionally.
31|FAIL|F04; workflow measurements|Merge navigation, restore preparation and review actions remain in panel/footer content rather than the page action area.
32|PASS_LOCAL|certificates-selected screenshot; merge source|Delete is hidden until selection and disappears after clearing. Merge requires two sources; preview Apply requires valid selection.
33|FAIL|F02/F03; UI-006/UI-018|Rescan uses 12px instead of the shared 14px text; editor actions can occupy two rows instead of the title row.
34|FAIL|F03; UI-008|Rescan and New Configuration widths differ within the same group. Certificate Delete/New dimensions match in the measured state.
35|PARTIAL|SharedCreate/SharedRefresh/PageActions; F03/F04|Shared components exist but Rescan and several workflow actions bypass their shared presentation/placement.
36|PARTIAL|F02; help-popup screenshot|Help hover overlay clears navigation at z-index 2147483647. Count position fails at narrow widths.
37|PASS_LOCAL|help-popup screenshot; HelpTip.vue|Hover and focus open contextual help; content is portaled above navigation with Close/Open Help controls.
38|PASS_LOCAL|primary measurements|Primary heading, banners and filters remain outside desktop panel scrolling. Whole-document scrolling at 600px is separately recorded.
39|FAIL|F01; UI-002/UI-003|At 600px every page expands beyond the viewport. Desktop primary panels reach the shared available bottom edge.
40|FAIL|F01; Preview.vue:32|Mobile breakpoint explicitly enables automatic shell height and visible overflow, defeating viewport containment.
41|PARTIAL|overview measurement; F24|Desktop route/detail bottoms align and list scrolls internally. Snapshot operations can produce adjacent nested scrollbars.
42|PARTIAL|F01/F24; workflow screenshots|Desktop inventories/forms are bounded, but very little usable detail height remains at 720px and the mobile shell scrolls externally.
43|PARTIAL|Preview.vue/Dashboard.vue|Desktop flex/grid constraints use minimum zero sizes; the 600px override removes the bounded shell behavior.
44|FAIL|F01/F02; responsive measurements|600px pages overflow vertically; 800px counts wrap, and populated certificate/port editor controls wrap at 1280px.
45|FAIL|F07/F03; settings/port-form screenshots|Rancher URL input is native white and inline; Rescan sizing differs. Main schedule/mapping controls otherwise share alignment.
46|PARTIAL|F20; CSS source|Scoped variables are used, but important action/help/count colors have hardcoded dark fallbacks; installed light theme was not tested.
47|PASS_LOCAL|styles/scrollbars.css; primary screenshots|Thin panel-colored scrollbars are used; forced-color override is present in source.
48|FAIL|F08; help-1280 screenshot|Expanded Help sections show duplicated divider lines; shared Overview collapsible sections use a single divider.
49|PARTIAL|F09; navigation.ts/SnapshotGate.vue|Most visual buttons use title case, but Connection editor title, some state text and corrupted snapshot gate labels remain inconsistent.
50|PARTIAL|F10; certificates/pending screenshots|Overview and diagnostic severity badges use colors; certificate grid Ready/Pending and rollout state text are not consistently badge-styled.
51|PARTIAL|SnapshotBanner.vue; coverage screenshots|Dark preview severity banners tint their full background; native theme contrast remains unverified.
52|PARTIAL|overview-1280 screenshot|List badges are compact on their own row; selected connection header badge/title crowding needs review at 1280px.
53|PARTIAL|SnapshotBanner/refresh error source|Coverage warning uses a full amber background. Missing/unavailable dependencies are not consistently reflected in scoped badges/notifications.
54|FAIL|F13; coverage/read-failure source|Coverage banner opens a gap list, but gaps do not lead directly to the exact fix editor; other read-failure notices are static.
55|PARTIAL|F20; native theme limitation|Current preview resembles native dark navigation; live host theme values, focus/disabled states and light scheme need installed verification.
56|PASS_LOCAL|all primary table rows; UI-010/UI-011|Measured text/numeric headers and body cells align at 1280px; selection columns are narrow and other columns adapt.
57|PASS_LOCAL|size formatter; history screenshot|Stored ZIP byte count drives numeric sorting and decimal B/KB/MB/GB/TB formatting; existing formatter tests cover scaling.
58|PASS_LOCAL|overview screenshot/source|Master/detail Overview includes search, route inventory and selected resource details.
59|PARTIAL|NamespaceSelector/native datasource source|Standalone global picker is shared and captures use All Namespaces. Authenticated Rancher namespace changes in both directions were not tested.
60|PASS_LOCAL|InventoryFilters.vue; interaction checks|Searchable multi-selects, selected count, Clear, outside click, focus and Escape dismissal are implemented and inspected.
61|PASS_LOCAL|configuration test suite|OR within selections and AND across filter groups are covered by existing configuration tests.
62|PARTIAL|F11; history screenshot|Overview protocols/ports and certificate/diagnostic filters exist; Snapshots lacks a dedicated Manual/Automatic generation filter.
63|PASS_LOCAL|configuration tests; shared filter source|Relevant names/namespaces/service ports are searchable, including partial port queries; domain-specific placeholders/help exist.
64|PASS_LOCAL|port/issuer/certificate screenshots|Namespaced identity is separated into Namespace cells; unscoped presets display Global rather than namespace/name prefixes.
65|PASS_LOCAL|InventoryFilters/DataGrid source; grouping checks|Flat lists are default, Group By Namespace is optional and Global is placed first. Snapshot ordering remains Created descending.
66|PASS_LOCAL|DataGrid.vue; all grid screenshots|Shared sortable headers expose direction/aria-sort and compare numbers separately from strings; main empty grids retain headers.
67|PASS_LOCAL|DataGrid.vue source|Expanded rows are bundled with their parent before sorting; grouping maintains those bundles. This structural check is source-based.
68|PASS_LOCAL|pending-rollouts/running-processes screenshots|Empty grids retain labeled headers and centered No Results Available; empty Select All is disabled.
69|PASS_LOCAL|row handler source; selection interaction|Read-only details are separate from row action/checkbox events; measured certificate selection did not open row details.
70|PASS_LOCAL|all grid screenshots; actions.css|Row action icons are compact, horizontal and right-aligned with accessible labels; destructive actions remain visually distinct.
71|PASS_LOCAL|UI-012; grids/source|Overview route cards have no selection boxes. Full inventories expose meaningful bulk actions; restore selection is an explicit operation workflow.
72|PASS_LOCAL|certificates-selected screenshot; PendingRollouts source|Explicit selection reveals scoped header actions and clears them when deselected. No live destructive apply was executed.
73|PASS_LOCAL|snapshot-restore-visible screenshot; DataGrid source|Real native checkboxes are used; restoration Select All displayed a mixed state for partial selection.
74|PARTIAL|F19; BulkDelete source|UI reviews selected resources and excludes Secrets, but backend recovery snapshot coverage is not revalidated for general snapshot deletion.
75|PARTIAL|F18; pending/workspace source|Labels distinguish drafts/examples, but saving issuer/port proposals mutates the same inventory arrays used to represent current configuration.
76|PASS_LOCAL|primary screenshots/UI-009|Desktop shared filter rows have labels above, expanding search, consistent aligned controls, and configurable page-specific filters.
91|PASS_LOCAL|overview screenshot|Network Manager uses the allowed Master/Detail variant; DNS Summary-only requirements do not apply here.
92|PARTIAL|Overview/shared filters; host integration limitation|Overview keyword search consumes preview global namespace scope; installed host picker synchronization needs validation.
93|PASS_LOCAL|overview screenshot|Routes, incidents, referenced certificates and pending changes are compact statistic cards.
94|PARTIAL|F27; Overview card source|Errors and pending cards navigate with meaningful scope; Referenced Certificates opens all certificates without a reference-only filter.
95|PASS_LOCAL|draft/resume source; configuration tests|Working drafts and validated pending changes are distinct; resumable editor drafts are exposed from Overview.
96|PASS_LOCAL|overview/domain screenshots|Incoming traffic, listener, destination and context are together; copy states configuration is not a reachability check.
97|PASS_LOCAL|overview screenshot|Namespace, owning application and preview change state appear in Resource Context.
98|PARTIAL|ResourceLink.vue; native limitation|Native detail URL builder uses active cluster context; actual installed link targets were not verified.
99|FAIL|F14; diagnostics/coverage/restore screenshots|Several namespace/resource references remain plain text, notably diagnostics and snapshot operation lists, instead of native detail links.
100|PASS_LOCAL|Overview/history deep-link source|Resource-scoped snapshot links preserve route scope and provide Clear Filter; prior configuration tests cover these paths.
101|PASS_LOCAL|overview screenshot|Domain Details starts expanded; Ports & Mappings, TLS & Certificate and Snapshots start collapsed for a selected route.
102|PASS_LOCAL|domain-link tests/source|Concrete web addresses use safe new-tab links. Wildcards/raw transport are informational; IPv6 and URL escaping are tested.
103|PASS_LOCAL|domain/port tests/source|Service cluster IP and endpoint IP/port are distinct; named service ports resolve through inspected metadata.
104|PASS_LOCAL|Overview source/details|Observation source/time and non-reachability caveat are displayed for address/configuration observations.
105|FAIL|F02/F04/F07|Forms differ in input styling and action placement; certificate/port forms wrap header controls and Settings URL is unstyled.
106|PASS_LOCAL|new editor screenshots|New forms reset to clean defaults; editing intentionally loads existing connection identity and fields.
107|PASS_LOCAL|configuration tests; editor screenshots|Existing connection namespace and relevant identity fields are immutable in the tested model.
108|PARTIAL|certificate/editor suggestion source|Conditional generation preserves manual Secret-name overrides, but an explicit Use Suggested Name control is not consistently provided.
109|PASS_LOCAL|configuration tests; issuer/certificate source|Certificate/issuer/domain and port choices follow selected namespace/profile; multi-certificate hostname coverage is tested.
110|PASS_LOCAL|PublishService related Add source|Related Add actions produce drafts with explicit preview/staged behavior, rather than silently issuing live resources.
111|PARTIAL|configuration suite; F15|Local model validates mapping/dependency constraints; authoritative live backend validation and ownership revision checks are not verified.
112|PARTIAL|unsaved-dialog screenshot; form-guard source|Actual connection leave prompt showed Save Draft/Discard/Stay; other forms register the guard. Native/browser-unload integration remains unverified.
113|PASS_LOCAL|editor-session.ts; configuration tests|Incomplete form drafts are resumable from Overview and described as preview/session state, not durable snapshots.
114|FAIL|F05; form/modal screenshots|Shared header CSS overrides secondary Cancel styling, making it solid blue like primary actions.
115|PASS_LOCAL|manual refresh interaction; configuration tests|Entered Route Name stayed intact after Refresh; stateful editor is preserved in place rather than remounted.
116|PARTIAL|F15; PendingRollouts.vue|Draft saving and Apply are separated; live Apply is disabled without backend capability. Real authenticated execution is absent/unverified.
117|PARTIAL|F22; issuer/settings source|Relevant provider configuration exposes credentials as references, but has no current-settings Test Connection with freshness/retest feedback.
118|PASS_LOCAL|configuration tests; pending-rollouts source|Incomplete drafts are labeled Needs Completion and do not qualify for Apply until valid.
119|PARTIAL|F15/F18|Pending proposals and simulated processes exist; current-state arrays can change before Apply and actual backend execution/readback is not verified.
120|PASS_LOCAL|pending-rollouts.ts; configuration tests|Create/edit/reissue/port/delete/restore drafts enter a shared pending list; repeated edits update stable pending records.
121|PARTIAL|pending/restore source; F15|Affected scope and proposed manifests are available, but authoritative before/after ownership data requires a real backend.
122|PASS_LOCAL|Overview/sidebar source|Both use the same pending counter, with examples excluded; screenshots showed matching zero counts.
123|PARTIAL|PortPresets/reconfiguration source; F18|Consumers are exposed in reconfiguration review, but saved presets update current preview inventory before reviewed Apply.
124|PARTIAL|atomic configuration tests; F15|Local affected-group validation is tested. Live transactional/partial failure reconciliation is not proven.
125|PARTIAL|snapshot gate/merge source; F15|Local dependency changes invalidate review. Real resourceVersion checks against concurrent cluster writes are not tested.
126|PARTIAL|ownership context; F15|Helm ownership is displayed; routing live changes through Helm/Fleet/controller source is not implemented/verified in preview.
127|PARTIAL|running-processes screenshot/source|Page exists with operation/status/times. Actual asynchronous backend jobs are not connected; available activity is simulated.
128|PASS_LOCAL|RunningProcesses simulation source|Preview simulated processes are explicitly labeled; model does not claim real controller rollout progress.
129|PASS_LOCAL|running/history source/screenshots|Session operation records are separate from durable stored backups on Snapshots.
130|PARTIAL|server persistence tests; compose/PVC source|Dedicated snapshot directory and persistent volume configuration exist; independent host backup/migration coverage was not proven.
131|PASS_LOCAL|server ZIP/recovery tests; RECOVERY.md|ZIP contains index/manifests and standalone recovery instructions; Secret-inclusive payload encryption and configuration-only omission are explicit.
132|FAIL|F18; port-presets.ts/workspace.ts/snapshot-schedule.ts|Capture reads arrays already updated by saved proposals, allowing proposed values to masquerade as persisted pre-change configuration.
133|PASS_LOCAL|snapshot-create-modal/secrets screenshots|Include Secrets is unchecked by default; checking reveals password/confirmation/strength fields and disables Create until valid. No credentials were entered.
134|PASS_LOCAL|existing snapshot server tests|Encrypted archive tests cover wrong-password verification and recovery. This is local cryptographic behavior, not production credential capture.
135|PARTIAL|source review; server tests|Password handling clears transient inputs and avoids saved index fields; a full runtime browser-memory/log audit was not performed.
136|PASS_LOCAL|snapshot comparison source; coverage screenshot|Screen values are redacted; missing Secret values are disclosed as non-restorable reference-only coverage.
137|PARTIAL|F11/F19; history/restore screenshots|Listing/search/scope/merge/restore/ZIP work locally; dedicated generation filter is absent and server deletion coverage is insufficient.
138|PASS_LOCAL|history screenshot; sort source|Fresh snapshot inventory uses raw Created descending; grouping retains Created ordering and user sort is preserved during refresh.
139|PASS_LOCAL|history measurements; size formatting tests|Snapshot Size uses complete ZIP bytes, numeric sorting and scaled decimal units; synthetic fixtures and full archive have distinct sizes.
140|PARTIAL|history screenshot; F11/F04|Common heading, icon actions, count, Group By and date range exist; generation filter and workflow header placement are incomplete.
141|FAIL|F18/F19; server.mjs:184|Client gates compare content/age, but proposed/current conflation and server deletion's age-only recovery check violate full persisted affected-scope validation.
142|PASS_LOCAL|configuration tests; restore-review screenshot|Saved/uploaded snapshot checks compare age and content automatically; mismatches remain blocked. Reference-only YAML does not establish encrypted credential coverage.
143|PARTIAL|restore-review screenshot; F18/F15|Selection/diff/current-state backup gate and confirmation are present, but authoritative current baseline and final live revision checks are unverified.
144|PASS_LOCAL|snapshot selection tests/source|Secrets default to not replacing credentials; replacement requires explicit selection. Managed resource deletion excludes Secrets by design.
145|PARTIAL|restore/pending source; F15|Restoration prepares pending drafts. Separate live backend Apply and actual Running Processes readback remain unavailable/unverified.
146|PASS_LOCAL|RECOVERY.md; ZIP tests|Independent file retrieval, decryption and native manifest recovery are documented/tested without reliance on the running UI.
147|PARTIAL|merge-unlock screenshot; server unlock tests; F25|Dedicated password verification supports encrypted sessions; actual UI traversal used unencrypted safe fixtures and source count showed zero before accepting two verified sources.
148|PASS_LOCAL|unlock tests/source|Missing/incorrect/unreadable sources are named and excluded; accepting verified sources requires explicit continuation and minimum source count.
149|PARTIAL|merge workflow screenshots; F16|Dedicated navigable per-type wizard exists and is visually reviewed; issuer identity collision prevents correct flattening in some namespaced cases.
150|FAIL|F16; snapshot regression test|Highest source priority is implemented, but profile identity issuer-profile/name omits namespace and collapses unrelated profiles.
151|PASS_LOCAL|configuration tests; merge type screenshots|Matching items are retained but hidden; changed/additional items appear in per-type steps and empty steps are skipped by the model.
152|PARTIAL|configuration tests; F16|Known dependencies are expanded and missing ones block merge/restore; namespace-colliding profile identity can corrupt the effective dependency set.
153|PARTIAL|Secret freshness tests/source|Current credentials take precedence where readable and saved provenance is retained. The live authenticated Secret-read path was not tested in the browser.
154|FAIL|F17; snapshot regression test|Comparison omits persistent metadata.labels; a metadata-only Service change is wrongly reported Unchanged and may disappear from review.
155|PARTIAL|merge server tests; F19|Durable merge/provenance/omission protection exists. General original-deletion recovery content is not validated server-side.
156|PASS_LOCAL|merge editor-session source|Merge uses hidden route and shared leave/draft guard; baseline changes invalidate choices. Navigation/header ownership issues are separately failed.
157|PARTIAL|coverage screenshot; F16/F17|Seven-day status/history UI works; identity/content omissions can produce inaccurate matching coverage.
158|PASS_LOCAL|snapshot-coverage screenshot|Banner is keyboard-clickable; gap page hides covered items and groups missing Secrets in collapsible sections with the shared header.
159|PASS_LOCAL|Secret coverage configuration tests|Secret values use applicable backup presence, not freshness/current-value equivalence, only for the banner; references still show missing.
160|PASS_LOCAL|Overview snapshot link source|Resource and exact snapshot links retain scope and offer Clear Filter.
161|PASS_LOCAL|history-1920 screenshot; SnapshotSchedule.vue|Schedule/cleanup panels are equal-width, left-group fields/right actions, compact retention units; they stack responsively in source.
162|PASS_LOCAL|schedule screenshots/source|Enabled is green, Disabled red and Unavailable is distinct; local loaded state was visibly rendered.
163|PASS_LOCAL|existing server restart/schedule tests|Server persists interval/scope/source and executes without a browser; supported units include minute/hour/day/week/month. Live cluster capture is not claimed.
164|PASS_LOCAL|cleanup server tests/source|Default is disabled; retention protects newest applicable item/scope coverage. Isolated audit schedule changes do not establish production policy.
165|PARTIAL|F23; SnapshotSchedule.vue|Storage has a full-width three-column row, but its default collapsed disclosure hides the required figures until opened.
166|PARTIAL|statfs/quota tests/source|Effective configured quota and filesystem free bytes are combined; real service-account/PVC volume-limit discovery was not tested in deployment.
167|PASS_LOCAL|storage server tests/source|Storage resolves the actual save directory and calls statfs on its mounted filesystem; configured quota bounds the result.
168|PASS_LOCAL|storage forecast tests/source|Largest complete ZIP and saved cadence drive estimate; configured 1GiB isolated quota supplies a known bounded test destination.
169|PASS_LOCAL|storage formatter/source tests|Unavailable/unknown limits are disclosed and horizons over a calendar year display infinity rather than spurious precision.
170|PASS_LOCAL|shared refresh screenshots|Manual icon Refresh and Refresh Every are shared; Rescan remains a separate discovery action.
171|PASS_LOCAL|DOM snapshots|Default is five minutes with Off, 30 Seconds, 1/5/15 Minutes and 1 Hour choices.
172|PASS_LOCAL|countdown tests; screenshots|Deadline-based fixed MM:SS sits between selector and Refresh; reset/off behavior is covered by the configuration suite.
173|PASS_LOCAL|manual refresh with edited Route Name|Refresh updated in place while preserving the typed value and editor; local form guard remained active.
174|PASS_LOCAL|bounded-read source/tests|Overlap prevention and bounded read failure retain previous data; configuration tests cover cancellation behavior.
175|PARTIAL|bounded-read unit tests/source|Delayed overlay/timeout/retry code exists; actual slow backend focus/retry transitions were not forced in this audit.
176|FAIL|F12; PageSummary.vue|Count spinner follows global refreshing immediately rather than only its delayed associated data request.
177|PARTIAL|diagnostics screenshot/source|Aligned filters and host scope exist locally; real Rancher controller replica discovery and live logs are not connected.
178|PASS_LOCAL|diagnostics DOM/screenshot|Lookback is 24 hours on opening; adapter limitation/demo source is labeled.
179|PASS_LOCAL|diagnostics DOM; source|Rolling scoped 24-hour count showed 1 warning and 1 error, red tone, accessible breakdown; independent of view search/severity.
180|PASS_LOCAL|DOM/source|Demo logs, static data, simulated processes and preview behavior are identified; refresh does not claim new live observation.
181|PASS_LOCAL|Settings screenshot/source|Browser display preferences persist independently; toggles do not alter snapshot scheduling/storage capabilities.
182|PARTIAL|Settings source; F12/F13|Preview, snapshot, inspection and read failure controls exist; all dependency warning types are not implemented as independently controlled notifications.
183|PASS_LOCAL|display-settings source|Fresh native/test defaults are off; explicit previously saved Preview preference can enable explanatory labels.
184|PASS_LOCAL|DisplaySettings.vue:11|HTTP(S) origin validation rejects embedded credentials; native links use active host origin rather than a hardcoded cluster.
185|PARTIAL|Settings screenshot; F22|Rancher URL and visibility controls exist; functional management connection configuration/testing is not connected.
186|PASS_LOCAL|help screenshot/navigation.ts|Help is final, uncounted and has no question-mark controls; collapsed topics cover the app's pages.
187|PASS_LOCAL|help-sections/HelpTip source|Topics cover preview/live and recovery; contextual popups reuse sections and route Open Help to relevant content.
188|NOT_VERIFIED|native datasource factory; F15|No authenticated native read/write or server authorization acceptance test was performed; preview cannot prove enforcement.
189|PARTIAL|encryption tests; Secret capture source|Encrypted explicit recovery path is supported and screen values are redacted; complete browser/log credential isolation requires live integration validation.
190|PASS_LOCAL|certificate inventory/source|Certificate listing reads public metadata and Secret references; it does not display private keys or provider credentials.
191|NOT_VERIFIED|architecture/rollout limitation|Management runtime is separate architecturally; real routing continuity during UI/API failure was not exercised.
192|PARTIAL|chart/extension source; build log|UIPlugin chart/assets structure is present; native published files and clean install verification were not run.
193|PARTIAL|README/RECOVERY/chart source|Deployment roles are documented; chart registration/runtime separation still needs an installed acceptance check.
194|PASS_LOCAL|deployment source review|No separate ingress/database/monitoring stack was introduced solely for this audit or preview feature.
195|PASS_LOCAL|isolated 127.0.0.1:8091 preview|Shared pages were tested against an isolated local directory and scrubbed fixtures; user container and credentials were not accessed.
196|PASS_LOCAL|actual screenshots/build log|Repository-owned standalone UI runs and builds; evidence is real rendered pages, not a design mockup.
197|PARTIAL|package.json/lockfile/build log|Shared npm scripts and lockfile are present and build passes; clean dependency installation was not repeated on the dirty workspace.
198|NOT_VERIFIED|vite-plugin source; F21|The audit ran a local built UI, not a fresh npm preview with Docker stopped. Optional backend startup failure remains a source-level concern.
199|PASS_LOCAL|README/vite source|Localhost URL, prerequisites, commands and Ctrl+C stop are documented with a distinct local port.
201|PARTIAL|shared preview-data/native adapter source|Swappable inventory/state contract exists, but concrete authenticated native provider is not end-to-end verified.
202|PARTIAL|preview/native Dashboard source|Standalone chrome is outside the shared Dashboard. Actual native header/sidebar inheritance was not visually inspected.
203|PARTIAL|F21; shared vite plugin|Preview needs no cluster credentials, but optional local snapshot helper startup can reject Vite setup; failure-tolerant startup needs a test.
204|PASS_LOCAL|this report; README|Preview/build evidence is explicitly separated from publication, installation and live execution; no deployment claim is made.
205|NOT_VERIFIED|release validation plan|Native integration, permissions, server validation and result readback remain required before declaring live readiness.
206|NOT_VERIFIED|Helm/package source|Packaging source exists; no clean install/upgrade/uninstall or runtime/register acceptance test was performed.
207|PARTIAL|F06/F12; page navigation checks|Preview manager opens Overview and scoped counts exist; hidden ownership and native context/authorization require fixes/verification.
208|FAIL|F01/F02/F03/F04; UI evidence|Shared desktop shell works, but mobile overflow, action wrapping, Rescan sizing and panel workflow actions fail measured requirements.
209|PASS_LOCAL|DataGrid source; empty grid screenshots|Sortable direction/aria metadata, parent-row bundling and retained empty headers are implemented; recorded geometry checks pass on primary tables.
210|PARTIAL|filter interactions; native limitation|Local filters/grouping and action event isolation work; live host namespace bidirectional synchronization remains unverified.
211|PASS_LOCAL|certificates selection screenshot|Selection-only Delete is hidden/cleared correctly. Ranked Reorder does not apply to this manager's inventories.
212|NOT_APPLICABLE|Network inventory semantics|No persistently manually ranked collection exists here. Merge source priority is audited against its separate wizard rules.
213|PARTIAL|hover/focus Help; mixed checkbox; F09|Labels, focus popup and guards were checked; corrupted snapshot gate text and untested full keyboard/native accessibility prevent full acceptance.
214|PARTIAL|unsaved dialog; R108|Clean/edit guard flow works locally, but explicit suggested-name reset and native navigation behavior need completion/verification.
215|PASS_LOCAL|manual refresh interaction/configuration tests|Typed form data survives refresh; source/freshness stays labeled rather than implying live retrieval.
216|PARTIAL|F18; local state source|Labels distinguish working/pending/process/snapshot states, but current inventory arrays still absorb unapplied issuer/port proposals.
217|PARTIAL|F15/F18|Local affected/diff views exist; authoritative ownership/revision and persisted-current separation are incomplete/unverified.
218|FAIL|F18/F19|Pre-change baseline conflation and server age-only deletion check prevent acceptance of full-scope execution backup verification.
219|PASS_LOCAL|existing server persistence/recovery tests|Snapshots survive server restart and standalone ZIP/YAML recovery is tested locally; deployment volume backup is separate.
220|PASS_LOCAL|existing schedule/cleanup tests|Browser-independent scheduling/source labeling and newest-item retention pass local server tests.
221|PARTIAL|F16/F17; snapshot tests|Encryption/ZIP/provenance/presence checks pass existing tests, but targeted namespaced issuer and persistent metadata regressions fail.
222|PARTIAL|storage tests; F23|Configured writable quota/ZIP estimate logic works; default collapsed display and actual deployed quota verification remain open.
223|PARTIAL|F07/F08/F12/F14|Help, Settings and Diagnostics use shared shell, but styling/dividers/count state/resource links are not fully consistent.
224|FAIL|F13|Warning/error notices do not all open scoped item fix editors with mutation review preserved.
225|NOT_VERIFIED|F15; security acceptance plan|No installed authenticated backend permission matrix/credential handling validation was performed.
226|NOT_VERIFIED|live continuity plan|Managed traffic during real UI/backend failure remains untested.
227|NOT_VERIFIED|release validation plan|Native publication and installation were not performed; successful standalone build is not release evidence.
228|PARTIAL|build-output.txt; actual browser evidence|Local built UI and build pass; clean npm preview startup on a fresh environment remains unverified.
229|NOT_VERIFIED|F21; isolated built server|No Docker-stopped/backend-absent fresh npm preview acceptance test was performed.
230|PARTIAL|root preview-suite source|Suite supports registered plugin selection/session state in source; cross-plugin side-by-side behavior and process ownership were not visually tested in this Network-only audit.
231|NOT_VERIFIED|preview-data source; new standard item|Global Git LFS feature-scenario completeness, authoritative scrubbing and missing-LFS startup need a separate fixture audit; small merge fixtures do not prove every feature's demo coverage.
232|NOT_VERIFIED|new global demo acceptance item|No complete global LFS scenario/scrubbing/provider acceptance run was performed.
"""

def build():
    reqs = json.loads((ROOT / 'requirements.json').read_text(encoding='utf-8'))
    assessments = {}
    for line in ASSESSMENTS.strip().splitlines():
        rid, status, evidence, analysis = line.split('|', 3)
        assessments[int(rid)] = dict(status=status, evidence=evidence, analysis=analysis)
    for rid in range(1, 10):
        assessments[rid] = dict(status='REFERENCE', evidence='Pinned design source/reference index', analysis='Source pointer inspected as context; not a behavioral acceptance requirement. DNS-only source pointers do not make DNS pages part of this Network Manager audit.')
    for rid in range(77, 91):
        assessments[rid] = dict(status='NOT_APPLICABLE', evidence='Network inventory semantics; MergeSnapshots.vue', analysis='Network Manager has no persistently manually ranked inventory. This rule governs such collections; snapshot merge source priority is a separate temporary operation audited under requirements 149–156.')
    assert len({x['id'] for x in reqs}) == len(reqs)
    assert set(map(lambda r: int(r['id']), reqs)) <= set(assessments), 'Missing assessment'
    rows = [{**r, **assessments[int(r['id'])]} for r in reqs]
    (ROOT / 'assessment.json').write_text(json.dumps(rows, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
    tally = Counter(r['status'] for r in rows)
    chunks = ['# Requirement-by-requirement audit\n',
              'Audit date: 2026-10-11. Every indexed bullet is assessed below; checked means reviewed, not passed. The pinned source is [RANCHER-PLUGIN-DESIGN.audit-source.md](RANCHER-PLUGIN-DESIGN.audit-source.md). IDs are stable audit IDs, not source section numbers. Requirement 200 was replaced during the source update by 230; 231–232 are newly added global demo-data requirements.\n',
              'PASS_LOCAL = supported by the named local UI/source/test evidence, without claiming installed/live compliance. PARTIAL = implemented in part or not fully validated. FAIL = observed/reproduced deviation. NOT_VERIFIED = no adequate execution evidence. NOT_APPLICABLE = outside Network Manager semantics. APPROVED_VARIATION = explicit Network Manager standard takes precedence. REFERENCE = source pointer.\n',
              '| Status | Items |\n|---|---:|\n'+ '\n'.join(f'| {k} | {v} |' for k,v in sorted(tally.items()))+'\n',
              '## Indexed requirements\n']
    section = None
    for r in rows:
        if r.get('section') != section:
            section = r.get('section')
            if section: chunks.append(f'### {section}\n')
        chunks.append(f"- [x] **R{r['id']} — {r['status']}** · source line {r.get('line', '?')}\n\n  **Requirement:** {r['requirement']}\n\n  **Analysis:** {r['analysis']}\n\n  **Evidence:** {r['evidence']}.\n")
    chunks.append('## Additional non-bullet source checks\n\n| Source item | Status | Analysis |\n|---|---|---|\n| Purpose/status and maintenance paragraphs | PASS_LOCAL | Treated as a cross-plugin design standard, not proof of deployment. This report preserves production boundaries and explicit variations. |\n| Navigation order block | PASS_LOCAL | Required final six entries match navigation.ts; hidden operations retain no visible owning highlight (R25 fails). |\n| Ranked-collection six-state behavior table | NOT_APPLICABLE | Network has no persistent manually ranked inventory. The six cases (normal empty/selected; clean/dirty reorder; refreshing/conflict; saving) apply when that feature exists. Merge precedence uses its own rules. |\n| DNS Zones/breadcrumb demonstration | NOT_APPLICABLE / PARTIAL | Zones are DNS-only. Reusable breadcrumb/owning navigation rule applies and fails on hidden Network routes. |\n| Native visual reference note | PARTIAL | Used as documented reference; no new authenticated Rancher capture or light-theme inspection was performed. |\n| Network Manager-specific variation | APPROVED_VARIATION | Native right-side navigation counts are explicitly approved in NETWORK-MANAGER-STANDARDS.md; no conflicting left-column migration is proposed. |\n| Published/installed/live claims | NOT_VERIFIED | Build/local UI are verified; install/auth/live/controller/recovery acceptance remains pending. |\n')
    (ROOT / 'checklist.md').write_text('\n'.join(chunks), encoding='utf-8')
    print(json.dumps(dict(items=len(rows),status_counts=dict(tally)), indent=2))

if __name__ == '__main__':
    build()
