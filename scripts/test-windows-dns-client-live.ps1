$ErrorActionPreference = 'Stop'
$taskReportPath = Join-Path $PSScriptRoot '../.local/manager-installation/windows-dns-client-live-tests.json'
$taskServers = @('10.99.15.55', '10.99.15.56', '10.99.15.57', '10.99.15.58')
$taskSource = '10.99.3.2'
$taskCases = @(
    @{ Name = '_ldap._tcp.dc._msdcs.cormierconsulting.com.'; Type = 'SRV'; Code = 33 },
    @{ Name = '_kerberos._tcp.cormierconsulting.com.'; Type = 'SRV'; Code = 33 },
    @{ Name = '_ldap._tcp.gc._msdcs.cormierconsulting.com.'; Type = 'SRV'; Code = 33 },
    @{ Name = 'domain02.cormierconsulting.com.'; Type = 'A'; Code = 1 },
    @{ Name = '2.3.99.10.in-addr.arpa.'; Type = 'PTR'; Code = 12 },
    @{ Name = 'cormierconsulting.com.'; Type = 'NS'; Code = 2 },
    @{ Name = 'cormierconsulting.com.'; Type = 'SOA'; Code = 6 }
)
function Get-TaskAdapterState {
    ConvertTo-Json -InputObject @(Get-DnsClientServerAddress | Sort-Object InterfaceIndex, AddressFamily | Select-Object InterfaceIndex, AddressFamily, ServerAddresses) -Depth 5 -Compress
}
function Get-TaskAnswers($Name, $Type, $Server, $Tcp) {
    $taskArgs = @{ Name = $Name; Type = $Type; Server = $Server; DnsOnly = $true; NoHostsFile = $true; QuickTimeout = $true; ErrorAction = 'Stop' }
    if ($Tcp) { $taskArgs.TcpOnly = $true }
    @(Resolve-DnsName @taskArgs)
}
function Convert-TaskAnswers($Answers, $Code) {
    $taskNormalized = @($Answers | Where-Object { [int]$_.Type -eq $Code } | ForEach-Object {
        $taskAnswer = $_
        $taskEntry = [ordered]@{ Name = $taskAnswer.Name.ToLowerInvariant().TrimEnd('.'); Type = [int]$taskAnswer.Type }
        foreach ($taskField in @('IPAddress', 'NameHost', 'NameTarget', 'Port', 'Priority', 'Weight', 'PrimaryServer', 'NameAdministrator', 'SerialNumber', 'TimeToZoneRefresh', 'TimeToZoneFailureRetry', 'TimeToExpiration', 'DefaultTTL')) {
            if ($null -ne $taskAnswer.$taskField) {
                $taskValue = $taskAnswer.$taskField
                if ($taskValue -is [string]) { $taskValue = $taskValue.ToLowerInvariant().TrimEnd('.') }
                $taskEntry[$taskField] = $taskValue
            }
        }
        ConvertTo-Json -InputObject $taskEntry -Compress
    } | Sort-Object)
    if ($taskNormalized.Count -eq 0) { throw 'No requested DNS answers' }
    ConvertTo-Json -InputObject $taskNormalized -Compress
}
$taskBefore = Get-TaskAdapterState
$taskResults = [System.Collections.Generic.List[object]]::new()
$taskBaselines = @{}
foreach ($taskTcp in @($false, $true)) {
    $taskMode = if ($taskTcp) { 'forced TCP' } else { 'default DNS transport' }
    foreach ($taskCase in $taskCases) {
        $taskKey = "$($taskCase.Type)/$($taskCase.Name)/$taskMode"
        $taskBaseline = Convert-TaskAnswers (Get-TaskAnswers $taskCase.Name $taskCase.Type $taskSource $taskTcp) $taskCase.Code
        $taskBaselines[$taskKey] = $taskBaseline
        foreach ($taskServer in $taskServers) {
            try {
                $taskActual = Convert-TaskAnswers (Get-TaskAnswers $taskCase.Name $taskCase.Type $taskServer $taskTcp) $taskCase.Code
                $taskResults.Add(@{ name = $taskCase.Name; type = $taskCase.Type; server = $taskServer; transport = $taskMode; matchesWindowsSource = ($taskActual -ceq $taskBaseline); passed = ($taskActual -ceq $taskBaseline) })
            } catch {
                $taskResults.Add(@{ name = $taskCase.Name; type = $taskCase.Type; server = $taskServer; transport = $taskMode; passed = $false; errorCode = $_.FullyQualifiedErrorId })
            }
        }
    }
    foreach ($taskServer in $taskServers) {
        try {
            $taskShort = Get-TaskAnswers 'domain02.' 'A' $taskServer $taskTcp
            $taskA = @($taskShort | Where-Object { [int]$_.Type -eq 1 })
            $taskCname = @($taskShort | Where-Object { [int]$_.Type -eq 5 })
            $taskPassed = $taskA.Count -eq 1 -and $taskA[0].IPAddress -eq $taskSource -and $taskCname.Count -eq 2 -and @($taskCname | Where-Object { $_.Name -eq 'domain02' -and $_.NameHost -eq 'domain02.cormierconsulting.io' }).Count -eq 1 -and @($taskCname | Where-Object { $_.Name -eq 'domain02.cormierconsulting.io' -and $_.NameHost -eq 'domain02.cormierconsulting.com' }).Count -eq 1
            $taskResults.Add(@{ name = 'domain02.'; type = 'raw short-name A'; server = $taskServer; transport = $taskMode; expectedAliasChainPreserved = $taskPassed; passed = $taskPassed })
        } catch { $taskResults.Add(@{ name = 'domain02.'; type = 'raw short-name A'; server = $taskServer; transport = $taskMode; passed = $false; errorCode = $_.FullyQualifiedErrorId }) }
    }
}
$taskSourceStable = $true
foreach ($taskTcp in @($false, $true)) {
    $taskMode = if ($taskTcp) { 'forced TCP' } else { 'default DNS transport' }
    foreach ($taskCase in $taskCases) {
        $taskKey = "$($taskCase.Type)/$($taskCase.Name)/$taskMode"
        if ((Convert-TaskAnswers (Get-TaskAnswers $taskCase.Name $taskCase.Type $taskSource $taskTcp) $taskCase.Code) -cne $taskBaselines[$taskKey]) { $taskSourceStable = $false }
    }
}
$taskUnchanged = (Get-TaskAdapterState) -ceq $taskBefore
$taskFailures = @($taskResults | Where-Object { !$_.passed })
$taskReport = [ordered]@{ observedAt = [DateTime]::UtcNow.ToString('o'); windowsResolverApi = 'Resolve-DnsName'; servers = $taskServers; assertions = $taskResults.Count; results = @($taskResults); sourceAnswersStableDuringTest = $taskSourceStable; clientAdapterDnsSettingsUnchanged = $taskUnchanged; domainAuthenticationUnverified = $true; secureDynamicUpdatesUnverified = $true; dhcpLeaseRenewalUnverified = $true; actualClientSearchListExpansionUnverified = $true; passed = ($taskFailures.Count -eq 0 -and $taskSourceStable -and $taskUnchanged) }
$taskReport | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $taskReportPath -Encoding utf8
[pscustomobject]@{ observedAt = $taskReport.observedAt; assertions = $taskReport.assertions; failures = $taskFailures.Count; sourceStable = $taskSourceStable; clientSettingsUnchanged = $taskUnchanged; passed = $taskReport.passed } | ConvertTo-Json -Compress
if (!$taskReport.passed) { exit 1 }
