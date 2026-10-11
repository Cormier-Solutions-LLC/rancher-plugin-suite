import test from 'node:test';
import assert from 'node:assert/strict';
import {createSnapshotUnlockSession} from '../snapshot-unlock.mjs';
test('only verified protected snapshots are merged; unencrypted sources remain eligible',async()=>{
 const session=createSnapshotUnlockSession([{id:'plain',encrypted:false},{id:'a',encrypted:true},{id:'b',encrypted:true},{id:'missing',encrypted:true}],async(id,password)=>{if(id!=='plain'&&password!=='test-password')throw new Error('Incorrect password');return {id,current:{}};});
 await session.verifyAll();assert.deepEqual(session.result().sources.map(x=>x.id),['plain']);
 session.setPassword(session.rows[1],'test-password');session.applyToAll(session.rows[1]);
 assert.equal(session.rows[2].status,'Not verified');
 session.setPassword(session.rows[2],'wrong');session.setPassword(session.rows[3],'');
 await session.verifyAll();const result=session.result();assert.deepEqual(result.sources.map(x=>x.id),['plain','a']);
 assert.deepEqual(result.passwords,{a:'test-password'});assert.deepEqual(result.excluded.map(x=>x.reason),['Incorrect password','Missing password']);
 session.setPassword(session.rows[1],'changed');assert.equal(session.rows[1].snapshot,null);session.clear();assert.ok(session.rows.every(row=>!row.password&&!row.snapshot));
});
