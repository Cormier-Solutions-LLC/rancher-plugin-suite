import { ref } from 'vue';
export const activeHelpPage = ref('overview');
export const helpSection = ref('overview');
export const helpRequest = ref(0);
export const contextualHelpPending = ref(false);
export function openContextHelp(topic = activeHelpPage.value) {
  helpSection.value = ['snapshot-coverage','merge-snapshots'].includes(topic) ? 'history' : topic;
  contextualHelpPending.value=true;
  helpRequest.value++;
}
