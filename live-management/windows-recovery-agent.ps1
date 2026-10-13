param([string]$ConfigurationPath='C:\ProgramData\CormierDnsManager\RecoveryChannel\agent.json',[switch]$Continuous)
$ErrorActionPreference='Stop';$root=Split-Path $ConfigurationPath -Parent
foreach($source in @('windows-dns-credential-recovery.ps1','windows-recovery-envelope.ps1','windows-recovery-channel.ps1','windows-recovery-agent-api.ps1')){. (Join-Path $root $source)}
$null=Assert-DnsRecoveryRoot $root;if((Get-Item -LiteralPath $ConfigurationPath).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Unsafe recovery configuration'}
$settings=[IO.File]::ReadAllText($ConfigurationPath)|ConvertFrom-Json
if($settings.namespace -cne 'dns-system' -or [IO.Path]::GetFullPath($settings.channelRoot) -cne 'C:\ProgramData\CormierDnsManager\RecoveryChannel' -or [IO.Path]::GetFullPath($settings.bridgeRoot) -cne 'C:\ProgramData\CormierDnsManager'){throw 'Installed recovery scope differs'}
$pollerLock=Open-DnsRecoveryLock $root 'recovery-poller.lock'
try{do{
 try{$null=Invoke-DnsRecoveryAgentIteration $settings;Write-DnsRecoveryFile (Join-Path $root 'last-agent-health.json') ([Text.Encoding]::UTF8.GetBytes((@{at=[DateTime]::UtcNow.ToString('o');reachable=$true}|ConvertTo-Json -Compress)))}
 catch{Write-DnsRecoveryFile (Join-Path $root 'last-agent-health.json') ([Text.Encoding]::UTF8.GetBytes((@{at=[DateTime]::UtcNow.ToString('o');reachable=$false;error='Independent Windows recovery is unconfirmed'}|ConvertTo-Json -Compress)))}
 # Jitter avoids repeatedly colliding with the bridge's five-second iteration.
 if($Continuous){Start-Sleep -Milliseconds (4000+(Get-Random -Minimum 0 -Maximum 3001))}
}while($Continuous)}finally{$pollerLock.Dispose()}
