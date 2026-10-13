<script setup>
import * as Vue from 'vue';
import { component } from '../../../../rancher-common-ui/client/index.mjs';
const Shared=component('PageActions',Vue); const props=defineProps({placement:{default:'create'}});
</script>
<template><Shared v-bind="$attrs" :target="placement==='refresh'?'#snm-refresh-action':'#snm-page-actions'"><slot/></Shared></template>
