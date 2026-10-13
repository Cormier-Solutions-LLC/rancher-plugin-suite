import {measureLayout,checkLayout} from './layout-contract.mjs';
// Run through the supported Codex browser adapter. No page state, fetch, or mutations
// are injected: interactions use locators; evaluate measures rendered DOM only.
export async function captureAudit(tab,{page,filterRow=true,helpPage=false,overview=false}){
 const measurement=await tab.playwright.evaluate(measureLayout);
 return {page,measurement,checks:checkLayout(measurement,{page,filterRow,helpPage,overview})};
}
export async function visitInventory(tab, label){
 await tab.playwright.getByRole('navigation',{name:'Network Manager',exact:true}).getByRole('button',{name:new RegExp('^'+label)}).click();
 await tab.playwright.domSnapshot();
}
export const inventoryPages = [['overview','Overview'],['certificates','TLS & Certificates'],['issuer-profiles','TLS Issuer Profiles'],['port-configurations','Port Configurations'],['pending-rollouts','Pending Rollouts'],['running-processes','Running Processes'],['history','Snapshots'],['diagnostics','Diagnostics'],['settings','Settings'],['help','Help']];
// The caller supplies an isolated, already-open tab and viewport capability.
// Viewport changes can reload the preview: explicitly restore the intended scope.
export async function auditInventoryPages(tab, viewport, sizes, saveScreenshot) {
 const results=[];
 try {
  for(const size of sizes){
   await viewport.set(size);
   await tab.playwright.getByRole('button',{name:'Global Namespace Selector',exact:true}).click();
   await tab.playwright.getByRole('option',{name:'All Namespaces',exact:true}).click();
   await tab.playwright.getByRole('button',{name:'Global Namespace Selector',exact:true}).click();
   await tab.playwright.domSnapshot();
   for(const [page,label] of inventoryPages){
    await visitInventory(tab,label);
    const result=await captureAudit(tab,{page,filterRow:size.width>800,overview:page==='overview',helpPage:page==='help'});
    results.push(result);
    if(saveScreenshot)await saveScreenshot(`${page}-${size.width}.png`,await tab.screenshot({fullPage:false}));
   }
  }
 } finally {await viewport.reset();}
 return results;
}
