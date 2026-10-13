import {it,expect,vi} from 'vitest';import {markRaw} from 'vue';
import {renderManager,fireEvent,getByRole,flushPromises} from './harness';
import {defaultInventory} from '../../pkg/dns-manager/ui/default-inventory.js';
import {navigationState} from '../../pkg/dns-manager/navigation';
import {restoreDnsDraft} from '../../pkg/dns-manager/snapshot-feature/data/snapshot-schedule';
it('Rancher route leave waits for the final restoration draft to persist',async()=>{
 const inv=structuredClone(defaultInventory) as any;const doc:any={data:{inventory:inv,state:{version:1,drafts:[],logs:[]}}};let finish:(value:any)=>void=()=>{};
 const source=markRaw({kind:'rancher',document:doc,capabilities:{stageChanges:false},loadState:()=>doc.data.state,saveState:vi.fn(()=>new Promise(resolve=>finish=resolve)),reload:async()=>doc});
 const app=await renderManager('snapshots',{previewShell:false,dataSource:source});for(let n=0;n<6;n++)restoreDnsDraft({name:'Restored item '+n,configuration:{kind:n===5?'DnsNavigation':'DnsZone'}});
 const leave=vi.fn();const waiting=(app.wrapper.vm as any).$.exposed.requestRouteLeave(leave);await flushPromises();expect(leave).not.toHaveBeenCalled();expect(source.saveState.mock.calls.at(-1)?.[0].drafts).toHaveLength(6);
 finish(true);await waiting;await flushPromises();expect(leave).toHaveBeenCalledTimes(1);
});
it('native navigation Apply captures its backup, waits for backend readback, then updates persisted navigation',async()=>{
 vi.stubGlobal('URL',Object.assign(class extends URL {},{createObjectURL:vi.fn(()=> 'blob:navigation-review'),revokeObjectURL:vi.fn()}));
 const inv=structuredClone(defaultInventory) as any,order=inv.zones.map((z:any)=>z.id),next=[...order].reverse();inv.source.managementReachable=true;inv.navigation={stateName:'dns-manager-state-user-test',order};
 let saved:any={version:1,order,drafts:[{id:'navigation-draft',name:'Zone Navigation',kind:'order',order:next,baseOrder:order}],logs:[]},finish:(value:any)=>void=()=>{};
 const doc:any={data:{inventory:inv,state:saved}},source=markRaw({kind:'rancher',document:doc,capabilities:{stageChanges:true},loadState:()=>saved,saveState:async(value:any)=>saved=structuredClone(value),reload:async()=>doc,stageChanges:vi.fn(()=>new Promise(resolve=>finish=resolve))});
 const original=vi.mocked(fetch).getMockImplementation()!;let captured:any;
 vi.mocked(fetch).mockImplementation(async(url:any,init:any)=>{if(String(url).endsWith('/api/snapshots')&&init?.method==='POST'){captured=JSON.parse(init.body).current;return new Response(JSON.stringify({schemaVersion:1,id:'12345678-1234-4123-8123-123456789012',createdAt:new Date().toISOString(),current:captured}),{status:201,headers:{'Content-Type':'application/json'}});}return original(url,init);});
 const app=await renderManager('pending',{previewShell:false,dataSource:source});fireEvent.click(getByRole(app.root,'checkbox',{name:'Select draft Zone Navigation'}));app.click('Review');await flushPromises();
 fireEvent.click(getByRole(app.root,'radio',{name:/No.*create a configuration snapshot now/}));await flushPromises();app.click(/Create configuration snapshot/i);await flushPromises();
 const confirm=getByRole(app.root,'checkbox',{name:'Confirm these navigation changes'}) as HTMLInputElement;await vi.waitFor(()=>expect(confirm.disabled).toBe(false));
 expect(captured.relatedConfigurations.find((c:any)=>c.kind==='DnsNavigation').dns.order).toEqual(order);expect(captured.snapshotScope.managerStateName).toBe(inv.navigation.stateName);
 fireEvent.click(confirm);app.click('Apply Selected');await flushPromises();expect(source.stageChanges).toHaveBeenCalledTimes(1);expect(navigationState.zones.map(z=>z.id)).toEqual(order);
 inv.navigation.order=next;finish({kind:'Navigation',receipts:[{operation:'SaveNavigation',readBack:true,order:next}]});await flushPromises();expect(navigationState.zones.map(z=>z.id)).toEqual(next);expect(saved.order).toEqual(next);expect(saved.drafts).toEqual([]);expect(app.root.textContent).toContain('Zone navigation saved and read back.');
});
it('Running Processes counts active work and excludes unconfirmed receipts from completed progress',async()=>{
 const inv=structuredClone(defaultInventory) as any;inv.source.managementReachable=true;inv.processes=[{id:'pending-navigation',kind:'Navigation',status:'Running',operations:[{operation:'SaveNavigation',name:'Zone Navigation'}],receipts:[{readBack:false}],createdAt:new Date().toISOString()}];
 const doc:any={data:{inventory:inv,state:{version:1,drafts:[],logs:[]}}};const source=markRaw({kind:'rancher',document:doc,capabilities:{stageChanges:false},loadState:()=>doc.data.state,saveState:async()=>{},reload:async()=>doc});
 const app=await renderManager('processes',{previewShell:false,dataSource:source});expect(app.root.querySelector('[aria-label="1 items"]')).not.toBeNull();expect(app.root.textContent).toContain('0 / 1');expect(app.root.textContent).toContain('Awaiting completion');
});
