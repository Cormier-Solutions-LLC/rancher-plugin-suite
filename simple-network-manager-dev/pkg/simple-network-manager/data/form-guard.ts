import { onMounted, onBeforeUnmount, watch } from 'vue';
import { editorDirty, registerEditorSave, rememberFormDraft, formDrafts, activeFormDraft, requestEditorLeave } from './editor-session';
import { completeFormDraft } from './editor-session';
export function useFormGuard(page: string, name: () => string, state: () => any, restore: (state: any) => void, active: () => boolean) {
  let baseline = JSON.stringify(state());
  const clean = () => { baseline = JSON.stringify(state()); editorDirty.value = false; };
  watch(() => JSON.stringify(state()), value => { editorDirty.value = active() && value !== baseline; }, { flush: 'sync' });
  const unload = (event: BeforeUnloadEvent) => { if (editorDirty.value) { event.preventDefault(); event.returnValue = ''; } };
  onMounted(() => {
    const draft = formDrafts.value.find(item => item.id === activeFormDraft.value && item.page === page);
    if (draft) restore(JSON.parse(JSON.stringify(draft.state)));
    clean(); registerEditorSave(() => rememberFormDraft(page, name(), state()));
    window.addEventListener('beforeunload', unload);
  });
  onBeforeUnmount(() => { editorDirty.value = false; registerEditorSave(null); window.removeEventListener('beforeunload', unload); });
  const cleanFields = (keys: string[]) => {
    const saved = JSON.parse(baseline); const current = state();
    for (const key of keys) saved[key] = current[key];
    baseline = JSON.stringify(saved); editorDirty.value = active() && JSON.stringify(current) !== baseline;
  };
  const leave = (action: () => void) => requestEditorLeave(() => { action(); clean(); });
  const complete = () => { completeFormDraft(page); clean(); };
  const start = (action: () => void) => leave(() => { activeFormDraft.value = ''; action(); });
  return { clean, cleanFields, complete, leave, start };
}
