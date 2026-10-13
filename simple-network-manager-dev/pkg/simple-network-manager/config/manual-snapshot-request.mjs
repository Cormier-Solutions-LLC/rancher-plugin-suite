import {withoutSecretValues,passwordStrength} from './backup-zip.mjs';
export function manualSnapshotRequest(current,{includeSecrets=false,password=''}={}){
 if(includeSecrets){
  if(!passwordStrength(password).acceptable)throw new Error('Secret-inclusive snapshots require a strong backup password.');
  // The manual endpoint accepts freshly captured, authenticated Secret values.
  // The unattended endpoint must keep rejecting cached credentials.
  return {path:'/api/snapshots',body:{current:JSON.parse(JSON.stringify(current)),scopeKey:JSON.stringify(withoutSecretValues(current)),password}};
 }
 return {path:'/api/snapshot-schedule/run',body:{current:withoutSecretValues(current),password:''}};
}
