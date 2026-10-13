param([string[]]$Servers=@('10.99.15.55','10.99.15.56','10.99.15.57','10.99.15.58'),[string]$ResultName='dns-live-record-tests.json')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$label='manager-acceptance-'+[Guid]::NewGuid().ToString('N').Substring(0,10)
$zone='cormierconsulting.io'
$results=[Collections.Generic.List[object]]::new()
function Check([string]$server,[string]$name,[string]$type,[string]$expected,[switch]$Tcp){
 $watch=[Diagnostics.Stopwatch]::StartNew()
 $last='';$deadline=[DateTime]::UtcNow.AddSeconds(60)
 do{
  try {
   $transport=if($Tcp){'tcp'}else{'udp'}
   $last=& dotnet (Join-Path $root 'dns-manager-dev/tests/LiveQuery/bin/Release/net10.0/LiveQuery.dll') $server $name $type $transport
   if($LASTEXITCODE -ne 0){throw 'Raw DNS query failed'}
   if($last.Contains($expected)){
    $results.Add([pscustomobject]@{server=$server;name=$name;type=$type;tcp=[bool]$Tcp;expected=$expected;passed=$true;milliseconds=$watch.ElapsedMilliseconds})
    return
   }
  }catch{$last=$_.Exception.Message}
  Start-Sleep -Seconds 2
 }while([DateTime]::UtcNow -lt $deadline)
 throw "DNS assertion failed at $server $name $type (TCP=$Tcp): $last"
}
function RemoveFixture {
 Invoke-Command -ComputerName domain02.cormierconsulting.com -ArgumentList $label,$zone -ScriptBlock {
  param($label,$zone)
  foreach($name in @("$label-a","$label-aaaa","$label-alias","$label-txt","$label-mx","_test._tcp.$label","$label-ptr")){
   $record=Get-DnsServerResourceRecord -ZoneName $zone -Name $name -ErrorAction SilentlyContinue
   if($record){Remove-DnsServerResourceRecord -ZoneName $zone -InputObject $record -Force}
  }
 } | Out-Null
}
try {
 Invoke-Command -ComputerName domain02.cormierconsulting.com -ArgumentList $label,$zone -ScriptBlock {
  param($label,$zone)
  $ErrorActionPreference='Stop';$ttl=[TimeSpan]::FromSeconds(5)
  Add-DnsServerResourceRecordA -ZoneName $zone -Name "$label-a" -IPv4Address '192.0.2.101' -TimeToLive $ttl
  Add-DnsServerResourceRecordAAAA -ZoneName $zone -Name "$label-aaaa" -IPv6Address '2001:db8::101' -TimeToLive $ttl
  Add-DnsServerResourceRecordCName -ZoneName $zone -Name "$label-alias" -HostNameAlias "$label-a.$zone" -TimeToLive $ttl
  Add-DnsServerResourceRecord -ZoneName $zone -Name "$label-txt" -Txt -DescriptiveText 'manager-acceptance' -TimeToLive $ttl
  Add-DnsServerResourceRecordMX -ZoneName $zone -Name "$label-mx" -MailExchange "$label-a.$zone" -Preference 10 -TimeToLive $ttl
  Add-DnsServerResourceRecord -ZoneName $zone -Name "_test._tcp.$label" -Srv -DomainName "$label-a.$zone" -Priority 10 -Weight 5 -Port 8443 -TimeToLive $ttl
  Add-DnsServerResourceRecordPtr -ZoneName $zone -Name "$label-ptr" -PtrDomainName "$label-a.$zone" -TimeToLive $ttl
 } | Out-Null
 foreach($server in $servers){foreach($tcp in @($false,$true)){
  Check $server "$label-a.$zone" A '192.0.2.101' -Tcp:$tcp
  Check $server "$label-aaaa.$zone" AAAA '2001:db8::101' -Tcp:$tcp
  Check $server "$label-alias.$zone" A '192.0.2.101' -Tcp:$tcp
  Check $server "$label-txt.$zone" TXT 'manager-acceptance' -Tcp:$tcp
  Check $server "$label-mx.$zone" MX "$label-a.$zone" -Tcp:$tcp
  Check $server "_test._tcp.$label.$zone" SRV '8443' -Tcp:$tcp
  Check $server "$label-ptr.$zone" PTR "$label-a.$zone" -Tcp:$tcp
  Check $server $zone SOA 'domain' -Tcp:$tcp
  Check $server $zone NS 'cormierconsulting' -Tcp:$tcp
 }}
 Invoke-Command -ComputerName domain02.cormierconsulting.com -ArgumentList $label,$zone -ScriptBlock {
  param($label,$zone)
  $old=Get-DnsServerResourceRecord -ZoneName $zone -Name "$label-a" -RRType A
  $next=Get-DnsServerResourceRecord -ZoneName $zone -Name "$label-a" -RRType A
  $next.RecordData.IPv4Address=[Net.IPAddress]'192.0.2.102'
  Set-DnsServerResourceRecord -ZoneName $zone -OldInputObject $old -NewInputObject $next
 } | Out-Null
 Check '10.99.3.2' "$label-a.$zone" A '192.0.2.102'
 foreach($server in $servers){Check $server "$label-a.$zone" A '192.0.2.102'}
 foreach($server in $servers){foreach($tcp in @($false,$true)){
  Check $server "$label-a.$zone" AAAA '"answers":[]' -Tcp:$tcp
 }}
 RemoveFixture
 foreach($server in $servers){foreach($tcp in @($false,$true)){
  Check $server "$label-txt.$zone" TXT '"rcode":"NxDomain"' -Tcp:$tcp
  Check $server "$label-a.$zone" A '"rcode":"NxDomain"' -Tcp:$tcp
 }}
 Write-Output "Passed $($results.Count) live record/transport/update assertions."
}finally {
 RemoveFixture
 $results|ConvertTo-Json -Depth 5|Set-Content (Join-Path $root ".local/manager-installation/$ResultName")
}
