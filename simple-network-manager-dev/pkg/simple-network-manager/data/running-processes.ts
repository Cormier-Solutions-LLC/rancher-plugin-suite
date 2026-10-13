import { reactive, computed, shallowRef,watch } from 'vue';import { pendingChanges, type PendingChange } from './pending-rollouts';
import { validateChangeBatch } from '../config/change-batch.mjs';
import {reconcileCertificateRenewals} from '../../../../live-management/certificate-renewal.mjs';
import {inventoryDatasets} from './inventory';
import {portConfigurations} from './port-presets';
import {publications} from './publications';
import {issuerProfiles} from './workspace';
export interface RunningProcess{id:string;name:string;namespace:string;category:string;status:string;startedAt:number;finishedAt?:number;progress:number;resources:object[];configuration?:object;receipt?:any;failed?:boolean;simulated:boolean}
export const runningProcesses=reactive<RunningProcess[]>([]);export const runningCount=computed(()=>runningProcesses.filter(p=>p.progress<100).length);
export const liveRolloutSource=shallowRef<any>(null);
export async function applyLiveChanges(ids:string[],reviewed:string){
 const chosen=pendingChanges.filter(c=>ids.includes(c.id));if(!chosen.length||JSON.stringify(chosen)!==reviewed)throw new Error('Pending changes changed during review.');
 validateChangeBatch(chosen);const source=liveRolloutSource.value;if(!source?.capabilities.stageChanges)throw new Error('Live execution is unavailable.');
 const process:RunningProcess={id:crypto.randomUUID(),name:chosen.map(c=>c.name).join(', '),namespace:chosen[0].namespace,category:'Live Rollout',status:'Validating on Kubernetes',startedAt:Date.now(),progress:10,resources:chosen.flatMap(c=>c.resources),configuration:{changes:chosen.map(c=>({id:c.id,name:c.name,namespace:c.namespace,configuration:c.configuration}))},simulated:false};runningProcesses.push(process);
 try{const result=await source.stageChanges(chosen);for(const change of result.catalog||[]){if(change.entity==='IssuerProfile'){const index=issuerProfiles.findIndex(p=>p.name===change.name&&(p.manifest as any)?.kind===change.kind&&((p.manifest as any)?.metadata?.namespace||'')===change.namespace);if(index>=0)issuerProfiles.splice(index,1);continue;}if(change.entity==='PublicationDraft'){const index=publications.findIndex(p=>p.namespace===change.namespace&&p.name===change.name);if(index>=0)publications.splice(index,1);continue;}const index=portConfigurations.findIndex(c=>c.id===change.id);if(change.operation==='Delete'){if(index>=0)portConfigurations.splice(index,1);}else if(index>=0)portConfigurations[index]=change.value;else portConfigurations.push(change.value);}(process as any).receipt=result;
  if(result.applied.some((r:any)=>r.operation==='Renew')){process.status='Certificate renewal submitted; waiting for cert-manager.';process.progress=50;}
  else{process.status=`Applied ${result.applied.length} resources; saved ${result.catalog?.length||0} catalog changes; readback receipts recorded`;process.progress=100;process.finishedAt=Date.now();}
  for(let i=pendingChanges.length-1;i>=0;i--)if(ids.includes(pendingChanges[i].id))pendingChanges.splice(i,1);
 }catch(e){process.status=e instanceof Error?e.message:'Live rollout failed';process.progress=100;process.finishedAt=Date.now();(process as any).failed=true;(process as any).receipt={applied:(e as any).applied||[]};throw e;}
}
export function reconcileRunningProcesses(){reconcileCertificateRenewals(runningProcesses,inventoryDatasets['certificate-snapshot.json'].certificates);}
watch(()=>inventoryDatasets['certificate-snapshot.json'].certificates,reconcileRunningProcesses,{deep:true});
export function applyPreviewChanges(ids:string[],reviewed:string){const chosen=pendingChanges.filter(c=>ids.includes(c.id));if(!chosen.length||JSON.stringify(chosen)!==reviewed)throw new Error('Pending changes changed during review. Review and snapshot again.');validateChangeBatch(chosen);
 for(const change of chosen){const process:RunningProcess={id:crypto.randomUUID(),name:change.name,namespace:change.namespace,category:change.category,status:'Simulated: Queued',startedAt:Date.now(),progress:0,resources:JSON.parse(JSON.stringify(change.resources)),configuration:change.configuration?JSON.parse(JSON.stringify(change.configuration)):undefined,simulated:true};runningProcesses.push(process);for(const [delay,progress,status]of [[1000,30,'Simulated: Validating'],[2500,65,'Simulated: Applying'],[4500,100,'Simulated: Completed']]as const)setTimeout(()=>{process.progress=progress;process.status=status;if(progress===100)process.finishedAt=Date.now();const target=runningProcesses.find(p=>p.id===process.id);if(target)Object.assign(target,process);},delay);}
 for(let i=pendingChanges.length-1;i>=0;i--)if(ids.includes(pendingChanges[i].id))pendingChanges.splice(i,1);
}
