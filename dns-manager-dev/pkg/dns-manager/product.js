import { watch } from 'vue';
import { GROUP, pages, routeName, navigationState } from './navigation';
export function init(plugin, store) {
  const { virtualType, basicType, weightGroup, setGroupDefaultType } = plugin.DSL(store,'explorer');
  pages.forEach(([id,label],index)=>virtualType({name:`dns-manager-${id}`,label,namespaced:false,weight:100-index,route:{name:routeName(id),params:{product:'explorer'}}}));
  virtualType({name:'dns-manager-home',label:'Overview',overview:true,namespaced:false,weight:110,route:{name:routeName('overview'),params:{product:'explorer'}}});
  basicType(['dns-manager-home',...pages.map(([id])=>`dns-manager-${id}`)],GROUP);
  setGroupDefaultType(GROUP,'dns-manager-overview');weightGroup(GROUP,0.4,true);
  // Group labels are literal UI names rather than untranslated internal keys.
  store.commit('type-map/labelGroup',{group:GROUP,label:'DNS Manager'});
  store.commit('type-map/labelGroup',{group:`${GROUP}/dnsManagerZones`,label:'Zones'});
  setGroupDefaultType(`${GROUP}/dnsManagerZones`,'dns-manager-zones');
  watch(navigationState, state=>{
    for(const [id,label] of pages) virtualType({name:`dns-manager-${id}`,label,namespaced:false,weight:100-pages.findIndex(p=>p[0]===id),count:['help','settings'].includes(id)?undefined:state.counts[id],route:{name:routeName(id),params:{product:'explorer'}}});
    for(const [index,zone] of state.zones.entries())virtualType({name:`dns-manager-zone-${zone.id}`,label:zone.name,namespaced:false,count:zone.recordCount,weight:90-index,route:{name:routeName('zone'),params:{product:'explorer',zone:zone.id}}});
    // Nested groups use the host's group tree, selection, and expansion behavior.
    basicType(state.zones.map(z=>`dns-manager-zone-${z.id}`),`${GROUP}/dnsManagerZones`);
  },{deep:true,immediate:true});
}
