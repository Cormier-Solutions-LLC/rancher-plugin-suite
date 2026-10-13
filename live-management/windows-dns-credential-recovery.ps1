# Loaded by the trusted Windows recovery agent, never invoked as a DNS job.
# Root, pinned CA and identity come from installed agent configuration.
Add-Type -AssemblyName System.Security
function Assert-DnsRecoveryRoot([string]$Root) {
 $directory=Get-Item -LiteralPath $Root -ErrorAction Stop
 if(!$directory.PSIsContainer -or ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Unsafe credential recovery directory'}
 $acl=Get-Acl -LiteralPath $directory.FullName
 if(!$acl.AreAccessRulesProtected){throw 'Credential recovery requires private directory permissions'}
 foreach($rule in $acl.Access){$sid=$rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value;if($rule.AccessControlType -eq 'Allow' -and $sid -notin @('S-1-5-18','S-1-5-32-544')){throw 'Credential recovery directory grants unexpected access'}}
 return $directory.FullName
}
function Get-DnsRecoveryPaths([string]$Root,[string]$Id) {
 if($Id -cnotmatch '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'){throw 'Invalid credential recovery reference'}
 $Root=Assert-DnsRecoveryRoot $Root
 foreach($name in @('kubeconfig.json','credential-recovery-active.json',('recovery-'+$Id+'.json'),('recovery-'+$Id+'.dpapi'))){$p=Join-Path $Root $name;if(Test-Path -LiteralPath $p){if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Unsafe credential recovery file'}}}
 return @{root=$Root;credential=(Join-Path $Root 'kubeconfig.json');lease=(Join-Path $Root 'credential-recovery-active.json');receipt=(Join-Path $Root ('recovery-'+$Id+'.json'));payload=(Join-Path $Root ('recovery-'+$Id+'.dpapi'))}
}
function Write-DnsRecoveryFile([string]$Path,[byte[]]$Bytes) {
 $temporary=Join-Path ([IO.Path]::GetDirectoryName($Path)) ('.tmp-'+[Guid]::NewGuid().ToString())
 try{$handle=[IO.File]::Open($temporary,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$handle.Write($Bytes,0,$Bytes.Length);$handle.Flush($true)}finally{$handle.Dispose()};if(Test-Path -LiteralPath $Path){[IO.File]::Replace($temporary,$Path,[NullString]::Value)}else{[IO.File]::Move($temporary,$Path)}}finally{if(Test-Path -LiteralPath $temporary){[IO.File]::Delete($temporary)}}
}
function Save-DnsRecoveryReceipt($Paths,$Receipt) {Write-DnsRecoveryFile $Paths.receipt ([Text.Encoding]::UTF8.GetBytes(($Receipt|ConvertTo-Json -Depth 12 -Compress)))}
function Get-DnsRecoveryPayload($Paths,[string]$Id) {
 try{$bytes=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($Paths.payload),[Text.Encoding]::UTF8.GetBytes('DnsCredentialRecovery/v1/'+$Id),[Security.Cryptography.DataProtectionScope]::LocalMachine);$payload=[Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json;if($payload.id -cne $Id){throw 'Identity differs'};return $payload}catch{throw 'Encrypted Windows credential recovery could not be unlocked'}
}
function Assert-DnsRecoveryConfiguration([string]$Json,[string]$ClusterCaData) {
 if(!$Json -or $Json.Length -gt 65536 -or !$ClusterCaData){throw 'Incomplete credential recovery configuration'}
 try{$value=$Json|ConvertFrom-Json}catch{throw 'Invalid credential recovery configuration'}
 if($value.apiVersion -ne 'v1' -or $value.kind -ne 'Config' -or @($value.clusters).Count -ne 1 -or @($value.users).Count -ne 1 -or @($value.contexts).Count -ne 1 -or $value.'current-context' -ne 'bridge'){throw 'Unexpected credential recovery context'}
 $cluster=$value.clusters[0];$user=$value.users[0];$context=$value.contexts[0]
 if($cluster.name -ne 'cluster' -or $cluster.cluster.server -cne 'https://10.99.15.50:6443' -or $cluster.cluster.'tls-server-name' -cne 'kubernetes.cormierconsulting.io' -or $cluster.cluster.'certificate-authority-data' -cne $ClusterCaData -or $user.name -ne 'bridge' -or $context.name -ne 'bridge' -or $context.context.cluster -ne 'cluster' -or $context.context.user -ne 'bridge' -or $context.context.namespace -ne 'dns-system' -or [string]$user.user.token -notmatch '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'){throw 'Credential recovery does not match the installed cluster and bridge'}
 foreach($check in @(@{object=$value;keys=@('apiVersion','kind','clusters','users','contexts','current-context','preferences')},@{object=$cluster;keys=@('name','cluster')},@{object=$cluster.cluster;keys=@('server','tls-server-name','certificate-authority-data')},@{object=$user;keys=@('name','user')},@{object=$user.user;keys=@('token')},@{object=$context;keys=@('name','context')},@{object=$context.context;keys=@('cluster','user','namespace')})){foreach($property in $check.object.PSObject.Properties){if($property.Name -notin $check.keys){throw 'Unsupported credential recovery settings'}}}
 # Equivalent kubeconfigs arrive from both PowerShell hashtables and JavaScript.
 # Compare a fixed field order rather than the original JSON property order.
 $canonical=[ordered]@{apiVersion='v1';kind='Config';clusters=@([ordered]@{name='cluster';cluster=[ordered]@{server='https://10.99.15.50:6443';'tls-server-name'='kubernetes.cormierconsulting.io';'certificate-authority-data'=$cluster.cluster.'certificate-authority-data'}});users=@([ordered]@{name='bridge';user=[ordered]@{token=[string]$user.user.token}});contexts=@([ordered]@{name='bridge';context=[ordered]@{cluster='cluster';user='bridge';namespace='dns-system'}});'current-context'='bridge'}
 return $canonical|ConvertTo-Json -Depth 12 -Compress
}
function Enter-DnsRecoveryLease($Paths,[string]$Id) {
 if(Test-Path -LiteralPath $Paths.lease){$lease=Get-Content -LiteralPath $Paths.lease -Raw|ConvertFrom-Json;if($lease.id -cne $Id){throw 'Another Windows credential recovery is incomplete'};return}
 $handle=[IO.File]::Open($Paths.lease,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$bytes=[Text.Encoding]::UTF8.GetBytes((@{id=$Id}|ConvertTo-Json -Compress));$handle.Write($bytes,0,$bytes.Length);$handle.Flush($true)}finally{$handle.Dispose()}
}
function Exit-DnsRecoveryLease($Paths,[string]$Id) {if(Test-Path -LiteralPath $Paths.lease){$lease=Get-Content -LiteralPath $Paths.lease -Raw|ConvertFrom-Json;if($lease.id -cne $Id){throw 'Credential recovery lease differs'};[IO.File]::Delete($Paths.lease)}}
function Test-DnsRecoveryBytes([byte[]]$First,[byte[]]$Second) {if($null -eq $First -or $null -eq $Second){return $null -eq $First -and $null -eq $Second};if($First.Length -ne $Second.Length){return $false};for($i=0;$i -lt $First.Length;$i++){if($First[$i] -ne $Second[$i]){return $false}};return $true}
function New-DnsCredentialRecovery {
 param([string]$Root,[string]$Id,[string]$TargetJson,[string]$ClusterCaData,[string]$AccountUid,[scriptblock]$AssertQuiescent)
 $paths=Get-DnsRecoveryPaths $Root $Id;$target=Assert-DnsRecoveryConfiguration $TargetJson $ClusterCaData
 if(!$AccountUid -or !$AssertQuiescent){throw 'Trusted service-account identity and bridge quiescence are required'}
 if(Test-Path -LiteralPath $paths.receipt){$prior=Get-Content -LiteralPath $paths.receipt -Raw|ConvertFrom-Json;$payload=Get-DnsRecoveryPayload $paths $Id;if($prior.id -cne $Id -or $payload.target -cne $target -or $payload.accountUid -cne $AccountUid){throw 'Original Windows recovery selection differs'};return $prior}
 Enter-DnsRecoveryLease $paths $Id
 $phase='quiescence'
 try{
  if((& $AssertQuiescent) -ne $true){throw 'Windows bridge is not confirmed quiescent'}
  $phase='current configuration'
  $before=if(Test-Path -LiteralPath $paths.credential){[Convert]::ToBase64String([IO.File]::ReadAllBytes($paths.credential))}else{$null}
  $targetBytes=[Text.Encoding]::UTF8.GetBytes($target)
  if($null -ne $before){try{$original=[Convert]::FromBase64String($before);if((Assert-DnsRecoveryConfiguration ([Text.Encoding]::UTF8.GetString($original)) $ClusterCaData) -ceq $target){$targetBytes=$original}}catch{}}
  $phase='encryption';$payload=@{id=$Id;before=$before;target=$target;targetBytes=[Convert]::ToBase64String($targetBytes);accountUid=$AccountUid};$encrypted=[Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes(($payload|ConvertTo-Json -Depth 10 -Compress)),[Text.Encoding]::UTF8.GetBytes('DnsCredentialRecovery/v1/'+$Id),[Security.Cryptography.DataProtectionScope]::LocalMachine)
  $phase='encrypted file persistence'
  Write-DnsRecoveryFile $paths.payload $encrypted
  $phase='receipt persistence'
  $receipt=@{id=$Id;version=1;status='Prepared';beforeExists=($null -ne $before);accountUid=$AccountUid;createdAt=[DateTime]::UtcNow.ToString('o');writeIntent=$false;finishedAt=$null};Save-DnsRecoveryReceipt $paths $receipt;return [pscustomobject]$receipt
 }catch{$cause=$_.Exception.GetBaseException();if(!(Test-Path -LiteralPath $paths.receipt)){Exit-DnsRecoveryLease $paths $Id};throw ('Windows credential recovery preparation failed at '+$phase+' ('+$cause.GetType().Name+'/'+$cause.HResult+')')}
}
function Confirm-DnsRecoveryTarget($Paths,$Payload,[scriptblock]$Authenticate) {
 if(!$Authenticate -or !(Test-Path -LiteralPath $Paths.credential) -or !(Test-DnsRecoveryBytes ([IO.File]::ReadAllBytes($Paths.credential)) ([Convert]::FromBase64String($Payload.targetBytes)))){return $false}
 return (& $Authenticate $Paths.credential $Payload.accountUid) -eq $true
}
function Invoke-DnsCredentialRecovery {
 param([string]$Root,[string]$Id,[scriptblock]$Authenticate,[scriptblock]$AssertQuiescent)
 $paths=Get-DnsRecoveryPaths $Root $Id;$receipt=Get-Content -LiteralPath $paths.receipt -Raw|ConvertFrom-Json;$payload=Get-DnsRecoveryPayload $paths $Id
 if(!$Authenticate -or !$AssertQuiescent -or $receipt.id -cne $Id -or $receipt.accountUid -cne $payload.accountUid){throw 'Trusted Windows recovery confirmation is unavailable'}
 if($receipt.status -eq 'Applied'){if(!(Confirm-DnsRecoveryTarget $paths $payload $Authenticate)){throw 'Applied Windows credential no longer matches its receipt'};Exit-DnsRecoveryLease $paths $Id;return $receipt}
 if($receipt.status -ne 'Prepared'){throw 'Reconcile the original Windows credential recovery'}
 Enter-DnsRecoveryLease $paths $Id
 $current=if(Test-Path -LiteralPath $paths.credential){[IO.File]::ReadAllBytes($paths.credential)}else{$null};$before=if($null -ne $payload.before){[Convert]::FromBase64String($payload.before)}else{$null}
 if(!(Test-DnsRecoveryBytes $current $before) -or (& $AssertQuiescent) -ne $true){throw 'Windows credentials or active operations changed after review'}
 # Authenticate from a private temporary candidate before the only file write.
 $candidate=Join-Path $paths.root ('candidate-'+$Id+'.json')
 try{Write-DnsRecoveryFile $candidate ([Convert]::FromBase64String($payload.targetBytes));if((& $Authenticate $candidate $payload.accountUid) -ne $true){throw 'Candidate rejected'}}catch{throw 'Restored Windows credential authentication was not confirmed'}finally{if(Test-Path -LiteralPath $candidate){[IO.File]::Delete($candidate)}}
 $receipt.status='Applying';$receipt.writeIntent=$true;Save-DnsRecoveryReceipt $paths $receipt
 try{
  $current=if(Test-Path -LiteralPath $paths.credential){[IO.File]::ReadAllBytes($paths.credential)}else{$null};if(!(Test-DnsRecoveryBytes $current $before)){throw 'Concurrent credential change'}
  if(!(Test-DnsRecoveryBytes $current ([Convert]::FromBase64String($payload.targetBytes)))){Write-DnsRecoveryFile $paths.credential ([Convert]::FromBase64String($payload.targetBytes))}
  if(!(Confirm-DnsRecoveryTarget $paths $payload $Authenticate)){throw 'Readback differs'}
  $receipt.status='Applied';$receipt.finishedAt=[DateTime]::UtcNow.ToString('o');Save-DnsRecoveryReceipt $paths $receipt
 }catch{$receipt.status='Interrupted';Save-DnsRecoveryReceipt $paths $receipt;throw 'Windows credential recovery requires reconciliation; no write is replayed'}
 Exit-DnsRecoveryLease $paths $Id;return $receipt
}
function Repair-DnsCredentialRecovery {
 param([string]$Root,[string]$Id,[scriptblock]$Authenticate)
 $paths=Get-DnsRecoveryPaths $Root $Id;$receipt=Get-Content -LiteralPath $paths.receipt -Raw|ConvertFrom-Json;$payload=Get-DnsRecoveryPayload $paths $Id
 if($receipt.id -cne $Id -or $receipt.accountUid -cne $payload.accountUid){throw 'Windows recovery identity differs'}
 if($receipt.status -eq 'Prepared'){return $receipt};Enter-DnsRecoveryLease $paths $Id
 if($receipt.writeIntent -and (Confirm-DnsRecoveryTarget $paths $payload $Authenticate)){$receipt.status='Applied';$receipt.finishedAt=[DateTime]::UtcNow.ToString('o');Save-DnsRecoveryReceipt $paths $receipt;Exit-DnsRecoveryLease $paths $Id}
 return $receipt
}
