<script setup>defineProps({variant:{type:String,default:'stacked',validator:v=>['stacked','master-detail'].includes(v)}});</script>
<template><div class="rcui-overview" :class="`rcui-${variant}`"><slot name="metrics"/><div class="rcui-overview-content"><slot/></div></div></template>
