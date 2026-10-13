<script setup>
import * as Vue from 'vue';
import { component } from '../../../../rancher-common-ui/client/index.mjs';
import { openContextHelp } from '../data/help-context';
const Shared=component('HelpTip',Vue);
</script>
<template><Shared v-bind="$attrs" @open-help="openContextHelp($event)"/></template>
