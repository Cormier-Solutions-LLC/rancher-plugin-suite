import {it,expect,vi} from 'vitest';
import {renderManager,fireEvent,getByRole,flushPromises} from './harness';
import {defaultInventory} from '../../pkg/dns-manager/ui/default-inventory.js';
import {markRaw} from 'vue';
import {navigationState} from '../../pkg/dns-manager/navigation';

it('live refresh preserves the reviewed snapshot gate during a zone write, and confirmed creation adds navigation',async()=>{
 vi.stubGlobal('URL',Object.assign(class extends URL {},{createObjectURL:vi.fn(()=> 'blob:zone-review'),revokeObjectURL:vi.fn()}));
 const zone='manager-review.cormierconsulting.io',inv=structuredClone(defaultInventory) as any;inv.source.managementReachable=true;
 let saved:any={version:1,drafts:[{id:'zone-draft',kind:'zone',zone,type:'Forward'}],logs:[]},finish:(value:any)=>void=()=>{};
 const doc:any={data:{inventory:inv,state:saved}};
 const source=markRaw({kind:'rancher',document:doc,capabilities:{stageChanges:true},loadState:()=>saved,saveState:async(value:any)=>{saved=structuredClone(value)},reload:async()=>doc,stageChanges:vi.fn(()=>new Promise(resolve=>{finish=resolve}))});
 const original=vi.mocked(fetch).getMockImplementation()!;
 vi.mocked(fetch).mockImplementation(async(url:any,init:any)=>{
  if(String(url).endsWith('/api/snapshots')&&init?.method==='POST')return new Response(JSON.stringify({schemaVersion:1,id:'12345678-1234-4123-8123-123456789012',createdAt:new Date().toISOString(),current:JSON.parse(init.body).current}),{status:201,headers:{'Content-Type':'application/json'}});
  return original(url,init);
 });
 const app=await renderManager('pending',{previewShell:false,dataSource:source});
 fireEvent.click(getByRole(app.root,'checkbox',{name:'Select draft zone'}));app.click('Review');await flushPromises();
 fireEvent.click(getByRole(app.root,'radio',{name:/No.*create a configuration snapshot now/}));await flushPromises();
 app.click(/Create configuration snapshot/i);await flushPromises();
 const gate=app.root.querySelector('#dm-apply-gate'),confirm=getByRole(app.root,'checkbox',{name:'Confirm these Windows DNS changes'}) as HTMLInputElement;
 await vi.waitFor(()=>expect(confirm.disabled,app.root.querySelector('[role="alert"]')?.textContent||'snapshot gate').toBe(false));fireEvent.click(confirm);app.click('Apply Selected');await flushPromises();expect(source.stageChanges).toHaveBeenCalledTimes(1);
 app.click('Refresh DNS observations');await flushPromises();
 expect(app.root.querySelector('#dm-apply-gate')).toBe(gate);expect(confirm.checked).toBe(true);expect((getByRole(app.root,'button',{name:'Apply Selected'}) as HTMLButtonElement).disabled).toBe(true);
 inv.zones.push({id:zone,name:zone,kind:'Forward',managed:true,ownerId:'owner',serial:'1',replication:'Synced'});inv.records[zone]=[];
 finish({receipts:[{operation:'CreateZone',readBack:true}],replicationVerified:true});await flushPromises();
 expect(navigationState.zones.some(z=>z.id===zone)).toBe(true);expect(app.root.textContent).toContain('All three replicas verified.');expect(saved.drafts).toEqual([]);
});
