import { describe, it, expect, vi } from 'vitest';
import { renderManager, flushPromises, fireEvent, getByRole, getByLabelText } from './harness';
import { defaultInventory } from '../../pkg/dns-manager/ui/default-inventory.js';
import { storedSnapshots } from '../../pkg/dns-manager/snapshot-feature/data/stored-snapshots';
import { markRaw } from 'vue';
const source=()=>markRaw({kind:'rancher',capabilities:{stageChanges:false},document:{data:{inventory:defaultInventory}},reload:async()=>({data:{inventory:defaultInventory}}),loadState:()=>({version:1,drafts:[],logs:[]}),saveState:vi.fn()});
const record=(id:string)=>({id,createdAt:new Date().toISOString(),name:id,namespaces:['dns-system'],publications:0,services:0,manifests:0,routeIds:[],coverage:[]});
describe('Live overview snapshot status',()=>{
 it.each([true,false])('reports Windows management reachability %s with the matching status tone',async(managementReachable)=>{
  const data=source();data.document.data.inventory=structuredClone(defaultInventory);
  (data.document.data.inventory.source as any).managementReachable=managementReachable;
  data.reload=async()=>data.document;
  const app=await renderManager('snapshots',{previewShell:false,dataSource:data});
  const banner=getByRole(app.root,'button',{name:managementReachable?'Windows DNS management connected':'Live inventory connected · Windows bridge unavailable'});
  expect(banner.classList.contains(managementReachable?'success':'error')).toBe(true);
  expect(banner.classList.contains(managementReachable?'error':'success')).toBe(false);
  fireEvent.click(banner);await flushPromises();
  expect(app.root.querySelector('#dm-title')?.textContent).toBe('Edit Source');
 });
 it('observation refresh retains an active protected backup dialog and its input',async()=>{
  const readObservations=vi.fn(async()=>structuredClone(defaultInventory));
  const app=await renderManager('snapshots',{readObservations});
  app.click('New Snapshot');await flushPromises();
  fireEvent.click(getByRole(document.body,'checkbox',{name:'Include Secrets'}));await flushPromises();
  fireEvent.input(getByLabelText(document.body,'Password',{exact:true}),{target:{value:'Temporary-Review-Only!42'}});await flushPromises();
  const password=getByLabelText(document.body,'Password',{exact:true});
  app.click('Refresh sample data');await flushPromises();
  expect(readObservations).toHaveBeenCalled();
  expect(getByLabelText(document.body,'Password',{exact:true})).toBe(password);
  expect((password as HTMLInputElement).value).toBe('Temporary-Review-Only!42');
  fireEvent.click(getByRole(document.body,'button',{name:'Cancel'}));await flushPromises();
  expect(document.body.contains(password)).toBe(false);
 });
 it('distinguishes pending reads and updates the overview when the index arrives',async()=>{
  let complete!: (response:Response)=>void;
  vi.mocked(fetch).mockImplementation(()=>new Promise<Response>(resolve=>{complete=resolve;}));
  const app=await renderManager('overview',{previewShell:false,dataSource:source()});
  expect(app.root.querySelector('[data-stored-backup-count]')?.textContent).toBe('Loading stored backups…');
  expect(app.root.textContent).toContain('Checking Snapshot Coverage');
  expect(app.root.textContent).not.toContain('Snapshot Missing Or Outdated');
  expect(getByRole(app.root,'button',{name:/Checking Snapshot Coverage/}).textContent).not.toContain('0 /');
  complete(new Response(JSON.stringify({snapshots:[record('one'),record('two')]}),{headers:{'Content-Type':'application/json'}}));await flushPromises();
  expect(app.root.querySelector('[data-stored-backup-count]')?.textContent).toBe('2 Stored Backups');
  expect(app.root.textContent).not.toContain('Live apply and durable backup verification require the management backend.');
  storedSnapshots.value=[...storedSnapshots.value,record('three')];await flushPromises();
  expect(app.root.querySelector('[data-stored-backup-count]')?.textContent).toBe('3 Stored Backups');
 });
 it('reports failed storage reads instead of claiming zero backups',async()=>{
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({error:'Unavailable'}),{status:503,headers:{'Content-Type':'application/json'}}));
  const app=await renderManager('overview',{previewShell:false,dataSource:source()});
  expect(app.root.querySelector('[data-stored-backup-count]')?.textContent).toBe('Snapshot storage unavailable');
  expect(app.root.textContent).not.toContain('0 Stored Backups');
  storedSnapshots.value=[record('recovered')];await flushPromises();
  expect(app.root.querySelector('[data-stored-backup-count]')?.textContent).toBe('1 Stored Backups');
 });
});
