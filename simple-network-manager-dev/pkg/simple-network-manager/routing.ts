import Dashboard from './pages/Dashboard.vue';
import { PAGES, routeName } from './navigation';

export default PAGES.map(page => ({
  name: routeName(page.name),
  path: `/c/:cluster/explorer/simple-network-manager/${ page.name }`,
  component: Dashboard,
  props: (route: any) => ({ section: page.name, clusterName: route.params.cluster }),
  meta: { product: 'explorer' }
}));
