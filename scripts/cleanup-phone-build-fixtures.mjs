import fs from 'node:fs';import assert from 'node:assert/strict';
const dir='.local/manager-installation',base='http://127.0.0.1:15889',ledgers=['phone-retry-build-v1-owned.json','phone-retry-build-v2-owned.json','phone-retry-build-owned.json','phone-security-build-owned.json','phone-capacity-build-owned.json','phone-physical-capacity-build-owned.json','phone-recovery-build-owned.json'];
if(process.argv[2]==='verify'){let count=0;for(const file of ledgers){const path=dir+'/'+file,ledger=JSON.parse(fs.readFileSync(path));for(const item of ledger.owned){assert.equal((await fetch(base+item.url)).status,404,'Owned build resource remains');count++;}ledger.buildFixturesCleanupConfirmedAt=new Date().toISOString();fs.writeFileSync(path,JSON.stringify(ledger,null,2));}console.log(JSON.stringify({allOwnedBuildResourcesAbsent:true,resources:count}));process.exit(0);}
for(const file of ledgers){const path=dir+'/'+file,ledger=JSON.parse(fs.readFileSync(path));if(ledger.buildFixturesCleanedAt)continue;
 for(const item of [...ledger.owned].reverse()){
  const r=await fetch(base+item.url);if(r.status===404)continue;assert.equal(r.status,200);const obj=await r.json();assert.equal(obj.metadata.uid,item.uid);assert.equal(obj.metadata.labels['manager-acceptance-id'],ledger.id);
  if(obj.kind==='Job')assert.ok(obj.status.conditions.some(c=>c.type==='Complete'&&c.status==='True'));
  const removed=await fetch(base+item.url,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiVersion:'v1',kind:'DeleteOptions',propagationPolicy:'Foreground',preconditions:{uid:item.uid}})});assert.ok([200,202].includes(removed.status));
 }
 ledger.buildFixturesCleanedAt=new Date().toISOString();fs.writeFileSync(path,JSON.stringify(ledger,null,2));console.log(JSON.stringify({ownedBuildContextAndJobDeletionRequested:true,image:ledger.image}));
}
