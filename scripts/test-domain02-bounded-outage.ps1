param(
  [int]$OutageSeconds = 90,
  [string]$EvidencePath = '.local/manager-installation/domain02-bounded-outage-tests.json'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$evidence = Join-Path $root $EvidencePath
$query = Join-Path $root 'dns-manager-dev/tests/LiveQuery/bin/Release/net10.0/LiveQuery.dll'
$kubectl = 'C:\Program Files\Docker\Docker\resources\bin\kubectl.exe'
$hostName = 'domain02.cormierconsulting.com'
$sourceIp = '10.99.3.2'
$servers = @('10.99.15.55','10.99.15.56','10.99.15.57','10.99.15.58')
$id = [guid]::NewGuid().ToString('N')
$remoteScript = "C:\ProgramData\CormierDnsManager\domain02-outage-$id.ps1"
$remoteLog = "C:\ProgramData\CormierDnsManager\domain02-outage-$id.json"
$taskName = "Cormier DNS Manager Bounded Outage $id"

function Save-Evidence([System.Collections.IDictionary]$state) {
  $state | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $evidence -Encoding utf8
}

function Test-Tcp53([string]$address, [int]$timeoutMs = 500) {
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $pending = $client.ConnectAsync($address, 53)
    if (-not $pending.Wait($timeoutMs)) { return $false }
    return $client.Connected
  } catch { return $false } finally { $client.Dispose() }
}

function Query([string]$server, [string]$name, [string]$type, [string]$transport) {
  $raw = & dotnet $query $server $name $type $transport 2>&1
  if ($LASTEXITCODE -ne 0) { throw "DNS query failed: $server $transport $name $type :: $raw" }
  $answer = $raw | ConvertFrom-Json
  if ($answer.rcode -ne 'NoError' -or @($answer.answers).Count -lt 1) {
    throw "DNS answer failed: $server $transport $name $type :: $raw"
  }
  [ordered]@{ server=$server; transport=$transport; name=$name; type=$type; rcode=$answer.rcode; authoritative=$answer.authoritative; answers=@($answer.answers) }
}

$state = [ordered]@{
  id = $id
  startedAt = [DateTime]::UtcNow.ToString('o')
  target = [ordered]@{ host=$hostName; address=$sourceIp; adapter='Ethernet'; outageSeconds=$OutageSeconds }
  method = 'Abrupt production-NIC isolation by a one-shot SYSTEM task with automatic local re-enable'
  physicalHostPowerCut = $false
  status = 'Preparing'
  checks = @()
}
Save-Evidence $state

$baseline = Invoke-Command -ComputerName $hostName -ScriptBlock {
  $os = Get-CimInstance Win32_OperatingSystem
  $adapter = Get-NetAdapter -Name 'Ethernet'
  [ordered]@{
    bootTime = $os.LastBootUpTime.ToUniversalTime().ToString('o')
    adapterStatus = [string]$adapter.Status
    interfaceIndex = $adapter.ifIndex
    macAddress = $adapter.MacAddress
    dnsService = [string](Get-Service DNS).Status
    bridgeTask = [string](Get-ScheduledTask -TaskName 'Cormier DNS Manager Bridge').State
    recoveryTask = [string](Get-ScheduledTask -TaskName 'Cormier DNS Manager Recovery Agent').State
  }
}
$state.baseline = $baseline
if ($baseline.adapterStatus -ne 'Up' -or $baseline.dnsService -ne 'Running') { throw 'Domain02 baseline is not healthy' }
if (-not (Test-Tcp53 $sourceIp)) { throw 'Domain02 TCP/53 baseline is not reachable' }

$state.baselineQueries = @(
  Query '10.99.15.58' 'domain02.cormierconsulting.com' 'A' 'udp'
  Query '10.99.15.58' '_ldap._tcp.dc._msdcs.cormierconsulting.com' 'SRV' 'tcp'
  Query '10.99.15.58' '2.3.99.10.in-addr.arpa' 'PTR' 'udp'
  Query '10.99.15.58' 'example.com' 'A' 'tcp'
)

$payload = @"
`$ErrorActionPreference = 'Stop'
`$log = '$remoteLog'
`$state = [ordered]@{ id='$id'; startedAt=[DateTime]::UtcNow.ToString('o'); adapter='Ethernet'; status='Starting' }
function Save-State { `$state | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath `$log -Encoding utf8 }
Save-State
try {
  Disable-NetAdapter -Name 'Ethernet' -Confirm:`$false
  `$state.status='Isolated'; `$state.isolatedAt=[DateTime]::UtcNow.ToString('o'); Save-State
  Start-Sleep -Seconds $OutageSeconds
} finally {
  Enable-NetAdapter -Name 'Ethernet' -Confirm:`$false -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 8
  `$state.status='Recovered'; `$state.recoveredAt=[DateTime]::UtcNow.ToString('o'); Save-State
}
"@

Invoke-Command -ComputerName $hostName -ArgumentList $remoteScript,$payload,$taskName -ScriptBlock {
  param($path,$content,$name)
  Set-Content -LiteralPath $path -Value $content -Encoding utf8
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$path`""
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $name -Action $action -Principal $principal -Settings $settings -Force | Out-Null
  Start-ScheduledTask -TaskName $name
}

