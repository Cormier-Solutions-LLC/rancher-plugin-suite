const reject=()=>{throw new Error('Source connection test returned incompatible, stale or inconsistent evidence.');};
const address=value=>value.includes(':')?new URL('http://['+value+']/').hostname.slice(1,-1):value;
const domain=value=>String(value).toLowerCase().replace(/\.$/,'');const serial=value=>Number.isInteger(value)&&value>=0&&value<=4294967295;
export function validateDnsSourceTestResult(result,settings,{now=Date.now(),after=now}={}){
 try{
  const tested=Date.parse(result?.testedAt),completed=Date.parse(result?.completedAt),source=result?.source,checks=result?.checks;
  if(result?.configurationChanged!==false||!Number.isFinite(tested)||!Number.isFinite(completed)||tested<after-5000||now-tested>30000||completed<tested||completed>now+5000||tested>now+5000||!source||source.name!==settings.name.trim()||source.type!==settings.type||source.host!==domain(settings.host)||source.address!==address(settings.address)||source.credential!==settings.credential.trim()||!checks)reject();
  const query=checks.dnsQuery,transfer=checks.zoneTransfer,windows=checks.windowsManagement;
  if(!['Verified','Unverified'].includes(query?.status)||query.protocol!=='UDP'||typeof query.zone!=='string'||!query.zone||query.zone.length>253||query.status==='Verified'&&!serial(query.serial))reject();
  if(!['Verified','Unverified','ChangedDuringTest'].includes(transfer?.status)||transfer.protocol!=='TCP'||transfer.zone!==query.zone||transfer.status!=='Unverified'&&(!serial(transfer.serial)||!Number.isInteger(transfer.records)||transfer.records<2||transfer.records>20000||!Number.isInteger(transfer.frames)||transfer.frames<1||transfer.frames>20000))reject();
  if(query.status==='Verified'&&transfer.status==='Verified'&&transfer.serial!==query.serial||transfer.status==='ChangedDuringTest'&&(query.status!=='Verified'||transfer.serial===query.serial))reject();
  if(!['ObservedBindingVerified','RegisteredBindingVerified','Unverified'].includes(windows?.status))reject();const managementVerified=['ObservedBindingVerified','RegisteredBindingVerified'].includes(windows.status);if(managementVerified){const observed=Date.parse(windows.observedAt);if(!Number.isFinite(observed)||now-observed>=120000||observed>now+5000)reject();}
  const verified=query.status==='Verified'&&transfer.status==='Verified'&&managementVerified;if(result.verified!==verified)reject();return result;
 }catch{reject();}
}
