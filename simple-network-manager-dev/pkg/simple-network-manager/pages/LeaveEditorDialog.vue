<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { leavePrompt, finishEditorLeave, stayInEditor } from '../data/editor-session';
const dialog = ref<HTMLDialogElement | null>(null);
watch(leavePrompt, async value => { await nextTick(); if (value) dialog.value?.showModal(); else dialog.value?.close(); });
</script>
<template><dialog ref="dialog" aria-labelledby="leave-editor-title" @cancel.prevent="stayInEditor"><h2 id="leave-editor-title">Unsaved changes</h2><p>Save a working draft for this session, discard your changes, or keep editing.</p><div class="leave-actions"><button type="button" @click="finishEditorLeave(true)">Save draft and leave</button><button type="button" class="secondary" @click="finishEditorLeave(false)">Discard changes</button><button type="button" class="secondary" @click="stayInEditor">Stay on this page</button></div></dialog></template>
<style scoped>dialog { max-width: 580px; padding: 26px; color: var(--body-text, #dce3ed); background: var(--box-bg, #242c38); border: 1px solid #619bd9; border-radius: 8px; }dialog::backdrop { background: #080f1ac9; }h2 { margin: 0 0 16px; font-size: 21px; }p { font-size: 13px; line-height: 1.7; }.leave-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }button { padding: 12px 16px; background: #326fb4; color: white; border: 1px solid #619bd9; border-radius: 5px; cursor: pointer; font: inherit; }.secondary { background: transparent; }button:focus-visible { outline: 2px solid #73b5ff; outline-offset: 3px; }</style>
