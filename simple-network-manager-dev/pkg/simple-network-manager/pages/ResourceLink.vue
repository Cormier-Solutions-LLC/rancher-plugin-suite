<script setup lang="ts">
import { resourceUrl } from '../data/resource-links';
defineProps<{kind:string;name:string;namespace?:string;label?:string}>();
</script>
<template><a v-if="resourceUrl(kind,name,namespace)" :href="resourceUrl(kind,name,namespace)" target="_blank" rel="noopener noreferrer" @click.stop>{{ label || name }}</a><span v-else title="Set the Rancher URL in Settings to open resource links from this standalone preview">{{ label || name }}</span></template>
<style scoped>a{color:#a9d2ff;text-decoration:underline}a:focus-visible{outline:2px solid #73b5ff}</style>
