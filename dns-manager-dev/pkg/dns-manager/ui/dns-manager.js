import {orderedDnsRecords} from '../snapshot-feature/config/dns-record-order.mjs';
import {validateDnsSourceTestResult} from '../../../../live-management/dns-source-test-result.mjs';
import {sourceRows,sourceEditorMarkup,sourceDraftFromForm} from './source-controls.js';
import {sourceConfigurationDraft,sourceRestoreDrafts} from '../../../../live-management/dns-source-drafts.mjs';

import {evaluateCoverage} from '../snapshot-feature/data/coverage.mjs';

import {refreshSnapshots} from '../snapshot-feature/data/stored-snapshots';

import { runtime } from '../../../../rancher-common-ui/client/index.mjs';

import { recordIdentity } from './record-identity.js';

import { containsSecretValues } from '../snapshot-feature/config/backup-zip.mjs';

import { defaultInventory } from './default-inventory.js';

import { mountSnapshotFeature, mountSnapshotGate } from '../snapshot-feature/mount.js';

import { createIcons, Network, Layers, ShieldCheck, Route, Globe, ChevronDown, RefreshCw, Trash2, ArrowDownUp, Plus, CircleHelp, Save, ArrowRight, Pencil, ChevronRight, GripVertical } from 'lucide';



import { mountRequestOverlay } from './request-state.js';



import { createNamespaceContext } from './namespace-context.js';

import { watch } from 'vue';

import { storedSnapshots } from '../snapshot-feature/data/stored-snapshots';

import { navigationState } from '../navigation.js';

import { displaySettings } from '../snapshot-feature/data/display-settings';

import { editorDirty, finishEditorLeave } from '../snapshot-feature/data/editor-session';



const iconSet = { Network, Layers, ShieldCheck, Route, Globe, ChevronDown, RefreshCw, Trash2, ArrowDownUp, Plus, CircleHelp, Save, ArrowRight, Pencil, ChevronRight, GripVertical };







