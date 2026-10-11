import { computed, reactive } from 'vue';
export interface PendingChange { id: string; category: string; name: string; namespace: string; updatedAt: number; resources: object[]; configuration?: object }
export const pendingChanges = reactive<PendingChange[]>([]);
export const pendingCount = computed(() => pendingChanges.length);
// A saved edit replaces the previous proposal for the same object, not a second rollout.
export function queueChange(input: Omit<PendingChange, 'updatedAt'>) {
  const change: PendingChange = JSON.parse(JSON.stringify({ ...input, updatedAt: Date.now() }));
  const index = pendingChanges.findIndex(item => item.id === input.id);
  if (index < 0) pendingChanges.push(change); else pendingChanges[index] = change;
}
