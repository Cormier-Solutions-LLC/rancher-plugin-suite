import { queueChange } from './pending-rollouts';
import { reactive, ref } from 'vue';
export const editingConnection = ref('');
export const lastViewedConnection = ref('');
export const connectionDrafts = reactive<{ sourceId: string; name: string; namespace: string; resources: object[] }[]>([]);
export function saveConnectionDraft(draft: typeof connectionDrafts[number]) {
  const index = connectionDrafts.findIndex(item => item.sourceId === draft.sourceId);
  const copy = JSON.parse(JSON.stringify(draft));
  queueChange({ id: `connection:${draft.sourceId}`, category: 'Connection Edit', name: draft.name, namespace: draft.namespace, resources: draft.resources });
  if (index < 0) connectionDrafts.push(copy); else connectionDrafts[index] = copy;
}
