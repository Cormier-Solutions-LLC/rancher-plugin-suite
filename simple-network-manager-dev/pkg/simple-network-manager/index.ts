import { importTypes } from '@rancher/auto-import';
import { IPlugin } from '@shell/core/types';
import routes from './routing';

// Init the package
export default function(plugin: IPlugin): void {
  // Auto-import model, detail, edit from the folders
  importTypes(plugin);

  // Provide plugin metadata from package.json
  plugin.metadata = require('./package.json');

  plugin.addProduct(require('./product'));
  plugin.addRoutes(routes);
}
