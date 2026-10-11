<script setup lang="ts">
defineProps<{ icon: 'details' | 'edit' | 'reconfigure' | 'download' | 'history' | 'delete' | 'add' | 'merge' | 'apply' }>();
</script>
<template>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <template v-if="icon === 'add'"><path d="M12 3v18M3 12h18"/></template>
    <template v-else-if="icon === 'merge'"><path d="M5 3v4c0 3 7 3 7 7v7M19 3v4c0 3-7 3-7 7M8 17l4 4 4-4"/></template>
    <template v-else-if="icon === 'apply'"><path d="m8 4 12 8-12 8z"/></template>
    <template v-else-if="icon === 'details'"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 8h9M8 12h9M8 16h9M6 8h.01M6 12h.01M6 16h.01"/></template>
    <template v-else-if="icon === 'edit'"><path d="m15 4 5 5M4 20l4-1 12-12a2.1 2.1 0 0 0-3-3L5 16z"/></template>
    <template v-else-if="icon === 'download'"><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/></template>
    <template v-else-if="icon === 'history'"><path d="M3 9a9 9 0 1 1 1 9M3 3v6h6M12 7v5l4 2"/></template>
    <template v-else-if="icon === 'delete'"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></template>
    <template v-else><path d="M20 10a8 8 0 0 0-14-4L3 9M3 3v6h6M4 14a8 8 0 0 0 14 4l3-3M15 15h6v6"/></template>
  </svg>
</template>
