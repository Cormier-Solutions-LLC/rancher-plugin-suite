<script setup>defineProps({tone:{type:String,default:'warning'},actionable:Boolean});defineEmits(['activate']);</script>
<template><button v-if="actionable" type="button" class="rcui-banner" :class="tone" @click="$emit('activate')"><slot/></button><div v-else class="rcui-banner" :class="tone" role="status"><slot/></div></template>
