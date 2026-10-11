<script setup>
import Dashboard from '../pkg/dns-manager/pages/Dashboard.vue';
defineProps({ dataSource: { type: Object, required: true } });
</script>

<template>
  <Dashboard preview-shell cluster-name="kubcontroller" :data-source="dataSource" />
</template>
