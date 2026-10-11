import metadata from './package.json';
import routes from './routing';
import * as product from './product';
export default function init(plugin) {
  plugin.metadata = metadata;
  plugin.addProduct(product);
  plugin.addRoutes(routes);
}
