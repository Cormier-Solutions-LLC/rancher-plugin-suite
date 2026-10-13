# Only private bootstrap settings supply paths, namespace, identities and trust.
function Assert-DnsRecoveryAgentSettings($Settings){
 $fields=@('version','namespace','clusterUid','accountUid','agentAccountUid','requestUid','receiptUid','channelRoot','bridgeRoot','kubectl','clusterCaData','bridgeSourceDigest');$uuid='^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 if($Settings.version -ne 1 -or @($Settings.PSObject.Properties).Count -ne $fields.Count -or $Settings.namespace -cnotmatch '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$' -or $Settings.bridgeSourceDigest -cnotmatch '^[a-f0-9]{64}$' -or !$Settings.clusterCaData){throw 'Installed recovery settings are incomplete'}
 foreach($property in $Settings.PSObject.Properties){if($property.Name -notin $fields){throw 'Unexpected recovery setting'}};foreach($name in @('clusterUid','accountUid','agentAccountUid','requestUid','receiptUid')){if($Settings.$name -cnotmatch $uuid){throw 'Installed recovery identity is invalid'}}
 $null=Assert-DnsRecoveryRoot $Settings.channelRoot;$null=Assert-DnsRecoveryRoot $Settings.bridgeRoot
 $file=Get-Item -LiteralPath $Settings.kubectl -ErrorAction Stop;if($file.PSIsContainer -or !$file.FullName.EndsWith('.exe',[StringComparison]::OrdinalIgnoreCase) -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Installed Kubernetes executable differs'}
 foreach($path in @((Join-Path $Settings.channelRoot 'recovery-kubeconfig.json'),(Join-Path $Settings.bridgeRoot 'windows-dns-bridge.ps1'))){if((Get-Item -LiteralPath $path -ErrorAction Stop).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Unsafe installed recovery file'}}
 if((Get-FileHash -LiteralPath (Join-Path $Settings.bridgeRoot 'windows-dns-bridge.ps1') -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Settings.bridgeSourceDigest){throw 'Installed bridge recovery guard source differs'}
 $null=Assert-DnsRecoveryConfiguration ([IO.File]::ReadAllText((Join-Path $Settings.channelRoot 'recovery-kubeconfig.json'))) $Settings.clusterCaData
 return $Settings
}
function Invoke-DnsRecoveryKube($Settings,[string]$Credential,[string]$Kind,[string]$Name,[switch]$Missing){
 $allowed=@{secret=@('dns-windows-recovery-request','dns-windows-bridge-credential');configmap=@('dns-windows-queue','dns-windows-observations','dns-windows-recovery-receipt');serviceaccount=@('dns-windows-bridge','dns-windows-recovery-agent')}
 if(!$allowed.ContainsKey($Kind) -or $Name -notin $allowed[$Kind]){throw 'Unexpected independent recovery read'}
 $options=@('--request-timeout=10s','--kubeconfig',$Credential,'-n',$Settings.namespace,'get',$Kind,$Name,'-o','json');if($Missing){if($Name -ne 'dns-windows-bridge-credential'){throw 'Unexpected optional recovery read'};$options+=@('--ignore-not-found')}
 $raw=& $Settings.kubectl @options 2>$null;if($LASTEXITCODE -ne 0){throw 'Independent recovery API read failed'};$text=$raw -join "`n";if(!$text){if($Missing){return $null};throw 'Independent recovery API returned no object'};if($text.Length -gt 2097152){throw 'Independent recovery API response exceeded its bound'};try{return $text|ConvertFrom-Json}catch{throw 'Independent recovery API response is invalid'}
}
function Confirm-DnsRecoveryIdentity($Settings,[string]$Credential,[string]$Name,[string]$Uid){
 try{$raw=& $Settings.kubectl --request-timeout=10s --kubeconfig $Credential auth whoami -o json 2>$null;if($LASTEXITCODE -ne 0){return $false};$identity=($raw|ConvertFrom-Json).status.userInfo;if($identity.username -cne ('system:serviceaccount:'+$Settings.namespace+':'+$Name) -or $identity.uid -cne $Uid -or @(@('system:authenticated','system:serviceaccounts',('system:serviceaccounts:'+$Settings.namespace))|Where-Object {$_ -notin $identity.groups}).Count){return $false};return $true}catch{return $false}
}
function Get-DnsRecoverySecretDigest($Secret){
 $canonical=@($Secret.data.'ca.crt',$Secret.data.namespace,$Secret.data.token)|ConvertTo-Json -Compress;$sha=[Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonical)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
}
function New-DnsRecoveryApiProviders($Settings){
 $Settings=Assert-DnsRecoveryAgentSettings $Settings;$credential=Join-Path $Settings.channelRoot 'recovery-kubeconfig.json'
 $quiescent={
  $account=Invoke-DnsRecoveryKube $Settings $credential serviceaccount 'dns-windows-bridge';if($account.metadata.uid -cne $Settings.accountUid -or $account.metadata.deletionTimestamp){throw 'Bridge service-account identity differs'}
  $inventory=Invoke-DnsRecoveryKube $Settings $credential configmap 'dns-windows-observations';$observed=$inventory.data.'inventory.json'|ConvertFrom-Json;if($observed.credentialRecoveryGuard.version -ne 1 -or $observed.credentialRecoveryGuard.sourceDigest -cne $Settings.bridgeSourceDigest){throw 'Running bridge recovery guard is unconfirmed'}
  $queue=Invoke-DnsRecoveryKube $Settings $credential configmap 'dns-windows-queue';$jobs=@(($queue.data.'jobs.json'|ConvertFrom-Json)|ForEach-Object {$_});if($jobs.Count -gt 1000){throw 'DNS queue exceeded its bound'}
  # The caller holds the shared bridge lock. Running entries left by a crash
  # are history, not active work; the restored bridge marks them Interrupted.
  return $true
 }.GetNewClosure()
 $prepare={param($id)
  if((& $quiescent) -ne $true){throw 'Bridge guard is unavailable'};$path=Join-Path $Settings.channelRoot ('channel-secret-baseline-'+$id+'.json');if(Test-Path -LiteralPath $path){$prior=Read-DnsChannelFile $path;if($prior.id -cne $id){throw 'Recovery baseline differs'};return}
  $secret=Invoke-DnsRecoveryKube $Settings $credential secret 'dns-windows-bridge-credential' -Missing
  $baseline=@{id=$id;uid=if($secret){$secret.metadata.uid}else{$null};digest=if($secret){Get-DnsRecoverySecretDigest $secret}else{$null}}
  Write-DnsRecoveryFile $path ([Text.Encoding]::UTF8.GetBytes(($baseline|ConvertTo-Json -Compress)))
 }.GetNewClosure()
 $secretTarget={param($id,$payload)
  $account=Invoke-DnsRecoveryKube $Settings $credential serviceaccount 'dns-windows-bridge';if($account.metadata.uid -cne $Settings.accountUid -or $payload.accountUid -cne $Settings.accountUid -or $account.metadata.deletionTimestamp){return $false}
  $secret=Invoke-DnsRecoveryKube $Settings $credential secret 'dns-windows-bridge-credential' -Missing;if(!$secret -or $secret.type -cne 'kubernetes.io/service-account-token' -or $secret.metadata.deletionTimestamp -or @($secret.data.PSObject.Properties).Count -ne 3 -or $secret.metadata.annotations.'kubernetes.io/service-account.name' -cne 'dns-windows-bridge' -or $secret.metadata.annotations.'kubernetes.io/service-account.uid' -cne $Settings.accountUid){return $false}
  $target=$payload.target|ConvertFrom-Json
  if($secret.data.'ca.crt' -cne $Settings.clusterCaData -or $secret.data.namespace -cne [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Settings.namespace)) -or $secret.data.token -cne [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($target.users[0].user.token))){return $false}
  $baseline=Read-DnsChannelFile (Join-Path $Settings.channelRoot ('channel-secret-baseline-'+$id+'.json'));if($baseline.id -cne $id -or ($baseline.uid -and $secret.metadata.uid -cne $baseline.uid)){return $false}
  return $secret.metadata.annotations.'dns-manager.cormierconsulting.io/credential-recovery' -ceq ($id+'/dns-windows-bridge-credential') -or ($baseline.uid -and $baseline.digest -ceq (Get-DnsRecoverySecretDigest $secret))
 }.GetNewClosure()
 $authenticate={param($path,$uid)
  $account=Invoke-DnsRecoveryKube $Settings $credential serviceaccount 'dns-windows-bridge';if($account.metadata.uid -cne $uid -or $uid -cne $Settings.accountUid -or $account.metadata.deletionTimestamp -or !(Confirm-DnsRecoveryIdentity $Settings $path 'dns-windows-bridge' $uid)){return $false}
  foreach($name in @('dns-windows-queue','dns-windows-observations')){$null=Invoke-DnsRecoveryKube $Settings $path configmap $name};return $true
 }.GetNewClosure()
 return @{AssertQuiescent=$quiescent;PrepareContext=$prepare;AssertSecretTarget=$secretTarget;Authenticate=$authenticate}
}
function Invoke-DnsRecoveryAgentIteration($Settings,[int64]$Now=([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())){
 $Settings=Assert-DnsRecoveryAgentSettings $Settings;$credential=Join-Path $Settings.channelRoot 'recovery-kubeconfig.json'
 if(!(Confirm-DnsRecoveryIdentity $Settings $credential 'dns-windows-recovery-agent' $Settings.agentAccountUid)){throw 'Independent recovery identity was not authenticated'}
 $queue=Invoke-DnsRecoveryKube $Settings $credential secret 'dns-windows-recovery-request'
 if($queue.metadata.uid -cne $Settings.requestUid -or $queue.metadata.deletionTimestamp -or $queue.type -cne 'Opaque' -or @($queue.data.PSObject.Properties).Count -ne 1 -or !$queue.data.PSObject.Properties['request.jwe']){throw 'Independent recovery queue identity differs'}
 $encoded=$queue.data.'request.jwe';if(!$encoded){return};if($encoded.Length -gt 180000){throw 'Recovery queue exceeds its bound'};try{$bytes=[Convert]::FromBase64String($encoded);if([Convert]::ToBase64String($bytes) -cne $encoded){throw 'Noncanonical encoding'};$envelope=[Text.UTF8Encoding]::new($false,$true).GetString($bytes)}catch{throw 'Recovery queue encoding differs'}
 $providers=New-DnsRecoveryApiProviders $Settings
 $outcome=Invoke-DnsRecoveryChannelRequest -ChannelRoot $Settings.channelRoot -BridgeRoot $Settings.bridgeRoot -Envelope $envelope -ClusterUid $Settings.clusterUid -AccountUid $Settings.accountUid -ClusterCaData $Settings.clusterCaData @providers -Now $Now
 $receipt=Invoke-DnsRecoveryKube $Settings $credential configmap 'dns-windows-recovery-receipt';if($receipt.metadata.uid -cne $Settings.receiptUid -or $receipt.metadata.deletionTimestamp -or @($receipt.data.PSObject.Properties).Count -ne 1 -or !$receipt.data.PSObject.Properties['receipt.json']){throw 'Recovery receipt identity differs'}
 $json=$outcome|ConvertTo-Json -Depth 8 -Compress;if($receipt.data.'receipt.json' -ceq $json){return $outcome};$receipt.data.'receipt.json'=$json
 $null=($receipt|ConvertTo-Json -Depth 20 -Compress)|& $Settings.kubectl --request-timeout=10s --kubeconfig $credential -n $Settings.namespace replace -f - -o json 2>$null;if($LASTEXITCODE -ne 0){throw 'Recovery acknowledgement submission was not confirmed'}
 $observed=Invoke-DnsRecoveryKube $Settings $credential configmap 'dns-windows-recovery-receipt';if($observed.metadata.uid -cne $Settings.receiptUid -or $observed.data.'receipt.json' -cne $json){throw 'Recovery acknowledgement readback differs'};return $outcome
}
