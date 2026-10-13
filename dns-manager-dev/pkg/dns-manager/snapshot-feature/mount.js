import { createApp } from 'vue';
import SnapshotFeature from './pages/SnapshotFeature.vue';
import SnapshotGate from './pages/SnapshotGate.vue';
export function mountSnapshotFeature(element,adapter){const app=createApp(SnapshotFeature,adapter);app.provide('rancher.common-ui.help',()=>element.closest('#dns-manager-interface')?.querySelector('[aria-label="Page help"]')?.click());app.mount(element);return ()=>app.unmount();}
export function mountSnapshotGate(element,props){const app=createApp(SnapshotGate,props);const instance=app.mount(element);return {checkNow:()=>instance.checkNow(),snapshotId:()=>instance.snapshotId(),unmount:()=>app.unmount()};}
