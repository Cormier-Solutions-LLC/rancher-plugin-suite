// Run this read-only function with the approved CUA browser evaluate API.
// It deliberately checks real browser geometry; JSDOM cannot measure alignment.
export function inspectDnsLayout() {
  const root = document.querySelector('#dns-manager-interface');
  const visible = e => e && e.getClientRects().length && getComputedStyle(e).display !== 'none';
  const rect = e => { const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {label:e.getAttribute('aria-label')||e.textContent.trim().slice(0,90),x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,font:s.fontSize,align:s.textAlign}; };
  const checks=[];
  const check=(id,pass,actual)=>checks.push({id,pass:!!pass,actual});
  check('viewport-bounded',document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1,{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight});
  const actions=[...root.querySelectorAll('.dm-heading button')].filter(visible).map(rect);
  check('actions-not-clipped',actions.every(r=>r.x>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1),actions);
  const labeled=[...root.querySelectorAll('#dm-actions > .dm-button,#dm-snapshot-actions .page-actions > button')].filter(visible).map(rect);
  if(labeled.length>1){check('labeled-action-equal-width',Math.max(...labeled.map(r=>r.width))-Math.min(...labeled.map(r=>r.width))<=1,labeled);check('labeled-action-equal-height',Math.max(...labeled.map(r=>r.height))-Math.min(...labeled.map(r=>r.height))<=1,labeled);check('labeled-action-same-row',Math.max(...labeled.map(r=>r.y))-Math.min(...labeled.map(r=>r.y))<=1,labeled);}
  const nav=[...root.querySelectorAll('#dm-navigation .dm-count')].filter(visible).map(rect);
  check('navigation-count-column',nav.length===0||Math.max(...nav.map(r=>r.x))-Math.min(...nav.map(r=>r.x))<=1,nav);
  const numbers=[...root.querySelectorAll('th.dm-numeric,td.dm-numeric,th.grid-number,td.grid-number')].filter(visible).map(rect);
  check('numeric-align-right',numbers.every(r=>r.align==='right'),numbers);
  const filters=[...root.querySelectorAll('.dm-filter-row input,.dm-filter-row select')].filter(visible).map(rect);
  const rows=new Map();for(const r of filters){const key=Math.round(r.y);rows.set(key,[...(rows.get(key)||[]),r]);}
  check('filter-bottom-alignment',[...rows.values()].every(rs=>Math.max(...rs.map(r=>r.bottom))-Math.min(...rs.map(r=>r.bottom))<=1),filters);
  check('filters-not-clipped',filters.every(r=>r.x>=0&&r.right<=innerWidth+1),filters);
  const dialogs=[...document.querySelectorAll('[role=dialog]')].filter(visible).map(rect);
  if(dialogs.length)check('dialog-bounded',dialogs.every(r=>r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1),dialogs);
  const panels=[...root.querySelectorAll('.schedule-panels > .snapshot-schedule')].filter(visible).map(rect);
  if(panels.length===2&&innerWidth>=1000){check('schedule-half-width-aligned',Math.abs(panels[0].width-panels[1].width)<=1&&Math.abs(panels[0].y-panels[1].y)<=1,panels);check('schedule-usable-height',panels.every(r=>r.height>=200),panels);}
  const storage=root.querySelector('.storage-three');
  if(visible(storage)){const columns=[...storage.children].map(rect);check('storage-three-equal-columns',columns.length===3&&Math.max(...columns.map(r=>r.width))-Math.min(...columns.map(r=>r.width))<=1,columns);check('storage-outside-schedule',!storage.closest('.snapshot-schedule'),rect(storage));}
  return {measuredAt:new Date().toISOString(),page:root.querySelector('#dm-title').textContent,active:root.querySelector('[aria-current=page]')?.dataset.page,viewport:{width:innerWidth,height:innerHeight},checks};
}
