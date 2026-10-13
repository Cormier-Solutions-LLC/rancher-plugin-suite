import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
const evidence=JSON.parse(readFileSync('docs/standards-audit/2026-10-11/layout-evidence.json','utf8'));
describe('Real-browser alignment evidence (CUA, not JSDOM geometry)',()=>{
  it.each(['desktop','tablet','mobile'])('%s evidence covers all 13 visible routes and preserves viewport and count alignment',profile=>{
    const views=evidence.filter((v:any)=>v.name.startsWith(profile+'-')&&!['mobile-source-editor','mobile-help-dialog'].includes(v.name));expect(views).toHaveLength(13);
    for(const v of views)for(const id of ['viewport-bounded','actions-not-clipped','navigation-count-column','filter-bottom-alignment','filters-not-clipped']){
      const check=v.checks.find((c:any)=>c.id===id);expect(check,`${v.name}: ${id}`).toBeTruthy();expect(check.pass,`${v.name}: ${id}\n${JSON.stringify(check.actual)}`).toBe(true);
    }
  });
  it('recorded mobile help dialog stays within the viewport',()=>{
    expect(evidence.find((v:any)=>v.name==='mobile-help-dialog').checks.find((c:any)=>c.id==='dialog-bounded').pass).toBe(true);
  });
});
