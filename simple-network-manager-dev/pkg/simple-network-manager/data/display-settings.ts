import { reactive } from 'vue';
declare const __SNM_PREVIEW_MODE__: boolean;
const previewDefault = typeof __SNM_PREVIEW_MODE__ !== 'undefined' && __SNM_PREVIEW_MODE__;
const defaults = { previewMode: previewDefault, snapshotBanner: true, inspectionInfo: true };
let saved = {};
try { saved = JSON.parse(localStorage.getItem('network-manager-display') || '{}'); } catch {}
export const displaySettings = reactive({ ...defaults, ...Object.fromEntries(Object.entries(saved).filter(([key,value]) => key in defaults && typeof value === 'boolean')) });
export function saveDisplaySettings(settings: typeof defaults) { localStorage.setItem('network-manager-display', JSON.stringify(settings)); Object.assign(displaySettings, settings); }
