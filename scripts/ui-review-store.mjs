import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export const choiceOptions = { network:'Network look', dns:'DNS look', blend:'Combine both', custom:'Custom', either:'Either / same' };
export function emptyReview(report) {
  return { schemaVersion:1, reportId:report.id, revision:0, completed:false, generalComment:'', choices:{}, savedAt:null };
}
export function validateReview(report, input) {
  const fail = message => { throw Object.assign(new Error(message),{status:422}); };
  if (!input || input.schemaVersion !== 1 || input.reportId !== report.id || !Number.isSafeInteger(input.revision) || input.revision < 0 || typeof input.completed !== 'boolean') fail('Invalid review document or report version.');
  if (typeof input.generalComment !== 'string' || input.generalComment.length > 10000) fail('General comment must be text, at most 10,000 characters.');
  if (!input.choices || typeof input.choices !== 'object' || Array.isArray(input.choices)) fail('Choices must be an object.');
  const items=report.sections.flatMap(s=>s.items), ids=new Set(items.map(i=>i[0]));
  for(const [id,entry] of Object.entries(input.choices)) {
    if(!ids.has(id) || !entry || !(entry.choice === null || Object.hasOwn(choiceOptions,entry.choice)) || typeof entry.comment !== 'string' || entry.comment.length > 10000) fail('Invalid choice or comment: '+id);
  }
  if(input.completed) for(const [id,title] of items) {
    const entry=input.choices[id];
    if(!entry?.choice) fail('Choose a look for '+title+'.');
    if(['blend','custom'].includes(entry.choice) && !entry.comment.trim()) fail('Describe your '+choiceOptions[entry.choice].toLowerCase()+' choice for '+title+'.');
  }
  return { schemaVersion:1, reportId:report.id, revision:input.revision, completed:input.completed, generalComment:input.generalComment, choices:input.choices };
}
export function createReviewStore(report, file) {
  let queue=Promise.resolve();
  async function read() {
    try { const value=JSON.parse(await readFile(file,'utf8')); validateReview(report,value); return value; }
    catch(error) { if(error.code === 'ENOENT') return emptyReview(report); throw error; }
  }
  function save(input) {
    const task=queue.then(async()=>{
      const clean=validateReview(report,input), current=await read();
      if(clean.revision !== current.revision) throw Object.assign(new Error('Another review tab saved newer choices. Export your local choices, then reload before continuing.'),{status:409});
      const value={...clean, revision:current.revision+1, savedAt:new Date().toISOString()};
      await mkdir(dirname(file),{recursive:true});
      const temporary=file+'.'+randomUUID()+'.tmp';
      await writeFile(temporary,JSON.stringify(value,null,2)+'\n',{encoding:'utf8',flag:'wx'});
      await rename(temporary,file);
      return value;
    });
    queue=task.catch(()=>{}); return task;
  }
  return {read,save};
}
