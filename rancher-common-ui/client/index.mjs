// Consumer bridge only. Components, templates and styles live in the separately loaded UIPlugin.
import { KEY, EVENT, NAME, compatible } from '../src/registry.mjs';
export function runtime() { return globalThis[KEY]; }
export function bindNavigation(prefix, getTones) {
  let observer;
  const connect=()=>{observer?.destroy();observer=runtime()?.observeNavigation?.(prefix,getTones);};
  globalThis.addEventListener(EVENT,connect);connect();
  return {update:()=>observer?.update(),destroy:()=>{globalThis.removeEventListener(EVENT,connect);observer?.destroy();}};
}
export function dependencyState(store) {
  const api = runtime();
  if (!api) return { ready: false, reason: 'The common UI plugin has not loaded.' };
  if (!compatible(api)) return { ready: false, reason: `Common UI ${api.version || 'unknown'} is incompatible. API 1 and version 1.x are required.` };
  if (store) {
    const loaded = store.getters?.['uiplugins/plugins'];
    const ready = store.getters?.['uiplugins/ready'];
    if (ready && Array.isArray(loaded) && !loaded.some(p => p.name === NAME || p.id === NAME)) return { ready: false, reason: 'The common UI plugin is disabled or uninstalled.' };
    const error = store.getters?.['uiplugins/errors']?.[NAME];
    if (error) return { ready: false, reason: 'Rancher could not load the common UI plugin.' };
  }
  return { ready: true, api };
}
export function component(name, Vue, defaults = {}) {
  return Vue.defineComponent({ name: `Common${name}`, inheritAttrs: false, setup(_, { attrs, slots, expose }) {
    const revision = Vue.shallowRef(runtime());
    const inner = Vue.ref();
    const changed = () => { revision.value = runtime(); };
    Vue.onMounted(() => globalThis.addEventListener(EVENT, changed));
    Vue.onBeforeUnmount(() => globalThis.removeEventListener(EVENT, changed));
    // Keep exposed calendar methods available through the thin adapter.
    expose({ openCalendar: () => inner.value?.openCalendar?.() });
    return () => {
      const api = revision.value;
      if (!compatible(api)) return null;
      const definition = api.getComponents(Vue)[name];
      if (!definition) throw new Error(`Common UI is missing required component ${name}.`);
      return Vue.h(definition, { ...defaults, ...attrs, ref: inner, key: api.version }, slots);
    };
  } });
}
export function dependencyGate(Vue) {
  return Vue.defineComponent({ name: 'CommonUIDependencyGate', inheritAttrs: false, setup(_, { attrs, slots }) {
    const instance = Vue.getCurrentInstance();
    const store = instance?.proxy?.$store;
    Vue.provide('rancher.common-ui.help', attrs.onHelp);
    const state = Vue.shallowRef(dependencyState(store));
    const update = () => { state.value = dependencyState(store); };
    let unwatch;
    Vue.onMounted(() => {
      globalThis.addEventListener(EVENT, update);
      unwatch = store?.watch?.(() => [store.getters?.['uiplugins/plugins'],store.getters?.['uiplugins/ready'],store.getters?.['uiplugins/errors']], update, { deep: true });
      update();
    });
    Vue.onBeforeUnmount(() => { globalThis.removeEventListener(EVENT, update); unwatch?.(); });
    return () => state.value.ready
      ? Vue.h('div', { ...attrs, class: ['rcui-surface', attrs.class], 'data-common-ui-version': state.value.api.version }, slots.default?.())
      : Vue.h('section', { class: 'rcui-dependency', role: 'alert', style: 'padding:24px;font:14px/1.6 system-ui;border:1px solid currentColor;border-radius:6px' }, [
          Vue.h('h2', 'Common UI plugin required'), Vue.h('p', state.value.reason),
          Vue.h('p', 'Install and enable rancher-common-ui 1.x in cattle-ui-plugin-system, then reload Rancher. This manager cannot run without it.'),
          Vue.h('button', { type: 'button', onClick: () => globalThis.location.reload() }, 'Reload')
        ]);
  } });
}
export async function loadPreviewRuntime(url) {
  const response=await fetch('/common-ui/package.json');
  if(!response.ok)throw new Error('Common UI preview assets are unavailable. Build rancher-common-ui.');
  const manifest=await response.json();
  url ||= `/common-ui/rancher-common-ui-${manifest.version}.umd.min.js`;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = url;
    script.onload = resolve; script.onerror = () => reject(new Error('Common UI assets could not load. Build rancher-common-ui and start its preview server.'));
    document.head.append(script);
  });
  const init = globalThis[`rancher-common-ui-${manifest.version}`]?.default;
  if (typeof init !== 'function') throw new Error('Common UI bundle has no extension initializer.');
  init({ metadata: {}, addUninstallHook() {} });
}