$state.status = 'WaitingForIsolation'
$state.outageIntentAt = [DateTime]::UtcNow.ToString('o')
Save-Evidence $state
$deadline = [DateTime]::UtcNow.AddSeconds(35)
do {
  if (-not (Test-Tcp53 $sourceIp 300)) { $downAt = [DateTime]::UtcNow; break }
  Start-Sleep -Milliseconds 500
} while ([DateTime]::UtcNow -lt $deadline)
if (-not $downAt) { throw 'Domain02 did not become unreachable within the isolation deadline' }
$state.status = 'Isolated'
$state.sourceUnreachableAt = $downAt.ToString('o')
Save-Evidence $state

$outageQueries = [Collections.Generic.List[object]]::new()
foreach ($round in 1..3) {
  foreach ($server in $servers) {
    foreach ($transport in @('udp','tcp')) {
      $outageQueries.Add((Query $server 'domain02.cormierconsulting.com' 'A' $transport))
      $outageQueries.Add((Query $server '_ldap._tcp.dc._msdcs.cormierconsulting.com' 'SRV' $transport))
    }
  }
  $outageQueries.Add((Query '10.99.15.58' 'example.com' 'A' 'udp'))
  $outageQueries.Add((Query '10.99.15.58' 'example.com' 'A' 'tcp'))
}
$state.outageQueries = @($outageQueries)
$state.sourceStillUnreachableAfterQueries = -not (Test-Tcp53 $sourceIp 300)
$state.kubernetesDuringOutage = (& $kubectl -n dns-system get deployment/dns-manager-controller statefulset/dns-manager-engine -o json | ConvertFrom-Json).items | ForEach-Object {
  [ordered]@{ kind=$_.kind; name=$_.metadata.name; ready=if($_.kind -eq 'Deployment'){$_.status.readyReplicas}else{$_.status.readyReplicas}; desired=if($_.kind -eq 'Deployment'){$_.spec.replicas}else{$_.spec.replicas} }
}
Save-Evidence $state
if (-not $state.sourceStillUnreachableAfterQueries) { throw 'Domain02 recovered before the bounded outage assertions completed' }
if (@($state.kubernetesDuringOutage | Where-Object {$_.ready -ne $_.desired}).Count -gt 0) { throw 'DNS Manager workloads lost readiness during the outage' }

$state.status = 'WaitingForRecovery'
Save-Evidence $state
$recoveryDeadline = [DateTime]::UtcNow.AddMinutes(4)
do {
  if (Test-Tcp53 $sourceIp 700) { $recoveredAt = [DateTime]::UtcNow; break }
  Start-Sleep -Seconds 2
} while ([DateTime]::UtcNow -lt $recoveryDeadline)
if (-not $recoveredAt) { throw 'Domain02 did not automatically recover within four minutes' }

$remoteFinal = $null
for ($attempt=0; $attempt -lt 30 -and -not $remoteFinal; $attempt++) {
  try {
    $remoteFinal = Invoke-Command -ComputerName $hostName -ArgumentList $remoteLog -ScriptBlock {
      param($log)
      $os = Get-CimInstance Win32_OperatingSystem
      $logged = if (Test-Path -LiteralPath $log) { Get-Content -LiteralPath $log -Raw | ConvertFrom-Json } else { $null }
      [ordered]@{
        bootTime = $os.LastBootUpTime.ToUniversalTime().ToString('o')
        adapterStatus = [string](Get-NetAdapter -Name 'Ethernet').Status
        dnsService = [string](Get-Service DNS).Status
        bridgeTask = [string](Get-ScheduledTask -TaskName 'Cormier DNS Manager Bridge').State
        recoveryTask = [string](Get-ScheduledTask -TaskName 'Cormier DNS Manager Recovery Agent').State
        log = $logged
      }
    }
  } catch { Start-Sleep -Seconds 3 }
}
if (-not $remoteFinal) { throw 'WinRM did not recover after TCP/53 returned' }

$state.recoveredAt = $recoveredAt.ToString('o')
$state.outageDurationSeconds = [math]::Round(($recoveredAt - $downAt).TotalSeconds, 3)
$state.remoteFinal = $remoteFinal
$state.postRecoveryQueries = @(
  Query '10.99.15.55' 'domain02.cormierconsulting.com' 'A' 'udp'
  Query '10.99.15.56' '_ldap._tcp.dc._msdcs.cormierconsulting.com' 'SRV' 'tcp'
  Query '10.99.15.57' '2.3.99.10.in-addr.arpa' 'PTR' 'udp'
  Query '10.99.15.58' 'example.com' 'A' 'tcp'
)

Invoke-Command -ComputerName $hostName -ArgumentList $taskName,$remoteScript,$remoteLog -ScriptBlock {
  param($name,$script,$log)
  Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $script,$log -Force -ErrorAction SilentlyContinue
}

$state.cleanup = [ordered]@{ taskRemoved=$true; remoteFilesRemoved=$true }
$state.status = 'Passed'
$state.finishedAt = [DateTime]::UtcNow.ToString('o')
$state.passed = ($state.outageQueries.Count -eq 54 -and $state.remoteFinal.adapterStatus -eq 'Up' -and $state.remoteFinal.dnsService -eq 'Running' -and $state.remoteFinal.bootTime -eq $state.baseline.bootTime)
Save-Evidence $state
if (-not $state.passed) { throw 'Domain02 bounded outage checks did not pass' }
$state | ConvertTo-Json -Depth 20
