<script setup lang="ts">
import { computed } from 'vue';
import ResourceLink from './ResourceLink.vue';
import { inventoryDatasets } from '../data/inventory';
const owners = inventoryDatasets['resource-owner-snapshot.json'];
defineOptions({ inheritAttrs: false });
const props = defineProps<{ kind: string; name: string; namespace: string; label: string }>();
const info = computed(() => (owners as any)[`${props.kind}/${props.namespace}/${props.name}`]);
</script>
<template><ResourceLink v-if="info?.owners?.length" :kind="info.owners[0].kind" :name="info.owners[0].name" :namespace="namespace" :label="label"/><ResourceLink v-else-if="info?.release" kind="catalog.cattle.io.app" :name="info.release" :namespace="info.releaseNamespace" :label="label"/><ResourceLink v-else :kind="kind" :name="name" :namespace="namespace" :label="label"/></template>
