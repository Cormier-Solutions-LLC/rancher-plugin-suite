import { ref } from 'vue';
export const mergeSourceIds = ref<string[]>([]);
export const mergeRequested = ref(0);
export function openSnapshotMerge(ids: string[]) {
  mergeSourceIds.value = [...ids];
  mergeRequested.value++;
}
