import { describe, it, expect, vi } from 'vitest';
import {effectScope,nextTick} from 'vue';
import {init as initProduct} from '../../pkg/dns-manager/product';
import {navigationState,GROUP} from '../../pkg/dns-manager/navigation';
import { renderManager, fireEvent, getByRole, getByLabelText, queryByRole, flushPromises } from './harness';
const pages = [['overview','Overview'],['sources','Sources'],['zones','Zones'],['instances','Instances'],['pending','Pending Rollouts'],
  ['processes','Running Processes'],['snapshots','Snapshots'],['diagnostics','Diagnostics'],['settings','Settings'],['help','Help']];

describe('Shared page and navigation requirements (§2–3, §9)', () => {
  it.each([['zones','Zones'],['overview','Overview'],['zone:io','cormierconsulting.io']])('explicit %s route overrides the remembered Snapshots page',async(section,title)=>{
    const app=await renderManager(section,{}, {page:'snapshots',density:'Compact',drafts:[{id:'retained',kind:'record',name:'Retained draft'}]});
    expect(app.root.querySelector('#dm-title')?.textContent).toBe(title);
    expect(app.root.querySelector('[aria-current="page"]')?.getAttribute('data-page')).toBe(section);
    expect((app.root.querySelector('#dns-manager-interface') as HTMLElement).style.getPropertyValue('--dm-row-height')).toBe('36px');
    await app.nav('pending');
    expect(app.root.textContent).toContain('Retained draft');
  });
  it('native zone links follow Zones directly without a subgroup',async()=>{
    const virtualType=vi.fn(),basicType=vi.fn(),hooks:Function[]=[];const scope=effectScope();
    scope.run(()=>initProduct({DSL:()=>({virtualType,basicType,weightGroup:vi.fn(),setGroupDefaultType:vi.fn()}),addUninstallHook:(hook:Function)=>hooks.push(hook)},{commit:vi.fn()}));
    navigationState.zones=[{id:'test-zone',name:'Test Zone',recordCount:3}];navigationState.counts={zones:1,snapshots:2};await nextTick();
    expect(basicType).toHaveBeenCalledWith(['dns-manager-zone-test-zone'],GROUP);
    expect(basicType.mock.calls.every(([,group])=>group===GROUP)).toBe(true);
    const zone=virtualType.mock.calls.find(([type])=>type.name==='dns-manager-zone-test-zone')![0];
    const zones=virtualType.mock.calls.find(([type])=>type.name==='dns-manager-zones')![0];
    const pending=virtualType.mock.calls.find(([type])=>type.name==='dns-manager-pending')![0];
    expect(zone.weight).toBeLessThan(zones.weight);expect(zone.weight).toBeGreaterThan(pending.weight);
    scope.stop();hooks.forEach(hook=>hook());navigationState.zones=[];navigationState.counts={};
  });
  it('zones stay visible despite an old collapsed preference and dividers bracket the inventory pages',async()=>{
    const app=await renderManager('overview',{}, {preferences:{zonesExpanded:false}});
    expect(app.root.querySelector('[data-action="toggle-zones"]')).toBeNull();
    expect(app.root.querySelector('#dm-zone-navigation')?.hasAttribute('hidden')).toBe(false);
    expect(app.root.querySelector('#dm-zone-navigation [data-page="zone:io"]')).toBeTruthy();
    const menu=app.root.querySelector('#dm-navigation')!;
    expect(menu.querySelector('[data-page="overview"]')?.nextElementSibling?.getAttribute('role')).toBe('separator');
    expect(menu.querySelector('[data-page="pending"]')?.previousElementSibling?.getAttribute('role')).toBe('separator');
  });
  it.each([['Error','error',1],['Warning','warning',1],['Info','success',0]])('Diagnostics reflects %s in the last 24 hours, independent of unavailable inventory',async(severity,tone,count)=>{
    const now=Date.now();const app=await renderManager('diagnostics',{}, {logs:[{id:'backend-unavailable',severity:'Info',at:new Date(now).toISOString(),message:'Existing backend notice'},{severity,at:new Date(now).toISOString(),message:'Recent test incident'}, {severity:'Error',at:new Date(now-86400001).toISOString(),message:'Old'}, {severity:'Error',at:new Date(now+86400000).toISOString(),message:'Future'}]});
    const menu=app.root.querySelector('[data-page="diagnostics"] .dm-count')!;
    const header=app.root.querySelector('#dm-actions .dm-count')!;
    expect(menu.classList.contains(tone)).toBe(true);expect(header.classList.contains(tone)).toBe(true);
    expect(menu.textContent).toBe(String(count));expect(header.textContent).toBe(menu.textContent);
  });
  it('top-right count stays equal to its menu count when a grid search hides all rows',async()=>{
    const app=await renderManager('zones');const input=app.root.querySelector('#dm-search') as HTMLInputElement;
    fireEvent.input(input,{target:{value:'no-matching-zone'}});await flushPromises();
    expect(app.root.querySelector('#dm-actions .dm-count')?.textContent).toBe(app.root.querySelector('[data-page="zones"] .dm-count')?.textContent);
  });
  it.each(pages)('%s keeps heading, refresh, active navigation and contextual Help in the shared shell', async (page, title) => {
    const app=await renderManager(page);
    expect(getByRole(app.root,'heading',{level:1,name:title})).toBeTruthy();
    const header=app.root.querySelector('.dm-heading')!;
    expect(getByRole(header as HTMLElement,'combobox',{name:'Automatic refresh interval'})).toBeTruthy();
    expect(getByRole(header as HTMLElement,'button',{name:'Refresh sample data'})).toBeTruthy();
    expect(app.root.querySelector('[aria-current="page"]')?.getAttribute('data-page')).toBe(page);
    expect(app.root.querySelector('[aria-label="Page help"]')?.hasAttribute('hidden')).toBe(page==='help');
    if(['settings','help'].includes(page)) expect(app.root.querySelector('#dm-actions .dm-count')).toBeNull();
  });
  it('common pages end in the required order; editors stay out of sidebar', async () => {
    const app=await renderManager(); const labels=[...app.root.querySelectorAll('#dm-navigation > [data-page]')].map(e=>e.getAttribute('data-page'));
    expect(labels.slice(-6)).toEqual(['pending','processes','snapshots','diagnostics','settings','help']);
    expect(app.root.querySelector('#dm-navigation [data-page="source:new"]')).toBeNull();
  });
  it.each([['source:new','Create Source','sources'],['source:edit','Edit Source','sources'],['zone:new','Create Zone','zones']])('%s selects its parent without exposing another menu entry',async(page,title,parent)=>{
    const app=await renderManager(page);expect(getByRole(app.root,'heading',{level:1,name:title})).toBeTruthy();
    expect(app.root.querySelector('[aria-current="page"]')?.getAttribute('data-page')).toBe(parent);
  });
  it('Preview starts off and warning panels open concrete remediation pages',async()=>{
    const app=await renderManager();expect(app.root.querySelector('.dm-preview')).toBeNull();
    expect(app.root.querySelector('#dm-status')?.textContent).not.toContain('Design Preview');
    app.click(/Management Failover: Verification Pending/);expect(app.root.querySelector('#dm-title')?.textContent).toBe('Diagnostics');
    app.click(/Live management backend unavailable/);expect(app.root.querySelector('#dm-title')?.textContent).toBe('Edit Source');
    expect(getByRole(app.root,'button',{name:'Test Connection'})).toBeTruthy();
  });
  it('hiding the backend banner retains required-failure count descriptions',async()=>{
    const app=await renderManager('settings');fireEvent.click(getByLabelText(app.root,'Management backend availability'));
    fireEvent.submit(app.root.querySelector('#dm-settings')!);
    expect(queryByRole(app.root,'button',{name:/Live management backend unavailable/})).toBeNull();
    expect(app.root.querySelector('#dm-navigation .dm-count.error')?.getAttribute('title')).toContain('backend');
  });
  it('contextual Help opens the matching guide and Help has no question-mark buttons',async()=>{
    const app=await renderManager('sources');app.click('Page help');expect(getByRole(app.root,'dialog')).toBeTruthy();app.click('Open Help');
    expect(app.root.querySelector('[data-help-id="sources"]')?.hasAttribute('open')).toBe(true);
    expect(app.root.querySelector('#dm-content .dm-inline-help')).toBeNull();
  });
});

