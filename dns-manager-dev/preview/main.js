import { createApp } from 'vue';
import { createPreviewDataClient, createStaticPreviewDataClient } from '../../preview-data/client.mjs';
import initialSource from 'virtual:rancher-suite-source';
import { mountPreviewDataEditor } from '../../preview-data/editor.mjs';
async function start() {
  const source = import.meta.env.DEV ? await createPreviewDataClient('dns-manager') : createStaticPreviewDataClient(initialSource);
  const { default: Preview } = await import('./Preview.vue');
  createApp(Preview, { dataSource: source }).mount('#app');
  mountPreviewDataEditor(source, { container: document.querySelector('.dm-sidebar-foot'), beforeEdit: () => {
    const form = document.querySelector('#dm-editor, #dm-settings, tr[data-drag]');
    if (form) { document.querySelector('#dm-notice').textContent = 'Save or cancel the current editor before editing Mock Data.'; return false; }
    return true;
  } });
}
start().catch(error => { document.querySelector('#app').textContent = `Preview source unavailable: ${error.message}`; });
