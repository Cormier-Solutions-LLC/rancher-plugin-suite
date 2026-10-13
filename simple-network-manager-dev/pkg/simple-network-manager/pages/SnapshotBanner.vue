<script setup lang="ts">
import * as Vue from 'vue';import {component} from '../../../../rancher-common-ui/client/index.mjs';const Banner=component('Banner',Vue);
import { boundedRead } from '../config/bounded-read.mjs';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { overallSnapshotCoverage, updateCoverageClock } from '../data/snapshot-coverage';
import { displaySettings } from '../data/display-settings';
import { storedSnapshots, refreshSnapshots } from '../data/stored-snapshots';
const emit = defineEmits<{ navigate:[section:string] }>();
function openCoverage() { if (displaySettings.snapshotBanner) emit('navigate',overallSnapshotCoverage.value.tone === 'success' ? 'history' : 'snapshot-coverage'); }
const controller = new AbortController();
const now = ref(Date.now()); const error = ref(''); const loaded = ref(false); let timer: ReturnType<typeof setInterval>;
onMounted(async () => { timer = setInterval(() => { now.value = Date.now(); updateCoverageClock(); }, 60000); try { await boundedRead(refreshSnapshots, {signal:controller.signal}); controller.signal.throwIfAborted(); loaded.value = true; } catch { if(controller.signal.aborted)return; error.value = 'Snapshot storage could not be checked.'; } });
onUnmounted(() => {controller.abort(); clearInterval(timer);});
const latest = computed(() => [...storedSnapshots.value].filter(snapshot => Number.isFinite(Date.parse(snapshot.createdAt)) && Date.parse(snapshot.createdAt) <= now.value).sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt))[0]);
watch(storedSnapshots,()=>{now.value=Date.now();},{flush:'sync'});
const recent = computed(() => !!latest.value && now.value - Date.parse(latest.value.createdAt) < 7 * 86400000);
</script>
<template><Banner class="snapshot-banner" :tone="displaySettings.snapshotBanner?overallSnapshotCoverage.tone:'info'" :actionable="displaySettings.snapshotBanner" :aria-label="displaySettings.snapshotBanner?`${overallSnapshotCoverage.label} — View Snapshot Coverage`:undefined" @activate="openCoverage"><strong v-if="displaySettings.snapshotBanner && latest">{{ overallSnapshotCoverage.label }} · {{ new Date(latest.createdAt).toLocaleString() }}</strong><strong v-else-if="displaySettings.snapshotBanner">{{ error || (loaded ? 'No Snapshots Available — Create A Configuration Snapshot' : 'Checking Saved Snapshots…') }}</strong><span v-if="displaySettings.snapshotBanner && latest">Scope: {{ latest.scope?.label || latest.name }}. {{ overallSnapshotCoverage.covered }} / {{ overallSnapshotCoverage.total }} known configuration items covered. Configuration matches must be less than seven days old; Secret coverage checks whether values have ever been backed up, without comparing current credentials.</span><small v-if="displaySettings.previewMode && displaySettings.inspectionInfo">Preview inventory: 35 routing resources inspected October 11. Cluster data is static; forms create local drafts.</small></Banner></template>
