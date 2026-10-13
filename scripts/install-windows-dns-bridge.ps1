$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$kubectl='C:\Program Files\Docker\Docker\resources\bin\kubectl.exe'
$hostName='domain02.cormierconsulting.com'
$target='C:\ProgramData\CormierDnsManager'
& $kubectl apply --server-side -f (Join-Path $root 'live-management/dns-windows-bridge.yaml')
if($LASTEXITCODE -ne 0){throw 'Bridge authorization installation failed'}
foreach($entry in @(@{name='dns-windows-queue';key='jobs.json';value='[]'},@{name='dns-windows-observations';key='inventory.json';value='{}'})) {
 & $kubectl -n dns-system get configmap $entry.name 2>$null | Out-Null
 if($LASTEXITCODE -ne 0){& $kubectl -n dns-system create configmap $entry.name "--from-literal=$($entry.key)=$($entry.value)";if($LASTEXITCODE -ne 0){throw 'Bridge state initialization failed'}}
}
$secret=(& $kubectl -n dns-system get secret dns-windows-bridge-credential -o json)|ConvertFrom-Json
if(!$secret.data.token){throw 'Scoped bridge credential is not initialized; retry installation after token issuance'}
$token=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($secret.data.token))
$current=(& $kubectl config view --raw --minify -o json)|ConvertFrom-Json
$ca=$current.clusters[0].cluster.'certificate-authority-data'
if(!$ca){throw 'An embedded cluster CA is required'}
$bridgeConfig=@{apiVersion='v1';kind='Config';clusters=@(@{name='cluster';cluster=@{server='https://10.99.15.50:6443';'tls-server-name'='kubernetes.cormierconsulting.io';'certificate-authority-data'=$ca}});users=@(@{name='bridge';user=@{token=$token}});contexts=@(@{name='bridge';context=@{cluster='cluster';user='bridge';namespace='dns-system'}});'current-context'='bridge'}
$session=New-PSSession -ComputerName $hostName
try {
 Invoke-Command -Session $session -ArgumentList $target -ScriptBlock {param($target);New-Item -ItemType Directory -Force $target | Out-Null;& icacls $target /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null;if($LASTEXITCODE -ne 0){throw 'Private bridge directory permissions failed'}}
 Copy-Item -LiteralPath $kubectl -Destination ($target+'\kubectl.exe') -ToSession $session
 Copy-Item -LiteralPath (Join-Path $root 'live-management/windows-dns-bridge.ps1') -Destination ($target+'\windows-dns-bridge.ps1') -ToSession $session
 $json=$bridgeConfig|ConvertTo-Json -Depth 15
 Invoke-Command -Session $session -ArgumentList $target,$json -ScriptBlock {
  param($target,$json)
  [IO.File]::WriteAllText($target+'\kubeconfig.json',$json,[Text.UTF8Encoding]::new($false))
  $config=@{kubectl=$target+'\kubectl.exe';kubeconfig=$target+'\kubeconfig.json'}|ConvertTo-Json
  [IO.File]::WriteAllText($target+'\configuration.json',$config,[Text.UTF8Encoding]::new($false))
  $action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -File "'+$target+'\windows-dns-bridge.ps1" -Continuous')
  $triggers=@((New-ScheduledTaskTrigger -AtStartup),(New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval ([TimeSpan]::FromMinutes(1))))
  $settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
  Register-ScheduledTask -TaskName 'Cormier DNS Manager Bridge' -Action $action -Trigger $triggers -Settings $settings -User 'SYSTEM' -RunLevel Highest -Force | Out-Null
  Start-ScheduledTask -TaskName 'Cormier DNS Manager Bridge'
  Get-ScheduledTask -TaskName 'Cormier DNS Manager Bridge' | Select-Object TaskName,State
 }
} finally {Remove-PSSession $session;$token=$null;$json=$null;$bridgeConfig=$null}
