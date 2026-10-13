param([string]$Id,[string]$RequestId)
$ErrorActionPreference='Stop';$uuid='^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';if($Id -cnotmatch $uuid -or $RequestId -cnotmatch $uuid){throw 'Invalid original recovery reference'}
$session=New-PSSession -ComputerName domain02.cormierconsulting.com
try{Invoke-Command -Session $session -ArgumentList $Id,$RequestId -ScriptBlock {
 param($Id,$RequestId);$ErrorActionPreference='Stop';$root='C:\ProgramData\CormierDnsManager\RecoveryChannel';$bridge='C:\ProgramData\CormierDnsManager';. (Join-Path $root 'windows-dns-credential-recovery.ps1');$null=Assert-DnsRecoveryRoot $root;$null=Assert-DnsRecoveryRoot $bridge
 $held=$false;try{$probe=[IO.File]::Open((Join-Path $bridge 'bridge-mutation.lock'),[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$probe.Dispose()}catch [IO.IOException]{$held=$true}
 $health=Get-Content -LiteralPath (Join-Path $root 'last-agent-health.json') -Raw|ConvertFrom-Json
 $current=$null;$p=Join-Path $root 'channel-current-request.json';if(Test-Path -LiteralPath $p){$r=Get-Content -LiteralPath $p -Raw|ConvertFrom-Json;$current=@{requestId=$r.requestId;envelopeDigest=$r.envelopeDigest}}
 $channel=$null;$p=Join-Path $root ('channel-request-'+$RequestId+'.json');if(Test-Path -LiteralPath $p){$r=Get-Content -LiteralPath $p -Raw|ConvertFrom-Json;$channel=@{id=$r.id;requestId=$r.requestId;action=$r.action;status=$r.status;transactionStatus=$r.transactionStatus}}
 $local=$null;$p=Join-Path $bridge ('recovery-'+$Id+'.json');if(Test-Path -LiteralPath $p){$r=Get-Content -LiteralPath $p -Raw|ConvertFrom-Json;$local=@{id=$r.id;status=$r.status;writeIntent=$r.writeIntent;writeConfirmed=$r.writeConfirmed}}
 $lease=$null;$p=Join-Path $bridge 'credential-recovery-active.json';if(Test-Path -LiteralPath $p){$r=Get-Content -LiteralPath $p -Raw|ConvertFrom-Json;$lease=@{id=$r.id}}
 @{observedAt=[DateTime]::UtcNow.ToString('o');health=$health;bridgeMutationLockHeld=$held;currentRequest=$current;channelReceipt=$channel;localReceipt=$local;localLease=$lease;ordinaryBridgeState=[string](Get-ScheduledTask -TaskName 'Cormier DNS Manager Bridge').State;recoveryAgentState=[string](Get-ScheduledTask -TaskName 'Cormier DNS Manager Recovery Agent').State}|ConvertTo-Json -Depth 6
}}finally{Remove-PSSession $session}
