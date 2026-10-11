<script setup lang="ts">
import ActionIcon from './ActionIcon.vue';
withDefaults(defineProps<{ label?: string; disabled?: boolean }>(), { label: 'New', disabled: false });
defineEmits<{ create: [] }>();
</script>
<template><button type="button" class="shared-create" :disabled="disabled" @click="$emit('create')"><ActionIcon icon="add"/>{{ label.replace(/^Create /, '') }}</button></template>
<style scoped>.shared-create { display:inline-flex; align-items:center; gap:7px; min-height:38px; padding:10px 14px; border:0; border-radius:5px; background:#326fb4; color:white; font:inherit; font-size:12px; cursor:pointer; }.shared-create:disabled { opacity:.5; cursor:not-allowed; }.shared-create:focus-visible { outline:2px solid #73b5ff; outline-offset:3px; }</style>

<style scoped>.shared-create span{font-size:27px;line-height:18px;font-weight:500}</style>
