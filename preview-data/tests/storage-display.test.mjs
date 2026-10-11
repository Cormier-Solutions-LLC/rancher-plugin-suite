import test from 'node:test';
import assert from 'node:assert/strict';
import {formatExhaustion} from '../storage-display.mjs';
test('storage forecasts show infinity only beyond one calendar year; unknown is not infinity',()=>{
 const measuredAt='2026-10-11T14:00:00Z';
 assert.equal(formatExhaustion({measuredAt,runOutAt:'2027-10-11T14:00:01Z'}),'∞');
 assert.notEqual(formatExhaustion({measuredAt,runOutAt:'2027-10-11T14:00:00Z'}),'∞');
 assert.equal(formatExhaustion({measuredAt,runOutAt:'6712-04-19T08:53:26Z'}),'∞');
 assert.equal(formatExhaustion({measuredAt,runOutAt:null,reason:'Beyond Supported Date Range'}),'∞');
 assert.equal(formatExhaustion({measuredAt,runOutAt:null,reason:'Automatic Snapshots Disabled'}),'Automatic Snapshots Disabled');
 assert.equal(formatExhaustion(null),'Unavailable');
});
