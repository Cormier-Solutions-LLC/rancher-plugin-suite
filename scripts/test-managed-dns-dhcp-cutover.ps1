param(
    [string]$InterfaceAlias = 'vEthernet (Home Lab)',
    [string]$PrimaryDns = '10.99.15.58',
    [string]$FallbackDns = '10.99.3.2',
    [string]$DnsSuffix = 'cormierconsulting.com'
)

$ErrorActionPreference = 'Stop'

$reportPath = Join-Path $PSScriptRoot '../.local/manager-installation/managed-dns-dhcp-cutover.json'
$adapter = Get-NetAdapter -Name $InterfaceAlias -ErrorAction Stop
$configuration = Get-NetIPConfiguration -InterfaceIndex $adapter.ifIndex
$dnsClient = Get-DnsClient -InterfaceIndex $adapter.ifIndex
$dnsAddresses = @(Get-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4).ServerAddresses
$interfaceKey = "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces\$($adapter.InterfaceGuid)"
$dhcp = Get-ItemProperty -LiteralPath $interfaceKey

function Select-Answer($answers, $type) {
    @($answers | Where-Object { $_.Type -eq $type })
}

$shortName = Select-Answer (Resolve-DnsName 'domain02' -Type A -DnsOnly -NoHostsFile -QuickTimeout) 1
$fqdn = Select-Answer (Resolve-DnsName 'domain02.cormierconsulting.com' -Type A -DnsOnly -NoHostsFile -QuickTimeout) 1
$reverse = Select-Answer (Resolve-DnsName '10.99.3.2' -Type PTR -DnsOnly -NoHostsFile -QuickTimeout) 12
$service = Select-Answer (Resolve-DnsName '_ldap._tcp.dc._msdcs.cormierconsulting.com' -Type SRV -DnsOnly -NoHostsFile -QuickTimeout) 33
$public = Select-Answer (Resolve-DnsName 'www.cloudflare.com' -Type A -DnsOnly -NoHostsFile -QuickTimeout) 1

$assertions = [ordered]@{
    adapterUsesDhcp = $configuration.NetIPv4Interface.Dhcp.ToString() -eq 'Enabled'
    resolverOrder = ($dnsAddresses.Count -eq 2 -and $dnsAddresses[0] -eq $PrimaryDns -and $dnsAddresses[1] -eq $FallbackDns)
    dhcpResolverOption = ($dhcp.DhcpNameServer -replace ',', ' ' -replace '\s+', ' ').Trim() -eq "$PrimaryDns $FallbackDns"
    connectionSuffix = $dnsClient.ConnectionSpecificSuffix -eq $DnsSuffix
    dhcpSuffixOption = $dhcp.DhcpDomain -eq $DnsSuffix
    leasePresent = [int64]$dhcp.Lease -gt 0 -and [int64]$dhcp.LeaseTerminatesTime -gt [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    shortNameExpansion = $shortName.Count -eq 1 -and $shortName[0].Name -eq "domain02.$DnsSuffix" -and $shortName[0].IPAddress -eq '10.99.3.2'
    fqdnResolution = $fqdn.Count -eq 1 -and $fqdn[0].IPAddress -eq '10.99.3.2'
    reverseResolution = $reverse.Count -eq 1 -and $reverse[0].NameHost.TrimEnd('.') -eq "domain02.$DnsSuffix"
    serviceDiscovery = $service.Count -ge 1 -and @($service | Where-Object { $_.NameTarget.TrimEnd('.') -eq "domain02.$DnsSuffix" -and $_.Port -eq 389 }).Count -ge 1
    publicRecursion = $public.Count -ge 1
}
$failed = @($assertions.GetEnumerator() | Where-Object { -not $_.Value } | ForEach-Object Key)
$report = [ordered]@{
    observedAt = [DateTime]::UtcNow.ToString('o')
    interfaceAlias = $InterfaceAlias
    interfaceIndex = $adapter.ifIndex
    ipv4Address = $configuration.IPv4Address.IPAddress
    gateway = $configuration.IPv4DefaultGateway.NextHop
    dnsServers = $dnsAddresses
    connectionSpecificSuffix = $dnsClient.ConnectionSpecificSuffix
    leaseSeconds = [int64]$dhcp.Lease
    leaseObtainedAt = [DateTimeOffset]::FromUnixTimeSeconds([int64]$dhcp.LeaseObtainedTime).UtcDateTime.ToString('o')
    leaseExpiresAt = [DateTimeOffset]::FromUnixTimeSeconds([int64]$dhcp.LeaseTerminatesTime).UtcDateTime.ToString('o')
    assertions = $assertions
    failedAssertions = $failed
    dhcpLeaseRenewalVerified = [bool]$assertions.leasePresent
    actualClientSearchListExpansionVerified = [bool]$assertions.shortNameExpansion
    passed = $failed.Count -eq 0
}
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $reportPath -Encoding utf8
[pscustomobject]@{
    observedAt = $report.observedAt
    assertions = $assertions.Count
    failures = $failed.Count
    resolverOrder = $report.dnsServers -join ','
    suffix = $report.connectionSpecificSuffix
    passed = $report.passed
} | ConvertTo-Json -Compress
if (-not $report.passed) { exit 1 }
