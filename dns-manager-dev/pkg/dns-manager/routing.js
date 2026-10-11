import Dashboard from './pages/Dashboard.vue';
import { pages,routeName } from './navigation';
const props = (route,section) => ({clusterName:route.params.cluster,section:section==='zone'?(route.query.editor==='record'?'record:':'zone:')+route.params.zone:route.query.editor?(section==='sources'?'source:':'zone:')+route.query.editor:section});
export default [
  ...pages.map(([section])=>({name:routeName(section),path:`/c/:cluster/explorer/dns-manager/${section}`,component:Dashboard,props:r=>props(r,section),meta:{product:'explorer'}})),
  {name:routeName('zone'),path:'/c/:cluster/explorer/dns-manager/zones/:zone',component:Dashboard,props:r=>props(r,'zone'),meta:{product:'explorer'}},
  {path:'/c/:cluster/explorer/dns-manager',redirect:r=>({name:routeName('overview'),params:r.params})}
];
