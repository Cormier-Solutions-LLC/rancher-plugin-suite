<script setup>
import { ref, onMounted } from 'vue';
defineProps({target:String});const mounted=ref(false);onMounted(()=>mounted.value=true);
</script>
<template><Teleport v-if="mounted&&target" :to="target"><div class="page-actions rcui-actions"><slot/></div></Teleport><div v-else-if="!target" class="page-actions rcui-actions"><slot/></div></template>
