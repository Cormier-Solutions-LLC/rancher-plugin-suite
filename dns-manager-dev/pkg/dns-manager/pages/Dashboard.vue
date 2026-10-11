<script setup>
import { onMounted, onBeforeUnmount, watch, ref, getCurrentInstance } from 'vue';
import { mountDnsManager } from '../ui/dns-manager.js';
import { routeFor } from '../navigation.js';
const props = defineProps({
  previewShell: { type: Boolean, default: false },
  clusterName: { type: String, default: 'kubcontroller' },
  section: { type: String, default: 'overview' },
  readObservations: { type: Function, default: undefined },
  previewStorage: { type: Object, default: undefined },
  dataSource: { type: Object, default: undefined }
});
const emit = defineEmits(['navigate']);
defineOptions({ beforeRouteLeave(to, from, next) { const guard=this.$.exposed?.requestRouteLeave; guard ? guard(next) : next(); } });
let controller;
defineExpose({ requestRouteLeave: next => controller ? controller.requestRouteLeave(next) : next() });
const hostStore = getCurrentInstance()?.proxy?.$store;
const hostRouter = getCurrentInstance()?.proxy?.$router;
const managerRoot = ref(null);
onMounted(async () => {
  const document = props.dataSource && (props.dataSource.document || await props.dataSource.reload());
  controller = mountDnsManager(managerRoot.value, {
    section: props.section,
    preview: props.previewShell,
    dataSourceKind: props.dataSource?.kind,
    rancherOrigin: props.previewShell ? undefined : window.location.origin,
    inventory: document?.data.inventory,
    storage: props.dataSource ? { load: () => props.dataSource.loadState(), save: state => props.dataSource.saveState(state) } : props.previewShell ? props.previewStorage : undefined,
    clusterName: props.clusterName,
    readObservations: props.readObservations,
    store: hostStore,
    onNavigate: next => {
      emit('navigate', next);
      if (!props.previewShell && hostRouter) hostRouter.push(routeFor(next,props.clusterName));
    }
  });
});
watch(() => props.section, next => controller?.navigate(next));
onBeforeUnmount(() => controller?.destroy());
</script>

<template>
<div id="dns-manager-interface" ref="managerRoot" :class="{ 'dm-standalone': previewShell }" aria-label="DNS Manager interface preview">
  <header v-if="previewShell" class="dm-top"><span class="dm-brand"><i data-lucide="network" aria-hidden="true"></i> Rancher</span><span class="dm-cluster">Cluster: {{ clusterName }}</span><span id="dm-global-namespaces" aria-label="Global namespace filter"></span><span class="dm-preview">Design Preview · Sample Data</span></header>
  <div class="dm-shell" :class="{ 'dm-native-shell': !previewShell }">
    <aside v-if="previewShell" class="dm-sidebar"><div class="dm-explorer">CLUSTER EXPLORER</div><div class="dm-context">kubcontroller <span>10.99.15.50</span></div><div class="dm-native"><i data-lucide="layers" aria-hidden="true"></i> Workloads</div><div class="dm-native"><i data-lucide="shield-check" aria-hidden="true"></i> Compliance</div><div class="dm-native"><i data-lucide="route" aria-hidden="true"></i> Network Manager</div><button class="dm-group cursor-interaction" data-action="nav" data-page="overview"><i data-lucide="globe" aria-hidden="true"></i> DNS Manager <i data-lucide="chevron-down" aria-hidden="true"></i></button><nav id="dm-navigation" aria-label="DNS Manager pages"></nav><div class="dm-sidebar-foot">DNS Manager<br><span>Technitium · 3 planned instances</span></div></aside>
    <main class="dm-main"><div class="dm-breadcrumb"><button class="dm-link" data-action="nav" data-page="overview">DNS Manager</button> / <span id="dm-crumb">Overview</span></div><div class="dm-heading"><div><div class="dm-title-row"><h1 id="dm-title">Overview</h1><button class="dm-inline-help" data-action="help-context" aria-label="Page help"><i data-lucide="circle-help" aria-hidden="true"></i></button></div><p id="dm-subtitle">DNS service, source replication, and lookup policy.</p></div><div class="dm-actions"><div id="dm-snapshot-actions"></div><div id="dm-actions" class="dm-actions"></div></div></div><div id="dm-status"></div><div id="dm-content" class="dm-content"></div><div id="dm-notice" class="dm-notice" aria-live="polite"></div></main>
  </div><div id="dm-modal"></div><div id="dm-request-state"></div>
