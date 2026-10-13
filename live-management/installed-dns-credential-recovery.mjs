import {mkdir,readFile,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {dnsCredentialRecovery} from './dns-credential-recovery.mjs';
import {dnsRecoveryCoordinator} from './dns-recovery-coordinator.mjs';
import {dnsEngineApi} from './dns-engine-api.mjs';
import {windowsCredentialRecovery} from './windows-credential-recovery.mjs';
import {windowsRecoveryChannel} from './windows-recovery-channel.mjs';
import {readWindowsRecoveryBootstrap,clusterWindowsRecoveryRequest} from './windows-recovery-bootstrap.mjs';
import {readDnsInventory} from '../preview-data/fresh-dns-source.mjs';
const requestPath='/api/v1/namespaces/dns-system/secrets/dns-windows-recovery-request',receiptPath='/api/v1/namespaces/dns-system/configmaps/dns-windows-recovery-receipt';
const fail=()=>Object.assign(new Error('The installed DNS credential recovery dependencies are unavailable.'),{status:503});
// Bootstrap pins are installed configuration, never HTTP parameters. The mounted
// identity publishes encrypted Windows requests only. Secret writes are performed
// by the authenticated caller through Rancher in the parent recovery session.
export function installedDnsCredentialRecovery({snapshotRoot,loadSnapshot,volumeUsedBytes,expectedUid=process.env.DNS_RECOVERY_BOOTSTRAP_UID,expectedDigest=process.env.DNS_RECOVERY_BOOTSTRAP_SHA256,quotaBytes=Number(process.env.SNAPSHOT_STORAGE_LIMIT_BYTES)||Infinity,request=clusterWindowsRecoveryRequest(),readInventory=readDnsInventory}={}){
 const directory=join(snapshotRoot,'credential-recovery');let recovery,initializing;
 async function call(path,method='GET',body){const result=await request(path,{method,...(body?{body:JSON.stringify(body)}:{})});if(![200,201].includes(result.status))throw fail();return result.body;}
 async function initialize(bootstrap){
  await mkdir(directory,{recursive:true,mode:0o700});
  const client={readRequest:()=>call(requestPath),readReceipt:()=>call(receiptPath),replaceRequest:value=>call(requestPath,'PUT',value)};
  // The independent Windows poller competes for the bridge's existing shared
  // lock. Its real preparation can outlast a twenty-second response window.
  // Keep the original durable request and wait longer; timeout still requires
  // reconciliation and never authorizes replay of an uncertain mutation.
  const channel=windowsRecoveryChannel({directory,client,...bootstrap}),windows=windowsCredentialRecovery({directory,channel,clusterUid:bootstrap.clusterUid,accountUid:bootstrap.accountUid,waitMs:60000});
  const coordinator=dnsRecoveryCoordinator({directory,windows,engineApi:dnsEngineApi(),readController:()=>readInventory('dns-manager-observations')});
  recovery=dnsCredentialRecovery({directory,loadSnapshot:async(id,password)=>{const document=await loadSnapshot(id,password);const index=JSON.parse(await readFile(join(snapshotRoot,id+'.meta.json'),'utf8'));if(index.id!==id||index.encrypted!==true||index.archiveFormat!=='zip')throw Object.assign(fail(),{status:422});return {encrypted:true,snapshot:document};},coordinator,quotaBytes:async()=>{
   // Recovery shares the configured snapshot volume budget. Files outside the
   // private recovery directory count toward its remaining quota too.
   const own=(await Promise.all((await readdir(directory)).map(name=>stat(join(directory,name))))).reduce((sum,s)=>sum+(s.isFile()?s.size:0),0);
   const outside=volumeUsedBytes?Math.max(0,(await volumeUsedBytes())-own):(await Promise.all((await readdir(snapshotRoot)).map(name=>stat(join(snapshotRoot,name))))).reduce((sum,s)=>sum+(s.isFile()?s.size:0),0);
   return Math.max(0,quotaBytes-outside);
  }});return recovery;
 }
 return async()=>{
  // Every request confirms that immutable public bindings still name the
  // installed channel. No stale initialization bypasses a missing bootstrap.
  const bootstrap=await readWindowsRecoveryBootstrap({expectedUid,expectedDigest,request});if(recovery)return recovery;
  if(!initializing)initializing=initialize(bootstrap).catch(e=>{initializing=null;throw e;});return initializing;
 };
}
