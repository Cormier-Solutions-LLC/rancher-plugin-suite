<script setup>
import * as Vue from 'vue';import {component} from '../../../../rancher-common-ui/client/index.mjs';
import {refreshing} from '../data/page-refresh';import {navigationCounts,navigationTones} from '../data/navigation-counts';
import {openContextHelp} from '../data/help-context';
const Shared=component('PageSummary',Vue);const page=Vue.inject('manager-page',Vue.ref(''));const attrs=Vue.useAttrs();
const count=Vue.computed(()=>attrs.count===undefined?undefined:navigationCounts.value[page.value]??attrs.count);
const tone=Vue.computed(()=>navigationTones.value[page.value]??attrs.tone);
</script><template><Shared v-bind="$attrs" :count="count" :tone="tone" help-target="#snm-page-help" count-target="#snm-page-count" :loading="refreshing" @open-help="openContextHelp($event)"/></template>
