import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { emptyReview, validateReview, createReviewStore } from '../ui-review-store.mjs';
import { createUiReviewServer } from '../ui-review-server.mjs';
const report={id:'test-review',sections:[{id:'page',images:[],items:[['layout','Layout'],['controls','Controls']]}]};
async function fixture(t){
  const prefix=resolve(tmpdir(),'ui-review-test-'),directory=await mkdtemp(prefix);
  t.after(async()=>{const target=resolve(directory);assert.ok(target.startsWith(prefix)&&target.startsWith(resolve(tmpdir())+sep));await rm(target,{recursive:true,force:true});});
  return {directory,file:resolve(directory,'decisions.json')};
}
test('partial comments survive saving and reopening without selecting a look',async t=>{
  const {file}=await fixture(t),store=createReviewStore(report,file);
  const input=emptyReview(report);input.choices.layout={choice:null,comment:'Keep compact spacing.'};
  const saved=await store.save(input);assert.equal(saved.revision,1);assert.equal(saved.completed,false);
  assert.deepEqual(await createReviewStore(report,file).read(),saved);assert.match(await readFile(file,'utf8'),/Keep compact spacing/);
});
test('completion requires all choices and descriptions for custom combinations',()=>{
  const input={...emptyReview(report),completed:true};
  assert.throws(()=>validateReview(report,input),/Choose a look/);
  input.choices={layout:{choice:'blend',comment:''},controls:{choice:'dns',comment:''}};
  assert.throws(()=>validateReview(report,input),/Describe/);
  input.choices.layout.comment='Network spacing with DNS input style.';assert.equal(validateReview(report,input).completed,true);
});
test('stale saves cannot overwrite newer selections',async t=>{
  const {file}=await fixture(t),store=createReviewStore(report,file),input=emptyReview(report);
  await store.save({...input,generalComment:'newer'});
  await assert.rejects(store.save({...input,generalComment:'stale'}),error=>error.status===409);
  assert.equal((await store.read()).generalComment,'newer');
});
test('concurrent same-revision saves accept only one',async t=>{
  const {file}=await fixture(t),store=createReviewStore(report,file),input=emptyReview(report);
  const result=await Promise.allSettled([store.save({...input,generalComment:'first'}),store.save({...input,generalComment:'second'})]);
  assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal((await store.read()).generalComment,'first');
});
test('completion persists and subsequent edits revoke it',async t=>{
  const {file}=await fixture(t),store=createReviewStore(report,file);
  const completed=await store.save({...emptyReview(report),completed:true,choices:{layout:{choice:'network',comment:''},controls:{choice:'dns',comment:''}}});
  assert.equal((await store.read()).completed,true);
  await store.save({...completed,completed:false,generalComment:'Revision needed.'});assert.equal((await store.read()).completed,false);
});
test('invalid report IDs, choices and oversized comments are rejected',()=>{
  const input=emptyReview(report);
  assert.throws(()=>validateReview(report,{...input,reportId:'wrong'}),/report version/);
  assert.throws(()=>validateReview(report,{...input,choices:{unknown:{choice:'dns',comment:''}}}),/Invalid choice/);
  assert.throws(()=>validateReview(report,{...input,choices:{layout:{choice:'invalid',comment:''}}}),/Invalid choice/);
  assert.throws(()=>validateReview(report,{...input,generalComment:'x'.repeat(10001)}),/10,000/);
});
test('HTTP saves persist; cross-origin writes and unlisted paths are rejected',async t=>{
  const {directory}=await fixture(t),server=createUiReviewServer({directory,report});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));t.after(()=>new Promise(done=>server.close(done)));
  const origin='http://127.0.0.1:'+server.address().port;
  const input=await (await fetch(origin+'/api/review')).json();
  const blocked=await fetch(origin+'/api/review',{method:'PUT',headers:{'Content-Type':'application/json',Origin:'https://unrelated.example'},body:JSON.stringify(input)});assert.equal(blocked.status,403);
  const saved=await fetch(origin+'/api/review',{method:'PUT',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({...input,generalComment:'HTTP choice'})});assert.equal(saved.status,200);
  assert.equal((await (await fetch(origin+'/api/review')).json()).generalComment,'HTTP choice');
  assert.equal((await fetch(origin+'/../package.json')).status,404);
});
