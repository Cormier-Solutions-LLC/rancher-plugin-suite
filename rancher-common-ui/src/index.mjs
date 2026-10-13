import { createComponents } from '../.generated/components.mjs';
import theme from '../.generated/theme.mjs';
import { installRuntime } from './registry.mjs';
import { observeNavigation } from './navigation.mjs';
import { decorateTables, mountDialog, reviewMarkup, layoutMarkup, tableMarkup } from './dom.mjs';
export default function init(plugin) {
  plugin.metadata = { name: 'rancher-common-ui', version: __COMMON_UI_VERSION__, description: 'Shared manager presentation runtime', rancherUI: { commonUI: { apiVersion: 1 } } };
  const styles = document.createElement('style'); styles.id='rancher-common-ui-theme'; styles.textContent=theme;
  document.getElementById(styles.id)?.remove();document.head.append(styles);
  const cache=new WeakMap();
  const api={name:'rancher-common-ui',version:__COMMON_UI_VERSION__,apiVersion:1,getComponents(Vue){if(!cache.has(Vue))cache.set(Vue,createComponents(Vue));return cache.get(Vue);},observeNavigation,decorateTables,mountDialog,reviewMarkup,layoutMarkup,tableMarkup};
  const uninstall=installRuntime(globalThis,api);
  plugin.addUninstallHook?.(()=>{uninstall();if(globalThis[Symbol.for('rancher.common-ui.runtime')]!==api && document.getElementById(styles.id)===styles)styles.remove();});
}
