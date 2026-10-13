<script setup>
import * as Vue from 'vue';
import { component } from '../../../../../rancher-common-ui/client/index.mjs';
import { passwordStrength } from '../config/backup-zip.mjs';
const Shared=component('BackupPassword',Vue);const emit=defineEmits(['confirm','cancel']);
</script><template><Shared v-bind="$attrs" :strength-for="passwordStrength" @confirm="emit('confirm',$event)" @cancel="emit('cancel')"/></template>
