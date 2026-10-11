import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordIdentity } from '../pkg/dns-manager/ui/record-identity.js';
test('record selection distinguishes owner types and multiple values', () => {
  const records = [
    {name:'testing',type:'A',value:'192.0.2.1',ttl:300},
    {name:'testing',type:'A',value:'192.0.2.2',ttl:300},
    {name:'testing',type:'AAAA',value:'2001:db8::1',ttl:300}
  ];
  assert.equal(new Set(records.map(recordIdentity)).size, 3);
  assert.equal(recordIdentity(records[0]), recordIdentity({...records[0], ttl:3600}));
});
