import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { choiceOptions } from './ui-review-store.mjs';
export async function generateReview(directory,report) {
  const template=await readFile(new URL('./ui-review-template.html',import.meta.url),'utf8');
  const data=JSON.stringify({report,choiceOptions}).replaceAll('<','\\u003c');
  await writeFile(resolve(directory,'report.html'),template.replace('/* REPORT_DATA */',data));
  const lines=['# '+report.title,'',report.scope,'','Open the interactive report with `npm run review:ui` at http://127.0.0.1:5175/. Choices and comments save to `decisions.json`. This Markdown copy is an alternate manual worksheet; edits here do not synchronize with the interactive report.','', 'Pick one option per item. For Combine both or Custom, describe the intended result. Implementation follows completed choices.',''];
  for(const section of report.sections){
    lines.push('## '+section.title,'','Screenshots: '+section.images.map(name=>`[${name}](evidence/${name}.png)`).join(' · '),'');
    for(const [id,title,network,dns,note] of section.items)lines.push('### '+title+' (`'+id+'`)','','**Network look:** '+network,'','**DNS look:** '+dns,'','**Choice concerns:** '+note,'',...Object.values(choiceOptions).map(label=>'- [ ] '+label),'','Comment: ______________________________________________','');
    lines.push('Source evidence: '+section.sources.map(source=>'`'+source+'`').join(', '),'');
  }
  lines.push('## Shared UI implementation after review','',...report.architecture.map(text=>'- '+text),'','## Evidence and defects','',...report.limitations.map(text=>'- '+text),'','General comments: ______________________________________________','','- [ ] Review completed; use these presentation selections to implement the shared UI plugin.','');
  await writeFile(resolve(directory,'report.md'),lines.join('\n'));
}
