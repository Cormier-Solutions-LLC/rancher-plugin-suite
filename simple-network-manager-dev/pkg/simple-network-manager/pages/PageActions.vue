<script setup lang="ts">
import { onMounted, ref } from 'vue';
withDefaults(defineProps<{ placement?: 'create' | 'refresh' }>(), { placement: 'create' });
const mounted = ref(false);
onMounted(() => { mounted.value = true; });
</script>
<template><Teleport v-if="mounted" :to="placement === 'refresh' ? '#snm-refresh-action' : '#snm-page-actions'"><div class="page-actions"><slot /></div></Teleport></template>
<style scoped>.page-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }.page-actions :deep(button) { padding:11px 14px; border:0; border-radius:5px; background:#326fb4; color:white; font:inherit; font-size:12px; cursor:pointer; }.page-actions :deep(button:disabled) { opacity:.5; cursor:not-allowed; }.page-actions :deep(button:focus-visible) { outline:2px solid #73b5ff; outline-offset:3px; }</style>
