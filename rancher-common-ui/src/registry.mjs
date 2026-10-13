export const KEY = Symbol.for('rancher.common-ui.runtime');
export const EVENT = 'rancher-common-ui:changed';
export const NAME = 'rancher-common-ui';
export function compatible(api) {
  return !!api && api.name === NAME && api.apiVersion === 1 && /^1\.\d+\.\d+$/.test(api.version) && typeof api.getComponents === 'function';
}
export function installRuntime(target, api) {
  if (!compatible(api)) throw new Error('Invalid common UI API. Managers require common UI 1.x / API 1.');
  target[KEY] = api;
  target.dispatchEvent(new Event(EVENT));
  return () => {
    if (target[KEY] !== api) return;
    delete target[KEY];
    target.dispatchEvent(new Event(EVENT));
  };
}
