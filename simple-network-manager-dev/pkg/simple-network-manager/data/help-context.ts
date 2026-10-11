import { ref } from 'vue';
export const activeHelpPage = ref('overview');
export const helpSection = ref('overview');
export const helpRequest = ref(0);
export function openContextHelp(topic = activeHelpPage.value) {
  helpSection.value = ['snapshot-coverage','merge-snapshots'].includes(topic) ? 'history' : topic;
  helpRequest.value++;
}
