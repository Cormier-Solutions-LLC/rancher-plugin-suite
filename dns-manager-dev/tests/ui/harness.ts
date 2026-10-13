import { mount, flushPromises } from '@vue/test-utils';
import { fireEvent, getByRole, getByLabelText, queryByRole } from '@testing-library/dom';
import Dashboard from '../../pkg/dns-manager/pages/Dashboard.vue';
import { defaultInventory } from '../../pkg/dns-manager/ui/default-inventory.js';
export { fireEvent, getByRole, getByLabelText, queryByRole, flushPromises };
export async function renderManager(section = 'overview', extra: any = {}, state: any = {}) {
  let saved: any = structuredClone({ version: 1, drafts: [], logs: [], page: section, ...state });
  const wrapper = mount(Dashboard, { attachTo: document.body, props: { previewShell: true, section,
    previewStorage: { load: () => saved, save: (value: any) => { saved = structuredClone(value); } }, ...extra } });
  await flushPromises();
  return { wrapper, root: wrapper.element as HTMLElement, state: () => saved,
    async nav(page: string) { await wrapper.setProps({ section: page }); await flushPromises(); },
    click(name: string | RegExp, scope: HTMLElement = wrapper.element as HTMLElement) { fireEvent.click(getByRole(scope, 'button', { name })); },
    defaults: defaultInventory };
}
