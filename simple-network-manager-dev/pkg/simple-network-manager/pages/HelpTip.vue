<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { openContextHelp } from '../data/help-context';
withDefaults(defineProps<{ text: string; label?: string; topic?: string }>(), { label: 'Help' });
const open = ref(false);
const trigger = ref<HTMLButtonElement | null>(null);
const tooltip = ref<HTMLElement | null>(null);
const position = ref({ left: '8px', top: '8px' });
const tooltipId = `network-manager-help-${Math.random().toString(36).slice(2)}`;
let closing: ReturnType<typeof setTimeout> | undefined;

function place() {
  if (!open.value || !trigger.value || !tooltip.value) return;
  const anchor = trigger.value.getBoundingClientRect();
  const box = tooltip.value.getBoundingClientRect();
  const left = Math.max(8, Math.min(anchor.right - box.width, window.innerWidth - box.width - 8));
  const below = anchor.bottom + 8;
  const top = below + box.height <= window.innerHeight - 8 ? below : Math.max(8, anchor.top - box.height - 8);
  position.value = { left: `${left}px`, top: `${top}px` };
}
function close() {
  clearTimeout(closing);
  open.value = false;
  window.removeEventListener('resize', place);
  window.removeEventListener('scroll', place, true);
}
async function show() {
  clearTimeout(closing);
  open.value = true;
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, true);
  await nextTick(); place();
}
function leave() {
  clearTimeout(closing);
  closing = setTimeout(() => { const active=document.activeElement; if (!trigger.value?.contains(active) && !tooltip.value?.contains(active)) close(); }, 150);
}
onBeforeUnmount(close);
</script>
<template>
  <span class="help-tip" @pointerenter="show" @pointerleave="leave">
    <button ref="trigger" type="button" class="help-button" :aria-label="label" :aria-controls="open ? tooltipId : undefined" :aria-expanded="open" @focus="show" @blur="leave" @keydown.esc="close">?</button>
    <Teleport to="body"><span v-if="open" :id="tooltipId" ref="tooltip" role="dialog" :aria-label="label" class="help-content" :style="position" @pointerenter="show" @pointerleave="leave" @focusout="leave" @keydown.esc.stop="close"><span>{{ text }}</span><span class="help-popup-actions"><button type="button" @click="close">Close</button><button type="button" @click="openContextHelp(topic); close()">Open Help</button></span></span></Teleport>
  </span>
</template>
<style scoped>
.help-tip{display:inline-flex;vertical-align:middle;margin-left:8px}
.help-button{display:grid;place-items:center;border:1px solid #91b8dc!important;border-radius:50%!important;background:transparent!important;color:#a9d2ff!important;width:20px;height:20px;padding:0!important;font-size:12px!important;cursor:help}
.help-content{position:fixed;z-index:2147483647;box-sizing:border-box;width:min(280px,calc(100vw - 16px));max-height:calc(100dvh - 16px);overflow:auto;padding:12px;border:1px solid #619bd9;border-radius:6px;background:#1c2430;color:#dce3ed;font-family:inherit;font-size:12px;line-height:1.6;font-weight:normal;text-align:left;box-shadow:0 6px 20px #0008}
.help-popup-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}.help-popup-actions button{font:inherit;padding:5px 8px;background:transparent;border:1px solid #619bd9;border-radius:4px;color:inherit;cursor:pointer}.help-popup-actions button:focus-visible{outline:2px solid #73b5ff;outline-offset:2px}
</style>
