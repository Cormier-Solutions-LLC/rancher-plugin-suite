param(
 [string]$Name='manager-native-dns-acceptance.cormierconsulting.io',
 [string]$Address,
 [int]$Ttl=60,
 [switch]$Absent,
 [string]$ResultName='native-dns-observations.json'
)
$ErrorActionPreference='Stop'
if(!$Absent -and !$Address){throw 'Supply Address or Absent.'}
if($ResultName -notmatch '^[a-z0-9-]+\.json$'){throw 'Use a simple result filename.'}
$taskRoot=Split-Path $PSScriptRoot -Parent
$taskQuery=Join-Path $taskRoot 'dns-manager-dev/tests/LiveQuery/bin/Release/net10.0/LiveQuery.dll'
$taskResults=[Collections.Generic.List[object]]::new()
foreach($taskServer in @('10.99.3.2','10.99.15.55','10.99.15.56','10.99.15.57','10.99.15.58')){
 foreach($taskTransport in @('udp','tcp')){
  $taskResponse=& dotnet $taskQuery $taskServer $Name A $taskTransport
  if($LASTEXITCODE -ne 0){throw "Query failed: $taskServer $taskTransport"}
  $taskParsed=$taskResponse|ConvertFrom-Json
  $taskMatches=@($taskParsed.answers|Where-Object {$_.type -eq 'A' -and $_.name.TrimEnd('.') -eq $Name.TrimEnd('.')})
  $taskPassed=if($Absent){$taskParsed.rcode -eq 'NXDomain' -and !$taskMatches.Count}else{
   $taskParsed.rcode -eq 'NoError' -and $taskParsed.authoritative -and $taskMatches.Count -eq 1 -and $taskMatches[0].value -eq $Address -and $taskMatches[0].ttl -eq $Ttl
  }
  $taskResults.Add([pscustomobject]@{server=$taskServer;transport=$taskTransport;name=$Name;passed=[bool]$taskPassed;response=$taskParsed})
 }
}
$taskReport=[pscustomobject]@{observedAt=[DateTime]::UtcNow.ToString('o');absent=[bool]$Absent;address=$Address;ttl=$Ttl;results=$taskResults.ToArray()}
$taskReport|ConvertTo-Json -Depth 8|Set-Content (Join-Path $taskRoot ".local/manager-installation/$ResultName")
if(@($taskResults|Where-Object {!$_.passed}).Count){throw "Native DNS verification failed; inspect $ResultName."}
Write-Output "All 10 native DNS $ResultName assertions passed."