export function mountDnsManager(root, options = {}) {



  const lifecycle = new AbortController();



  const listen = (target, type, listener) => target.addEventListener(type, listener, { signal: lifecycle.signal });



  const example = options.preview !== false;

  const zones=structuredClone(options.inventory?.zones || (example ? defaultInventory.zones : []));



  const records=structuredClone(options.inventory?.records || (example ? defaultInventory.records : {}));



  let page=options.section || 'overview',order=zones.map(z=>z.id),proposal=null,search='',filter='All',checked=new Set(),drafts=[],snapshots=[],modal=null,dragId=null,stateRevision=0,namespace='All',refreshSeconds=300,deadline=Date.now()+300000,formDirty=false,testResult=null,sourceTestPending=false,sourceTestRevision=0,logSource='All',lookback=24;



  let source=structuredClone(options.inventory?.source || (example ? defaultInventory.source : {name:'Unconfigured',host:'',address:'',credential:''}));

  let observations=structuredClone(options.inventory || {});
  let sourceEditingId=source.id||null;
  const sourceManagementReady=()=>!!options.sourceAction&&observations.sourceManagement?.ready===true;
  const sourceManagementUnavailable=()=>!!options.sourceAction&&!sourceManagementReady();
  const configuredSources=()=>sourceRows(observations,source);
  const selectedSource=()=>configuredSources().find(item=>item.id===sourceEditingId)||configuredSources()[0];
  const sourceCount=()=>namespaceContext.matches(undefined)?configuredSources().length:0;
  const visibleSourceIds=()=>namespaceContext.matches(undefined)?configuredSources().filter(item=>matches(`${item.name} ${item.host} ${item.address}`)).map(item=>'source:'+item.id):[];
  function configuredSourceTable(){const ids=visibleSourceIds();return toolbar('Search Sources')+table([selectAll(ids),'Source','Integration Type','Connection','Zones','Actions'],configuredSources().filter(item=>ids.includes('source:'+item.id)).map(item=>`<tr><td><input type="checkbox" data-select="source:${escape(item.id)}" aria-label="Select source ${escape(item.name)}" ${checked.has('source:'+item.id)?'checked':''}></td><td><button class="dm-link" data-action="nav" data-page="source:edit" data-source="${escape(item.id)}">${escape(item.name)}</button><small>${escape(item.host)}</small><small>${escape(item.address)}</small></td><td>${escape(item.type)}${item.writable===false?'<small>Read only</small>':''}</td><td>${badge(item.managementReachable&&item.dnsReachable?'DNS Source Reachable':'Not Verified',!(item.managementReachable&&item.dnsReachable))}</td><td>${item.zoneCount||0} · Observed</td><td class="dm-row-actions"><button class="dm-icon-button" data-action="nav" data-page="source:edit" data-source="${escape(item.id)}" aria-label="Edit source ${escape(item.name)}">${icon('pencil')}</button></td></tr>`).join(''));}
  function sourceReviewModal(box){const review=modal,prepared=review.receipt?.status==='Prepared',body=runtime().reviewMarkup(review.items)+`<p>A fresh server backup and registered bridge checks are required before Apply.</p>${review.operationId?`<p>Original operation: ${escape(review.operationId)} · ${escape(review.receipt?.status||'Unconfirmed')}</p>`:''}${review.error?`<div class="rcui-banner error" role="alert">${escape(review.error)}</div>`:''}<label class="dm-check-label"><input type="checkbox" data-action="confirm-source-apply" ${prepared&&!review.writing?'':'disabled'} ${review.confirmed?'checked':''}>Confirm these source configuration changes</label><div class="dm-form-actions">${button('Close','close-modal',review.writing?'disabled':'')}${!review.operationId?button('Create Snapshot And Prepare','prepare-source-review',review.writing?'disabled':'','dm-primary'):button('Read Original Status','source-review-status',review.writing?'disabled':'')+button('Reconcile Original Operation','source-review-reconcile',review.writing?'disabled':'')}<button type="button" class="dm-button dm-primary" data-action="apply-source-review" ${prepared&&review.confirmed&&!review.writing?'':'disabled'}>Apply Source Changes</button></div>`;releaseDialog=runtime().mountDialog(box,{title:'Review Source Configuration',body,onClose:()=>{if(!review.writing){modal=null;renderModal();}}});initIcons();alignButtons();}
  function acceptSourceObservations(latest){observations=structuredClone(latest);source=structuredClone(latest.source);zones.splice(0,zones.length,...structuredClone(latest.zones));for(const key of Object.keys(records))delete records[key];Object.assign(records,structuredClone(latest.records));order=[...(latest.navigation?.order||order).filter(id=>zoneById(id)),...zones.filter(z=>!(latest.navigation?.order||order).includes(z.id)).map(z=>z.id)];}
  function finishSourceDrafts(receipt,changes){const saved=options.storage?.load?.();const current=Array.isArray(saved?.drafts)?structuredClone(saved.drafts):drafts;drafts=current.filter(draft=>!receipt.draftIds.includes(draft.id)||!changes.some(change=>JSON.stringify(change)===JSON.stringify(draft.sourceChange)));}
  async function sourceReviewAction(action){
    const review=modal;if(review?.kind!=='source-draft'||review.writing||lifecycle.signal.aborted)return;
    if(action==='apply'&&(!review.confirmed||review.receipt?.status!=='Prepared'))return;
    review.writing=true;review.error='';renderModal();
    try{
      if(action==='prepare'||action==='apply'){
        if(await persistenceTail===false)throw new Error('Save the source proposals successfully before continuing.');
        const fresh=await options.readObservations();if(lifecycle.signal.aborted)return;
        if(JSON.stringify(fresh.sourceManagement?.catalog)!==JSON.stringify(review.catalog))throw new Error('Source configuration changed during review. Refresh and review again.');
        const selected=drafts.filter(draft=>review.items.some(item=>item.id===draft.id));
        if(JSON.stringify(selected)!==review.selected)throw new Error('Source proposals changed during review.');
      }
      if(action==='prepare'){
        const backup=await options.sourceAction({action:'backup'});if(lifecycle.signal.aborted)return;
        review.operationId=crypto.randomUUID();review.snapshotId=backup.id;
        review.receipt=await options.sourceAction({action:'prepare',id:review.operationId,snapshotId:backup.id,changes:review.items.map(item=>item.sourceChange)});
      }else review.receipt=await options.sourceAction({action,id:review.operationId});
      if(lifecycle.signal.aborted)return;review.confirmed=false;
      if(review.receipt?.status==='Applied'){
        const latest=await options.readObservations();if(lifecycle.signal.aborted)return;
        finishSourceDrafts(review.receipt,review.items.map(item=>item.sourceChange));
        acceptSourceObservations(latest);modal=null;await persist();if(lifecycle.signal.aborted)return;
        render();void updateDNSCoverage();notice('Source configuration applied and independently verified.');return;
      }
    }catch(error){review.error=error.message;if(error.receipt)review.receipt=error.receipt;review.confirmed=false;try{const latest=await options.readObservations();if(!lifecycle.signal.aborted)acceptSourceObservations(latest);}catch{ /* Keep the original operation and error when readback is unavailable. */ }}
    finally{review.writing=false;if(!lifecycle.signal.aborted&&modal===review)renderModal();}
  }



  const ui={namespaceFilters:[],density:'Comfortable',rancherUrl:'',banners:{management:true,preview:false,backend:true,snapshots:true}};



  let snapshotUnmount,applyGate;

  const captureDNS=(inventory=observations)=>{if(!example&&!options.inventory)throw new Error('Live DNS observations are unavailable.');const currentSource=inventory.source||source;const currentOrder=inventory.navigation?.order||order;return {configuration:{id:'source/'+(currentSource.id||currentSource.name),name:currentSource.name,kind:'DnsSource',dns:Object.fromEntries(['name','host','address','credential'].map(k=>[k,currentSource[k]]))},relatedConfigurations:(inventory.zones||zones).map(z=>({id:'zone/'+z.id,name:z.name,namespace:'dns-system',kind:'DnsZone',dns:{zone:{id:z.id,name:z.name,kind:z.kind,serial:z.serial,...(z.managed?{managed:true,ownerId:z.ownerId,...(z.parentZone?{parentZone:z.parentZone,delegationRecords:orderedDnsRecords(z.delegationRecords||[])}: {})}:{})},records:orderedDnsRecords((inventory.records||records)[z.id]),priority:currentOrder.indexOf(z.id)}})).concat([{id:'navigation/zones',name:'Zone Navigation',namespace:'dns-system',kind:'DnsNavigation',dns:{order:[...currentOrder]}}]),credentialReferences:structuredClone(currentSource.credentialReferences||[]),pendingChanges:drafts,snapshotScope:{label:example?'DNS Configuration · Sample Inventory':'DNS Configuration · Live Windows Inventory',source:example?'Saved preview configuration':'Authenticated DNS management observations',...(inventory.navigation?.stateName?{managerStateName:inventory.navigation.stateName}:{})},routeManifests:[]}};

  let coverageStatus={tone:'info',label:'Checking Snapshot Coverage',covered:0,total:0},coverageRevision=0;

  async function updateDNSCoverage(){if(snapshotReadState!=='ready')return;const token=++coverageRevision;try{const result=await evaluateCoverage(captureDNS(),storedSnapshots.value);if(token!==coverageRevision||lifecycle.signal.aborted)return;coverageStatus=result.summary;}catch{coverageStatus={tone:'error',label:'Snapshot Coverage Unavailable',covered:0,total:0};}if(!lifecycle.signal.aborted){status();initIcons();}}



  let readState='idle',readFailed=false,readRetryAt=0,snapshotReadState='loading';



  let logs=[],sort={key:'',direction:1};



  const footer=['pending','processes','snapshots','diagnostics','settings','help'];



  const labels={overview:'Overview',sources:'Sources',zones:'Zones',instances:'Instances',pending:'Pending Rollouts',processes:'Running Processes',snapshots:'Snapshots',diagnostics:'Diagnostics',settings:'Settings',help:'Help','snapshot-coverage':'Snapshot Coverage'};



  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));



  const zoneById=id=>zones.find(z=>z.id===id);



  const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;



  const button=(label,action,extra='',kind='')=>`<button type="button" class="dm-button cursor-interaction ${kind}" data-action="${action}" ${extra}>${label}</button>`;



  const badge=(label,pending=false)=>`<span class="dm-badge ${pending?'dm-pending':''}">${label}</span>`;



  const notice=message=>{root.querySelector('#dm-notice').textContent=message};



  const dirty=()=>proposal&&proposal.join('|')!==order.join('|');



  const initIcons=()=>{createIcons({icons: iconSet, root, attrs:{width:16,height:16}});root.querySelectorAll('[data-tooltip]').forEach(el=>el.setAttribute('title',el.dataset.tooltip))};



  let persistenceTail=Promise.resolve(true);

  function persist(){stateRevision++;const saved=options.storage?.save({version:1,revision:stateRevision,page,order:[...order],drafts:[...drafts],snapshots:[...snapshots],source,density:ui.density,preferences:ui,logs,refreshSeconds});persistenceTail=Promise.resolve(saved).then(value=>{if(value===false){notice('State could not be saved.');return false;}return true;},e=>{notice(`State was not saved: ${e.message}. Edits are retained.`);return false;});return persistenceTail;}



  function restore(state){const saved=state?.privateContent;if(saved?.version!==1)return;stateRevision=saved.revision||0;if(Array.isArray(saved.order)&&saved.order.length===zones.length&&new Set(saved.order).size===zones.length&&saved.order.every(id=>zoneById(id)))order=[...saved.order];if(saved.page==='overview'||saved.page==='sources'||saved.page==='zones'||saved.page==='instances'||typeof saved.page==='string'&&saved.page.startsWith('zone:')&&zoneById(saved.page.slice(5)))page=saved.page;drafts=Array.isArray(saved.drafts)?saved.drafts:[];snapshots=Array.isArray(saved.snapshots)?saved.snapshots:[];if(saved.source?.host)source=saved.source;if(saved.density)ui.density=saved.density;if(saved.preferences){ui.rancherUrl=saved.preferences.rancherUrl||'';ui.namespaceFilters=Array.isArray(saved.preferences.namespaceFilters)?saved.preferences.namespaceFilters:[];ui.banners={...ui.banners,...saved.preferences.banners}};logs=Array.isArray(saved.logs)?saved.logs:[];if([0,30,60,300,900,3600].includes(saved.refreshSeconds))refreshSeconds=saved.refreshSeconds;deadline=Date.now()+refreshSeconds*1000;if(footer.includes(saved.page))page=saved.page;drafts=drafts.map((d,i)=>({...d,id:d.id||'legacy-'+i}));}



  restore({privateContent:options.storage?.load()});

  // A Rancher route is explicit navigation; saved state only supplies preferences and drafts.

  if (options.section) page = options.section;



  let mounted=false;



  const namespaceContext=createNamespaceContext(options.store, filters=>{ui.namespaceFilters=filters;if(mounted){checked.clear();render();persist()}},ui.namespaceFilters);



  const requestOverlay = mountRequestOverlay(root, { onReady: data => {

    if(data?.zones&&data?.records){observations=structuredClone(data);zones.splice(0,zones.length,...structuredClone(data.zones));for(const key of Object.keys(records))delete records[key];Object.assign(records,structuredClone(data.records));source=structuredClone(data.source);order=[...(observations.navigation?.order||order).filter(id=>zoneById(id)),...zones.filter(z=>!(observations.navigation?.order||order).includes(z.id)).map(z=>z.id)];if(!formDirty&&!proposal){if(page==='snapshots'&&snapshotUnmount){nav();actions();status();initIcons();}else render();}updateDNSCoverage();}

    notice('Read completed. Existing drafts and editor values are preserved.');

  },onState: state=>{readState=state.phase;readRetryAt=state.phase==='failed'?state.retryAt:0;if(state.phase==='failed')readFailed=true;if(state.phase==='ready'){readFailed=false;if(state.sourceRecovered){refreshSeconds=300;deadline=Date.now()+300000}}if(state.recoveringSource){refreshSeconds=5;deadline=state.retryAt}nav();actions();initIcons()} });



  const title=()=>labels[page]||({'source:new':'Create Source','source:edit':'Edit Source','zone:new':'Create Zone'}[page])||(page.startsWith('record:')?'Record Draft':zoneById(page.slice(5))?.name)||'Overview';



  const matches=value=>String(value).toLowerCase().includes(search.toLowerCase());



  const scoped=()=>namespaceContext.matches('dns-system');



  const visibleZones=()=>order.filter(id=>scoped()&&matches([zoneById(id).name,zoneById(id).kind,'dns-system',source.host,...records[id].flatMap(r=>[r.name,r.type,r.value])].join(' ')));



  const recentLogs=()=>logs.filter(l=>namespaceContext.matches(l.namespace)&&Date.now()-new Date(l.at).getTime()>=0&&Date.now()-new Date(l.at).getTime()<=86400000);



  const snapshotCount=()=>storedSnapshots.value.filter(record=>(record.namespaces?.length?record.namespaces:['']).some(ns=>namespaceContext.matches(ns))).length;

  const snapshotLabel=()=>example?`${snapshotCount()} Stored Sample Backups`:snapshotReadState==='ready'?`${snapshotCount()} Stored Backups`:snapshotReadState==='failed'?'Snapshot storage unavailable':'Loading stored backups…';

  function updateSnapshotCount(){const count=root.querySelector('[data-stored-backup-count]');if(count)count.textContent=snapshotLabel();}



  const diagState=()=>{const items=recentLogs().filter(l=>['WARNING','WARN','ERROR'].includes(String(l.severity).toUpperCase()));return {count:items.length,severity:items.some(l=>String(l.severity).toUpperCase()==='ERROR')?'error':items.length?'warning':'success'}};



  const countBadge=(count,severity='',issue='',scope=activeMenu())=>readState==='loading'&&(['overview','sources','zones','instances','pending','processes','snapshots','diagnostics'].includes(scope)||scope.startsWith('zone:'))?`<span class="dm-count dm-count-loading" aria-label="Loading data; last known count ${count}" title="Loading data"><span class="dm-badge-spinner" aria-hidden="true"></span></span>`:`<span class="dm-count ${severity}" aria-label="${count} ${scope==='diagnostics'?'incidents in the last 24 hours':'items'}${issue?': '+escape(issue):''}" ${issue?`title="${escape(issue)}"`:''}>${count}</span>`;



  const requiredIssue=id=>readFailed?'Required data request failed; automatic retry is pending.':!options.readObservations&&(['overview','sources','zones','instances','pending','processes','snapshots','diagnostics'].includes(id)||id.startsWith('zone:'))?'Required management backend is not configured; live operations and observations are unavailable.':'';



  function rancherLink(kind,name,scope='dns-system'){



    if(!options.rancherOrigin&&!ui.rancherUrl)return `<span title="Configure the Rancher URL in Settings">${escape(name)}</span>`;



    const suffix=kind==='namespace'?`namespace/${encodeURIComponent(name)}`:`${kind}/${encodeURIComponent(scope)}/${encodeURIComponent(name)}`;



    return `<a class="dm-resource-link" href="${escape(options.rancherOrigin||ui.rancherUrl)}/dashboard/c/${encodeURIComponent(options.clusterName||'kubcontroller')}/explorer/${suffix}" target="_blank" rel="noopener noreferrer">${escape(name)}</a>`;



  }

  const replicaRows=()=>example?[0,1,2].map(id=>({id,address:`10.99.15.${55+id}`,reachable:true,zones:zones.map(zone=>({zone:zone.name,serial:Number(zone.serial),sourceSerial:Number(zone.serial),expired:false}))})):(observations.replicas||[]);

  function instanceManagementLink(instance){
    const origin=options.rancherOrigin||ui.rancherUrl;if(!origin)return '<span title="Configure the Rancher URL in Settings">Management link unavailable</span>';
    const cluster=encodeURIComponent(options.clusterName||'kubcontroller'),service=encodeURIComponent(`http:dns-manager-api-${instance.id}:5380`);
    const href=`${origin}/k8s/clusters/${cluster}/api/v1/namespaces/dns-system/services/${service}/proxy/`;
    return `<a class="dm-resource-link" href="${escape(href)}" target="_blank" rel="noopener noreferrer" aria-label="Open Technitium management for dns-manager-engine-${instance.id}">Open Technitium</a>`;
  }

  function instanceTable(zoneName){
    const rows=replicaRows().filter(instance=>!search||matches([`dns-manager-engine-${instance.id}`,instance.address,zoneName,(instance.zones||[]).map(zone=>zone.zone)].join(' ')));
    return table(['Instance','DNS Address','API Status',zoneName?'Zone State':'Zones','Kubernetes Service','Management'],rows.map(instance=>{const zone=zoneName&&(instance.zones||[]).find(item=>item.zone===zoneName),current=zone&&!zone.expired&&zone.serial===zone.sourceSerial;return `<tr><td><strong>dns-manager-engine-${instance.id}</strong><small>Independent persistent instance</small></td><td>${escape(instance.address||`10.99.15.${55+instance.id}`)} · TCP / UDP 53</td><td>${badge(example?'Ready · Sample':instance.reachable?'API Reachable':'Unreachable',!instance.reachable)}</td><td>${zoneName?(zone?badge(`${current?'Current':'Needs Attention'} · Serial ${zone.serial??'Unknown'}`,!current):badge('Zone Not Observed',true)):`${(instance.zones||[]).filter(zone=>!zone.expired&&zone.serial===zone.sourceSerial).length} / ${zones.length} current`}</td><td>${rancherLink('service',`dns-manager-api-${instance.id}`)}</td><td>${instanceManagementLink(instance)}</td></tr>`}).join(''));
  }



  function pageCount(){if(page==='overview'||page==='zones')return scoped()?zones.length:0;if(page==='instances')return scoped()?replicaRows().length:0;if(page==='sources'&&sourceManagementReady())return visibleSourceIds().length;if(page==='sources')return sourceCount();if(page.startsWith('zone:'))return scoped()?(records[page.slice(5)]||[]).length:0;if(page==='pending')return drafts.filter(d=>namespaceContext.matches(d.kind==='source'?undefined:'dns-system')).length;if(page==='processes')return activeProcesses().length;if(page==='diagnostics')return diagState().count;if(page==='snapshots')return snapshotCount();return 0}



  function navigate(next){if(next===page)return;if(dirty()||formDirty||editorDirty.value){modal={kind:'leave',next};renderModal();return}requestOverlay.cancel();page=next;proposal=null;checked.clear();search='';filter='All';logSource='All';sort={key:'',direction:1};modal=null;testResult=null;root._editingRecord=null;render();persist();options.onNavigate?.(next)}



  function activeMenu(){if(page.startsWith('source:'))return 'sources';if(page==='zone:new')return 'zones';if(page.startsWith('record:'))return 'zone:'+page.slice(7);return page}



  function nav(){

    if (!example) { navigationState.counts={overview:scoped()?zones.length:0,sources:sourceCount(),zones:scoped()?zones.length:0,instances:scoped()?replicaRows().length:0,pending:drafts.filter(d=>namespaceContext.matches(d.kind==='source'?undefined:'dns-system')).length,processes:activeProcesses().length,snapshots:snapshotCount(),diagnostics:diagState().count}; navigationState.tones=Object.fromEntries([...Object.keys(navigationState.counts),...order.map(id=>'zone:'+id)].map(id=>[id,id==='diagnostics'?diagState().severity:requiredIssue(id)?'error':''])); navigationState.zones=order.map(id=>({...zoneById(id),recordCount:scoped()?(records[id]||[]).length:0})); }



    const navigation=root.querySelector('#dm-navigation');if(!navigation)return;



    const active=activeMenu();const selected=active;



    const entry=(id,label,count,severity='')=>`<button type="button" class="dm-nav" data-action="nav" data-page="${id}" ${id.startsWith('zone:')?`title="${escape(label)}"`:''} ${selected===id?'aria-current="page"':''}><span class="dm-nav-label">${escape(label)}</span>${count===undefined?'':countBadge(count,id==='diagnostics'?severity:requiredIssue(id)?'error':severity,id==='diagnostics'?'':requiredIssue(id),id)}</button>`;



    navigation.innerHTML=entry('overview','Overview',scoped()?zones.length:0)+'<div class="dm-nav-divider rcui-nav-divider" role="separator"></div>'+entry('sources','Sources',sourceCount())+entry('zones','Zones',scoped()?zones.length:0)+`<div id="dm-zone-navigation">${order.map(id=>entry('zone:'+id,zoneById(id).name,scoped()?records[id].length:0)).join('')}</div>`+entry('instances','Instances',scoped()?replicaRows().length:0)+'<div class="dm-nav-divider rcui-nav-divider" role="separator"></div>'+footer.map(id=>entry(id,labels[id],id==='pending'?drafts.filter(d=>namespaceContext.matches(d.kind==='source'?undefined:'dns-system')).length:id==='processes'?activeProcesses().length:id==='snapshots'?snapshotCount():id==='diagnostics'?diagState().count:undefined,id==='diagnostics'?diagState().severity:'')).join('');



  }



  function refreshControls(count){return `<div class="dm-refresh"><label>Refresh Every <select class="dm-select" id="dm-refresh-interval" aria-label="Automatic refresh interval">${[[0,'Off'],...(refreshSeconds===5?[[5,'5 Seconds · Recovery']]:[]),[30,'30 Seconds'],[60,'1 Minute'],[300,'5 Minutes'],[900,'15 Minutes'],[3600,'1 Hour']].map(([value,label])=>`<option value="${value}" ${refreshSeconds===value?'selected':''}>${label}</option>`).join('')}</select></label><output id="dm-countdown" aria-label="Next Refresh"></output><button type="button" class="dm-icon-button" data-action="refresh" aria-label="${example ? 'Refresh sample data' : 'Refresh DNS observations'}">${icon('refresh-cw')}</button>${count===undefined?'':countBadge(count,page==='diagnostics'?diagState().severity:requiredIssue(activeMenu())?'error':'',page==='diagnostics'?'':requiredIssue(activeMenu()))}</div>`}



  function actions(){let html='';if(proposal)html=`${dirty()?button(icon('save')+'Save','review-order','','dm-primary'):''}${button('Cancel','cancel-order')}`;else{



    if(checked.size){html+=button(icon('trash-2')+'Delete','delete-review','','dm-danger');if(page==='sources'&&checked.size===1)html+=button(icon('pencil')+'Reconfigure','nav','data-page="source:edit"');if(page==='zones')html+=button(icon('refresh-cw')+'Rescan','rescan');if(page==='pending')html=button('Review','review-draft')+button('Discard','discard-draft','','dm-danger')}



    if(page==='zones'&&checked.size)html+=button(icon('arrow-down-up')+'Reorder','reorder');



    if(page==='sources'||page==='zones'||page.startsWith('zone:'))html+=button(icon('plus')+'Create','nav',`data-page="${page==='sources'?'source:new':page==='zones'?'zone:new':'record:'+page.slice(5)}"`,'dm-primary');



  }if(page==='settings')html='<button type="submit" form="dm-settings" class="dm-button dm-primary">Save Settings</button>'+button('Cancel','nav','data-page="overview"');if(page.startsWith('source:')||page.startsWith('record:')||page==='zone:new')html=(page.startsWith('source:')?button('Test Connection','test-connection',sourceTestPending?'disabled':''):'')+'<button type="submit" form="dm-editor" class="dm-button dm-primary">Save Draft</button>'+button('Cancel','nav',`data-page="${page.startsWith('source:')?'sources':page==='zone:new'?'zones':'zone:'+page.slice(7)}"`);root.querySelector('#dm-actions').innerHTML=html+refreshControls(['help','settings'].includes(page)||page.includes('source:')||page.includes('record:')||page==='zone:new'?undefined:pageCount());alignButtons();updateCountdown()}



  function alignButtons(){if(sourceManagementUnavailable()&&(page==='sources'||page.startsWith('source:'))){for(const control of root.querySelectorAll('#dm-actions [data-action="delete-review"],#dm-actions [data-page="source:new"],#dm-actions button[type="submit"]')){control.disabled=true;control.title=observations.sourceManagement?.error||'Registered source management is unavailable.';}}for(const group of root.querySelectorAll('.dm-heading .dm-actions,.dm-form-actions')){const buttons=[...group.querySelectorAll('.dm-button,#dm-snapshot-actions button')];for(const b of buttons)b.style.width='';const width=Math.max(0,...buttons.map(b=>b.getBoundingClientRect().width));for(const b of buttons)b.style.width=width+'px'}}



  function toolbar(label,withNamespace=true,types=[]){return `<div class="dm-toolbar dm-filter-row"><label class="dm-search-label">${label}<input class="dm-input" id="dm-search" aria-label="${label}" placeholder="Names, namespaces, records, addresses…" value="${escape(search)}"></label>${types.length?`<label>Type<select id="dm-filter" class="dm-select" aria-label="Filter type">${['All',...types].map(v=>`<option ${v===filter?'selected':''}>${v}</option>`).join('')}</select></label>`:''}</div>`}



  function namespaceFilter(){const filters=namespaceContext.filters;const options=namespaceContext.options;return `<div class="dm-namespace-filter"><span>Namespaces</span><details><summary>${filters.length?filters.length+' selected · '+escape(filters.map(v=>options.find(o=>o.value===v)?.label||v).join(', ')):'All Namespaces'}</summary><div class="dm-namespace-options"><input class="dm-input" aria-label="Search namespace choices" placeholder="Search namespaces" data-namespace-search><button type="button" class="dm-link" data-action="clear-namespaces">Clear Selection</button><label><input type="checkbox" data-namespace-option="all" ${filters.length?'':'checked'}>All Namespaces</label>${options.map(o=>`<label><input type="checkbox" data-namespace-option="${escape(o.value)}" ${filters.includes(o.value)?'checked':''}>${escape(o.label)}</label>`).join('')}</div></details></div>`}



  function visibleZoneRows(){const ids=proposal||order;return ids.filter(id=>proposal||(visibleZones().includes(id)&&(filter==='All'||zoneById(id).kind===filter)))}



  function visibleRecords(id){return (records[id]||[]).filter(r=>scoped()&&matches(`${r.name} ${r.type} ${r.value}`)&&(filter==='All'||r.type===filter))}



  function overview(){return `<div class="dm-metrics"><button class="dm-metric cursor-interaction" data-action="nav" data-page="sources"><span class="dm-label">Sources</span><strong>${sourceCount()}</strong><span class="dm-label">Windows Domain Controller</span></button><button class="dm-metric cursor-interaction" data-action="nav" data-page="zones"><span class="dm-label">Zones</span><strong>${visibleZones().length}</strong><span class="dm-label">${example?'Example zone inventory':'Transferred authoritative zones'}</span></button><div class="dm-metric"><span class="dm-label">DNS Instances</span><strong>${example?'3 / 3':(observations.replicas||[]).filter(r=>r.reachable).length+' / 3'}</strong><span class="dm-label">${example?'Ready · Sample State':'Management API Reachability'}</span></div></div>${toolbar('Search Overview',true)}<div class="dm-page-scroll"><section class="dm-panel"><h2>Proposed LAN DNS Request Path</h2><p>LAN and DHCP DNS cutover has not been applied.</p><div class="dm-flow"><div class="dm-flow-item"><strong>Omada</strong><small>10.99.1.1</small></div>${icon('arrow-right')}<div class="dm-flow-item"><strong>DNS Service</strong><small>10.99.15.58 · TCP / UDP 53</small></div>${icon('arrow-right')}<div class="dm-flow-item"><strong>Technitium</strong><small>3 Independent Persistent Instances</small></div></div><div class="dm-status-table dm-table-wrap"><table><thead><tr><th>Instance</th><th>API Status</th><th>Zone Replication</th><th>Storage</th></tr></thead><tbody>${(example?[{id:0,reachable:true},{id:1,reachable:true},{id:2,reachable:true}]:observations.replicas||[]).map(r=>`<tr><td>dns-manager-engine-${r.id}</td><td>${badge(example?'Ready · Sample':r.reachable?'API Reachable':'Unreachable',!r.reachable)}</td><td>${example?'4 / 4 · Sample':(r.zones||[]).filter(z=>!z.expired&&z.serial===z.sourceSerial).length+' / '+zones.length+' current'}</td><td>Independent Volume</td></tr>`).join('')}</tbody></table></div></section><section class="dm-panel"><h2>Source & Fallback</h2><div class="dm-detail-list"><div><span class="dm-label">Windows DNS Source</span><strong>${escape(source.host)}</strong><span class="dm-label">${escape(source.address)} · ${example?'Live Connection Unverified':source.reachable?'DNS Source Reachable':'Source Unavailable'}</span></div><div><span class="dm-label">Omada Upstreams · Planned</span><strong>10.99.3.1 → 10.99.3.2</strong><span class="dm-label">Gateway Failover Verification Pending</span></div></div><details><summary class="cursor-interaction">Lookup Policy</summary><ol class="dm-policy"><li>Internal: name.cormierconsulting.io</li><li>Internal: name.cormierconsulting.com</li><li>8.8.8.8: name.cormierconsulting.io</li><li>8.8.8.8: name.cormierconsulting.com</li></ol><p>Internal candidates check replicated zones, then domain02. Dotted names stay exact.</p></details></section><section class="dm-panel"><h2>Matching DNS Zones</h2><div class="dm-table-wrap"><table><thead><tr><th>Zone</th><th>Namespace</th><th>Records</th></tr></thead><tbody>${visibleZones().map(id=>`<tr><td><button class="dm-link" data-action="nav" data-page="zone:${id}">${escape(zoneById(id).name)}</button></td><td>${rancherLink('namespace','dns-system')}</td><td>${records[id].length}</td></tr>`).join('')||'<tr><td colspan="3">No Matching Zones</td></tr>'}</tbody></table></div></section><section class="dm-panel"><h2>Working Drafts & Snapshots</h2><div class="dm-detail-list"><div><span class="dm-label">Working Drafts</span><strong>${drafts.length} ${example?'Preview ':''}Drafts</strong></div><div><span class="dm-label">Configuration Snapshots</span><strong data-stored-backup-count>${snapshotLabel()}</strong></div></div><p style="margin-top:12px">${example?'Live apply and durable backup verification require the management backend.':'Stored snapshots preserve DNS configuration; application and volume data are excluded.'}</p></section></div>`}



  function selectAll(ids){return `<input type="checkbox" data-action="select-all" aria-label="Select all visible items" ${ids.length&&ids.every(id=>checked.has(id))?'checked':''}>`}



  function table(headers,rows){return runtime().tableMarkup(headers,rows,{emptyMessage:['pending','processes'].includes(page)?'No Results Available':'No Matching Items'});}



  function sourceTable(){if(sourceManagementReady())return configuredSourceTable();const ids=source.host&&namespaceContext.matches(undefined)&&matches(`${source.name} ${source.host} ${source.address}`)?['source']:[];return toolbar('Search Sources')+table([selectAll(ids),'Source','Integration Type','Connection','Zones','Actions'],ids.map(id=>`<tr><td><input type="checkbox" data-select="source" aria-label="Select source domain02" ${checked.has(id)?'checked':''}></td><td><button class="dm-link" data-action="nav" data-page="source:edit">${escape(source.name)}</button><small>${escape(source.host)}</small><small>${escape(source.address)}</small></td><td>Windows Domain Controller</td><td>${badge(example?'Not Verified':source.reachable?'DNS Source Reachable':'DNS Source Unavailable',!source.reachable)}</td><td>${zones.length} · ${example?'Sample':'Transferred'}</td><td class="dm-row-actions"><button class="dm-icon-button" data-action="nav" data-page="source:edit" aria-label="Edit source">${icon('pencil')}</button></td></tr>`).join(''))}



  function zoneTable(){const ids=visibleZoneRows();return (proposal?'<div class="dm-warning">Reordering Zone Navigation<span>Grab any part of a row, or use arrow keys on its handle. Save stages a draft; Apply happens in Pending Rollouts.</span></div>':toolbar('Search Zones',true,['Forward','Reverse','AD']))+table([proposal?'':selectAll(ids),'Priority','Zone','Namespace','Records','Replication','Actions'],ids.map(id=>{const z=zoneById(id);return `<tr class="dm-rank-row" data-id="${id}" ${proposal?`draggable="true" data-drag="${id}"`:''}><td>${proposal?`<button type="button" class="dm-rank-handle" data-drag="${id}" aria-label="Reorder ${escape(z.name)}; arrow up or down">${icon('grip-vertical')}</button>`:`<input type="checkbox" data-select="${id}" aria-label="Select ${escape(z.name)}" ${checked.has(id)?'checked':''}>`}</td><td>${(proposal||order).indexOf(id)+1}</td><td>${proposal?escape(z.name):`<button class="dm-link" data-action="nav" data-page="zone:${id}">${escape(z.name)}</button>`}<small>${z.kind} · Secondary Copy</small></td><td>${rancherLink('namespace','dns-system')}</td><td>${records[id].length}</td><td>${badge(example?'Synced · Sample':z.replication||'Unverified')}</td><td class="dm-row-actions">${proposal?'':`<button class="dm-icon-button" data-action="nav" data-page="zone:${id}" aria-label="Open ${escape(z.name)}">${icon('chevron-right')}</button>`}</td></tr>`}).join(''))}

  function instancesPage(){return toolbar('Search Instances',true)+`<section class="dm-panel"><h2>DNS Instances</h2><p>Each Technitium interface opens through Rancher's authenticated Kubernetes service proxy. The DNS APIs remain private to the cluster.</p>${instanceTable()}</section>`}



  function zonePage(id){if(!zoneById(id))return '<section class="dm-panel"><p>Zone unavailable in the current authorized inventory.</p></section>';const z=zoneById(id),items=visibleRecords(id),ids=items.map(recordIdentity);return `<section class="dm-panel dm-compact"><div class="dm-detail-list"><div><span class="dm-label">Writable Source</span><strong>${escape(source.host)}</strong></div><div><span class="dm-label">Kubernetes Copies · ${rancherLink('namespace','dns-system')}</span><strong>Read Only · ${escape(z.replication||'Unknown')}${example?' · Sample':''}</strong></div></div><details><summary>Replication Details</summary><p>Serial ${z.serial} · ${example?'Sample transfer timing':'Transfer timing is reported by the controller'}</p></details></section><section class="dm-panel"><h2>Instances</h2>${instanceTable(z.name)}</section>`+toolbar('Search Records',false,[...new Set(records[id].map(r=>r.type))])+table([selectAll(ids),'Name','Type','Value','TTL','Actions'],items.map(r=>`<tr><td><input type="checkbox" data-select="${escape(recordIdentity(r))}" aria-label="Select ${escape(r.name)} ${escape(r.type)} ${escape(r.value)}" ${checked.has(recordIdentity(r))?'checked':''}></td><td>${escape(r.name)}</td><td>${r.type}</td><td>${escape(r.value)}</td><td>${r.ttl}</td><td class="dm-row-actions"><button class="dm-icon-button" data-action="edit-record" data-zone="${id}" data-record="${escape(recordIdentity(r))}" aria-label="Edit ${escape(r.name)} ${escape(r.type)} ${escape(r.value)}">${icon('pencil')}</button></td></tr>`).join(''))}



  function editor(){if(page.startsWith('source:')&&sourceManagementReady())return sourceEditorMarkup({editing:page==='source:edit',selected:selectedSource(),context:observations.sourceManagement,escape});if(page.startsWith('source:')){const editing=page==='source:edit';return `<section class="dm-panel"><h2>Windows Domain Controller Integration</h2><form id="dm-editor" data-kind="source"><div class="dm-form"><label>Name<input class="dm-input" name="name" required ${editing?'readonly aria-readonly="true"':''} value="${editing?escape(source.name):''}" placeholder="domain02"></label><label>Integration Type<select class="dm-select" name="type"><option>Windows Domain Controller</option></select></label><label class="dm-wide">Controller Hostname<input class="dm-input" name="host" required value="${editing?escape(source.host):''}" placeholder="domain02.cormierconsulting.com"></label><label>DNS Address<input class="dm-input" name="address" required value="${editing?escape(source.address):''}" placeholder="10.99.3.2"></label><label>Credential Reference<input class="dm-input" name="credential" value="${editing?escape(source.credential):''}" placeholder="Secret reference"></label><label class="dm-wide">Zone Synchronization<select class="dm-select"><option>All Transferable Authoritative Zones</option></select></label></div><p style="margin-top:16px">Connectivity, zone transfers, and Windows management permissions are verified separately.</p><div id="dm-test-result" aria-live="polite"></div><div class="dm-form-actions">${button('Test Connection','test-connection')}${button('Cancel','nav','data-page="sources"')}<button class="dm-button dm-primary cursor-interaction" type="submit">Save Draft</button></div></form></section>`}if(page==='zone:new')return `<section class="dm-panel"><h2>New Zone Draft</h2><form id="dm-editor" data-kind="zone"><div class="dm-form"><label class="dm-wide">Zone Name<input class="dm-input" name="zone" required placeholder="example.cormierconsulting.io"></label><label>Writable Source<select class="dm-select" name="source"><option>${escape(source.name)}</option></select></label><label>Zone Type<select class="dm-select" name="type"><option>Forward</option><option>Reverse</option></select></label></div><div class="dm-form-actions">${button('Cancel','nav','data-page="zones"')}<button class="dm-button dm-primary cursor-interaction" type="submit">Save Draft</button></div></form></section>`;const id=page.slice(7);if(!zoneById(id))return '<section class="dm-panel"><p>Zone unavailable in the current authorized inventory.</p></section>';const record=root._editingRecord||{name:'',type:'A',value:'',ttl:3600};return `<section class="dm-panel"><h2>${escape(zoneById(id).name)}</h2><p>Changes target Windows DNS after review and a verified configuration snapshot.</p><form id="dm-editor" data-kind="record" data-zone="${id}"><div class="dm-form" style="margin-top:16px"><label>Name<input class="dm-input" name="name" required ${root._editingRecord?'readonly aria-readonly="true"':''} value="${escape(record.name)}" placeholder="testing"></label><label>Record Type<select class="dm-select" name="type" ${root._editingRecord?'disabled aria-disabled="true"':''}>${['A','AAAA','CNAME','PTR','MX','SRV','TXT'].map(type=>`<option ${type===record.type?'selected':''}>${type}</option>`).join('')}</select></label><label class="dm-wide">Value<input class="dm-input" name="value" required value="${escape(record.value)}" placeholder="192.0.2.11"></label><label>TTL (Seconds)<input class="dm-input" name="ttl" type="number" min="0" required value="${record.ttl}"></label></div><div class="dm-form-actions">${button('Cancel','nav',`data-page="zone:${id}"`)}<button class="dm-button dm-primary cursor-interaction" type="submit">Save Draft</button></div></form></section>`}



  function pending(){const items=drafts.filter(d=>namespaceContext.matches(d.kind==='source'?undefined:'dns-system')&&matches(JSON.stringify(d)));return toolbar('Search Pending Rollouts')+table([selectAll(items.map(d=>d.id)),'Change','Scope','Status','Actions'],items.map(d=>`<tr><td><input type="checkbox" data-select="${escape(d.id)}" aria-label="Select draft ${escape(d.name||d.kind)}" ${checked.has(d.id)?'checked':''}></td><td>${escape(d.kind)}<small>${escape(d.name||d.zone||'Zone Navigation')}</small></td><td>${escape(d.zone||'Manager Configuration')}</td><td>Draft · Not Applied</td><td><button class="dm-icon-button" data-action="review-draft" data-id="${escape(d.id)}" aria-label="Review draft">${icon('pencil')}</button></td></tr>`).join(''))}



  function settings(){return `<section class="dm-panel dm-page-scroll"><form id="dm-settings"><label>Rancher URL<input class="dm-input" name="rancherUrl" type="url" value="${escape(ui.rancherUrl)}" placeholder="https://rancher.example.com"></label><p>Used by standalone resource links. No credentials belong in this URL. Native integration will use the active Rancher context.</p><h3>Top-of-page Notifications</h3>${[['snapshots','Show snapshot coverage status'],['management','Management failover verification'],['preview','Preview / sample-data notice'],['backend','Management backend availability']].map(([key,label])=>`<label class="dm-check-label"><input type="checkbox" name="${key}" ${ui.banners[key]?'checked':''}>${label}</label>`).join('')}<p>Hiding a notice does not verify connectivity or enable live Apply.</p><div class="dm-form-actions"><button type="submit" class="dm-button dm-primary">Save Settings</button></div></form></section>`}



  function filteredLogs(){return logs.filter(l=>Date.now()-new Date(l.at).getTime()<=lookback*3600000&&namespaceContext.matches(undefined)&&(logSource==='All'||logSource==='Browser UI')&&matches(JSON.stringify(l))&&(filter==='All'||filter===(l.severity==='Warning'?'Warn':l.severity)))}



  function diagnostics(){



    const items=filteredLogs();



    const controls=`<div class="dm-toolbar dm-filter-row dm-diagnostics-filters"><label class="dm-search-label">Search Diagnostics<input class="dm-input" id="dm-search" aria-label="Search Diagnostics" placeholder="Message, source, or severity…" value="${escape(search)}"></label><label>Lookback (hours)<input class="dm-input" id="dm-lookback" type="number" min="0.25" max="168" step="0.25" value="${lookback}"></label><label>Log source<select id="dm-log-source" class="dm-select" aria-label="Log source">${['All','Browser UI','Windows DNS · Not Connected','dns-01 · Not Connected','dns-02 · Not Connected','dns-03 · Not Connected','Kubernetes Resources · Not Connected'].map(value=>`<option value="${escape(value)}" ${value===logSource?'selected':''}>${value==='All'?'All Log Sources':escape(value)}</option>`).join('')}</select></label><label>Severity<select id="dm-filter" class="dm-select" aria-label="Severity">${['All','Debug','Info','Warn','Error'].map(value=>`<option value="${value}" ${value===filter?'selected':''}>${value==='All'?'All Severities':value}</option>`).join('')}</select></label></div>`;



    return controls+`<p class="dm-scope-note">Actual browser events. Managed-resource logs are unavailable until the management backend connects; the 24-hour badge counts browser warnings/errors only.</p>`+table(['Time','Namespace','Log Source','Severity','Message'],items.map(l=>`<tr><td>${escape(new Date(l.at).toLocaleString())}</td><td>Global</td><td>Browser UI</td><td>${escape(l.severity==='Warning'?'Warn':l.severity)}</td><td>${escape(l.message)}</td></tr>`).join(''));



  }



  const guide=[



    {id:'overview',title:'Overview',text:'Review DNS service, sample health, source/fallback configuration, and drafts.',actions:[['Manager title / breadcrumb','Return to Overview from anywhere.'],['Search / Namespace','Filter matching zones by names, namespaces, source names, record names/types/values. Clearing filters restores the scope.'],['Metric cards / zone links','Open the corresponding source or zone inventory.'],['Refresh / Refresh Every','Refresh observations and reset the countdown. Unsaved values remain intact. Delayed reads show loading feedback and time out after 60 seconds. Confirmed source disconnections retry every five seconds, then return to five-minute refresh after recovery; other read failures retry every 60 seconds.'],['Resource links','Open native Rancher resource details in a new tab using the configured origin. Without a destination, show text rather than a misleading link.']]},



    {id:'sources',title:'Sources',text:'Create and edit Windows Domain Controller integrations. The preview has one sample source.',actions:[['Create / Edit / Reconfigure','Open a working editor without altering the active source.'],['Test Connection','Use the entered, unsaved endpoint and credential reference. DNS query, zone transfer, and Windows management need separate evidence. No backend means Not Verified; changing settings invalidates a prior result.'],['Save Draft','Stage settings in Pending Rollouts. Repeated saves for the same target replace its draft.'],['Cancel / navigation','Prompt Stay or Discard Changes when edits are unsaved.'],['Checkboxes / Delete','Select the explicit full-grid scope and stage a reviewed deletion draft. Resources remain unchanged until Apply.']]},



    {id:'zones',title:'Zones and Records',text:'Browse forward, reverse, and AD zones. Zone badges count scoped records, and each zone shows the instances serving its current copy.',actions:[['Zones / child zones / Instances','Open the zone grid, a specific zone, or the replica inventory directly below the zone entries.'],['Zone link / Create / Edit record','Open a record grid or editor. Search, namespace, and type filters narrow the displayed scope. Changes remain drafts until Apply.'],['Instance management link','Open that replica’s Technitium interface through Rancher’s authenticated Kubernetes service proxy.'],['Checkbox / Select All','Select visible authorized rows. A partial selection makes Select All indeterminate. Compact tables have no selection checkboxes.'],['Reorder / drag / arrow keys','Replace checkboxes with handles and suspend filters. Grab the whole row or move with keyboard arrows. Save appears only after a change; Cancel restores the applied order.'],['Save','Review and stage an order draft. Navigation retains applied order until Apply confirms persistence.'],['Delete / Rescan','Stage a deletion after review. Rescan requires the backend; unavailable scans report failure rather than invent observations.']]},

    {id:'instances',title:'Instances',text:'Inspect the three independent Technitium replicas and open their private management interfaces.',actions:[['Search Instances','Filter by instance name, DNS address, or observed zone.'],['Kubernetes Service','Open the native Rancher Service resource.'],['Open Technitium','Open the selected replica through Rancher’s authenticated service proxy without publishing its API outside the cluster.']]},



    {id:'pending',title:'Pending Rollouts',text:'Review staged creates, edits, deletions, and ordering changes before execution.',actions:[['Review','Show selected scope and proposed configuration.'],['Discard','Remove selected unapplied drafts without changing resources.'],['Apply','Validate permissions, dependencies, concurrency, and durable pre-change snapshot coverage, then start a backend operation in Running Processes. Live Apply is disabled without that backend.']]},



    {id:'processes',title:'Running Processes',text:'Track accepted backend operations and actual results.',actions:[['Operation status','Show real progress/failures and scope. Saving a draft does not start a process. The preview fabricates no operations.']]},



    {id:'snapshots',title:'Snapshots',text:'Manage DNS configuration backups, scheduled capture, retention, restore drafts and priority merges.',actions:[['Capture / Merge / Restore','Capture saved sample DNS configuration in ZIP; optional Include Secrets prompts for matching strong passwords and encrypts the complete payload. Server storage, scheduling, comparison, merge and restoration use the DNS adapter. Apply remains unavailable without the authenticated live backend.']]},



    {id:'diagnostics',title:'Diagnostics',text:'Inspect actual browser events; management, Windows, Technitium, and workload logs require the backend.',actions:[['Search / Namespace / Log Source / Severity / Lookback','Narrow the displayed events. Severity supports Debug, Info, Warn, Error. Disconnected resources provide no collected logs. Lookback is 0.25–168 hours.'],['24-hour badge','Count warnings/errors across the full browser-event scope, independent of current filters. Zero means no browser incidents; yellow counts warnings; red combines errors and warnings when errors exist.']]},



    {id:'settings',title:'Settings',text:'Set browser-local preferences without creating a rollout.',actions:[['Rancher URL','Set an HTTP/HTTPS origin without credentials or a path. Native integration uses the active Rancher context.'],['Notification checkboxes','Individually show or hide banner types. Hiding a warning cannot verify connectivity or enable writes.'],['Save Settings / Cancel','Persist local preferences, or leave with unsaved-change review. Help and Settings do not display inventory counts.']]},



    {id:'help',title:'Help',text:'Application guide and cause/effect explanations for all available controls.',actions:[['Section headings / Open page','Expand explanations and navigate to the described page.'],['Circled question marks on other pages','Open the matching guide text in a popup. Close returns to the current view; Open Help expands the matching section. This page has no question-mark controls.']]}



  ];



  const guideKey=()=>page.startsWith('source:')?'sources':page.startsWith('zone:')||page.startsWith('record:')||page==='zone:new'?'zones':labels[page]?page:'overview';



  function guideBody(section){return `<p>${escape(section.text)}</p><dl>${section.actions.map(([action,effect])=>`<dt>${escape(action)}</dt><dd>${escape(effect)}</dd>`).join('')}</dl>`}



  function helpPage(){return `<section class="dm-panel dm-page-scroll"><p>Sample inventories and browser-stored drafts. Windows DNS and Kubernetes serving configuration are unchanged by this preview.</p>${guide.map(section=>`<details class="dm-help-section" data-help-id="${section.id}"><summary>${section.title}</summary>${guideBody(section)}${section.id==='help'?'':`<a class="dm-resource-link" href="#${section.id}" data-action="nav" data-page="${section.id}">Open ${section.title}</a>`}</details>`).join('')}</section>`}



  function status(){displaySettings.previewMode=ui.banners.preview&&example;root.querySelector('#dm-status').innerHTML=(ui.banners.snapshots?`<button type="button" class="rcui-banner ${coverageStatus.tone}" data-action="nav" data-page="snapshot-coverage"><strong>${escape(coverageStatus.label)}</strong><span>${coverageStatus.label==='Checking Snapshot Coverage'?'Loading stored backups and comparing current configuration…':coverageStatus.total?`${coverageStatus.covered} / ${coverageStatus.total} known configuration items covered. View Snapshot Coverage.`:'Coverage has not been verified. View Snapshot Coverage.'}</span></button>`:'')+(ui.banners.management&&page==='overview'?'<button type="button" class="dm-warning dm-alert-link" data-action="nav" data-page="diagnostics" title="Open management failover diagnostics">Management Failover: Verification Pending<span>kubcontroller → 10.99.15.50 · Verify access when controller01 is unavailable.</span></button>':'')+(displaySettings.previewMode?'<button type="button" class="dm-banner dm-alert-link" data-action="nav" data-page="settings">Design Preview · Sample Data · Local Drafts</button>':'')+(ui.banners.backend?`<button type="button" class="rcui-banner ${source.managementReachable?'success':'error'} dm-alert-link" data-action="nav" data-page="${source.host?'source:edit':'source:new'}" title="Open source configuration and connection testing">${source.managementReachable?'Windows DNS management connected':options.readObservations?'Live inventory connected · Windows bridge unavailable':'Live management backend unavailable'}</button>`:'')}



  const activeProcesses=()=>scoped()?(observations.processes||[]).filter(p=>['Queued','Running'].includes(p.status)):[];

  function processTable(){const items=scoped()?(observations.processes||[]).filter(p=>!search||JSON.stringify([p.id,p.status,p.error,p.operations?.map(o=>o.name)]).toLowerCase().includes(search.toLowerCase())).slice().reverse():[];return toolbar('Search Running Processes')+table(['Process','Namespace','Operation','Status','Progress','Started','Resources','Result'],items.length?items.map(p=>'<tr><td>'+escape(p.id)+'</td><td>dns-system</td><td>'+escape(p.kind==='Source'?'Source configuration':p.kind==='Navigation'?'Zone navigation':'Windows DNS')+'</td><td>'+escape(p.status)+'</td><td>'+escape((p.receipts||[]).filter(r=>r.readBack).length+' / '+(p.operations||[]).length)+'</td><td>'+escape(p.startedAt||p.createdAt)+'</td><td>'+escape((p.operations||[]).map(o=>[o.zone||o.name,o.type||o.operation].filter(Boolean).join(' ')).join(', '))+'</td><td>'+escape(p.error||(p.status==='Applied'?'Readback verified':'Awaiting completion'))+(p.kind==='Source'&&p.status!=='Applied'?'<div class=dm-row-actions><button class=dm-button data-action=source-process-status data-id='+escape(p.id)+'>Read Original Status</button><button class=dm-button data-action=source-process-reconcile data-id='+escape(p.id)+'>Reconcile Original Operation</button>'+(p.status==='Prepared'?'<button class=dm-button data-action=source-process-continue data-id='+escape(p.id)+'>Continue Review</button>':'')+'</div>':'')+'</td></tr>').join(''):'<tr><td colspan="8">No backend operations in this scope.</td></tr>');}

  function render(){const savedForm=formDirty&&root.querySelector('#dm-editor');const savedValues=savedForm?Object.fromEntries(new FormData(savedForm)):null;if(page==='snapshots'&&editorDirty.value){nav();actions();initIcons();return}snapshotUnmount?.();snapshotUnmount=undefined;const globalNamespaces=root.querySelector('#dm-global-namespaces');if(globalNamespaces)globalNamespaces.innerHTML=namespaceFilter();nav();root.querySelector('#dm-title').textContent=title();root.querySelector('#dm-crumb').textContent=title();root.querySelector('#dm-subtitle').textContent=page==='overview'?'DNS service, source replication, and lookup policy.':page==='instances'?'Private DNS replica management through Rancher.':'DNS management · Observed inventory';status();const content=root.querySelector('#dm-content');content.className='dm-content';content.innerHTML=page==='overview'?runtime().layoutMarkup('overview',overview(),{variant:'stacked'}):page==='sources'?sourceTable():page==='zones'?zoneTable():page==='instances'?instancesPage():page==='zone:new'?editor():page.startsWith('zone:')?zonePage(page.slice(5)):page==='pending'?pending():page==='settings'?settings():page==='diagnostics'?diagnostics():page==='help'?helpPage():page==='processes'?processTable():['snapshots','snapshot-coverage'].includes(page)?'<div id="dm-snapshot-root" style="height:100%;min-height:0"></div>':editor();if(['snapshots','snapshot-coverage'].includes(page))snapshotUnmount=mountSnapshotFeature(content.querySelector('#dm-snapshot-root'),{view:page==='snapshot-coverage'?'coverage':'history',onNavigate:navigate,capture:captureDNS,restore:stageSnapshotRestore,matches:namespaceContext.matches});if(page.includes('source:')||page.includes('record:')||page==='zone:new')content.classList.add('dm-editor-scroll');for(const footerActions of content.querySelectorAll('.dm-form-actions'))footerActions.remove();actions();root.style.setProperty('--dm-row-height',ui.density==='Compact'?'36px':'46px');root.querySelector('[aria-label="Page help"]').hidden=page==='help';for(const h of page==='help'?[]:content.querySelectorAll('.dm-panel>h2'))h.insertAdjacentHTML('beforeend',` <button class="dm-inline-help" data-action="help-context" aria-label="Help for ${escape(h.textContent)}" data-subject="${escape(h.textContent)}">${icon('circle-help')}</button>`);const all=root.querySelector('[data-action="select-all"]');if(all){const ids=selectionIds();all.indeterminate=ids.some(id=>checked.has(id))&&!ids.every(id=>checked.has(id))}for(const grid of content.querySelectorAll('table')){const headings=[...grid.querySelectorAll('thead th')];for(let i=0;i<headings.length;i++){const heading=headings[i];const numeric=/^(Priority|Records|Zones|TTL|Count|Size|Items)$/.test(heading.textContent.trim());if(numeric){heading.classList.add('dm-numeric');for(const row of grid.querySelectorAll('tbody tr'))row.children[i]?.classList.add('dm-numeric')}if(heading.querySelector('input[type=checkbox]')||grid.querySelector('tbody td:first-child input[type=checkbox],tbody td:first-child .dm-rank-handle')){if(i===0){heading.classList.add('dm-selection');for(const row of grid.querySelectorAll('tbody tr'))row.children[0]?.classList.add('dm-selection')}}}}decorateTables(content);if(savedValues){const form=root.querySelector('#dm-editor');for(const [name,value] of Object.entries(savedValues))if(form?.elements[name])form.elements[name].value=value}initIcons();alignButtons();renderModal();void updateDNSCoverage()}



  function sortTable(grid,column,direction){

    const body=grid.querySelector('tbody');if(!body)return;

    const rows=[...body.rows];if(rows.some(row=>row.cells.length===1&&row.cells[0].colSpan>1))return;

    const numeric=grid.querySelectorAll('thead th')[column]?.classList.contains('dm-numeric');

    rows.sort((left,right)=>{const a=left.cells[column]?.textContent.trim()||'',b=right.cells[column]?.textContent.trim()||'';return (numeric?Number(a)-Number(b):a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}))*direction});

    rows.forEach(row=>body.appendChild(row));

  }

  function decorateTables(content){runtime().decorateTables(content,{sort,suspended:!!proposal});if(sort.key){const [grid,column]=sort.key.split(':').map(Number);const table=content.querySelectorAll('table')[grid];if(table&&!table.classList.contains('data-grid'))sortTable(table,column,sort.direction);}}

  let releaseDialog;



  function renderModal(){if(modal?.kind==='draft'&&applyGate&&root.querySelector('#dm-apply-gate'))return;applyGate?.unmount();applyGate=undefined;const box=root.querySelector('#dm-modal');releaseDialog?.();releaseDialog=undefined;if(!modal){box.innerHTML='';return}if(modal.kind==='source-draft'){sourceReviewModal(box);return;}let body='',heading='';const navReview=modal.items?.some(i=>i.kind==='order'||i.kind==='restore'&&i.configuration?.kind==='DnsNavigation');if(modal.kind==='order'){heading='Review Zone Order Draft';body=`<div class="dm-orders"><div><h3>Applied Order</h3><ol>${order.map(id=>`<li>${escape(zoneById(id).name)}</li>`).join('')}</ol></div><div><h3>Proposed Order</h3><ol>${proposal.map(id=>`<li>${escape(zoneById(id).name)}</li>`).join('')}</ol></div></div><p>Save stages this draft in Pending Rollouts. Applying later requires a durable pre-change snapshot, permission and revision checks. Active navigation stays in the applied order.</p><div class="dm-form-actions">${button('Cancel','close-modal')}${button('Save Draft','stage-order','','dm-primary')}</div>`}else if(modal.kind==='leave'){heading='Unsaved Changes';body=`<p>Changes have not been saved as a draft.</p><div class="dm-form-actions">${button('Stay','close-modal')}${button('Save Draft And Leave','save-leave')}${button('Discard Changes','discard-leave','','dm-danger')}</div>`}else if(modal.kind==='delete'){heading='Review Delete Draft';body=`<p>Selected scope: ${modal.items.map(escape).join(', ')}. Nothing is deleted until a validated rollout is applied.</p><div class="dm-form-actions">${button('Cancel','close-modal')}${button('Save Draft','stage-delete','','dm-primary')}</div>`}else if(modal.kind==='draft'){heading='Review Pending Rollout';body=`${runtime().reviewMarkup(modal.items)}${options.applyChanges&&source.managementReachable?'<p>'+(navReview?'Apply requires a server snapshot of the current saved navigation.':'Apply requires a server snapshot of the complete zone records. Credential values are excluded from this pre-change copy.')+'</p><div id="dm-apply-gate"></div><label class="dm-check-label"><input type="checkbox" data-action="confirm-dns-apply" disabled>' +(navReview?'Confirm these navigation changes':'Confirm these Windows DNS changes')+'</label><p id="dm-apply-error" role="alert"></p>':'<div class="dm-warning">Windows DNS management is unavailable</div>'}<div class="dm-form-actions">${button('Close','close-modal')}<button class="dm-button dm-primary" data-action="apply-dns-draft" disabled>Apply Selected</button></div>`}else{heading=modal.subject||title()+' Help';const section=guide.find(s=>s.id===guideKey());body=`${modal.helpText?`<p>${escape(modal.helpText)}</p>`:guideBody(section)}<div class="dm-form-actions">${button('Close','close-modal')}${button('Open Help','open-help',`data-section="${section.id}"`)}</div>`}releaseDialog=runtime().mountDialog(box,{title:heading,body,onClose:()=>{modal=null;renderModal();}});if(modal.kind==='draft'&&options.applyChanges&&source.managementReachable){modal.capture=captureDNS();modal.reviewed=JSON.stringify(modal.items);modal.confirmed=false;applyGate=mountSnapshotGate(box.querySelector('#dm-apply-gate'),{scopeKey:JSON.stringify(modal.capture),data:modal.capture,requireServerCopy:true,allowSecretCapture:false,onReady:ready=>{const check=box.querySelector('[data-action="confirm-dns-apply"]');if(check){check.disabled=!ready;check.checked=false;}modal.confirmed=false;box.querySelector('[data-action="apply-dns-draft"]').disabled=true;}});}initIcons();alignButtons();box.querySelector('button:not(:disabled)')?.focus()}



  function selectionIds(){if(page==='zones')return visibleZoneRows();if(page==='sources'&&sourceManagementReady())return visibleSourceIds();if(page==='sources')return source.host&&namespaceContext.matches(undefined)&&matches(`${source.name} ${source.host} ${source.address}`)?['source']:[];if(page.startsWith('zone:'))return visibleRecords(page.slice(5)).map(recordIdentity);if(page==='pending')return drafts.filter(d=>namespaceContext.matches(d.kind==='source'?undefined:'dns-system')&&matches(JSON.stringify(d))).map(d=>d.id);return []}



  function stage(draft){if(containsSecretValues(draft))throw new Error('Secret restoration requires an authenticated backend that holds encrypted backup references. Secret values cannot be saved in preview drafts.');const identityFor=d=>d.sourceChange?JSON.stringify(['source',d.sourceChange.sourceId]):JSON.stringify([d.kind,d.zone,d.name,d.kind==='record'?(d.targetId||recordIdentity(d)):null]);const identity=identityFor(draft);const index=drafts.findIndex(d=>identityFor(d)===identity);const item={...draft,id:index>=0?drafts[index].id:draft.id||crypto.randomUUID(),preview:example,at:new Date().toISOString()};if(item.sourceChange)item.sourceChange.id=item.id;if(index>=0)drafts[index]=item;else drafts.push(item);persist();return item}
  function stageSnapshotRestore(change){if(change.configuration?.kind!=='DnsSourceCatalog')return stage({kind:'restore',...change});if(!sourceManagementReady())throw new Error(observations.sourceManagement?.error||'Registered source management is unavailable.');const restored=sourceRestoreDrafts({...change,context:observations.sourceManagement,idFactory:()=>crypto.randomUUID()});for(const draft of restored)stage(draft);return restored;}



  function log(severity,message){logs.push({at:new Date().toISOString(),severity,component:'Browser UI',message});persist();nav()}



  function move(id,index){const before=proposal.indexOf(id);if(before<0||index<0||index>=proposal.length)return;proposal.splice(before,1);proposal.splice(index,0,id);render();root.querySelector(`button[data-drag="${id}"]`)?.focus();notice('Order draft changed. Active navigation stays in the applied order.');}



  function updateCountdown(){const output=root.querySelector('#dm-countdown');if(output){const seconds=refreshSeconds?Math.max(0,Math.ceil(((readRetryAt||deadline)-Date.now())/1000)):0;output.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}}



  function refresh(manual=false){deadline=Date.now()+refreshSeconds*1000;nav();actions();status();if(options.readObservations&&!requestOverlay.busy)requestOverlay.read(options.readObservations,'Loading DNS observations');else if(manual)notice('Preview observations refreshed. Live inventory is not connected; drafts and editor values are preserved.')}



  const stopSnapshotCounts=watch(storedSnapshots,()=>{snapshotReadState='ready';nav();actions();updateSnapshotCount();initIcons();void updateDNSCoverage()},{deep:true});

  const actionGeometry=new MutationObserver(()=>alignButtons());

  actionGeometry.observe(root.querySelector('.dm-heading .dm-actions'),{childList:true,subtree:true});

  listen(document,'pointerdown',event=>{for(const popover of root.querySelectorAll('#dm-global-namespaces details[open]'))if(!popover.contains(event.target))popover.removeAttribute('open')});

  listen(root,'keydown',event=>{if(event.key==='Escape')for(const popover of root.querySelectorAll('#dm-global-namespaces details[open]'))popover.removeAttribute('open')});



  let lastDiagnostics=JSON.stringify(diagState());

  const timer=setInterval(()=>{if(refreshSeconds&&Date.now()>=deadline)refresh();const nextDiagnostics=JSON.stringify(diagState());if(nextDiagnostics!==lastDiagnostics){lastDiagnostics=nextDiagnostics;nav();if(page==='diagnostics')actions();initIcons();}updateCountdown()},1000);



  listen(root,'click',async event=>{const target=event.target.closest('[data-action]');if(!target)return;const action=target.dataset.action;



    if(['management-help','preview-help','backend-help'].includes(action)){modal={kind:'help',subject:action==='management-help'?'Management HA Verification':action==='backend-help'?'Management Backend Recovery':'Preview Capabilities',helpText:action==='management-help'?'Before deployment, verify kubcontroller at 10.99.15.50 reaches another controller when controller01 is unavailable, using the Traefik TLS-passthrough Kubernetes API endpoint. Keep another management connection available during the check. This preview has not performed that test.':action==='backend-help'?'The authenticated DNS management service and Windows adapter are not connected. Connect the backend and verify Rancher permissions, then test DNS queries, zone transfers and Windows management separately in Edit Source. A configured source alone cannot enable Apply.':'Inventory and health are samples; proposals remain preview drafts. Stored local ZIPs are backups of sample configuration, not live Windows or Kubernetes state.'};renderModal()}



    else if(action==='nav'){if(target.dataset.page==='source:edit')sourceEditingId=target.dataset.source||(page==='sources'&&checked.size===1?[...checked][0].replace(/^source:/,''):source.id)||null;navigate(target.dataset.page);}



    else if(action==='sort'){const key=target.dataset.grid+':'+target.dataset.column;sort={key,direction:sort.key===key?-sort.direction:1};const grid=root.querySelectorAll('#dm-content table')[Number(target.dataset.grid)];sortTable(grid,Number(target.dataset.column),sort.direction);decorateTables(root.querySelector('#dm-content'))}



    else if(action==='clear-namespaces'){namespaceContext.set([])}





    else if(action==='open-help'){const section=target.dataset.section;modal=null;navigate('help');const detail=root.querySelector(`[data-help-id="${section}"]`);if(detail){detail.open=true;detail.scrollIntoView({block:'start'})}}



    else if(action==='reorder'&&checked.size){proposal=[...order];render();notice('Grab any part of a row, or use arrow keys on its handle.')}



    else if(action==='save-leave'){const next=modal.next;const callback=modal.onLeave;const form=root.querySelector('#dm-editor');if(editorDirty.value)finishEditorLeave(true);else if(dirty())stage({kind:'order',order:[...proposal],previousOrder:[...order],revision:stateRevision,needsCompletion:true});else if(form)stage({kind:form.dataset.kind,zone:form.dataset.zone||null,...Object.fromEntries(new FormData(form)),...(form.dataset.kind==='record'&&root._editingRecord?{type:root._editingRecord.type,targetId:recordIdentity(root._editingRecord)}:{}),needsCompletion:true});else{notice('Save these settings before leaving.');return}proposal=null;formDirty=false;modal=null;if(callback){renderModal();callback()}else navigate(next)}



    else if(action==='cancel-order'){proposal=null;render();notice('Order proposal discarded.')}



    else if(action==='review-order'){modal={kind:'order'};renderModal()}



    else if(action==='stage-order'){stage({kind:'order',name:'Zone Navigation',order:[...proposal],baseOrder:[...order]});proposal=null;modal=null;render();notice('Order draft is in Pending Rollouts. Active navigation is unchanged.')}



    else if(action==='close-modal'){const callback=modal?.onLeave;modal=null;renderModal();callback?.(false)}



    else if(action==='discard-leave'){const next=modal.next,callback=modal.onLeave;if(editorDirty.value)finishEditorLeave(false);proposal=null;formDirty=false;modal=null;if(callback){renderModal();callback()}else navigate(next)}



    else if(action==='help-context'){modal={kind:'help',subject:target.dataset.subject||title(),helpText:target.dataset.helpText};renderModal()}



    else if(action==='refresh')refresh(true);



    else if(action==='rescan'){notice('Rescan requires the management backend. No live inspection occurred.');log('Warning','Requested rescan could not run: management backend unavailable.')}



    else if(action==='delete-review'){modal={kind:'delete',items:[...checked],scope:page};renderModal()}



    else if(action==='stage-delete'){if(modal.scope==='sources'&&sourceManagementUnavailable()){notice('Registered source management is unavailable. Refresh before removing a source.');return;}if(modal.scope==='sources'&&sourceManagementReady()){try{for(const target of modal.items)stage(sourceConfigurationDraft({id:crypto.randomUUID(),operation:'Delete',sourceId:target.replace(/^source:/,''),settings:null,context:observations.sourceManagement}));}catch(error){notice(error.message);return;}}else stage({kind:'delete',name:modal.scope,zone:modal.scope,items:[...modal.items]});modal=null;checked.clear();render();notice('Delete draft staged; resources remain unchanged.')}



    else if(action==='review-draft'){const ids=target.dataset.id?[target.dataset.id]:[...checked],items=drafts.filter(d=>ids.includes(d.id));if(items.some(item=>item.sourceChange)){if(!sourceManagementReady()||items.some(item=>!item.sourceChange)){notice('Review source configuration separately from DNS record and navigation changes.');return;}modal={kind:'source-draft',items,selected:JSON.stringify(items),catalog:structuredClone(observations.sourceManagement.catalog),operationId:null,receipt:null,confirmed:false,writing:false,error:''};}else modal={kind:'draft',items};renderModal()}
    else if(action==='prepare-source-review')await sourceReviewAction('prepare');
    else if(action==='apply-source-review')await sourceReviewAction('apply');
    else if(action==='source-review-status')await sourceReviewAction('status');
    else if(action==='source-review-reconcile')await sourceReviewAction('reconcile');
    else if(action==='source-process-status'||action==='source-process-reconcile'){target.disabled=true;try{const original=observations.processes?.find(item=>item.id===target.dataset.id&&item.kind==='Source');const receipt=await options.sourceAction({action:action==='source-process-status'?'status':'reconcile',id:target.dataset.id});const latest=await options.readObservations();if(lifecycle.signal.aborted)return;if(receipt.status==='Applied'){finishSourceDrafts(receipt,original?.changes||[]);await persist();if(lifecycle.signal.aborted)return;}acceptSourceObservations(latest);render();notice('Original source operation: '+receipt.status);}catch(error){if(!lifecycle.signal.aborted)notice(error.message);}finally{target.disabled=false;}}
    else if(action==='source-process-continue'){const process=observations.processes?.find(item=>item.id===target.dataset.id&&item.kind==='Source'),items=drafts.filter(draft=>process?.draftIds.includes(draft.id));if(!sourceManagementReady()||process?.status!=='Prepared'||!items.length||items.length!==process.draftIds.length||JSON.stringify(items.map(item=>item.sourceChange))!==JSON.stringify(process.changes)){notice('Read the original source status and review its unchanged saved proposals before continuing.');return;}modal={kind:'source-draft',items,selected:JSON.stringify(items),catalog:structuredClone(observations.sourceManagement.catalog),operationId:process.id,receipt:{status:'Prepared'},confirmed:false,writing:false,error:''};renderModal();}



    else if(action==='apply-dns-draft'){if(!modal||modal.writing||!modal.confirmed||!applyGate?.checkNow()||!applyGate.snapshotId())return;const review=modal;review.writing=true;target.disabled=true;root.querySelector('[data-action="close-modal"]').disabled=true;try{const fresh=await options.readObservations();if(JSON.stringify(captureDNS(fresh))!==JSON.stringify(review.capture))throw new Error('DNS configuration changed during review. Refresh and create a new snapshot.');const selected=drafts.filter(d=>review.items.some(i=>i.id===d.id));if(JSON.stringify(selected)!==review.reviewed)throw new Error('Selected drafts changed during review.');const receipt=await options.applyChanges({changes:review.items,snapshotId:applyGate.snapshotId()});drafts=drafts.filter(d=>!review.items.some(i=>i.id===d.id));const next=await options.readObservations();observations=next;zones.splice(0,zones.length,...structuredClone(next.zones));for(const key of Object.keys(records))delete records[key];Object.assign(records,structuredClone(next.records));source=structuredClone(next.source);order=[...(observations.navigation?.order||order).filter(id=>zoneById(id)),...zones.filter(z=>!(observations.navigation?.order||order).includes(z.id)).map(z=>z.id)];applyGate.unmount();applyGate=undefined;modal=null;checked.clear();persist();render();notice(receipt.kind==='Navigation'?'Zone navigation saved and read back.':'Windows DNS applied and read back '+receipt.receipts.length+' DNS changes.'+(receipt.replicationVerified?' All three replicas verified.':''));}catch(e){root.querySelector('#dm-apply-error').textContent=e.message;review.writing=false;root.querySelector('[data-action="close-modal"]').disabled=false;target.disabled=false;}}

    else if(action==='discard-draft'){drafts=drafts.filter(d=>!checked.has(d.id));checked.clear();persist();render();notice('Selected unapplied drafts discarded.')}



    else if(action==='edit-record'){const record=records[target.dataset.zone].find(r=>recordIdentity(r)===target.dataset.record);navigate('record:'+target.dataset.zone);root._editingRecord=record;render()}



    else if(action==='select-all'){checked=target.checked?new Set(selectionIds()):new Set();render()}



    else if(action==='test-connection'){

      if(sourceTestPending)return;const form=root.querySelector('#dm-editor');if(!form?.reportValidity())return;

      const formValues=Object.fromEntries(new FormData(form)),data=Object.fromEntries(['name','type','host','address','credential'].map(key=>[key,key==='type'?'Windows Domain Controller':formValues[key]])),fingerprint=JSON.stringify(formValues),revision=sourceTestRevision,started=Date.now();sourceTestPending=true;testResult=null;

      for(const button of root.querySelectorAll('[data-action="test-connection"]'))button.disabled=true;root.querySelector('#dm-test-result').textContent='Testing entered source…';

      const stillCurrent=()=>!lifecycle.signal.aborted&&root.querySelector('#dm-editor')?.dataset.kind==='source'&&revision===sourceTestRevision&&JSON.stringify(Object.fromEntries(new FormData(root.querySelector('#dm-editor'))))===fingerprint;

      try{

        if(!options.testSourceConnection)throw new Error('Read-only source connection testing is unavailable.');

        const result=await options.testSourceConnection(data,{signal:AbortSignal.any([lifecycle.signal,AbortSignal.timeout(20000)])});

        if(!stillCurrent()){if(!lifecycle.signal.aborted&&root.querySelector('#dm-test-result'))root.querySelector('#dm-test-result').textContent='Settings changed · In-flight test result ignored. Test the entered settings again.';return;}

        validateDnsSourceTestResult(result,data,{after:started});

        const check=result.checks;const verified=check.dnsQuery?.status==='Verified'&&check.zoneTransfer?.status==='Verified'&&['ObservedBindingVerified','RegisteredBindingVerified'].includes(check.windowsManagement?.status);

        if(result.verified!==verified)throw new Error('Source test verification is inconsistent.');

        testResult={at:result.completedAt,...data,verified};const value=c=>c?.status==='Verified'?'Verified':c?.status==='ObservedBindingVerified'?'Installed binding verified':c?.status==='RegisteredBindingVerified'?'Registered binding verified':c?.status==='ChangedDuringTest'?'Changed during test':'Not verified';

        root.querySelector('#dm-test-result').innerHTML='<div class="rcui-banner '+(verified?'success':'warning')+' dm-source-test-result" role="status"><strong>Entered Source Test</strong><span>'+escape(data.host)+' / '+escape(data.address)+'</span><span>DNS query (UDP): '+value(check.dnsQuery)+' · '+escape(check.dnsQuery?.zone||'')+'</span><span>Complete zone transfer (TCP): '+value(check.zoneTransfer)+(check.zoneTransfer?.status==='Verified'?' · '+escape(check.zoneTransfer.records)+' record responses':'')+'</span><span>Windows management: '+value(check.windowsManagement)+'</span><span>Management evidence uses the installed bridge binding; write permission is checked separately at Apply.</span><span>No source configuration or DNS records were changed.</span></div>';

        notice('Read-only testing completed for the entered source.');

      }catch(error){if(stillCurrent()){testResult={at:new Date().toISOString(),...data,verified:false};root.querySelector('#dm-test-result').innerHTML='<div class="rcui-banner error dm-source-test-result" role="alert">Not Verified<span>Entered endpoint: '+escape(data.host)+' / '+escape(data.address)+'</span><span>'+escape(error.message)+'</span></div>';notice('Connection verification failed; entered settings were preserved.');}}

      finally{sourceTestPending=false;for(const button of root.querySelectorAll('[data-action="test-connection"]'))button.disabled=false;}

    }



  });



  listen(root,'change',event=>{const target=event.target;if(target.dataset.action==='confirm-source-apply'){modal.confirmed=target.checked;const apply=root.querySelector('[data-action=apply-source-review]');if(apply)apply.disabled=!target.checked||modal.receipt?.status!=='Prepared'||modal.writing;return;}if(target.name==='bindingId'&&sourceManagementReady()){const binding=observations.sourceManagement.registry.bindings.find(item=>item.id===target.value),form=root.querySelector('#dm-editor');if(binding&&form){for(const key of ['host','address','credential'])form.elements[key].value=binding[key];invalidateTest();}return;}if(target.dataset.action==='confirm-dns-apply'){modal.confirmed=target.checked;root.querySelector('[data-action="apply-dns-draft"]').disabled=!target.checked||!applyGate?.checkNow()||!applyGate.snapshotId();return;}if(target.dataset.namespaceOption){const value=target.dataset.namespaceOption;namespaceContext.set(value==='all'?[]:target.checked?[...namespaceContext.filters,value]:namespaceContext.filters.filter(v=>v!==value));root.querySelector('#dm-global-namespaces details')?.setAttribute('open','');return}if(target.dataset.select){target.checked?checked.add(target.dataset.select):checked.delete(target.dataset.select);actions();initIcons();const all=root.querySelector('[data-action="select-all"]');if(all){const ids=selectionIds();all.checked=ids.length>0&&ids.every(id=>checked.has(id));all.indeterminate=ids.some(id=>checked.has(id))&&!all.checked}}



    if(target.id==='dm-log-source'){logSource=target.value;render()}if(target.id==='dm-lookback'){const value=Number(target.value);if(value>=0.25&&value<=168){lookback=value;render()}else notice('Lookback must be between 0.25 and 168 hours.')}if(target.id==='dm-filter'||target.id==='dm-namespace'){if(target.id==='dm-filter')filter=target.value;else namespace=target.value;checked.clear();render()}



    if(target.id==='dm-refresh-interval'){refreshSeconds=Number(target.value);deadline=Date.now()+refreshSeconds*1000;persist();updateCountdown()}



    if(target.closest('#dm-editor'))invalidateTest();



  });



  function invalidateTest(){formDirty=true;sourceTestRevision++;if(testResult||sourceTestPending){testResult=null;const output=root.querySelector('#dm-test-result');if(output)output.textContent=sourceTestPending?'Settings changed · In-flight test result will be ignored.':'Settings changed · Test result invalidated.';}}



  listen(root,'input',event=>{if(event.target.hasAttribute('data-namespace-search')){const query=event.target.value.toLowerCase();for(const label of event.target.closest('.dm-namespace-options').querySelectorAll('label'))label.hidden=!label.textContent.toLowerCase().includes(query)}else if(event.target.id==='dm-search'){const start=event.target.selectionStart;search=event.target.value;checked.clear();render();const input=root.querySelector('#dm-search');input.focus();input.setSelectionRange(start,start)}else if(event.target.closest('#dm-editor'))invalidateTest();else if(event.target.closest('#dm-settings'))formDirty=true});



  listen(root,'submit',event=>{event.preventDefault();const form=event.target;if(!form.reportValidity())return;const data=Object.fromEntries(new FormData(form));if(form.dataset.kind==='record'&&root._editingRecord){data.type=root._editingRecord.type;data.targetId=recordIdentity(root._editingRecord)}



    if(form.id==='dm-settings'){if(data.rancherUrl){let url;try{url=new URL(data.rancherUrl)}catch{notice('Enter a valid Rancher URL.');return}if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash){notice('Use an HTTP/HTTPS origin without credentials, paths, or query parameters.');return}ui.rancherUrl=url.origin}else ui.rancherUrl='';for(const key of Object.keys(ui.banners))ui.banners[key]=form.elements[key].checked;formDirty=false;persist();render();notice('Local settings saved. No rollout was created.');return}



    if(form.id!=='dm-editor')return;
    if(form.dataset.kind==='source'&&sourceManagementUnavailable()){notice(observations.sourceManagement?.error||'Registered source management is unavailable. Refresh before saving a source proposal.');return;}
    if(form.dataset.kind==='source'&&sourceManagementReady()){try{const draft=sourceDraftFromForm(form,observations.sourceManagement,crypto.randomUUID());stage(draft);}catch(error){notice(error.message);return;}}
    else stage({kind:form.dataset.kind,zone:form.dataset.zone||null,...data,...(form.dataset.kind==='record'&&root._editingRecord?{type:root._editingRecord.type,targetId:recordIdentity(root._editingRecord)}:{})});formDirty=false;root._editingRecord=null;navigate('pending');notice('Working draft saved in Pending Rollouts. No live DNS configuration changed.');



  });



  listen(root,'dragstart',event=>{const row=event.target.closest('tr[data-drag]');if(!row||!proposal)return;dragId=row.dataset.drag;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',dragId);row.classList.add('dragging')});



  listen(root,'dragover',event=>{const row=event.target.closest('.dm-rank-row');if(!proposal||!row)return;event.preventDefault();root.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));row.classList.add('drop-target')});



  listen(root,'drop',event=>{const row=event.target.closest('.dm-rank-row');if(!proposal||!row)return;event.preventDefault();const id=dragId||event.dataTransfer.getData('text/plain');if(proposal.includes(id))move(id,proposal.indexOf(row.dataset.id));dragId=null});



  listen(root,'dragend',()=>{dragId=null;root.querySelectorAll('.drop-target,.dragging').forEach(el=>el.classList.remove('drop-target','dragging'))});



  listen(root,'keydown',event=>{if(modal){if(event.key==='Escape'){modal=null;renderModal();event.preventDefault()}else if(event.key==='Tab'){const buttons=[...root.querySelectorAll('.dm-dialog button:not(:disabled)')];if(!buttons.length)return;const index=buttons.indexOf(document.activeElement);if(event.shiftKey&&index<=0){buttons.at(-1).focus();event.preventDefault()}else if(!event.shiftKey&&index===buttons.length-1){buttons[0].focus();event.preventDefault()}}return}const handle=event.target.closest('button[data-drag]');if(handle&&proposal&&(event.key==='ArrowUp'||event.key==='ArrowDown')){event.preventDefault();move(handle.dataset.drag,proposal.indexOf(handle.dataset.drag)+(event.key==='ArrowUp'?-1:1))}});



  listen(window,'beforeunload',event=>{if(formDirty||dirty()){event.preventDefault();event.returnValue=''}});



  if(!options.readObservations&&!logs.some(l=>l.id==='backend-unavailable'&&Date.now()-new Date(l.at).getTime()>=0&&Date.now()-new Date(l.at).getTime()<86400000)){logs.push({id:'backend-unavailable',at:new Date().toISOString(),severity:'Error',component:'Browser UI',message:'Live management backend unavailable. DNS query serving status is unverified separately.'});persist()}



  mounted=true;render();void refreshSnapshots().then(()=>{snapshotReadState='ready';updateSnapshotCount();return updateDNSCoverage();}).catch(()=>{snapshotReadState='failed';coverageStatus={tone:'error',label:'Snapshot Storage Unavailable',covered:0,total:0};if(!lifecycle.signal.aborted){updateSnapshotCount();status();}});



  if(options.readObservations)requestOverlay.read(options.readObservations,'Loading DNS observations');



  return { navigate, async requestRouteLeave(next){if(dirty()||formDirty||editorDirty.value){modal={kind:'leave',onLeave:next};renderModal()}else if(await persistenceTail)next()}, destroy() { actionGeometry.disconnect();stopSnapshotCounts();snapshotUnmount?.();applyGate?.unmount();namespaceContext.destroy();requestOverlay.destroy();clearInterval(timer);lifecycle.abort(); } };



}
