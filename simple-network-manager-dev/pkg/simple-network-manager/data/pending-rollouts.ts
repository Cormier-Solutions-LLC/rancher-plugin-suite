import { computed, reactive } from 'vue';
import { editorDrafts, formDrafts } from './editor-session';
import { contextMatches } from './namespace-context';
export interface PendingChange { id: string; category: string; name: string; namespace: string; updatedAt: number; resources: object[]; configuration?: object;requiresSecretUnlock?:boolean;restorationSnapshotId?:string }
export const pendingChanges = reactive<PendingChange[]>([]);
export const incompleteChanges = computed(() => [
  ...editorDrafts.value.map(draft => ({id:`working:${draft.id}`,draftId:draft.id,page:'publish-service',category:'Connection',name:draft.name,namespace:draft.state?.form?.namespace || '',updatedAt:draft.updatedAt || 0,resources:[] as object[],needsCompletion:true})),
  ...formDrafts.value.filter(draft => ['certificates','issuer-profiles','port-configurations'].includes(draft.page)).map(draft => ({id:`working:${draft.id}`,draftId:draft.id,page:draft.page,category:({'certificates':'Certificate','issuer-profiles':'TLS Issuer','port-configurations':'Port Configuration'} as Record<string,string>)[draft.page],name:draft.name,namespace:draft.state?.form?.namespace || draft.state?.settings?.namespace || '',updatedAt:draft.updatedAt || 0,resources:[] as object[],needsCompletion:true}))
]);
export const pendingCount = computed(() => [...pendingChanges,...incompleteChanges.value].filter(change => contextMatches(change.namespace)).length);
// A saved edit replaces the previous proposal for the same object, not a second rollout.
export function queueChange(input: Omit<PendingChange, 'updatedAt'>) {
  const change: PendingChange = JSON.parse(JSON.stringify({ ...input, updatedAt: Date.now() }));
  const index = pendingChanges.findIndex(item => item.id === input.id);
  if (index < 0) pendingChanges.push(change); else pendingChanges[index] = change;
}
