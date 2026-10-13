$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$taskKubectl='C:\Program Files\Docker\Docker\resources\bin\kubectl.exe'
$taskFile=Join-Path $taskRoot 'live-management\windows-dns-bridge.ps1'
$taskErrors=$null
$null=[Management.Automation.Language.Parser]::ParseFile($taskFile,[ref]$null,[ref]$taskErrors)
if($taskErrors.Count){throw 'Bridge source does not parse'}
$taskQueue=(& $taskKubectl --server https://10.99.15.11:6443 --tls-server-name kubernetes.cormierconsulting.io -n dns-system get configmap dns-windows-queue -o json)|ConvertFrom-Json
if($LASTEXITCODE -ne 0 -or @($taskQueue.data.'jobs.json'|ConvertFrom-Json|Where-Object {$_.status -in @('Queued','Running')}).Count){throw 'Do not update the bridge while DNS operations are active'}
$taskSession=New-PSSession -ComputerName domain02.cormierconsulting.com
$taskBackup='windows-dns-bridge.before-zone-lifecycle-'+[DateTime]::UtcNow.ToString('yyyyMMddHHmmss')+'.ps1'
$taskStopped=$false
try {
 Invoke-Command -Session $taskSession -ArgumentList $taskBackup -ScriptBlock {
  param($backup)
  $ErrorActionPreference='Stop';$directory='C:\ProgramData\CormierDnsManager'
  $settings=Get-Content -LiteralPath ($directory+'\configuration.json') -Raw|ConvertFrom-Json
  $queue=(& $settings.kubectl --kubeconfig $settings.kubeconfig -n dns-system get configmap dns-windows-queue -o json)|ConvertFrom-Json
  if($LASTEXITCODE -ne 0 -or @($queue.data.'jobs.json'|ConvertFrom-Json|Where-Object {$_.status -in @('Queued','Running')}).Count){throw 'Bridge has an active write; update refused'}
  Copy-Item -LiteralPath ($directory+'\windows-dns-bridge.ps1') -Destination ($directory+'\'+$backup)
  Stop-ScheduledTask -TaskName 'Cormier DNS Manager Bridge'
 }
 $taskStopped=$true
 Copy-Item -LiteralPath $taskFile -Destination 'C:\ProgramData\CormierDnsManager\windows-dns-bridge.ps1' -ToSession $taskSession
 $taskHash=(Get-FileHash -LiteralPath $taskFile).Hash
 $taskResult=Invoke-Command -Session $taskSession -ArgumentList $taskHash,$taskBackup -ScriptBlock {
  param($hash,$backup)
  $ErrorActionPreference='Stop';$file='C:\ProgramData\CormierDnsManager\windows-dns-bridge.ps1'
  if((Get-FileHash -LiteralPath $file).Hash -ne $hash){throw 'Deployed bridge source hash differs'}
  Start-ScheduledTask -TaskName 'Cormier DNS Manager Bridge'
  [pscustomobject]@{host='domain02.cormierconsulting.com';sourceHash=$hash;privateBackup=$backup;startedAt=[DateTime]::UtcNow.ToString('o')}
 }
 $taskStopped=$false
 $taskResult|Select-Object host,sourceHash,privateBackup,startedAt|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $taskRoot '.local\manager-installation\dns-zone-bridge-rollout.json')
 Write-Output 'Windows bridge source updated with a private rollback copy; existing credentials were preserved.'
}finally{
 if($taskStopped){Invoke-Command -Session $taskSession -ArgumentList $taskBackup -ScriptBlock {param($backup);Copy-Item -LiteralPath ('C:\ProgramData\CormierDnsManager\'+$backup) -Destination 'C:\ProgramData\CormierDnsManager\windows-dns-bridge.ps1';Start-ScheduledTask -TaskName 'Cormier DNS Manager Bridge'}}
 Remove-PSSession $taskSession
}