describe('Selection, sorting and rank editing (§4)',()=>{
  it.each(['sources','zones','zone:io'])('%s hides Delete without selection and reveals it only for selected rows',async(page)=>{
    const app=await renderManager(page);expect(queryByRole(app.root.querySelector('#dm-actions') as HTMLElement,'button',{name:/Delete/})).toBeNull();
    const input=app.root.querySelector('tbody input[data-select]') as HTMLInputElement;
    expect(input).toBeTruthy();fireEvent.click(input);
    expect(getByRole(app.root.querySelector('#dm-actions') as HTMLElement,'button',{name:/Delete/})).toBeTruthy();
    fireEvent.click(app.root.querySelector('tbody input[data-select]')!);
    expect(queryByRole(app.root.querySelector('#dm-actions') as HTMLElement,'button',{name:/Delete/})).toBeNull();
  });
  it('Reorder uses handles, dirty-only Save and Cancel without persisting the proposal',async()=>{
    const app=await renderManager('zones');const original=[...app.state().order];
    expect(queryByRole(app.root,'button',{name:'Reorder'})).toBeNull();fireEvent.click(app.root.querySelector('tbody input[data-select]')!);app.click('Reorder');
    expect(app.root.querySelector('thead input[type="checkbox"]')).toBeNull();expect(queryByRole(app.root,'button',{name:'Save'})).toBeNull();
    const handle=app.root.querySelector('button[data-drag]')!;fireEvent.keyDown(handle,{key:'ArrowDown'});
    expect(getByRole(app.root,'button',{name:'Save'})).toBeTruthy();expect(app.state().order).toEqual(original);
    app.click('Cancel');expect(app.state().order).toEqual(original);expect(app.state().drafts).toHaveLength(0);
  });
  it('saving a changed rank stages a reviewed draft and preserves applied sidebar order',async()=>{
    const app=await renderManager('zones');const original=[...app.state().order];fireEvent.click(app.root.querySelector('tbody input[data-select]')!);app.click('Reorder');
    fireEvent.keyDown(app.root.querySelector('button[data-drag]')!,{key:'ArrowDown'});app.click('Save');expect(getByRole(app.root,'dialog')).toBeTruthy();app.click('Save Draft');
    expect(app.state().drafts.at(-1).kind).toBe('order');expect(app.state().order).toEqual(original);expect(app.root.querySelector('button[data-drag]')).toBeNull();
  });
  it('empty search retains headers; summary tables have no bulk-selection controls',async()=>{
    const app=await renderManager('zones');fireEvent.input(getByRole(app.root,'textbox',{name:'Search Zones'}),{target:{value:'no-such-zone-unique'}});
    expect(app.root.querySelectorAll('thead th').length).toBeGreaterThan(0);expect(app.root.querySelector('tbody')?.textContent).toContain('No Matching');
    await app.nav('overview');expect(app.root.querySelector('#dm-content input[type="checkbox"]')).toBeNull();
  });
  it('partial selection makes Select All indeterminate and sorting exposes aria-sort',async()=>{
    const app=await renderManager('zones');fireEvent.click(app.root.querySelector('tbody input[data-select]')!);
    expect((app.root.querySelector('thead input') as HTMLInputElement).indeterminate).toBe(true);
    app.click('Records');expect(app.root.querySelector('th[aria-sort="ascending"]')?.textContent).toContain('Records');
  });
});

