import { createApp } from 'vue';
import SnapshotFeature from './pages/SnapshotFeature.vue';
export function mountSnapshotFeature(element,adapter){const app=createApp(SnapshotFeature,adapter);app.mount(element);return ()=>app.unmount();}
