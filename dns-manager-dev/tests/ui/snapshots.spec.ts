import { describe, it, expect, vi } from 'vitest';
import {markRaw,reactive} from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { fireEvent, getByRole, getByLabelText } from '@testing-library/dom';
import BackupPassword from '../../pkg/dns-manager/snapshot-feature/pages/BackupPassword.vue';
import SnapshotUnlock from '../../pkg/dns-manager/snapshot-feature/pages/SnapshotUnlock.vue';
import SnapshotSchedule from '../../pkg/dns-manager/snapshot-feature/pages/SnapshotSchedule.vue';
import DataGrid from '../../pkg/dns-manager/snapshot-feature/pages/DataGrid.vue';
import SnapshotGate from '../../pkg/dns-manager/snapshot-feature/pages/SnapshotGate.vue';
import SnapshotOperations from '../../pkg/dns-manager/snapshot-feature/pages/SnapshotOperations.vue';
import SnapshotCoverage from '../../pkg/dns-manager/snapshot-feature/pages/SnapshotCoverage.vue';
import {readSnapshot as readDnsSnapshot,storedSnapshots as dnsSnapshots} from '../../pkg/dns-manager/snapshot-feature/data/stored-snapshots';
import {readSnapshot as readNetworkSnapshot} from '../../../simple-network-manager-dev/pkg/simple-network-manager/data/stored-snapshots';
import {configureSnapshotAdapter,captureScheduleSource} from '../../pkg/dns-manager/snapshot-feature/data/snapshot-schedule';
import {compareSnapshotStates} from '../../pkg/dns-manager/snapshot-feature/config/snapshot-diff';
import { renderManager } from './harness';
import {defaultInventory} from '../../pkg/dns-manager/ui/default-inventory.js';