describe('Forms, scope and refresh (§4, §6, §9)',()=>{
  it('delayed reads show loading only after 300 ms and retain the editor through a 60-second timeout',async()=>{
    vi.useFakeTimers();let signal:AbortSignal|undefined;
    const app=await renderManager('source:edit',{readObservations:(s:AbortSignal)=>{signal=s;return new Promise(()=>{});}});
    const editor=app.root.querySelector('#dm-editor');expect(app.root.querySelector('.dm-main')?.getAttribute('aria-busy')).toBe('false');
    await vi.advanceTimersByTimeAsync(300);expect(app.root.querySelector('.dm-main')?.getAttribute('aria-busy')).toBe('true');expect(app.root.querySelector('.dm-count-loading')).toBeTruthy();
    await vi.advanceTimersByTimeAsync(59700);expect(signal?.aborted).toBe(true);expect(app.root.querySelector('[role="alert"]')?.textContent).toContain('60 seconds');expect(app.root.querySelector('#dm-editor')).toBe(editor);expect(app.root.querySelector('.dm-count-loading')).toBeNull();
  });
  it('confirmed source disconnection retries at five seconds then restores five-minute refresh',async()=>{
    vi.useFakeTimers();const read=vi.fn().mockRejectedValueOnce(Object.assign(new Error('Disconnected'),{code:'SOURCE_UNAVAILABLE'})).mockResolvedValue({});
    const app=await renderManager('overview',{readObservations:read});expect(read).toHaveBeenCalledTimes(1);expect((getByRole(app.root,'combobox',{name:'Automatic refresh interval'}) as HTMLSelectElement).value).toBe('5');
    await vi.advanceTimersByTimeAsync(5000);expect(read).toHaveBeenCalledTimes(2);expect((getByRole(app.root,'combobox',{name:'Automatic refresh interval'}) as HTMLSelectElement).value).toBe('300');expect(app.root.querySelector('[role="alert"]')).toBeNull();
  });
  it('an abandoned delayed read is aborted when navigation changes',async()=>{
    let signal:AbortSignal|undefined;const app=await renderManager('overview',{readObservations:(s:AbortSignal)=>{signal=s;return new Promise(()=>{});}});
    await app.nav('zones');expect(signal?.aborted).toBe(true);expect(app.root.querySelector('.dm-main')?.getAttribute('aria-busy')).toBe('false');
  });
  it('Rancher origin rejects embedded credentials and URL paths',async()=>{
    const app=await renderManager('settings');fireEvent.input(getByLabelText(app.root,'Rancher URL'),{target:{value:'https://demo:demo@example.test/path'}});app.click('Save Settings');
    expect(app.root.querySelector('#dm-notice')?.textContent).toContain('without credentials');expect(app.state().preferences?.rancherUrl||'').toBe('');
  });
  it.each(['A','AAAA','CNAME','PTR','MX','SRV','TXT'])('new %s record selection preserves customized name and value',async type=>{
    const app=await renderManager('record:io');fireEvent.input(getByLabelText(app.root,'Name'),{target:{value:'custom'}});fireEvent.input(getByLabelText(app.root,'Value'),{target:{value:'retain'}});
    fireEvent.change(getByLabelText(app.root,'Record Type'),{target:{value:type}});expect((getByLabelText(app.root,'Name') as HTMLInputElement).value).toBe('custom');expect((getByLabelText(app.root,'Value') as HTMLInputElement).value).toBe('retain');
  });
  it('new source is clean; existing source locks its identity',async()=>{
    const app=await renderManager('source:new');expect((getByLabelText(app.root,'Name') as HTMLInputElement).value).toBe('');
    await app.nav('source:edit');expect((getByLabelText(app.root,'Name') as HTMLInputElement).readOnly).toBe(true);
  });
  it('Test Connection uses unsaved input, cannot claim verification and invalidates on editing',async()=>{
    const app=await renderManager('source:edit');fireEvent.input(getByLabelText(app.root,'Controller Hostname'),{target:{value:'new.example.test'}});app.click('Test Connection');
    expect(app.root.querySelector('#dm-test-result')?.textContent).toContain('new.example.test');expect(app.root.querySelector('#dm-test-result')?.textContent).toContain('Not Verified');
    fireEvent.input(getByLabelText(app.root,'DNS Address'),{target:{value:'192.0.2.10'}});expect(app.root.querySelector('#dm-test-result')?.textContent).toContain('invalidated');
  });
  it('navigation guards dirty forms, offers three choices and preserves input after Stay',async()=>{
    const app=await renderManager('source:edit');fireEvent.input(getByLabelText(app.root,'Controller Hostname'),{target:{value:'unsaved.example.test'}});await app.nav('zones');
    expect(getByRole(app.root,'dialog',{name:'Unsaved Changes'})).toBeTruthy();app.click('Stay');expect((getByLabelText(app.root,'Controller Hostname') as HTMLInputElement).value).toBe('unsaved.example.test');
  });
  it('manual refresh retains the actual editor node and unsaved field value',async()=>{
    const app=await renderManager('source:edit');const form=app.root.querySelector('#dm-editor');fireEvent.input(getByLabelText(app.root,'Controller Hostname'),{target:{value:'keep.example.test'}});
    app.click('Refresh sample data');expect(app.root.querySelector('#dm-editor')).toBe(form);expect((getByLabelText(app.root,'Controller Hostname') as HTMLInputElement).value).toBe('keep.example.test');
  });
  it('refresh choices include Off with a zero countdown and default five minutes',async()=>{
    const app=await renderManager();const select=getByRole(app.root,'combobox',{name:'Automatic refresh interval'}) as HTMLSelectElement;expect(select.value).toBe('300');
    expect([...select.options].map(o=>o.value)).toEqual(['0','30','60','300','900','3600']);fireEvent.change(select,{target:{value:'0'}});expect(app.root.querySelector('#dm-countdown')?.textContent).toBe('00:00');
  });
  it('diagnostics defaults to 24 hours, exposes all severities and keeps incident badge independent of search',async()=>{
    const app=await renderManager('diagnostics');expect((getByRole(app.root,'spinbutton',{name:'Lookback (hours)'}) as HTMLInputElement).value).toBe('24');
    expect([...getByRole(app.root,'combobox',{name:'Severity'}).querySelectorAll('option')].map(e=>e.textContent)).toEqual(['All Severities','Debug','Info','Warn','Error']);
    const before=app.root.querySelector('[data-page="diagnostics"] .dm-count')?.textContent;fireEvent.input(getByRole(app.root,'textbox',{name:'Search Diagnostics'}),{target:{value:'nonmatching'}});
    expect(app.root.querySelector('[data-page="diagnostics"] .dm-count')?.textContent).toBe(before);
  });
});
