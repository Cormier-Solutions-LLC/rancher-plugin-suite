import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=new URL('../../',import.meta.url);
const text=await readFile(new URL('RANCHER-PLUGIN-DESIGN.md',root),'utf8');
const lines=text.split(/\r?\n/),items=[];let section='',subsection='',number=0,current;
for(let i=0;i<lines.length;i++){
  const heading=lines[i].match(/^## (\d+)\. (.+)/);
  if(heading){section=heading[1]+'. '+heading[2];subsection='';number=0;current=null;continue;}
  if(lines[i].startsWith('## ')&&!heading)break;
  if(lines[i].startsWith('### ')){subsection=lines[i].slice(4);current=null;continue;}
  if(lines[i].startsWith('- ')){
    current={id:`RPD-${section.split('.')[0].padStart(2,'0')}-${String(++number).padStart(2,'0')}`,section,subsection,line:i+1,
      requirement:lines[i].slice(2).replace(/^\[ \] /,''),result:'Pending',analysis:'',evidence:[]};items.push(current);
  }else if(current&&/^  \S/.test(lines[i]))current.requirement+=' '+lines[i].trim();else current=null;
}
const directory=new URL('dns-manager-dev/docs/standards-audit/2026-10-11/',root);await mkdir(directory,{recursive:true});
const target=new URL('requirements.json',directory);
// Keep recorded dispositions on rerun only when the exact requirement is unchanged.
let prior={items:[]};try{prior=JSON.parse(await readFile(target,'utf8'));}catch{}
for(const item of items){const old=prior.items.find(old=>old.id===item.id&&old.requirement===item.requirement);if(old)Object.assign(item,{result:old.result,analysis:old.analysis,evidence:old.evidence});}
await writeFile(target,JSON.stringify({standard:'RANCHER-PLUGIN-DESIGN.md',sha256:createHash('sha256').update(text).digest('hex'),date:'2026-10-11',items},null,2)+'\n');
console.log(`${items.length} requirements inventoried in ${fileURLToPath(target)}`);
for(const item of items)console.log(`${item.id} L${item.line} ${item.requirement.slice(0,110)}`);
