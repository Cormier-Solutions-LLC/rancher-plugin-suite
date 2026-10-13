import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import { KEY, compatible, installRuntime } from '../src/registry.mjs';
import { dependencyState, dependencyGate, component } from '../client/index.mjs';

test('independent bundle: load order, compatibility, table behavior, upgrade and uninstall', async () => {
  const dom=new JSDOM('<!doctype html><body><div id="app"></div></body>',{url:'http://localhost/'});
  for(const key of ['document','Node','Element','HTMLElement','SVGElement','Event','CustomEvent','MutationObserver'])globalThis[key]=dom.window[key];
  globalThis.window=dom.window;
  for(const key of ['addEventListener','removeEventListener','dispatchEvent'])globalThis[key]=dom.window[key].bind(dom.window);
  const Vue=await import('@vue/runtime-dom');
  const Gate=dependencyGate(Vue),Grid=component('DataGrid',Vue);
  const app=Vue.createApp({render:()=>Vue.h(Gate,{},()=>Vue.h(Grid,{},()=>[
    Vue.h('thead',[Vue.h('tr',[Vue.h('th','Name'),Vue.h('th','Size'),Vue.h('th','Actions')])]),
    Vue.h('tbody',[Vue.h('tr',[Vue.h('td','Z'),Vue.h('td',{'data-sort':20},'20 KB'),Vue.h('td','Inspect')]),Vue.h('tr',[Vue.h('td','A'),Vue.h('td',{'data-sort':3},'3 KB'),Vue.h('td','Inspect')])])
  ]))});
  app.mount('#app');await Vue.nextTick();assert.match(document.body.textContent,/Common UI plugin required/);
  const bundle=await readFile(new URL('../dist/1.0.0/plugin/rancher-common-ui-1.0.0.umd.min.js',import.meta.url),'utf8');
  runInThisContext(bundle);const hooks=[];globalThis['rancher-common-ui-1.0.0'].default({addUninstallHook:hook=>hooks.push(hook)});
  await Vue.nextTick();await Vue.nextTick();assert.equal(dependencyState().ready,true);
  const first=globalThis[KEY];assert.equal(compatible(first),true);assert.equal(document.querySelectorAll('#rancher-common-ui-theme').length,1);
  for(const file of await readdir(new URL('../src/components/',import.meta.url))){if(file.endsWith('.vue'))assert.ok(first.getComponents(Vue)[file.slice(0,-4)],`bundle supplies ${file}`);}
  assert.equal(compatible({...first,version:'1.corrupt'}),false);
  assert.equal(document.querySelectorAll('th .sort-header').length,2,'Actions is not sortable');
  document.querySelectorAll('.sort-header')[1].click();await Vue.nextTick();assert.equal(document.querySelector('tbody tr td').textContent,'A','numeric sort preserves actual numeric values');
  assert.equal(dependencyState({getters:{'uiplugins/ready':true,'uiplugins/plugins':[]}}).ready,false,'disabled or removed plugin blocks consumers');
  const installed={getters:{'uiplugins/ready':true,'uiplugins/plugins':[{name:'rancher-common-ui'}]}};
  assert.equal(dependencyState(installed).ready,true);
  document.body.insertAdjacentHTML('beforeend','<ul><li class="nav-type"><a class="type-link" href="/c/local/explorer/simple-network-manager/overview"><span data-testid="type-count">35</span></a></li><li class="nav-type"><a class="type-link" href="/c/local/explorer/simple-network-manager/pending-rollouts"><span data-testid="type-count">2</span></a></li><li class="nav-type"><a class="type-link" href="/c/local/explorer/workloads/deployments"><span data-testid="type-count">7</span></a></li></ul>');
  let tones={overview:'warning','pending-rollouts':'error'};const nav=first.observeNavigation('simple-network-manager',()=>tones);
  const counts=document.querySelectorAll('[data-testid="type-count"]');assert.ok(counts[0].classList.contains('warning'));assert.ok(counts[1].classList.contains('error'));assert.equal(counts[2].className,'','other Rancher products retain host styling');
  assert.ok(counts[0].closest('li').classList.contains('rcui-nav-after'));assert.ok(counts[1].closest('li').classList.contains('rcui-nav-before'));
  tones={overview:'success','pending-rollouts':''};nav.update();assert.equal(counts[0].classList.contains('warning'),false);assert.ok(counts[0].classList.contains('success'));nav.destroy();
  const UpdatedGrid=Vue.defineComponent({setup(_,ctx){return()=>Vue.h('section',[Vue.h('p','Updated common grid'),Vue.h(first.getComponents(Vue).DataGrid,ctx.attrs,ctx.slots)]);}});
  const next={...first,version:'1.1.0',getComponents:host=>({...first.getComponents(host),DataGrid:UpdatedGrid})};const uninstallNext=installRuntime(globalThis,next);await Vue.nextTick();
  assert.equal(document.querySelector('[data-common-ui-version]').dataset.commonUiVersion,'1.1.0','compatible runtime changes without consumer rebuild');
  assert.match(document.body.textContent,/Updated common grid/,'new presentation comes from the upgraded runtime');
  hooks[0]();assert.equal(globalThis[KEY],next,'old uninstall hook cannot remove a newer runtime');
  uninstallNext();await Vue.nextTick();assert.match(document.body.textContent,/Common UI plugin required/,'uninstall removes business UI');
  globalThis[KEY]={...first,apiVersion:2,version:'2.0.0'};dispatchEvent(new Event('rancher-common-ui:changed'));await Vue.nextTick();assert.match(document.body.textContent,/incompatible/);
  delete globalThis[KEY];app.unmount();dom.window.close();
});

test('manager adapters reference runtime controls and never import factory or shared theme',async()=>{
  for(const folder of ['simple-network-manager-dev/pkg/simple-network-manager/pages','dns-manager-dev/pkg/dns-manager/snapshot-feature/pages']){
    for(const name of ['DataGrid','ActionIcon','CalendarDateInput','SnapshotDateRange','HelpTip','InventoryFilters','PageActions','BackupPassword','PageSummary']){
      const source=await readFile(new URL(`../../${folder}/${name}.vue`,import.meta.url),'utf8');
      assert.match(source,/rancher-common-ui\/client\/index.mjs/);assert.doesNotMatch(source,/<style|\.generated|src\/components/);
    }
  }
});
