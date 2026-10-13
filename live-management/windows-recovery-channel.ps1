# Loaded only by the installed independent recovery agent. Queue publishers are
# constrained by Kubernetes RBAC; encryption alone does not authenticate them.
function Open-DnsRecoveryLock([string]$Root,[string]$Name){
 $Root=Assert-DnsRecoveryRoot $Root;if($Name -notin @('recovery-agent.lock','recovery-poller.lock','bridge-mutation.lock')){throw 'Unexpected recovery lock'}
 $path=Join-Path $Root $Name;if((Test-Path -LiteralPath $path) -and ((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Unsafe recovery lock'}
 try{return [IO.File]::Open($path,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}catch{throw 'Another DNS operation holds the recovery lock'}
}
function Get-DnsEnvelopeDigest([string]$Envelope){$hash=[Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($Envelope)))).Replace('-','').ToLowerInvariant()}finally{$hash.Dispose()}}
function Read-DnsChannelFile([string]$Path){
 if((Get-Item -LiteralPath $Path -ErrorAction Stop).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Unsafe channel receipt'}
 $file=Get-Item -LiteralPath $Path;if($file.Length -gt 8192){throw 'Oversized channel receipt'};return [IO.File]::ReadAllText($Path)|ConvertFrom-Json
}
function Assert-DnsChannelReceipt($Receipt,[string]$ClusterUid,[string]$AccountUid,[string]$Digest){
 $fields=@('version','id','requestId','userId','clusterUid','accountUid','action','envelopeDigest','status','transactionStatus');$uuid='^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 if(@($Receipt.PSObject.Properties).Count -ne $fields.Count -or $Receipt.version -ne 1 -or $Receipt.id -cnotmatch $uuid -or $Receipt.requestId -cnotmatch $uuid -or $Receipt.userId -cnotmatch '^user-[a-z0-9-]+$' -or $Receipt.clusterUid -cne $ClusterUid -or $Receipt.accountUid -cne $AccountUid -or $Receipt.envelopeDigest -cne $Digest -or $Receipt.action -notin @('prepare','commit','reconcile','status') -or $Receipt.status -notin @('Intent','Succeeded','Interrupted','Rejected') -or $Receipt.transactionStatus -notin @('Prepared','Applied','Interrupted','Unavailable')){throw 'Recovery channel receipt differs'}
 foreach($property in $Receipt.PSObject.Properties){if($property.Name -notin $fields){throw 'Unexpected receipt field'}}
 return $Receipt
}
function Invoke-DnsRecoveryChannelRequest {
 param([string]$ChannelRoot,[string]$BridgeRoot,[string]$Envelope,[string]$ClusterUid,[string]$AccountUid,[string]$ClusterCaData,[scriptblock]$AssertQuiescent,[scriptblock]$Authenticate,[scriptblock]$AssertSecretTarget,[scriptblock]$PrepareContext,[int64]$Now=([DateTimeOffset]::UtcNow.ToUnixTimeSeconds()))
 $ChannelRoot=Assert-DnsRecoveryRoot $ChannelRoot;$BridgeRoot=Assert-DnsRecoveryRoot $BridgeRoot
 if(!$AssertQuiescent -or !$Authenticate -or !$AssertSecretTarget){throw 'Trusted recovery providers are unavailable'}
 $agentLock=Open-DnsRecoveryLock $ChannelRoot 'recovery-agent.lock';$bridgeLock=$null
 try{
  $hash=Get-DnsEnvelopeDigest $Envelope;$currentPath=Join-Path $ChannelRoot 'channel-current-request.json'
  if(Test-Path -LiteralPath $currentPath){
   $current=Read-DnsChannelFile $currentPath
   if($current.envelopeDigest -ceq $hash){
    if($current.requestId -cnotmatch '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'){throw 'Current channel request differs'}
    $requestPath=Join-Path $ChannelRoot ('channel-request-'+$current.requestId+'.json');$prior=Assert-DnsChannelReceipt (Read-DnsChannelFile $requestPath) $ClusterUid $AccountUid $hash
    # A known exact envelope can return its durable acknowledgement after expiry.
    # Its prior Intent is never executed again, even after a process crash.
    if($prior.status -eq 'Intent'){$prior.status='Interrupted';$prior.transactionStatus='Interrupted';Write-DnsRecoveryFile $requestPath ([Text.Encoding]::UTF8.GetBytes(($prior|ConvertTo-Json -Compress)))}
    return $prior
   }
  }
  $message=Read-DnsRecoveryEnvelope -Root $ChannelRoot -Envelope $Envelope -ClusterUid $ClusterUid -AccountUid $AccountUid -Now $Now -AllowExpired
  $ownerPath=Join-Path $ChannelRoot ('channel-owner-'+$message.id+'.json');$requestPath=Join-Path $ChannelRoot ('channel-request-'+$message.requestId+'.json')
  if($message.expiresAt -le $Now -or $message.issuedAt -lt $Now-600){
   if(Test-Path -LiteralPath $requestPath){$prior=Assert-DnsChannelReceipt (Read-DnsChannelFile $requestPath) $ClusterUid $AccountUid $hash;if($prior.status -eq 'Intent'){$prior.status='Interrupted';$prior.transactionStatus='Interrupted';Write-DnsRecoveryFile $requestPath ([Text.Encoding]::UTF8.GetBytes(($prior|ConvertTo-Json -Compress)))};return $prior}
   $expired=@{version=1;id=$message.id;requestId=$message.requestId;userId=$message.userId;clusterUid=$ClusterUid;accountUid=$AccountUid;action=$message.action;envelopeDigest=$hash;status='Rejected';transactionStatus='Unavailable'}
   Write-DnsRecoveryFile $requestPath ([Text.Encoding]::UTF8.GetBytes(($expired|ConvertTo-Json -Compress)));return [pscustomobject]$expired
  }
  if(Test-Path -LiteralPath $ownerPath){$owner=Read-DnsChannelFile $ownerPath;foreach($field in @('id','userId','clusterUid','accountUid')){if($owner.$field -cne $message.$field){throw 'Windows recovery belongs to another selection'}}}
  elseif($message.action -eq 'prepare'){$owner=@{id=$message.id;userId=$message.userId;clusterUid=$message.clusterUid;accountUid=$message.accountUid};Write-DnsRecoveryFile $ownerPath ([Text.Encoding]::UTF8.GetBytes(($owner|ConvertTo-Json -Compress)))}
  else{throw 'Windows recovery preparation is unavailable'}
  if(Test-Path -LiteralPath $requestPath){
   $prior=Assert-DnsChannelReceipt (Read-DnsChannelFile $requestPath) $ClusterUid $AccountUid $hash;foreach($field in @('id','requestId','userId','clusterUid','accountUid','action')){if($prior.$field -cne $message.$field){throw 'Recovery request selection differs'}}
   if($prior.status -eq 'Intent'){$prior.status='Interrupted';$prior.transactionStatus='Interrupted';Write-DnsRecoveryFile $requestPath ([Text.Encoding]::UTF8.GetBytes(($prior|ConvertTo-Json -Compress)))}
   if($prior.status -notin @('Succeeded','Interrupted','Rejected')){throw 'Recovery request receipt is incomplete'};return $prior
  }
  # The bridge holds this same file lock around its entire queue iteration.
  # Preparing the durable lease while holding it blocks subsequent DNS work.
  $bridgeLock=Open-DnsRecoveryLock $BridgeRoot 'bridge-mutation.lock'
  $receipt=@{version=1;id=$message.id;requestId=$message.requestId;userId=$message.userId;clusterUid=$ClusterUid;accountUid=$AccountUid;action=$message.action;envelopeDigest=$hash;status='Intent';transactionStatus='Unavailable'}
  Write-DnsRecoveryFile $requestPath ([Text.Encoding]::UTF8.GetBytes(($receipt|ConvertTo-Json -Compress)))
  Write-DnsRecoveryFile $currentPath ([Text.Encoding]::UTF8.GetBytes((@{requestId=$message.requestId;envelopeDigest=$hash}|ConvertTo-Json -Compress)))
  try{
   switch($message.action){
    'prepare' {if($PrepareContext){& $PrepareContext $message.id};$result=New-DnsCredentialRecovery -Root $BridgeRoot -Id $message.id -TargetJson $message.target.configuration -ClusterCaData $ClusterCaData -AccountUid $AccountUid -AssertQuiescent $AssertQuiescent}
    'commit' {
     $paths=Get-DnsRecoveryPaths $BridgeRoot $message.id;$payload=Get-DnsRecoveryPayload $paths $message.id
     if((& $AssertSecretTarget $message.id $payload) -ne $true){throw 'Current Kubernetes credential differs'}
     $result=Invoke-DnsCredentialRecovery -Root $BridgeRoot -Id $message.id -Authenticate $Authenticate -AssertQuiescent $AssertQuiescent
    }
    'reconcile' {
     $paths=Get-DnsRecoveryPaths $BridgeRoot $message.id;$payload=Get-DnsRecoveryPayload $paths $message.id
     if((& $AssertSecretTarget $message.id $payload) -ne $true){throw 'Current Kubernetes credential differs'}
     $result=Repair-DnsCredentialRecovery -Root $BridgeRoot -Id $message.id -Authenticate $Authenticate
    }
    'status' {$paths=Get-DnsRecoveryPaths $BridgeRoot $message.id;$result=Read-DnsChannelFile $paths.receipt;if($result.id -cne $message.id -or $result.accountUid -cne $AccountUid){throw 'Recovery identity differs'};if($result.status -eq 'Applied'){$payload=Get-DnsRecoveryPayload $paths $message.id;if((& $AssertSecretTarget $message.id $payload) -ne $true -or !(Confirm-DnsRecoveryTarget $paths $payload $Authenticate)){throw 'Current Windows credential health is unconfirmed'}}}
   }
   if($result.status -notin @('Prepared','Applied','Interrupted')){throw 'Windows credential outcome is unconfirmed'}
   $receipt.status='Succeeded';$receipt.transactionStatus=$result.status
  }catch{$receipt.status='Interrupted';$receipt.transactionStatus='Interrupted'}
  Write-DnsRecoveryFile $requestPath ([Text.Encoding]::UTF8.GetBytes(($receipt|ConvertTo-Json -Compress)));return [pscustomobject]$receipt
 }finally{if($bridgeLock){$bridgeLock.Dispose()};$agentLock.Dispose()}
}
