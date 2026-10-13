import {withoutSecretValues} from '../simple-network-manager-dev/pkg/simple-network-manager/config/backup-zip.mjs';
export function persistentManagerState(state){
 const saved=withoutSecretValues(state);
 for(const change of saved.pendingChanges||[])if(change.resources?.some(r=>r.kind==='Secret'&&r.data===undefined&&r.stringData===undefined))change.requiresSecretUnlock=true;
 return saved;
}
