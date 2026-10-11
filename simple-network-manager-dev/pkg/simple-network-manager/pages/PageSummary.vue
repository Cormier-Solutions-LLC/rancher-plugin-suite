<script setup lang="ts">
import { onMounted, ref } from 'vue';
import HelpTip from './HelpTip.vue';
defineProps<{ count?: number; label?: string; help: string; tone?: string }>();const mounted=ref(false);onMounted(()=>mounted.value=true);
</script>
<template><Teleport v-if="mounted" to="#snm-page-help"><HelpTip :text="help" /></Teleport><Teleport v-if="mounted && count !== undefined" to="#snm-page-count"><span class="page-count" :class="tone" :aria-label="`${count} ${label || 'Items'}`" :title="label">{{ count }}</span></Teleport></template>
<style scoped>.page-count{display:inline-grid;place-items:center;min-width:24px;height:24px;padding:0 5px;border-radius:12px;background:#263d56;font-size:13px;color:#a9d2ff;white-space:nowrap;font-variant-numeric:tabular-nums;box-sizing:border-box}.page-count.warning{color:#edbb69;background:#493a23}.page-count.error{color:#ffb3ad;background:#4c282e}</style>