</div>
</template>

<style>
#dns-manager-interface{--dm-bg:light-dark(#f5f7fa,#101820);--dm-panel:light-dark(#fff,#19232e);--dm-side:light-dark(#edf1f5,#131d27);--dm-text:light-dark(#243244,#e4ebf2);--dm-muted:light-dark(#536579,#a9b8c8);--dm-line:light-dark(#d5dfe8,#344354);--dm-blue:light-dark(#086cab,#59b2ed);--dm-selected:light-dark(#d8edfa,#203e54);--dm-green:light-dark(#167345,#79d4a0);--dm-amber:light-dark(#885b05,#f4cb71);--dm-red:light-dark(#ad3232,#f09696);--dm-row-height:46px;color-scheme:inherit;background:var(--dm-bg);color:var(--dm-text);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;border:1px solid var(--dm-line);border-radius:6px;position:relative;overflow-wrap:anywhere}
#dns-manager-interface *{box-sizing:border-box}
#dns-manager-interface [hidden]{display:none!important}
#dns-manager-interface button,#dns-manager-interface input,#dns-manager-interface select{font:inherit}
#dns-manager-interface button{color:inherit}
#dns-manager-interface button:disabled{opacity:.5}
#dns-manager-interface .dm-top{display:flex;align-items:center;gap:24px;padding:15px 24px;padding-right:96px;background:var(--dm-panel);border-bottom:1px solid var(--dm-line);flex-wrap:wrap}
#dns-manager-interface .dm-brand{font-size:20px;font-weight:600;display:flex;align-items:center;gap:10px}
#dns-manager-interface .dm-cluster{color:var(--dm-muted);font-size:13px}
#dns-manager-interface .dm-preview{margin-left:auto;color:var(--dm-amber);font-size:12px}
#dns-manager-interface .dm-shell{display:grid;grid-template-columns:228px minmax(0,1fr);min-height:650px}
#dns-manager-interface .dm-sidebar{background:var(--dm-side);border-right:1px solid var(--dm-line);padding:20px 12px;display:flex;flex-direction:column;gap:5px;min-width:0}
#dns-manager-interface .dm-explorer{color:var(--dm-muted);font-size:11px;letter-spacing:1px;padding:0 10px}
#dns-manager-interface .dm-context{padding:6px 10px 22px;font-weight:600}
#dns-manager-interface .dm-context span{display:block;font-size:12px;color:var(--dm-muted);font-weight:400}
#dns-manager-interface .dm-native{display:flex;gap:10px;align-items:center;padding:9px 10px;color:var(--dm-muted)}
#dns-manager-interface .dm-group{display:flex;align-items:center;gap:9px;text-align:left;background:none;border:0;padding:10px;width:100%;font-weight:600;margin-top:10px}
#dns-manager-interface .dm-group i:last-child,#dns-manager-interface .dm-group svg:last-child{margin-left:auto}
#dns-manager-interface .dm-nav{display:flex;align-items:center;gap:8px;width:100%;background:transparent;border:0;border-radius:4px;text-align:left;padding:9px 10px 9px 30px;margin:2px 0;font-size:13px}
#dns-manager-interface .dm-nav[aria-current=page]{background:var(--dm-selected);color:var(--dm-blue)}
#dns-manager-interface .dm-nav:hover,#dns-manager-interface .dm-button:hover:not(:disabled){background:var(--dm-selected)}
#dns-manager-interface .dm-count{margin-left:auto;color:var(--dm-muted);font-size:12px;white-space:nowrap}
#dns-manager-interface .dm-zone-nav{padding-left:30px;font-size:12px;overflow-wrap:anywhere}
#dns-manager-interface .dm-sidebar-foot{margin-top:auto;padding:30px 10px 0;color:var(--dm-muted);font-size:12px}
#dns-manager-interface .dm-sidebar-foot span{font-size:11px}
#dns-manager-interface .dm-main{padding:24px;min-width:0}
#dns-manager-interface .dm-breadcrumb{font-size:12px;color:var(--dm-muted);margin-bottom:13px}
#dns-manager-interface .dm-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:22px}
#dns-manager-interface h1{font-size:27px;line-height:1.2;margin:0 0 6px;font-weight:500}
#dns-manager-interface h2{font-size:16px;font-weight:500;margin:0 0 14px}
#dns-manager-interface h3{font-size:14px;font-weight:500;margin:0 0 8px}
#dns-manager-interface p{margin:0;color:var(--dm-muted);font-size:12px}
#dns-manager-interface .dm-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#dns-manager-interface .dm-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;background:var(--dm-panel);border:1px solid var(--dm-line);border-radius:4px;padding:9px 12px;min-height:40px;white-space:nowrap}
#dns-manager-interface .dm-primary{background:var(--dm-blue);color:light-dark(#fff,#0b1823);border-color:var(--dm-blue)}
#dns-manager-interface .dm-danger{color:var(--dm-red)}
#dns-manager-interface .dm-icon-button{padding:7px;min-height:32px;border:0;background:transparent;display:inline-flex;align-items:center;justify-content:center;border-radius:4px}
#dns-manager-interface .dm-help{font-size:12px}
#dns-manager-interface i,#dns-manager-interface svg{width:16px;height:16px;flex-shrink:0}
#dns-manager-interface .dm-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:22px}
#dns-manager-interface .dm-metric{background:var(--dm-panel);border:1px solid var(--dm-line);border-radius:5px;padding:15px;text-align:left;display:block;min-width:0}
#dns-manager-interface .dm-metric strong{display:block;font-size:29px;font-weight:500;margin:4px 0;color:var(--dm-text)}
#dns-manager-interface .dm-label{color:var(--dm-muted);font-size:12px}
#dns-manager-interface .dm-panel{background:var(--dm-panel);border:1px solid var(--dm-line);border-radius:5px;padding:18px;margin-bottom:16px}
#dns-manager-interface .dm-warning{color:var(--dm-amber);border-left:3px solid var(--dm-amber);padding:10px 13px;background:light-dark(#fff2cc,#493a23);margin-bottom:18px;font-size:13px}
#dns-manager-interface .dm-warning span{display:block;color:inherit;font-size:12px;margin-top:3px}
#dns-manager-interface .dm-badge{font-size:11px;color:var(--dm-green);white-space:nowrap;border:1px solid var(--dm-line);border-radius:4px;padding:3px 6px;display:inline-flex;align-items:center;gap:5px;background:var(--dm-panel)}
#dns-manager-interface .dm-pending{color:var(--dm-amber)}
#dns-manager-interface .dm-flow{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:13px}
#dns-manager-interface .dm-flow-item{flex:1;min-width:110px}
#dns-manager-interface .dm-flow-item strong{display:block;font-weight:500}
#dns-manager-interface .dm-flow-item small{color:var(--dm-muted);font-size:12px;display:block}
#dns-manager-interface .dm-detail-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}
#dns-manager-interface .dm-detail-list strong{display:block;font-weight:500;font-size:13px}
#dns-manager-interface .dm-status-table{margin-top:16px}
#dns-manager-interface .dm-table-wrap{overflow-x:auto;max-width:100%}
#dns-manager-interface table{width:100%;border-collapse:collapse;font-size:12px;min-width:430px}
#dns-manager-interface th{font-weight:500;text-align:left;color:var(--dm-muted);padding:10px 8px;border-bottom:1px solid var(--dm-line);white-space:nowrap}
#dns-manager-interface td{padding:10px 8px;border-bottom:1px solid var(--dm-line);height:var(--dm-row-height);vertical-align:middle}
#dns-manager-interface tbody tr:hover{background:var(--dm-selected)}
#dns-manager-interface td small{display:block;color:var(--dm-muted);font-size:11px}
#dns-manager-interface td:first-child{width:34px}
#dns-manager-interface .dm-row-actions{text-align:right;white-space:nowrap}
#dns-manager-interface .dm-link{color:var(--dm-blue);background:transparent;border:0;text-align:left;padding:0;overflow-wrap:anywhere}
#dns-manager-interface .dm-toolbar{display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap}
#dns-manager-interface .dm-input,#dns-manager-interface .dm-select{background:var(--dm-panel);color:var(--dm-text);border:1px solid var(--dm-line);border-radius:4px;padding:9px 10px;min-height:40px;max-width:100%;min-width:0}
#dns-manager-interface .dm-search{flex:1;min-width:140px}
#dns-manager-interface .dm-refresh{margin-left:auto;color:var(--dm-muted);font-size:11px;display:flex;align-items:center;gap:8px}
#dns-manager-interface .dm-refresh select{font-size:12px;padding:5px;min-height:32px}
#dns-manager-interface .dm-notice{color:var(--dm-blue);font-size:12px;margin-top:12px;min-height:20px}
#dns-manager-interface .dm-rank-handle{cursor:grab;border:0;background:none;padding:5px;color:var(--dm-muted)}
#dns-manager-interface .dm-rank-row.drop-target{outline:2px solid var(--dm-blue);outline-offset:-2px}
#dns-manager-interface .dm-rank-row.dragging{opacity:.5}
#dns-manager-interface .dm-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
#dns-manager-interface .dm-form label{font-size:12px;color:var(--dm-muted);display:flex;flex-direction:column;gap:5px}
#dns-manager-interface .dm-form .dm-wide{grid-column:1/-1}
#dns-manager-interface .dm-form-actions{display:flex;gap:9px;justify-content:flex-end;margin-top:20px}
#dns-manager-interface details{padding:12px 0;border-top:1px solid var(--dm-line)}
#dns-manager-interface summary{font-size:13px;font-weight:500}
#dns-manager-interface details .dm-detail-list{margin-top:13px}
#dns-manager-interface .dm-policy{margin:0;padding-left:22px;color:var(--dm-muted);font-size:12px}
#dns-manager-interface .dm-policy li{margin:6px 0}
#dns-manager-interface .dm-overlay{position:absolute;inset:0;background:light-dark(#24324480,#0009);display:flex;align-items:flex-start;justify-content:center;padding:90px 18px 20px;z-index:20}
#dns-manager-interface .dm-dialog{background:var(--dm-panel);border:1px solid var(--dm-line);border-radius:6px;padding:24px;width:560px;max-width:100%;box-shadow:0 15px 45px #0004}
#dns-manager-interface .dm-dialog p{font-size:13px;margin-bottom:16px}
#dns-manager-interface .dm-orders{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;font-size:12px;margin-bottom:18px}
#dns-manager-interface .dm-orders ol{padding-left:18px;margin:0}
#dns-manager-interface .dm-dialog button{white-space:normal}
#dns-manager-interface .dm-empty{text-align:center;color:var(--dm-muted);padding:32px}
@media(max-width:800px){#dns-manager-interface .dm-shell{grid-template-columns:180px minmax(0,1fr)}#dns-manager-interface .dm-main{padding:18px}#dns-manager-interface .dm-top{gap:12px}#dns-manager-interface .dm-preview{margin-left:0}#dns-manager-interface .dm-metrics{gap:8px}#dns-manager-interface .dm-metric{padding:12px}}
@media(max-width:580px){#dns-manager-interface .dm-shell{grid-template-columns:1fr;min-height:0}#dns-manager-interface .dm-sidebar{border-right:0;border-bottom:1px solid var(--dm-line);padding:12px}#dns-manager-interface .dm-native,#dns-manager-interface .dm-explorer,#dns-manager-interface .dm-context,#dns-manager-interface .dm-sidebar-foot{display:none}#dns-manager-interface #dm-navigation{display:flex;flex-wrap:wrap;gap:4px}#dns-manager-interface .dm-nav{width:auto;padding:8px 10px;margin:0;max-width:100%}#dns-manager-interface .dm-count{margin-left:8px}#dns-manager-interface .dm-group{margin:0}#dns-manager-interface .dm-top{padding:12px;padding-right:94px}#dns-manager-interface .dm-cluster{display:none}#dns-manager-interface .dm-main{padding:15px}#dns-manager-interface .dm-metrics{grid-template-columns:1fr}#dns-manager-interface .dm-metric strong{display:inline;font-size:22px;margin-right:10px}#dns-manager-interface .dm-metric .dm-label{display:inline}#dns-manager-interface .dm-detail-list,#dns-manager-interface .dm-form,#dns-manager-interface .dm-orders{grid-template-columns:1fr}#dns-manager-interface .dm-form .dm-wide{grid-column:auto}#dns-manager-interface .dm-refresh{margin-left:0}#dns-manager-interface .dm-overlay{padding-top:100px}}
@media(pointer:coarse){#dns-manager-interface button,#dns-manager-interface .dm-icon-button{min-height:44px;min-width:44px}#dns-manager-interface input,#dns-manager-interface select{font-size:16px}}
#dns-manager-interface .dm-native-shell{grid-template-columns:minmax(0,1fr)}

/* The host supplies the native viewport; standalone mode owns its browser viewport. */
#dns-manager-interface{height:100%;max-height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;--dm-bg:light-dark(#f5f7fa,#1c242e);--dm-panel:light-dark(#fff,#232c37);--dm-side:light-dark(#edf1f5,#242c36)}
#dns-manager-interface.dm-standalone{height:100dvh;max-height:100dvh;border:0;border-radius:0}
#dns-manager-interface .dm-top{flex:0 0 auto;padding:10px 20px}
#dns-manager-interface .dm-shell{flex:1;min-height:0;overflow:hidden}
#dns-manager-interface .dm-sidebar{min-height:0;overflow:auto;scrollbar-gutter:stable}
#dns-manager-interface .dm-main{display:flex;flex-direction:column;min-height:0;overflow:hidden;padding:20px 24px}
#dns-manager-interface .dm-heading{align-items:center;flex-shrink:0;margin-bottom:16px}
#dns-manager-interface .dm-title-row{display:flex;align-items:center;gap:6px}
#dns-manager-interface .dm-title-row h1{margin-bottom:0}
#dns-manager-interface .dm-content{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;overflow:hidden;gap:12px}
#dns-manager-interface .dm-page-scroll,#dns-manager-interface .dm-inventory{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable}
#dns-manager-interface .dm-editor-scroll{overflow:auto}
#dns-manager-interface .dm-editor-scroll>.dm-panel{flex:0 0 auto}
#dns-manager-interface .dm-inventory{background:var(--dm-panel);border:1px solid var(--dm-line);border-radius:5px;padding:0 12px}
#dns-manager-interface .dm-inventory thead{position:sticky;top:0;background:var(--dm-panel);z-index:1}
#dns-manager-interface .dm-toolbar{flex-shrink:0;margin:0;align-items:flex-end}
#dns-manager-interface .dm-toolbar>label{display:flex;flex-direction:column;gap:5px;color:var(--dm-muted);font-size:12px}
#dns-manager-interface .dm-search-label{flex:1;min-width:140px}
#dns-manager-interface .dm-metrics{flex-shrink:0;margin-bottom:0}
#dns-manager-interface .dm-compact{flex-shrink:0;margin:0;padding:12px 18px}
#dns-manager-interface .dm-warning{margin-bottom:8px}
#dns-manager-interface .dm-banner{font-size:12px;color:var(--dm-muted);padding:5px 10px;border-left:2px solid var(--dm-line);margin-bottom:8px}
#dns-manager-interface .dm-error-banner{background:light-dark(#ffe8e8,#4c282e);color:var(--dm-red);border-left-color:var(--dm-red);padding:10px 13px}
#dns-manager-interface .dm-refresh{margin-left:0;gap:8px;font-size:12px}
#dns-manager-interface .dm-refresh label{display:flex;align-items:center;gap:6px}
#dns-manager-interface .dm-refresh select{min-height:32px;padding:5px 8px}
#dns-manager-interface #dm-countdown{min-width:5ch;font-family:ui-monospace,Consolas,monospace;font-variant-numeric:tabular-nums;color:#a9d2ff}
#dns-manager-interface .dm-button{height:40px;min-height:40px;box-sizing:border-box;padding:10px 14px;line-height:20px;border-radius:5px;font-size:14px;flex-shrink:0}
#dns-manager-interface .dm-primary{background:#326fb4;color:white;border-color:#326fb4}
#dns-manager-interface .dm-danger{background:#69333c;color:white;border-color:#69333c}
#dns-manager-interface .dm-icon-button{width:30px;height:30px;min-height:30px;padding:6px;margin:0;color:#a9d2ff}
#dns-manager-interface .dm-inline-help{display:inline-flex;vertical-align:middle;align-items:center;justify-content:center;width:24px;height:24px;padding:3px;border:0;background:transparent;color:#a9d2ff;cursor:pointer}
#dns-manager-interface svg{width:18px;height:18px;stroke-width:1.8}
#dns-manager-interface .dm-count{display:inline-flex;justify-content:center;align-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:20px;background:#233950;color:#a9d2ff;font-size:12px;flex-shrink:0;margin-left:auto}
#dns-manager-interface .dm-count.warning{background:#493a23;color:#edbb69}
#dns-manager-interface .dm-count.error{background:#4c282e;color:#ffb3ad}
#dns-manager-interface .dm-count-loading{background:transparent;color:var(--dm-blue)}
#dns-manager-interface .dm-badge-spinner{display:inline-block;width:14px;height:14px;border:2px solid var(--dm-line);border-top-color:var(--dm-blue);border-radius:50%;animation:dm-spin .8s linear infinite}
#dns-manager-interface .dm-nav-divider{border-top:1px solid var(--dm-line);margin:8px 0}
#dns-manager-interface .dm-nav{text-transform:none;overflow-wrap:anywhere}
#dns-manager-interface input[type=checkbox]{width:16px;height:16px;min-height:0;flex-shrink:0;vertical-align:middle;cursor:pointer}
#dns-manager-interface .dm-check-label{display:flex;gap:8px;align-items:center;margin:12px 0}
#dns-manager-interface #dm-settings>label:first-child{display:flex;flex-direction:column;gap:6px;max-width:600px;margin-bottom:12px}
#dns-manager-interface #dm-settings h3,#dns-manager-interface .dm-page-scroll>h3{margin-top:22px}
#dns-manager-interface button:focus-visible,#dns-manager-interface a:focus-visible,#dns-manager-interface input:focus-visible,#dns-manager-interface select:focus-visible{outline:2px solid #73b5ff;outline-offset:2px}
#dns-manager-interface .dm-rank-row[draggable=true]{cursor:grab}
#dns-manager-interface .dm-overlay{position:absolute;inset:0;overflow:auto;padding:30px 18px;align-items:center}
#dns-manager-interface .dm-dialog{max-height:100%;overflow:auto}
#dns-manager-interface .dm-review{white-space:pre-wrap;overflow-wrap:anywhere;color:var(--dm-text);font-size:12px}
#dns-manager-interface .dm-resource-link{color:var(--dm-blue)}
#dns-manager-interface table{table-layout:auto;width:100%}
#dns-manager-interface th,#dns-manager-interface td,#dns-manager-interface td:first-child,#dns-manager-interface .dm-row-actions{text-align:left;width:auto}
#dns-manager-interface th.dm-numeric,#dns-manager-interface td.dm-numeric{text-align:right;font-variant-numeric:tabular-nums}
#dns-manager-interface th.dm-selection,#dns-manager-interface td.dm-selection{width:34px}
#dns-manager-interface .dm-nav-row{display:flex;align-items:center}
#dns-manager-interface .dm-nav-row>.dm-nav{flex:1;min-width:0}
#dns-manager-interface .dm-zone-toggle{width:28px;height:28px;flex-shrink:0;border:0;background:transparent;color:var(--dm-muted);cursor:pointer}
#dns-manager-interface .dm-zone-toggle[aria-expanded=false] svg{transform:rotate(-90deg)}
#dns-manager-interface #dm-zone-navigation .dm-nav{padding-left:42px;font-size:12px}
#dns-manager-interface .dm-help-section summary{font-size:16px;padding:8px 0}
#dns-manager-interface .dm-help-section dl{margin:16px 0}
#dns-manager-interface .dm-help-section dt{font-weight:600;font-size:13px;margin-top:12px}
#dns-manager-interface .dm-help-section dd{font-size:13px;color:var(--dm-muted);margin:4px 0 0}
#dns-manager-interface .dm-namespace-filter{position:relative;min-width:180px;color:var(--dm-muted);font-size:12px;flex-shrink:0}
#dns-manager-interface .dm-namespace-filter>span{display:block;margin-bottom:5px}
#dns-manager-interface .dm-namespace-filter details{padding:0;border:0;margin:0}
#dns-manager-interface .dm-namespace-filter summary{border:1px solid var(--dm-line);border-radius:4px;background:var(--dm-panel);padding:9px 10px;min-height:40px;cursor:pointer}
#dns-manager-interface .dm-namespace-options{position:absolute;z-index:10;background:var(--dm-panel);border:1px solid var(--dm-line);border-radius:4px;padding:10px;min-width:240px;max-height:240px;overflow:auto;box-shadow:0 8px 20px #0006}
#dns-manager-interface .dm-namespace-options label{display:flex;align-items:center;gap:8px;margin:8px 0}
#dns-manager-interface #dm-navigation .dm-nav{display:grid;grid-template-columns:26px minmax(0,1fr);gap:8px;padding:9px 10px;width:100%;align-items:start}
#dns-manager-interface #dm-navigation .dm-count,#dns-manager-interface #dm-navigation .dm-count-slot{width:26px;min-width:26px;margin-left:0;justify-self:start}
#dns-manager-interface #dm-navigation .dm-count-slot{height:20px}
#dns-manager-interface #dm-zone-navigation .dm-nav-label{padding-left:12px}
#dns-manager-interface .dm-nav-label{min-width:0;overflow-wrap:anywhere;align-self:center}
#dns-manager-interface .dm-nav-row{position:relative}
#dns-manager-interface .dm-nav-row>.dm-nav{padding-right:34px!important}
#dns-manager-interface .dm-zone-toggle{position:absolute;right:4px;top:6px}
#dns-manager-interface .dm-filter-row{display:grid;grid-template-columns:minmax(180px,1fr) 220px;column-gap:18px;row-gap:12px;align-items:end}
#dns-manager-interface .dm-filter-row:has(#dm-filter){grid-template-columns:minmax(180px,1fr) 220px 140px}
#dns-manager-interface .dm-diagnostics-filters:has(#dm-filter){grid-template-columns:minmax(180px,1fr) 220px 110px 190px 150px}
#dns-manager-interface .dm-filter-row>label,#dns-manager-interface .dm-filter-row>.dm-namespace-filter{min-width:0;width:100%;font-size:12px}
#dns-manager-interface .dm-filter-row .dm-input,#dns-manager-interface .dm-filter-row .dm-select,#dns-manager-interface .dm-filter-row summary{height:40px;min-height:40px;width:100%;box-sizing:border-box;margin:0;padding:9px 10px;background:light-dark(#fff,#1c2430);border:1px solid var(--dm-line);border-radius:5px;font-size:14px}
#dns-manager-interface .dm-filter-row .dm-namespace-filter>span,#dns-manager-interface .dm-filter-row>label{line-height:18px}
#dns-manager-interface .dm-filter-row .dm-namespace-filter>span{margin-bottom:5px}
@media(max-width:1250px){#dns-manager-interface .dm-diagnostics-filters:has(#dm-filter){grid-template-columns:repeat(4,minmax(0,1fr))}#dns-manager-interface .dm-diagnostics-filters .dm-search-label{grid-column:1/-1}}
@media(max-width:800px){#dns-manager-interface .dm-filter-row,#dns-manager-interface .dm-filter-row:has(#dm-filter),#dns-manager-interface .dm-diagnostics-filters:has(#dm-filter){grid-template-columns:repeat(2,minmax(0,1fr))}#dns-manager-interface .dm-filter-row .dm-search-label{grid-column:1/-1}}
@media(max-width:580px){#dns-manager-interface #dm-navigation{display:block}#dns-manager-interface #dm-navigation .dm-nav{font-size:11px;padding:7px 10px}}
#dns-manager-interface .dm-notice{flex-shrink:0;margin-top:8px}
#dns-manager-interface,#dns-manager-interface *{scrollbar-width:thin;scrollbar-color:#59697d var(--dm-panel)}
#dns-manager-interface *::-webkit-scrollbar{width:10px;height:10px}
#dns-manager-interface *::-webkit-scrollbar-track{background:var(--dm-panel)}
#dns-manager-interface *::-webkit-scrollbar-thumb{background:#59697d;border:2px solid var(--dm-panel);border-radius:8px}
#dns-manager-interface *::-webkit-scrollbar-thumb:hover{background:#7a8ba1}
@media(max-width:580px){#dns-manager-interface .dm-shell{grid-template-rows:auto minmax(0,1fr)}#dns-manager-interface .dm-sidebar{max-height:26dvh}#dns-manager-interface .dm-top{padding:8px 12px}#dns-manager-interface .dm-brand{font-size:15px}#dns-manager-interface .dm-main{padding:12px}#dns-manager-interface .dm-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}#dns-manager-interface .dm-metric .dm-label{display:block;font-size:10px}#dns-manager-interface .dm-metric strong{display:block}#dns-manager-interface .dm-metric{padding:8px}#dns-manager-interface .dm-actions{width:100%}#dns-manager-interface .dm-refresh{flex-wrap:wrap}#dns-manager-interface .dm-refresh select{max-width:120px}#dns-manager-interface .dm-nav{font-size:11px}#dns-manager-interface .dm-sidebar-foot{display:none}}
@media(forced-colors:active){#dns-manager-interface,#dns-manager-interface *{scrollbar-color:auto;scrollbar-width:auto}}
#dns-manager-interface .dm-loading-shade{position:absolute;inset:0;z-index:30;backdrop-filter:blur(5px);background:#10182070;display:flex;align-items:center;justify-content:center}
#dns-manager-interface .dm-loading-box{display:flex;align-items:center;flex-direction:column;gap:12px;padding:24px;background:var(--dm-panel);border:1px solid var(--dm-line);border-radius:6px;font-size:13px}
#dns-manager-interface .dm-spinner{width:36px;height:36px;border:3px solid var(--dm-line);border-top-color:var(--dm-blue);border-radius:50%;animation:dm-spin .8s linear infinite}
#dns-manager-interface .dm-request-failure{position:absolute;bottom:16px;left:24px;right:24px;z-index:25;padding:12px 16px;background:light-dark(#ffe8e8,#4c282e);color:var(--dm-red);border:1px solid var(--dm-red);border-radius:5px;font-size:13px}
@keyframes dm-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){#dns-manager-interface .dm-spinner{animation:none}}
@media(prefers-reduced-motion:reduce){#dns-manager-interface .dm-badge-spinner{animation:none}}

/* Embedded pages inherit Rancher's active theme. Preview fallbacks remain local. */
#dns-manager-interface:not(.dm-standalone){--dm-bg:var(--body-bg,light-dark(#f5f7fa,#1c242e));--dm-panel:var(--box-bg,light-dark(#fff,#232c37));--dm-text:var(--body-text,light-dark(#243244,#e4ebf2));--dm-muted:var(--muted,light-dark(#536579,#a9b8c8));--dm-line:var(--border,light-dark(#d5dfe8,#344354));--dm-blue:var(--link,light-dark(#086cab,#59b2ed));border:0;border-radius:0;font:inherit}
#dns-manager-interface:not(.dm-standalone) .dm-primary{background:var(--primary,#326fb4);border-color:var(--primary,#326fb4)}
#dns-manager-interface:not(.dm-standalone) .dm-input,#dns-manager-interface:not(.dm-standalone) .dm-select,#dns-manager-interface:not(.dm-standalone) .dm-namespace-filter summary{background:var(--input-bg,var(--dm-panel));color:var(--dm-text)}
#dns-manager-interface.dm-standalone{--dm-bg:#25282f;--dm-panel:#171c22;--dm-side:#25282f;--dm-text:snow;--dm-muted:#8f8f9c;--dm-line:#38404b;--dm-blue:#9bbffd;--dm-selected:#455068;font-family:Lato,arial,helvetica,sans-serif}
#dns-manager-interface.dm-standalone .dm-primary{background:#2f68df;border-color:#2f68df}
#dns-manager-interface #dm-global-namespaces{margin-left:auto;min-width:220px}
#dns-manager-interface #dm-global-namespaces .dm-namespace-filter>span{display:none}
#dns-manager-interface #dm-global-namespaces .dm-namespace-options{right:0}
#dns-manager-interface .dm-filter-row{grid-template-columns:minmax(180px,1fr)}
#dns-manager-interface .dm-filter-row:has(#dm-filter){grid-template-columns:minmax(180px,1fr) 140px}
#dns-manager-interface .dm-diagnostics-filters:has(#dm-filter){grid-template-columns:minmax(180px,1fr) 110px 190px 150px}
@media(max-width:800px){#dns-manager-interface .dm-diagnostics-filters:has(#dm-filter){grid-template-columns:repeat(3,minmax(0,1fr))}#dns-manager-interface .dm-diagnostics-filters .dm-search-label{grid-column:1/-1}}

#dns-manager-interface .dm-alert-link{display:block;width:100%;text-align:left;font:inherit;cursor:pointer;border-top:0;border-right:0;border-bottom:0;border-radius:0}
#dns-manager-interface .dm-row-actions{text-align:right;white-space:nowrap}
#dns-manager-interface .dm-filter-row .dm-input,#dns-manager-interface .dm-filter-row .dm-select{background:var(--input-bg,var(--dm-bg))}
#dns-manager-interface .dm-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;max-width:100%;min-width:0}
#dns-manager-interface #dm-snapshot-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#dns-manager-interface .dm-sort{display:inline-flex;align-items:center;gap:5px;text-align:inherit;cursor:pointer;background:none;border:0;color:inherit;font:inherit;padding:0}
#dns-manager-interface .dm-sort span{font-size:11px;color:var(--dm-muted)}

</style>
