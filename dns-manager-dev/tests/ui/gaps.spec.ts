// These are unmet acceptance requirements, intentionally failing until repaired.
// Run separately with npm run test:ui:gaps; never mark them skipped or expected-to-fail.
import { describe,it,expect,vi } from 'vitest';
import { renderManager,fireEvent,getByRole,getByLabelText,flushPromises } from './harness';
import { readFileSync } from 'node:fs';
import { mount } from '@vue/test-utils';
import BackupPassword from '../../pkg/dns-manager/snapshot-feature/pages/BackupPassword.vue';
const geometry=JSON.parse(readFileSync('docs/standards-audit/2026-10-11/layout-evidence.json','utf8'));
describe('Unmet DNS standards acceptance requirements',()=>{
  it('F01 / RPD-06-02 Create Zone displays the actual clean editor',async()=>{
    const app=await renderManager('zone:new');expect(getByLabelText(app.root,'Zone Name')).toBeTruthy();
  });
  it('F02 / RPD-07-02 incomplete drafts explicitly say Needs Completion',async()=>{
    const app=await renderManager('pending',{}, {drafts:[{id:'incomplete',kind:'source',name:'demo',host:'',needsCompletion:true}]});
    expect(app.root.querySelector('tbody')?.textContent).toContain('Needs Completion');
  });
  it('F02 / RPD-06-09 Overview offers Resume for an incomplete working draft',async()=>{
    const app=await renderManager('overview',{}, {drafts:[{id:'incomplete',kind:'source',name:'demo',needsCompletion:true}]});expect(getByRole(app.root,'button',{name:/Resume/i})).toBeTruthy();
  });
  it('F03 / RPD-09-04 successful observations update displayed inventory',async()=>{
    const readObservations=vi.fn(async()=>({source:{...structuredClone((await import('../../pkg/dns-manager/ui/default-inventory.js')).defaultInventory.source),host:'fresh.example.test'},zones:[],records:{}}));
    const app=await renderManager('sources',{readObservations});await flushPromises();expect(readObservations).toHaveBeenCalled();expect(app.root.querySelector('tbody')?.textContent).toContain('fresh.example.test');
  });
  it('F04 / RPD-04-05 record-type filter is searchable and multi-select',async()=>{
    const app=await renderManager('zone:io');expect(app.root.querySelector('#dm-filter')?.hasAttribute('multiple')).toBe(true);
  });
  it('F05 / RPD-04-14 record-row activation opens read-only details',async()=>{
    const app=await renderManager('zone:io');fireEvent.click(app.root.querySelector('tbody tr td:nth-child(2)')!);expect(getByRole(app.root,'region',{name:/Record Details/i})).toBeTruthy();
  });
  it('F06 / RPD-08-28 per-resource snapshot coverage is rendered',async()=>{
    const app=await renderManager('zone:io');expect(app.root.querySelector('[data-snapshot-coverage]')).not.toBeNull();
  });
  it('F07 / RPD-03-06 primary action SVGs are 18 pixels',async()=>{
    const app=await renderManager('zones');expect(app.root.querySelector('#dm-actions > button svg')?.getAttribute('width')).toBe('18');
  });
  it('F08 / RPD-09-10 Diagnostics badge describes its rolling window and severity counts',async()=>{
    const app=await renderManager('diagnostics');expect(app.root.querySelector('[data-page="diagnostics"] .dm-count')?.getAttribute('aria-label')).toMatch(/24.*warn.*error/i);
  });
  it('F09 / RPD-03-09 contextual Help opens on keyboard focus',async()=>{
    const app=await renderManager();fireEvent.focus(getByRole(app.root,'button',{name:'Page help'}));expect(getByRole(app.root,'dialog')).toBeTruthy();
  });
  it.each(['desktop-snapshots','tablet-snapshots','mobile-snapshots'])('F07 / RPD-04-01 %s numeric columns align right',view=>{
    expect(geometry.find((v:any)=>v.name===view).checks.find((c:any)=>c.id==='numeric-align-right').pass).toBe(true);
  });
  it('F11 / RPD-08-32 desktop schedule panels have usable height',()=>{
    expect(geometry.find((v:any)=>v.name==='desktop-snapshots').checks.find((c:any)=>c.id==='schedule-usable-height').pass).toBe(true);
  });
  it('F09 / RPD-08-04 unlock modal initially focuses Password',async()=>{
    const wrapper=mount(BackupPassword,{attachTo:document.body,props:{open:true,unlock:true}});await flushPromises();expect(document.activeElement).toBe(getByLabelText(wrapper.element as HTMLElement,'Password'));
  });
  it('F12 / RPD-08-04 Cancel resets Include Secrets on a reused modal',async()=>{
    const wrapper=mount(BackupPassword,{attachTo:document.body,props:{open:true,capture:true}});const root=wrapper.element as HTMLElement;fireEvent.click(getByLabelText(root,'Include Secrets'));await flushPromises();fireEvent.click(getByRole(root,'button',{name:'Cancel',exact:true}));await flushPromises();expect((getByLabelText(root,'Include Secrets') as HTMLInputElement).checked).toBe(false);
  });
  it('F07 / RPD-08-11 New Snapshot shows a plus icon',async()=>{
    const app=await renderManager('snapshots');expect(getByRole(app.root,'button',{name:'New Snapshot',exact:true}).querySelector('svg')).not.toBeNull();
  });
});