describe('Snapshot options and verification (§8)',()=>{
  it.each([true,false])('coverage waits for the index and does not claim complete coverage after a failed read: %s',async(success)=>{
    dnsSnapshots.value=[];configureSnapshotAdapter({capture:()=>({configuration:{id:'source/test',name:'Test Source',kind:'DnsSource'}}),restore:vi.fn(),matches:()=>true});
    let complete!: (response:Response)=>void;
    vi.mocked(fetch).mockImplementation(()=>new Promise<Response>(resolve=>{complete=resolve;}));
    const wrapper=mount(SnapshotCoverage,{attachTo:document.body});await flushPromises();
    expect(wrapper.text()).toContain('Loading Saved Versions');expect(wrapper.text()).not.toContain('No Missing Configuration');
    complete(new Response(JSON.stringify(success?{snapshots:[]}:{error:'Unavailable'}),{status:success?200:503,headers:{'Content-Type':'application/json'}}));
    await vi.waitFor(()=>expect(wrapper.text()).toContain(success?'Test Source':'Snapshot storage is unavailable'));
    expect(wrapper.text()).not.toContain('No Missing Configuration');expect(wrapper.text()).not.toContain('Loading Saved Versions');
    await wrapper.get('button').trigger('click');expect(wrapper.emitted('navigate')?.[0]).toEqual(['snapshots']);
  });
  it('reactive comparison treats DNS record permutations as unchanged and retains real TTL differences',()=>{
    const records=[{name:'multi',type:'A',value:'192.0.2.1',ttl:30},{name:'multi',type:'A',value:'192.0.2.2',ttl:60}];
    const state=(values:any)=>reactive({configuration:{id:'zone/test',kind:'DnsZone',dns:{records:values,zone:{name:'example.test',serial:'1'},priority:0}}});
    expect(compareSnapshotStates(state(records),state([...records].reverse())).matches).toBe(true);
    const changed=state([{...records[0],ttl:31},records[1]]);expect(compareSnapshotStates(state(records),changed).changes).toHaveLength(1);
  });
  it('refresh with reordered Windows records retains the exact reviewed capture, while a TTL edit changes it',async()=>{
    const live=structuredClone(defaultInventory);const app=await renderManager('snapshots',{readObservations:async()=>structuredClone(live)});const baseline=JSON.stringify(captureScheduleSource());
    for(const records of Object.values(live.records))records.reverse();app.click('Refresh sample data');await flushPromises();
    expect(JSON.stringify(captureScheduleSource())).toBe(baseline);
    live.records.io[0].ttl+=1;app.click('Refresh sample data');await flushPromises();expect(JSON.stringify(captureScheduleSource())).not.toBe(baseline);
  });
  it.each([['DNS',readDnsSnapshot],['Network',readNetworkSnapshot]])('%s background comparison refuses encrypted reads without opening password dialogs',async(_manager,read)=>{
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({error:'Encrypted archive'}),{status:422,headers:{'Content-Type':'application/json'}}));
    await expect((read as typeof readDnsSnapshot)('encrypted',{interactive:false})).rejects.toThrow('explicit unlock');
    expect(document.querySelector('[role="dialog"]')).toBeNull();expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
  });
  it('DNS coverage exposes encrypted comparison gaps once and keeps navigation usable',async()=>{
    dnsSnapshots.value=[];configureSnapshotAdapter({capture:()=>({configuration:{id:'source/test',name:'Test Source',kind:'DnsSource',dns:{host:'dns.example.test'}}}),restore:vi.fn(),matches:()=>true});
    const record={id:'encrypted',createdAt:new Date(Date.now()-1000).toISOString(),name:'Encrypted',routeIds:[],coverage:[{id:'configuration/source/test',digest:'different-old-configuration'}],encrypted:true};
    vi.mocked(fetch).mockImplementation(async(url:any)=>new Response(JSON.stringify(String(url).endsWith('/api/snapshots')?{snapshots:[record]}:{error:'Encrypted archive'}),{status:String(url).endsWith('/api/snapshots')?200:422,headers:{'Content-Type':'application/json'}}));
    const wrapper=mount(SnapshotCoverage,{attachTo:document.body});await vi.waitFor(()=>expect(wrapper.text()).toContain('Encrypted saved versions can be unlocked from Snapshots'));
    expect(wrapper.text()).toContain('Test Source');expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(vi.mocked(fetch).mock.calls.filter(([url]:any)=>String(url).endsWith('/api/snapshots/encrypted'))).toHaveLength(1);
    await wrapper.get('button').trigger('click');expect(wrapper.emitted('navigate')?.[0]).toEqual(['snapshots']);
  });
  it('mixed credential and configuration restoration is blocked before any draft is prepared',async()=>{
    const actions=document.createElement('div');actions.id='dm-snapshot-actions';document.body.appendChild(actions);
    const restore=vi.fn();configureSnapshotAdapter({capture:()=>({configuration:{id:'current',name:'Current'}}),restore,matches:()=>true});
    const snapshot={id:'encrypted-copy',current:{configuration:{id:'source',name:'Saved Source',kind:'DnsSource'},routeManifests:[{apiVersion:'v1',kind:'Secret',metadata:{namespace:'dns-system',name:'dns-manager-engine-admin'},type:'Opaque',data:{'admin-password':'RGVtby1Pbmx5'}}]}};
    const wrapper=mount(SnapshotOperations,{attachTo:document.body,props:{snapshot,selectedIds:[]}});await flushPromises();
    await wrapper.get('input[aria-label="Select All Restoration Items"]').setValue(true);await flushPromises();
    expect(wrapper.text()).toContain('Select the installed DNS credentials separately');
    expect(wrapper.text()).not.toContain('RGVtby1Pbmx5');
    expect(wrapper.findAll('button').some(b=>b.text()==='Prepare Selected Restore')).toBe(false);
    (wrapper.vm as any).restore();await flushPromises();expect(restore).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('No configuration drafts were prepared');
    await wrapper.get('input[aria-label="Restore dns-manager-engine-admin Secret dns-system"]').setValue(false);await flushPromises();
    expect(wrapper.text()).not.toContain('No drafts will be prepared while credentials are selected');
  });
  it('a source-catalog restore passes its installed identity scope and archive ID to the source draft adapter',async()=>{
    const actions=document.createElement('div');actions.id='dm-snapshot-actions';document.body.appendChild(actions);
    const restore=vi.fn(),capture={configuration:{id:'source/windows-dns',name:'Windows DNS',kind:'DnsSource'}};configureSnapshotAdapter({capture:()=>capture,restore,matches:()=>true});
    const snapshotScope={catalogUid:crypto.randomUUID(),bindingUid:crypto.randomUUID(),bindingDigest:'a'.repeat(64),userId:'user-test'},snapshot={id:crypto.randomUUID(),current:{configuration:{id:'sources/catalog',name:'DNS Sources',kind:'DnsSourceCatalog',namespace:'dns-system',dns:{catalog:{version:1,revision:1,sources:[]}}},snapshotScope}};
    const wrapper=mount(SnapshotOperations,{attachTo:document.body,props:{snapshot,selectedIds:[]}});await flushPromises();await wrapper.get('input[aria-label="Select All Restoration Items"]').setValue(true);await flushPromises();
    (wrapper.vm as any).confirmed=true;(wrapper.vm as any).gate={checkNow:()=>true};(wrapper.vm as any).restore();await flushPromises();
    expect(restore).toHaveBeenCalledTimes(1);expect(restore.mock.calls[0][0]).toMatchObject({restoreSnapshotId:snapshot.id,snapshotScope,configuration:snapshot.current.configuration});
  });
  it('a source catalog cannot be restored in the same selection as zone configuration',async()=>{
    const actions=document.createElement('div');actions.id='dm-snapshot-actions';document.body.appendChild(actions);
    const restore=vi.fn();configureSnapshotAdapter({capture:()=>({configuration:{id:'source/windows-dns',name:'Windows DNS'}}),restore,matches:()=>true});
    const snapshot={id:crypto.randomUUID(),current:{configuration:{id:'sources/catalog',name:'DNS Sources',kind:'DnsSourceCatalog',namespace:'dns-system',dns:{catalog:{version:1,revision:1,sources:[]}}},relatedConfigurations:[{id:'zone/example.test',name:'example.test',kind:'DnsZone',namespace:'dns-system'}]}};
    const wrapper=mount(SnapshotOperations,{attachTo:document.body,props:{snapshot,selectedIds:[]}});await flushPromises();await wrapper.get('input[aria-label="Select All Restoration Items"]').setValue(true);await flushPromises();
    expect(wrapper.text()).toContain('Restore one DNS source catalog separately');(wrapper.vm as any).restore();await flushPromises();expect(restore).not.toHaveBeenCalled();expect(wrapper.text()).toContain('No drafts were prepared');
  });
  it('live credential capture sends reference-only configuration and explicit encryption options to the server',async()=>{
    const inv=structuredClone(defaultInventory) as any;inv.source.credentialReferences=[{namespace:'dns-system',name:'dns-manager-engine-admin'},{namespace:'dns-system',name:'dns-windows-bridge-credential'}];
    const doc:any={data:{inventory:inv,state:{version:1,drafts:[],logs:[]}}};const app=await renderManager('snapshots',{previewShell:false,dataSource:markRaw({kind:'rancher',document:doc,capabilities:{stageChanges:false},loadState:()=>doc.data.state,saveState:async()=>{},reload:async()=>doc})});app.click('New Snapshot');await flushPromises();
    const dialog=getByRole(document.body,'dialog',{name:'Snapshot Options'});fireEvent.click(getByLabelText(dialog,'Include Secrets'));await flushPromises();const password='Demo-only-Encrypted-Capture42!';
    fireEvent.input(getByLabelText(dialog,'Password',{exact:true}),{target:{value:password}});fireEvent.input(getByLabelText(dialog,'Confirm Password'),{target:{value:password}});await flushPromises();fireEvent.click(getByRole(dialog,'button',{name:'Create Snapshot'}));await flushPromises();
    const call=vi.mocked(fetch).mock.calls.find(([url,options]:any)=>String(url).endsWith('/api/snapshot-schedule/run')&&options?.method==='POST')!;const body=JSON.parse((call[1] as any).body);expect(body.includeSecrets).toBe(true);expect(body.password).toBe(password);expect(body.current.credentialReferences).toHaveLength(2);expect(body.current.routeManifests).toEqual([]);expect(JSON.stringify(doc.data.state)).not.toContain(password);expect(document.querySelector('.backup-dialog')).toBeNull();
  });
  it('Windows apply requires a matching server snapshot and refuses encrypted copies before prompting',async()=>{
    const current={configuration:{id:'dns',name:'DNS'}};
    vi.mocked(fetch).mockImplementation(async(url:any)=>new Response(JSON.stringify(String(url).endsWith('/api/snapshots')?{snapshots:[{id:'safe',createdAt:new Date().toISOString(),scope:{label:'DNS'},publications:0,services:0,manifests:0,routeIds:[],namespaces:[],coverage:[],encrypted:false},{id:'protected',createdAt:new Date().toISOString(),scope:{label:'DNS'},publications:0,services:0,manifests:0,routeIds:[],namespaces:[],coverage:[],encrypted:true}]}:{schemaVersion:1,id:'safe',createdAt:new Date().toISOString(),current}),{headers:{'Content-Type':'application/json'}}));
    const wrapper=mount(SnapshotGate,{attachTo:document.body,props:{scopeKey:'dns-review',data:current,requireServerCopy:true,allowSecretCapture:false}});await flushPromises();
    expect((wrapper.vm as any).checkNow()).toBe(false);
    await wrapper.get('input[value="yes"]').setValue();await wrapper.get('select').setValue('safe');await flushPromises();
    expect((wrapper.vm as any).checkNow()).toBe(true);expect((wrapper.vm as any).snapshotId()).toBe('safe');
    await wrapper.get('select').setValue('protected');await flushPromises();
    expect((wrapper.vm as any).checkNow()).toBe(false);expect(wrapper.get('[role="alert"]').text()).toContain('unencrypted');
    expect(document.querySelector('.backup-dialog')).toBeNull();
  });
  it('accepts a newly saved server snapshot immediately when the server clock is slightly ahead',async()=>{
    const current={configuration:{id:'dns',name:'DNS'}},createdAt=new Date(Date.now()+10000).toISOString();
    vi.mocked(fetch).mockImplementation(async(_url:any,options:any)=>new Response(JSON.stringify(options?.method==='POST'?{schemaVersion:1,id:'server-copy',createdAt,current}:{snapshots:[]}),{headers:{'Content-Type':'application/json'}}));
    const wrapper=mount(SnapshotGate,{attachTo:document.body,props:{scopeKey:'dns-review',data:current,requireServerCopy:true,allowSecretCapture:false}});await flushPromises();
    await wrapper.get('input[value="no"]').setValue();await wrapper.get('button').trigger('click');
    await vi.waitFor(()=>expect(wrapper.text()).toContain('Snapshot requirement satisfied'));
    expect((wrapper.vm as any).snapshotId()).toBe('server-copy');expect((wrapper.vm as any).checkNow()).toBe(true);
  });
  it('Include Secrets is off; enabling requires strong matching passwords with accessible feedback',async()=>{
    const wrapper=mount(BackupPassword,{attachTo:document.body,props:{open:true,capture:true}});await flushPromises();
    const root=wrapper.element as HTMLElement;expect((getByLabelText(root,'Include Secrets') as HTMLInputElement).checked).toBe(false);
    expect((getByRole(root,'button',{name:'Create Snapshot'}) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(getByLabelText(root,'Include Secrets'));await flushPromises();
    expect((getByRole(root,'button',{name:'Create Snapshot'}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.input(getByLabelText(root,'Password',{exact:true}),{target:{value:'Demo-Only-Strong!Pass42'}});
    fireEvent.input(getByLabelText(root,'Confirm Password'),{target:{value:'mismatch'}});await flushPromises();expect(getByRole(root,'alert').textContent).toContain('do not match');
    fireEvent.input(getByLabelText(root,'Confirm Password'),{target:{value:'Demo-Only-Strong!Pass42'}});await flushPromises();
    expect((getByRole(root,'button',{name:'Create Snapshot'}) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(getByRole(root,'button',{name:'Create Snapshot'}));await flushPromises();expect(wrapper.emitted('confirm')?.[0]).toEqual([{includeSecrets:true,password:'Demo-Only-Strong!Pass42'}]);
    expect((getByLabelText(root,'Password',{exact:true}) as HTMLInputElement).value).toBe('');
  });
  it('Escape cancels and clears password inputs',async()=>{
    const wrapper=mount(BackupPassword,{attachTo:document.body,props:{open:true,unlock:true}});const root=wrapper.element as HTMLElement;
    fireEvent.input(getByLabelText(root,'Password'),{target:{value:'temporary-demo'}});fireEvent.keyDown(getByLabelText(root,'Password'),{key:'Escape'});await flushPromises();
    expect(wrapper.emitted('cancel')).toHaveLength(1);expect((getByLabelText(root,'Password') as HTMLInputElement).value).toBe('');
  });
  it('capture without Secrets emits no password',async()=>{
    const wrapper=mount(BackupPassword,{attachTo:document.body,props:{open:true,capture:true}});await flushPromises();fireEvent.click(getByRole(wrapper.element as HTMLElement,'button',{name:'Create Snapshot'}));
    await flushPromises();expect(wrapper.emitted('confirm')?.[0]).toEqual([{includeSecrets:false,password:''}]);
  });
  it('merge tests actual backend verification, warns about wrong passwords and rechecks before continuing',async()=>{
    const calls:any[]=[];vi.stubGlobal('fetch',vi.fn(async(url:string,options:any)=>{
      const id=url.split('/')[3],password=JSON.parse(options.body).password;calls.push({id,password});
      const valid=id==='plain'||id==='protected-a'&&password==='demo-a'||id==='protected-b'&&password==='demo-b';
      return new Response(JSON.stringify(valid?{id,current:{}}:{error:'Incorrect password'}),{status:valid?200:422,headers:{'Content-Type':'application/json'}});
    }));
    const wrapper=mount(SnapshotUnlock,{attachTo:document.body,props:{records:[{id:'plain',name:'Plain',encrypted:false},{id:'protected-a',name:'A',encrypted:true},{id:'protected-b',name:'B',encrypted:true}]}});await flushPromises();
    const root=wrapper.element as HTMLElement;fireEvent.input(getByLabelText(root,'Password for A'),{target:{value:'demo-a'}});await flushPromises();
    fireEvent.click(getByRole(getByLabelText(root,'Password for A').closest('.unlock-row') as HTMLElement,'button',{name:'Apply To All Snapshots'}));await flushPromises();
    expect((getByLabelText(root,'Password for B') as HTMLInputElement).value).toBe('demo-a');
    fireEvent.click(getByRole(root,'button',{name:'Test All Passwords'}));await flushPromises();
    expect(root.textContent).toContain('2 / 3 Snapshots Verified');expect(getByRole(root,'alert').textContent).toContain('B');
    const before=calls.length;fireEvent.click(getByRole(root,'button',{name:'Continue With Verified Snapshots'}));await flushPromises();
    expect(calls.length).toBeGreaterThan(before);const result:any=wrapper.emitted('continue')?.[0][0];expect(result.sources.map((s:any)=>s.id)).toEqual(['plain','protected-a']);expect(result.excluded.map((s:any)=>s.id)).toEqual(['protected-b']);
  });
  it('editing a tested password invalidates Continue until retested',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify({id:url.split('/')[3],current:{}}),{headers:{'Content-Type':'application/json'}})));
    const wrapper=mount(SnapshotUnlock,{props:{records:[{id:'plain',name:'Plain',encrypted:false},{id:'encrypted',name:'Encrypted',encrypted:true}]}});await flushPromises();const root=wrapper.element as HTMLElement;
    fireEvent.input(getByLabelText(root,'Password for Encrypted'),{target:{value:'demo'}});await flushPromises();fireEvent.click(getByRole(root,'button',{name:'Test All Passwords'}));await flushPromises();
    expect((getByRole(root,'button',{name:'Continue With Verified Snapshots'}) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.input(getByLabelText(root,'Password for Encrypted'),{target:{value:'changed'}});await flushPromises();expect((getByRole(root,'button',{name:'Continue With Verified Snapshots'}) as HTMLButtonElement).disabled).toBe(true);
  });
  it('schedule and cleanup each show only their next date; storage is outside both in three columns',async()=>{
    const wrapper=mount(SnapshotSchedule,{attachTo:document.body});await flushPromises();const root=wrapper.element as HTMLElement;
    const panels=root.querySelectorAll('.snapshot-schedule');expect(panels).toHaveLength(2);
    expect([...panels[0].querySelectorAll('p')].map(p=>p.textContent)).toEqual(['Next Snapshot: Not Scheduled']);
    expect([...panels[1].querySelectorAll('p')].map(p=>p.textContent)).toEqual(['Next Delete: Not Scheduled']);
    expect(root.querySelectorAll('.storage-three > div')).toHaveLength(3);expect(panels[0].querySelector('.storage-three')).toBeNull();
    expect(root.querySelectorAll('.schedule-badge.disabled')).toHaveLength(2);
  });
  it('New Snapshot opens Snapshot Options before writing',async()=>{
    const app=await renderManager('snapshots');await flushPromises();app.click('New Snapshot');await flushPromises();
    expect(app.root.querySelector('input[type=radio]')).toBeNull();
    expect(getByRole(document.body,'dialog',{name:'Snapshot Options'})).toBeTruthy();expect(vi.mocked(fetch).mock.calls.some(([,options]:any)=>options?.method==='POST')).toBe(false);
    fireEvent.click(getByRole(document.body,'button',{name:'Cancel',exact:true}));await flushPromises();
  });
  it.each(['Save Schedule','Enable'])('%s prompts before changing a schedule; Cancel keeps it unchanged',async(label)=>{
    const wrapper=mount(SnapshotSchedule,{attachTo:document.body});await flushPromises();const panel=wrapper.element.querySelectorAll('.snapshot-schedule')[0] as HTMLElement;
    fireEvent.click(getByRole(panel,'button',{name:label,exact:true}));await flushPromises();
    expect(getByRole(document.body,'dialog',{name:'Snapshot Options'})).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls.some(([,options]:any)=>options?.method==='PUT')).toBe(false);
    fireEvent.click(getByRole(document.body,'button',{name:'Cancel',exact:true}));await flushPromises();
    expect(vi.mocked(fetch).mock.calls.some(([,options]:any)=>options?.method==='PUT')).toBe(false);
  });
  it('protected schedule submits chosen password and clears the dialog',async()=>{
    const wrapper=mount(SnapshotSchedule,{attachTo:document.body});await flushPromises();const panel=wrapper.element.querySelectorAll('.snapshot-schedule')[0] as HTMLElement;
    fireEvent.click(getByRole(panel,'button',{name:'Save Schedule',exact:true}));await flushPromises();
    const dialog=getByRole(document.body,'dialog',{name:'Snapshot Options'});fireEvent.click(getByLabelText(dialog,'Include Secrets'));await flushPromises();
    fireEvent.input(getByLabelText(dialog,'Password',{exact:true}),{target:{value:'Test-only-Strong-Password2026!'}});
    fireEvent.input(getByLabelText(dialog,'Confirm Password'),{target:{value:'Test-only-Strong-Password2026!'}});await flushPromises();
    fireEvent.click(getByRole(dialog,'button',{name:'Save Schedule',exact:true}));await flushPromises();
    const write=vi.mocked(fetch).mock.calls.find(([,options]:any)=>options?.method==='PUT')!;
    expect(JSON.parse((write[1] as any).body)).toMatchObject({includeSecrets:true,password:'Test-only-Strong-Password2026!'});
    expect(document.querySelector('.backup-dialog')).toBeNull();
  });
  it('schedule Run Now opens Snapshot Options before posting a capture',async()=>{
    const wrapper=mount(SnapshotSchedule,{attachTo:document.body});await flushPromises();const panel=wrapper.element.querySelectorAll('.snapshot-schedule')[0] as HTMLElement;
    fireEvent.click(getByRole(panel,'button',{name:'Run Now',exact:true}));await flushPromises();expect(getByRole(document.body,'dialog',{name:'Snapshot Options'})).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls.some(([,options]:any)=>options?.method==='POST')).toBe(false);fireEvent.click(getByRole(document.body,'button',{name:'Cancel',exact:true}));await flushPromises();
  });
});

describe('Shared snapshot grid (§4, §8)',()=>{
  it('snapshot grid has no duplicate count below the title bar',async()=>{
    const app=await renderManager('snapshots');await flushPromises();
    expect(app.root.querySelector('.snapshot-records .page-count')).toBeNull();
    expect(app.root.querySelector('#dm-actions .dm-count')).toBeTruthy();
  });
  it('numeric byte sorting does not use formatted size labels and preserves details with their row',async()=>{
    const wrapper=mount(DataGrid,{slots:{default:'<thead><tr><th>Name</th><th>Size</th></tr></thead><tbody><tr><td>Large</td><td data-sort="1000000">1 MB</td></tr><tr><td colspan="2">Large details</td></tr><tr><td>Small</td><td data-sort="2000">2 KB</td></tr></tbody>'}});
    await wrapper.get('button[aria-label="Sort By Size"]').trigger('click');expect(wrapper.findAll('tbody tr').map(r=>r.text())).toEqual(['Small2 KB','Large1 MB','Large details']);
  });
});
