import { onMounted, onBeforeUnmount, watch } from 'vue';
import { editorDirty, registerEditorSave, rememberFormDraft, formDrafts, activeFormDraft, requestEditorLeave } from './editor-session';
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
  const leave = (action: () => void) => requestEditorLeave(() => { action(); clean(); });
  return { clean, leave };
}
