// Replays real rendered-DOM measurements. This is intentionally not a fresh
// browser run; browser-audit.mjs collects the evidence through the CUA adapter.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkLayout} from './layout-contract.mjs';
const root=new URL('../../docs/audit-2026-10-11/',import.meta.url);
for(const file of ['browser-measurements.json','responsive-measurements.json','workflow-measurements.json']){
 for(const result of JSON.parse(readFileSync(new URL(file,root),'utf8'))){
  test(`${file}: ${result.page} ${result.measurement.viewport.width}px`,()=>{
   const checks=checkLayout(result.measurement,{page:result.page,filterRow:result.measurement.viewport.width>800,overview:result.page==='overview',helpPage:result.page==='help'});
   assert.deepEqual(checks.filter(check=>check.status==='FAIL'),[], 'Rendered UI must satisfy the layout contract');
  });
 }
}
