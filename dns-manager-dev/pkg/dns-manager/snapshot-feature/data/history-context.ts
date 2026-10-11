import { ref } from 'vue';
export const historyContext = ref<{ snapshotId?: string; routeId: string; name: string; namespace: string; service: string } | null>(null);
export const snapshotToReview = ref<any>(null);
