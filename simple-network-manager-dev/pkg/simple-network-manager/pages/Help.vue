<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import { helpSection } from '../data/help-context';
import { helpSections } from '../data/help-sections';
const emit=defineEmits<{navigate:[page:string]}>();
const expanded=ref<string[]>([helpSection.value]);
onMounted(async()=>{await nextTick();document.getElementById(`help-${helpSection.value}`)?.scrollIntoView({block:'nearest'});});
watch(helpSection,async id=>{if(!expanded.value.includes(id))expanded.value.push(id);await nextTick();document.getElementById(`help-${id}`)?.scrollIntoView({block:'nearest'});});
function toggle(id:string,event:Event){if((event.target as HTMLDetailsElement).open){if(!expanded.value.includes(id))expanded.value.push(id);}else expanded.value=expanded.value.filter(value=>value!==id);}
</script>
<template><div class="help-guide" aria-label="Network Manager Help"><details v-for="topic in helpSections" :id="`help-${topic.id}`" :key="topic.id" :open="expanded.includes(topic.id)" @toggle="toggle(topic.id,$event)"><summary>{{topic.title}}</summary><p>{{topic.text}}</p><button type="button" @click="emit('navigate',topic.page)">Open {{topic.page==='overview'?'Routing Overview':helpSections.find(section=>section.id===topic.page)?.title||topic.page}}</button></details></div></template>
<style scoped>.help-guide{min-height:0;font-size:13px}.help-guide details{border-bottom:1px solid var(--border,#384352);padding:16px 0}.help-guide summary{font-size:15px;font-weight:600;cursor:pointer;color:var(--body-text,#dce3ed)}.help-guide p{line-height:1.7;color:var(--muted,#a5b1c3);max-width:900px}.help-guide button{background:transparent;color:var(--link,#a9d2ff);border:1px solid var(--border,#384352);border-radius:5px;padding:8px 12px;font:inherit;cursor:pointer}.help-guide :is(button,summary):focus-visible{outline:2px solid #73b5ff;outline-offset:3px}</style>
