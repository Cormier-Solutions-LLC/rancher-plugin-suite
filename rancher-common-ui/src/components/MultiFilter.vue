<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
const props = defineProps<{ label: string; modelValue: string[]; options: { value: string; label: string }[]; emptyText?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();
const search = ref('');
const menu = ref<HTMLDetailsElement | null>(null);
function dismissOutside(event: Event) {
  if (menu.value && event.target instanceof Node && !menu.value.contains(event.target)) menu.value.open = false;
}
onMounted(() => { document.addEventListener('pointerdown', dismissOutside); document.addEventListener('focusin', dismissOutside); });
onUnmounted(() => { document.removeEventListener('pointerdown', dismissOutside); document.removeEventListener('focusin', dismissOutside); });
const shown = computed(() => props.options.filter(option => option.label.toLowerCase().includes(search.value.toLowerCase())));
function toggle(value: string) { emit('update:modelValue', props.modelValue.includes(value) ? props.modelValue.filter(item => item !== value) : [...props.modelValue, value]); }
</script>
<template>
  <div class="multi-filter"><span>{{ label }}</span><details ref="menu" @keydown.esc="($event.currentTarget as HTMLDetailsElement).open = false">
    <summary :aria-label="label">{{ modelValue.length ? `${modelValue.length} selected` : emptyText || `All ${label.toLowerCase()}` }}</summary>
    <div class="choices"><input v-model="search" type="search" :aria-label="`Search ${label}`" :placeholder="`Search ${label.toLowerCase()}…`"><button type="button" @click="emit('update:modelValue', [])">Clear selection</button>
      <fieldset><legend>{{ label }}</legend><label v-for="option in shown" :key="option.value"><input type="checkbox" :checked="modelValue.includes(option.value)" @change="toggle(option.value)">{{ option.label }}</label><p v-if="!shown.length">No matches.</p></fieldset>
    </div>
  </details></div>
</template>
<style scoped>
.multi-filter { position: relative; min-width: 170px; font-size: 12px; color: var(--muted, #a5b1c3); }.multi-filter > span { display:block; margin-bottom:7px; }details { margin:0; border:0; }summary { padding:11px; border:1px solid var(--border,#384352); border-radius:5px; background:var(--input-bg,#1c2430); font-size:12px; }.choices { position:absolute; top:100%; left:0; z-index:20; width:320px; max-width:80vw; background:var(--box-bg,#242c38); border:1px solid #619bd9; border-radius:5px; padding:12px; box-shadow:0 8px 24px #0006; }fieldset { border:0; padding:0; max-height:300px; overflow:auto; }legend { position:absolute; width:1px; height:1px; overflow:hidden; }label { display:flex; align-items:center; gap:8px; padding:9px 0; color:var(--body-text,#dce3ed); }input[type=search] { width:100%; padding:9px; background:var(--input-bg,#1c2430); border:1px solid #384352; color:var(--body-text,#dce3ed); border-radius:4px; }button { background:transparent; border:0; color:#a9d2ff; padding:10px 0; cursor:pointer; }input, summary, button { outline-offset:3px; }
</style>
