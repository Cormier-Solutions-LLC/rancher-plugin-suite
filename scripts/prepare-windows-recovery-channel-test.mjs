import {readFile,writeFile}from'node:fs/promises';import{randomUUID}from'node:crypto';import{encryptWindowsRecovery}from'../live-management/windows-recovery-envelope.mjs';
const [input,output]=process.argv.slice(2),fixture=JSON.parse(await readFile(input,'utf8'));
const id=randomUUID(),message=(action,changes={})=>({version:1,id,requestId:randomUUID(),userId:'user-test',clusterUid:fixture.clusterUid,accountUid:fixture.accountUid,action,issuedAt:10000,expiresAt:10300,...(action==='prepare'?{target:{configuration:fixture.target}}:{}),...changes});
const cases={};for(const name of ['prepare','secretDenied','lostCommit','reconcile','status','foreignOwner','quiescentDenied','afterQuiescence','agentBusy','bridgeBusy','crashBeforePrepare','candidateRejected','candidateRetry']){
 const action=name==='prepare'||['quiescentDenied','afterQuiescence','agentBusy','bridgeBusy','crashBeforePrepare','candidateRejected'].includes(name)?'prepare':name==='reconcile'?'reconcile':name==='status'||name==='foreignOwner'?'status':'commit';
 const changes=name==='foreignOwner'?{userId:'user-other'}:['quiescentDenied','afterQuiescence'].includes(name)?{id:fixture.quiescentId}:['agentBusy','bridgeBusy','crashBeforePrepare'].includes(name)?{id:fixture.lockId}:['candidateRejected','candidateRetry'].includes(name)?{id:fixture.candidateId}:{};
 if(name==='candidateRejected')changes.target={configuration:fixture.target};
 const value=message(action,changes);cases[name]={message:{...value,target:undefined},envelope:encryptWindowsRecovery(value,fixture.key,{now:10000})};
}
await writeFile(output,JSON.stringify({...fixture,target:undefined,key:undefined,cases},null,2));console.log('Prepared 13 encrypted synthetic channel requests; no private key transferred.');
