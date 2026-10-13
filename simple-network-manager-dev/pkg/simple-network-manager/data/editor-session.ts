import { ref } from 'vue';
export const editorDirty = ref(false);
export const leavePrompt = ref(false);
export const activeEditorDraft = ref('');
export const editorDrafts = ref<{ id: string; name: string; editId: string; state: any; updatedAt?: number }[]>([]);
let pending: (() => void) | null = null;
let saveCurrent: (() => void) | null = null;
export function registerEditorSave(save: (() => void) | null) { saveCurrent = save; }
export function requestEditorLeave(action: () => void) {
  if (!editorDirty.value) { action(); return; }
  pending = action; leavePrompt.value = true;
}
export function finishEditorLeave(save: boolean) {
  if (save) saveCurrent?.();
  editorDirty.value = false; leavePrompt.value = false;
  const action = pending; pending = null; action?.();
}
export function stayInEditor() { pending = null; leavePrompt.value = false; }
export function rememberEditorDraft(name: string, editId: string, state: any) {
  const existing = editorDrafts.value.find(draft => draft.id === activeEditorDraft.value);
  const saved = { id: existing?.id || `draft-${crypto.randomUUID()}`, name: name || 'Untitled connection', editId, state: JSON.parse(JSON.stringify(state)), updatedAt: Date.now() };
  if (existing) Object.assign(existing, saved); else editorDrafts.value.push(saved);
  activeEditorDraft.value = saved.id;
}

export const activeFormDraft = ref('');
export const formDrafts = ref<{ id: string; page: string; name: string; state: any; updatedAt?: number }[]>([]);
export function rememberFormDraft(page: string, name: string, state: any) {
  const existing = formDrafts.value.find(draft => draft.id === activeFormDraft.value && draft.page === page);
  const saved = { id: existing?.id || `form-${crypto.randomUUID()}`, page, name, state: JSON.parse(JSON.stringify(state)), updatedAt: Date.now() };
  if (existing) Object.assign(existing, saved); else formDrafts.value.push(saved);
  activeFormDraft.value = saved.id;
}
export function completeFormDraft(page: string) {
  formDrafts.value = formDrafts.value.filter(draft => draft.id !== activeFormDraft.value || draft.page !== page);
  activeFormDraft.value = '';
}
export function completeEditorDraft() {
  editorDrafts.value = editorDrafts.value.filter(draft => draft.id !== activeEditorDraft.value);
  activeEditorDraft.value = '';
}
