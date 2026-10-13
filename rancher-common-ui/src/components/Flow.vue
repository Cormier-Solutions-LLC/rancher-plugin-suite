<script setup>defineProps({variant:{type:String,default:'inline',validator:v=>['inline','boxed'].includes(v)}});</script>
<template><div class="rcui-flow" :class="`rcui-${variant}`"><slot/></div></template>
