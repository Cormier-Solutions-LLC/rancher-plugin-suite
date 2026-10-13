
import {managerFetch} from '../../../../../live-management/manager-api.mjs';
const fetch=(url:string, options?:RequestInit)=>managerFetch('dns-manager',url,options);
import {captureRelevantSecrets} from './snapshot-secrets';
import {withoutSecretValues} from '../config/backup-zip.mjs';
import { ref } from 'vue';
let capture:()=>any=()=>({}),restore:(change:any)=>void=()=>{},scope:(ns?:string)=>boolean=()=>true;
export function configureSnapshotAdapter(options:any){capture=options.capture;restore=options.restore;scope=options.matches;}
export const captureScheduleSource=(namespace='')=>{const data=JSON.parse(JSON.stringify(capture()));if(namespace){const configs=[data.configuration,...(data.relatedConfigurations||[])].filter(c=>c&&(!c.namespace||c.namespace===namespace));data.configuration=configs[0];data.relatedConfigurations=configs.slice(1);}return data;};
export const restoreDnsDraft=(change:any)=>restore(change);
export const snapshotContextMatches=(namespace?:string)=>scope(namespace);
export const scheduleState=ref<any>(null),snapshotStorage=ref<any>(null),storageError=ref('');
async function api(path:string,method='GET',body?:any){const response=await fetch('/api/'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('DNS backup backend unavailable.');const data=await response.json();if(!response.ok||data.error)throw new Error(data.error||'DNS backup backend unavailable.');return data;}
export async function loadSchedule(){return scheduleState.value=await api('snapshot-schedule');}
export async function saveSchedule(input:any){return scheduleState.value=await api('snapshot-schedule','PUT',{...input,current:input.current?(input.includeSecrets?await captureRelevantSecrets(input.current):withoutSecretValues(input.current)):undefined});}
export async function runSchedule(namespace:string,password='',includeSecrets=false){const result=await api('snapshot-schedule/run','POST',{current:withoutSecretValues(captureScheduleSource(namespace)),password,includeSecrets});await loadSchedule();return result;}
export async function refreshSnapshotStorage(){try{snapshotStorage.value=await api('snapshot-storage');storageError.value='';}catch(e){snapshotStorage.value=null;storageError.value='Available Snapshot Storage Cannot Be Measured';}}
