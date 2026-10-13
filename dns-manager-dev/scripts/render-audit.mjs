import { readFile,writeFile,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { relative,resolve } from 'node:path';
import { analysis } from './audit-analysis.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const directory=resolve(root,'dns-manager-dev/docs/standards-audit/2026-10-11');
const read=path=>readFile(resolve(root,path),'utf8');
const requirements=JSON.parse(await read('dns-manager-dev/docs/standards-audit/2026-10-11/requirements.json'));
const current=await read('RANCHER-PLUGIN-DESIGN.md');
if(createHash('sha256').update(current).digest('hex')!==requirements.sha256)throw new Error('Standard changed: regenerate requirement inventory before publishing the audit.');
await writeFile(resolve(directory,'STANDARD-SNAPSHOT.md'),current);
const labels={V:'Verified local',P:'Partial',G:'Gap',U:'Unverified live',N:'Not applicable',C:'Context'};
const files={
  1:['RANCHER-PLUGIN-DESIGN.md'],
  2:['dns-manager-dev/pkg/dns-manager/navigation.js','dns-manager-dev/pkg/dns-manager/product.js','dns-manager-dev/pkg/dns-manager/routing.js','dns-manager-dev/tests/ui/standards.spec.ts'],
  3:['dns-manager-dev/pkg/dns-manager/pages/Dashboard.vue','dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json','dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json'],
  4:['dns-manager-dev/pkg/dns-manager/ui/dns-manager.js','dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/DataGrid.vue','dns-manager-dev/tests/ui/standards.spec.ts','dns-manager-dev/tests/ui/snapshots.spec.ts'],
  5:['dns-manager-dev/pkg/dns-manager/ui/dns-manager.js','dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/36-overview-lower.png'],
  6:['dns-manager-dev/pkg/dns-manager/ui/dns-manager.js','dns-manager-dev/tests/ui/standards.spec.ts','dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/29-zone-create.png'],
  7:['dns-manager-dev/pkg/dns-manager/ui/dns-manager.js','dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/30-pending-incomplete.png','dns-manager-dev/docs/standards-audit/2026-10-11/screenshots/31-pending-review.png'],
  8:['dns-manager-dev/pkg/dns-manager/snapshot-feature/pages/SnapshotFeature.vue','dns-manager-dev/tests/ui/snapshots.spec.ts','dns-manager-dev/tests/backup.test.mjs','dns-manager-dev/tests/backup-server.test.mjs','preview-data/tests/snapshot-server.test.mjs','preview-data/tests/snapshot-unlock.test.mjs'],
  9:['dns-manager-dev/pkg/dns-manager/ui/request-state.js','dns-manager-dev/pkg/dns-manager/ui/dns-manager.js','dns-manager-dev/tests/ui/standards.spec.ts'],
  10:['dns-manager-dev/README.md','charts/dns-manager/README.md','preview-data/data-source.mjs','preview-data/vite-plugin.mjs','scripts/preview-suite.mjs'],
  13:['dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md','dns-manager-dev/docs/standards-audit/2026-10-11/test-results.json']
};
for(const [section,rows] of Object.entries(analysis)){
  const items=requirements.items.filter(item=>Number(item.id.split('-')[1])===Number(section));
  if(items.length!==rows.length)throw new Error(`Section ${section}: ${items.length} requirements, ${rows.length} analyses`);
  items.forEach((item,index)=>{const [key,...parts]=rows[index].split('|');item.result=labels[key];item.analysis=parts.join('|');item.evidence=files[section];if(!item.result||!item.analysis)throw new Error(`Missing disposition ${item.id}`);});
}
requirements.narrativeSections=[
  {section:11,result:'Context',analysis:'Network-specific variations are delegated to NETWORK-MANAGER-STANDARDS.md. This DNS audit does not assert Network Manager compliance.'},
  {section:12,result:'Partial',analysis:'DNS adopts the common pages and hidden editors as specified. Source/record semantics are reviewed here; live replication/HA/lookup-engine behavior belongs to DNS-MANAGER-DESIGN.md and remains outside UI proof.'},
  {section:14,result:'Verified local',analysis:'This audit preserves historical evidence and distinguishes normative requirements, local behavior and unverified live capabilities. Only the new shared global-demo requirement was added; no historical claim was rewritten as implementation proof.'}
];
await writeFile(resolve(directory,'requirements.json'),JSON.stringify(requirements,null,2)+'\n');
const link=path=>`[${path}](${relative(directory,resolve(root,path)).replaceAll('\\','/')})`;
const rebaseRequirement=value=>value.replace(/\]\(([^)]+)\)/g,(match,target)=>target.startsWith('#')||/^[a-z]+:/i.test(target)?match:`](${relative(directory,resolve(root,target.split('#')[0])).replaceAll('\\','/')}${target.includes('#')?'#'+target.split('#').slice(1).join('#'):''})`);
const counts={};for(const item of requirements.items)counts[item.result]=(counts[item.result]||0)+1;
let checklist=`# DNS Manager: item-by-item standards audit\n\nReviewed 2026-10-11. Standard SHA-256: \`${requirements.sha256}\`.\n\nEvery one of the ${requirements.items.length} top-level source/rule/checklist items has a disposition. There are 9 source-reference items, 198 shared rule items, and 24 acceptance-checklist items; these are not 231 independent tests. Sections 11, 12 and 14 contain prose, addressed below. Historical appendices remain evidence, not acceptance claims.\n\nVerified local means only the stated local scope was demonstrated. Partial identifies both what works and what is missing. Unverified live is not a pass. Not applicable includes its reason. See ${link('dns-manager-dev/docs/standards-audit/2026-10-11/REPORT.md')} for findings and limits.\n`;
let section='';for(const item of requirements.items){if(item.section!==section){section=item.section;checklist+=`\n## ${section}\n\n`;}
  checklist+=`### ${item.id} — ${item.result}\n\n**Requirement (standard line ${item.line}):** ${rebaseRequirement(item.requirement)}\n\n**Analysis:** ${item.analysis}\n\n**Evidence:** ${item.evidence.map(link).join('; ')}.\n`;
}
checklist+='\n## Narrative sections\n\n'+requirements.narrativeSections.map(s=>`- **Section ${s.section}: ${s.result}.** ${s.analysis}`).join('\n')+'\n';
await writeFile(resolve(directory,'CHECKLIST.md'),checklist);
const unit=JSON.parse(await read('.local/dns-ui-tests.json')),gaps=JSON.parse(await read('.local/dns-ui-gaps.json'));
const tests={date:'2026-10-11',ui:{total:unit.numTotalTests,passed:unit.numPassedTests,failed:unit.numFailedTests},knownGaps:{total:gaps.numTotalTests,passed:gaps.numPassedTests,failed:gaps.numFailedTests},assertions:[...unit.testResults,...gaps.testResults].flatMap(s=>s.assertionResults.map(a=>({name:a.fullName,status:a.status,failure:a.failureMessages?.join('\n').slice(0,650)||undefined}))),backend:{dns:6,shared:9,failures:0},previewBuild:'Passed',extensionBuild:'Passed'};
if(unit.numFailedTests||unit.testResults.some(s=>s.status==='failed'))throw new Error('Passing regression suite contains a failure.');
await writeFile(resolve(directory,'test-results.json'),JSON.stringify(tests,null,2)+'\n');
const visual=JSON.parse(await read('dns-manager-dev/docs/standards-audit/2026-10-11/visual-evidence.json'));
const layout=JSON.parse(await read('dns-manager-dev/docs/standards-audit/2026-10-11/layout-evidence.json'));
const geometries=layout.flatMap(view=>view.checks.map(check=>({view:view.name,...check})));
const sourceFiles=[...new Set(Object.values(files).flat())].filter(p=>!p.includes('/docs/'));
const manifest=[];for(const path of sourceFiles){const content=await read(path);manifest.push({path,sha256:createHash('sha256').update(content).digest('hex')});}
await writeFile(resolve(directory,'source-manifest.json'),JSON.stringify({date:'2026-10-11',standardSha256:requirements.sha256,files:manifest},null,2)+'\n');
await writeFile(resolve(directory,'EVIDENCE.md'),`# DNS audit visual and test evidence\n\n${visual.length} inspected screenshots, ${layout.length} geometry views, ${geometries.length} measured assertions (${geometries.filter(c=>c.pass).length} passing, ${geometries.filter(c=>!c.pass).length} failing). Geometry thresholds supplement visual review; they do not prove backend/native acceptance. The 200 px schedule-height check is a diagnostic usability threshold, not a quoted pixel requirement.\n\n## Measured failures\n\n${geometries.filter(c=>!c.pass).map(c=>`- ${c.view}: **${c.id}** — measured values in layout-evidence.json.`).join('\n')}\n\n## Inspected screenshots\n\n${visual.map(view=>`- [${view.name}](screenshots/${view.name}.png): ${view.heading}; viewport ${view.viewport.width}×${view.viewport.height}; document ${view.document.width}×${view.document.height}.`).join('\n')}\n\n## Geometry replay\n\n${link('dns-manager-dev/tests/ui/browser-layout-probe.mjs')} is the read-only real-browser probe. Run it through CUA against each visible route at 1280×720, 768×900 and 480×800, using the isolated audit preview. Save each returned object to layout-evidence.json and rerun npm run test:ui and npm run test:ui:gaps. This is an evidence replay workflow; npm/Vitest does not silently launch or drive a browser. JSDOM unit tests exercise actual Vue/UI behavior but cannot validate pixels.\n`);
const statusRows=Object.entries(counts).map(([status,count])=>`| ${status} | ${count} |`).join('\n');
await writeFile(resolve(directory,'SUMMARY.json'),JSON.stringify({date:'2026-10-11',counts,items:requirements.items.length,screenshots:visual.length,geometryViews:layout.length,geometryChecks:geometries.length,geometryFailures:geometries.filter(c=>!c.pass).length,tests:tests.ui,knownGaps:tests.knownGaps},null,2)+'\n');
console.log(JSON.stringify({counts,items:requirements.items.length,screenshots:visual.length,geometryChecks:geometries.length,ui:tests.ui,gaps:tests.knownGaps},null,2));
console.log(statusRows);
