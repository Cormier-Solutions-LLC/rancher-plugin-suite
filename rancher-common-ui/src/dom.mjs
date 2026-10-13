export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function tableMarkup(headers, rows, { emptyMessage='No Results Available' }={}) {
  // Headers and rows are manager-produced, escaped markup; empty labels are always escaped here.
  return `<div class="dm-table-wrap dm-inventory"><table class="rcui-grid"><thead><tr>${headers.map(header=>`<th>${header}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${headers.length}" class="dm-empty grid-empty">${escapeHTML(emptyMessage)}</td></tr>`}</tbody></table></div>`;
}
// Imperative consumers use the same runtime as Vue consumers. Business actions stay in the manager.
export function decorateTables(content, { sort = {key:'',direction:1}, suspended = false, onSort } = {}) {
  if (suspended) return;
  [...content.querySelectorAll('table')].forEach((grid,index) => {
    if (grid.classList.contains('data-grid')) return; // Vue DataGrid owns its own sort state.
    grid.classList.add('rcui-grid');
    [...grid.querySelectorAll('thead th')].forEach((heading,column) => {
      if(heading.querySelector('input')||/^(Actions?|Select)$/i.test(heading.textContent.trim())||!heading.textContent.trim())return;
      const label=heading.dataset.sortLabel||heading.textContent.trim(),key=index+':'+column;
      heading.dataset.sortLabel=label;
      heading.innerHTML=`<button type="button" class="dm-sort sort-header" data-action="sort" data-grid="${index}" data-column="${column}">${escapeHTML(label)} <span class="sort-direction" aria-hidden="true">${sort.key===key?(sort.direction===1?'▴':'▾'):'↕'}</span></button>`;
      heading.setAttribute('aria-sort',sort.key===key?(sort.direction===1?'ascending':'descending'):'none');
      if(onSort)heading.querySelector('button').onclick=()=>onSort(index,column);
    });
  });
}
export function mountDialog(container, { title, body, onClose }) {
  const previous=document.activeElement;
  container.innerHTML=`<div class="dm-overlay rcui-overlay"><section class="dm-dialog rcui-dialog" role="dialog" aria-modal="true" aria-labelledby="rcui-dialog-title"><h2 id="rcui-dialog-title">${escapeHTML(title)}</h2>${body}</section></div>`;
  const dialog=container.querySelector('[role=dialog]');
  const controls=()=>[...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(e=>!e.hidden);
  const key=event=>{if(event.key==='Escape'){event.preventDefault();onClose?.();}if(event.key==='Tab'){const list=controls(),first=list[0],last=list.at(-1);if(!list.length){event.preventDefault();return}if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}};
  dialog.addEventListener('keydown',key);controls()[0]?.focus();
  return ()=>{dialog.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();};
}
export function reviewMarkup(changes) {
  return `<div class="rcui-change-review">${(Array.isArray(changes)?changes:[changes]).map(change=>`<section class="rcui-review-item"><h3>${escapeHTML(change?.name || change?.zone || change?.kind || 'Proposed Change')}</h3><dl>${Object.entries(change||{}).filter(([key])=>key!=='id').map(([key,value])=>`<dt>${escapeHTML(key)}</dt><dd>${escapeHTML(typeof value==='object'?JSON.stringify(value,null,2):value)}</dd>`).join('')}</dl></section>`).join('')}</div>`;
}
export function layoutMarkup(kind, body, { variant = 'stacked' } = {}) {
  if(!['overview','detail','flow'].includes(kind))throw new Error('Unknown layout');
  if(!['stacked','master-detail','boxed','inline'].includes(variant))throw new Error('Unknown layout variant');
  return `<div class="rcui-${kind} rcui-${variant}">${body}</div>`;
}
