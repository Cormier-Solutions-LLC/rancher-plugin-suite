<script setup lang="ts">
import ActionIcon from './ActionIcon.vue';
withDefaults(defineProps<{ label?: string; busy?: boolean; disabled?: boolean; title?: string; iconOnly?: boolean }>(), { label: 'Refresh', busy: false, disabled: false, iconOnly: false });
defineEmits<{ refresh: [] }>();
</script>
<template><button type="button" class="shared-refresh" :class="{ 'icon-only': iconOnly }" :aria-label="label" :disabled="busy || disabled" :title="title || label" @click="$emit('refresh')"><ActionIcon icon="reconfigure" /><span v-if="!iconOnly">{{ busy ? 'Refreshing…' : label }}</span></button></template>
<style scoped>.shared-refresh { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:38px; padding:10px 14px; border:0; border-radius:5px; background:#326fb4; color:white; font:inherit; font-size:12px; cursor:pointer; }.shared-refresh.icon-only { padding:8px; width:38px; background:transparent; color:inherit; }.shared-refresh:disabled { opacity:.5; cursor:not-allowed; }.shared-refresh:focus-visible { outline:2px solid #73b5ff; outline-offset:3px; }</style>
