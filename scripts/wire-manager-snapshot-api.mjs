import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
for(const [folder,plugin,directory] of [['simple-network-manager-dev','network-manager','pkg/simple-network-manager'],['dns-manager-dev','dns-manager','pkg/dns-manager/snapshot-feature']]){
 for(const file of ['data/snapshot-schedule.ts','data/stored-snapshots.ts','pages/SnapshotSchedule.vue']){
  const full=path.join(root,folder,directory,file);let content=fs.readFileSync(full,'utf8');
  if(content.includes('managerFetch'))continue;
  let relative=path.relative(path.dirname(full),path.join(root,'live-management/manager-api.mjs')).replaceAll('\\','/');if(!relative.startsWith('.'))relative='./'+relative;
  const binding=`\nimport {managerFetch} from '${relative}';\nconst fetch=(url:string, options?:RequestInit)=>managerFetch('${plugin}',url,options);\n`;
  content=file.endsWith('.vue')?content.replace(/(<script\s+setup[^>]*>)/,'$1'+binding):binding+content;
  fs.writeFileSync(full,content);
 }
}
