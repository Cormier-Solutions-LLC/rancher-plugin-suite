<script lang="ts">
import { defineComponent, h, ref, cloneVNode, Fragment, Comment, isVNode } from 'vue';
import HelpTip from './HelpTip.vue';
const flatten=(nodes:any[]):any[]=>nodes.flatMap(n=>Array.isArray(n)?flatten(n):n?.type===Fragment?flatten(n.children||[]):n?.type===Comment?[]:[n]);
const text=(node:any):string=>typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(' '):node&&typeof node.children==='string'?node.children:node&&Array.isArray(node.children)?text(node.children):String(node?.props?.label||node?.props?.name||'');
const rebuild=(node:any,props:any,children:any[]):any=>{const result:any=h(node.type,props,children);result.scopeId=node.scopeId;result.slotScopeIds=node.slotScopeIds;return result;};
const value=(cell:any)=>cell?.props?.['data-sort']??text(cell).trim();
const compare=(a:any,b:any)=>{const x=String(a),y=String(b);return /^-?\d+(\.\d+)?$/.test(x)&&/^-?\d+(\.\d+)?$/.test(y)?Number(x)-Number(y):x.localeCompare(y,undefined,{numeric:true,sensitivity:'base'});};
export default defineComponent({name:'DataGrid',inheritAttrs:false,props:{defaultSortColumn:{type:Number,default:-1},defaultSortDescending:{type:Boolean,default:false},help:{type:String,default:'Use column headers to sort this list. Row selection and bulk actions are available where shown; an empty list retains its headers.'}},setup(props, {slots,attrs}){
 const column=ref(props.defaultSortColumn),descending=ref(props.defaultSortDescending);
 const choose=(index:number)=>{descending.value=column.value===index?!descending.value:false;column.value=index;};
 return ()=>{const nodes=flatten(slots.default?.()||[]);let columns=1;
 const head=nodes.find(n=>n?.type==='thead');
 const headers=flatten(head?.children||[]).flatMap(row=>flatten(row.children||[]));
 const dataRows=nodes.filter(n=>n?.type==='tbody').flatMap(n=>flatten(n.children||[])).filter(row=>row?.type==='tr').map(row=>flatten(row.children||[])).filter(cells=>!cells.some(cell=>cell?.props?.colspan));
 const alignments=headers.map((header,index)=>{
   const explicit=header?.props?.['data-align'];if(explicit)return explicit;
   const label=text(header).trim();if(/^(Actions?|Port|Count|Size|Progress|Resources|Services|Drafts|Services \/ drafts)$/i.test(label))return 'right';
   const values=dataRows.map(cells=>text(cells[index]).trim()).filter(Boolean);
   return values.length&&values.every(value=>/^-?[\d,]+(?:\.\d+)?%?$/.test(value))?'right':'left';
 });
 const aligned=(cell:any,index:number)=>({...cell.props,class:[cell.props?.class,alignments[index]==='right'?'grid-number':'grid-text']});
 const rendered=nodes.map(node=>{if(!isVNode(node))return node;
  if(node.type==='thead'){const rows=flatten(node.children as any[]||[]).map(row=>{if(row.type!=='tr')return row;const cells=flatten(row.children||[]);columns=cells.length;return rebuild(row,row.props,cells.map((cell,index)=>{
   const label=text(cell).trim();const original=Array.isArray(cell.children)?cell.children:[cell.children];const help=index===cells.length-1?[h(HelpTip,{text:props.help,label:'Grid Help'})]:[];if(cell.type!=='th'||!label||/^(Actions?|Select)/i.test(label))return help.length?rebuild(cell,aligned(cell,index),[...original,...help]):cloneVNode(cell,aligned(cell,index)) as any;
   return rebuild(cell,{...aligned(cell,index),'aria-sort':column.value===index?(descending.value?'descending':'ascending'):'none'},[h('button',{type:'button',class:'sort-header',onClick:()=>choose(index),'aria-label':`Sort By ${label}`},[...original,h('span',{'aria-hidden':'true',class:'sort-direction'},column.value===index?(descending.value?' ▾':' ▴'):' ↕')]),...help]);
  }));});return rebuild(node,node.props,rows);}
  if(node.type!=='tbody')return node;
  const rows=flatten(node.children as any[]||[]).filter(row=>row?.type==='tr');
  if(!rows.length)return rebuild(node,node.props,[h('tr',[h('td',{colspan:columns,class:'grid-empty'},'No Results Available')])]);
  const result:any[]=[];let bundles:any[][]=[];
  const flush=()=>{if(column.value>=0)bundles.sort((a,b)=>compare(value(flatten(a[0].children||[])[column.value]),value(flatten(b[0].children||[])[column.value]))*(descending.value?-1:1));result.push(...bundles.flat());bundles=[];};
  for(const row of rows){const cells=flatten(row.children||[]);if(cells[0]?.type==='th'&&cells[0]?.props?.colspan){flush();result.push(row);}else if(cells.length===1&&cells[0]?.props?.colspan){if(bundles.length)bundles[bundles.length-1].push(row);else result.push(row);}else bundles.push([row]);}flush();return rebuild(node,node.props,result.map(row=>{const cells=flatten(row.children||[]);if(cells.some(cell=>cell?.props?.colspan))return row;return rebuild(row,row.props,cells.map((cell,index)=>cloneVNode(cell,aligned(cell,index)) as any));}));
 });return h('table',{...attrs,class:[attrs.class,'data-grid']},rendered);};
}});
</script>
<style>.snm .sort-header{display:inline-flex;align-items:center;gap:3px;padding:0!important;background:transparent!important;border:0!important;color:inherit!important;font:inherit!important;text-align:left;cursor:pointer}.snm .sort-header:focus-visible{outline:2px solid #73b5ff;outline-offset:3px}.sort-direction{opacity:.6;font-size:10px}.snm .grid-empty{text-align:center!important;padding:28px!important;color:#a5b1c3}</style>

<style>.snm .data-grid .grid-text{text-align:left!important}.snm .data-grid .grid-number{text-align:right!important;font-variant-numeric:tabular-nums}.snm .data-grid .sort-header{text-align:inherit!important}</style>
