import { loadPreviewRuntime } from '../../rancher-common-ui/client/index.mjs';
import { createApp } from 'vue';
import { createPreviewDataClient, createStaticPreviewDataClient } from '../../preview-data/client.mjs';
import initialSource from 'virtual:rancher-suite-source';
import { mountPreviewDataEditor } from '../../preview-data/editor.mjs';
async function start() {
  await loadPreviewRuntime();
  const source = import.meta.env.DEV ? await createPreviewDataClient('network-manager') : createStaticPreviewDataClient(initialSource);
  const { connectNetworkState } = await import('../../preview-data/network-state');
  const state = connectNetworkState(source);
  const { default: Preview } = await import('./Preview.vue');
  createApp(Preview).mount('#app');
  mountPreviewDataEditor(source, { container: document.querySelector('.rcui-sidebar footer'), beforeEdit: state.canEdit });
}
start().catch(error => { document.querySelector('#app')!.textContent = `Preview source unavailable: ${error.message}`; });
