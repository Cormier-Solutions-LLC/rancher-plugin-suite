<script setup>defineProps({variant:{type:String,default:'stacked',validator:v=>['stacked','master-detail'].includes(v)}});</script>
<template><div class="rcui-detail" :class="`rcui-${variant}`"><slot/></div></template>
