param([string]$ConfigurationPath='C:\ProgramData\CormierDnsManager\configuration.json',[switch]$Continuous)
$ErrorActionPreference='Stop'
$configuration=Get-Content -LiteralPath $ConfigurationPath -Raw | ConvertFrom-Json
$bridgeRuntimeSourceDigest=(Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
$kubectl=$configuration.kubectl
$kubeconfig=$configuration.kubeconfig
$namespace='dns-system'
$queueName='dns-windows-queue'
$inventoryName='dns-windows-observations'
$allowedZones=@('_msdcs.cormierconsulting.com','99.10.in-addr.arpa','cormierconsulting.com','cormierconsulting.io')
Import-Module DnsServer
$ownershipPath=Join-Path (Split-Path $ConfigurationPath -Parent) 'managed-zones.json'
function Read-Ownership {
 if(!(Test-Path -LiteralPath $ownershipPath)){return @()}
 return @(Get-Content -LiteralPath $ownershipPath -Raw | ConvertFrom-Json | ForEach-Object {$_})
}
function Save-Ownership($entries) {
 $temporary=$ownershipPath+'.next'
 [IO.File]::WriteAllText($temporary,(ConvertTo-Json -InputObject @($entries) -Depth 8 -Compress),[Text.UTF8Encoding]::new($false))
 if(Test-Path -LiteralPath $ownershipPath){[IO.File]::Replace($temporary,$ownershipPath,$ownershipPath+'.previous')}else{[IO.File]::Move($temporary,$ownershipPath)}
}
function Owned-Zone([string]$name,[string]$ownerId) {
 $entry=@(Read-Ownership | Where-Object {$_.name -eq $name -and $_.ownerId -eq $ownerId -and $_.status -eq 'Active'})
 $zone=Get-DnsServerZone -Name $name -ErrorAction SilentlyContinue
 if($entry.Count -ne 1 -or !$zone -or $zone.IsDsIntegrated -or $zone.IsAutoCreated -or [string]$zone.ZoneType -ne 'Primary' -or $zone.ZoneFile -ne $entry[0].zoneFile){throw 'Zone ownership changed; no DNS writes are allowed'}
 return $entry[0]
}
function Available-Zones {
 $result=@($allowedZones)
 foreach($entry in @(Read-Ownership | Where-Object status -eq 'Active')){try{$null=Owned-Zone $entry.name $entry.ownerId;$result+=@($entry.name)}catch{}}
 return $result
}
function Zone-Arguments($operation) {
 $name=[string]$operation.zone
 if($name.Length -gt 253 -or $name -cne $name.ToLowerInvariant() -or $name -notmatch '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'){throw 'Invalid absolute zone name'}
 if($name.EndsWith('.invalid')){throw 'The .invalid suffix cannot be used for a Windows authoritative zone. Use a test subdomain.'}
 $args=@{DynamicUpdate='None';ErrorAction='Stop'}
 if($operation.kind -eq 'Forward') {
  if($name -match '\.(in-addr|ip6)\.arpa$'){throw 'A reverse zone requires Reverse type'}
  $args.Name=$name
 }elseif($operation.kind -eq 'Reverse') {
  if($name -match '^((?:\d+\.){1,4})in-addr\.arpa$') {
   $parts=@($Matches[1].TrimEnd('.').Split('.'));foreach($part in $parts){if([int]$part -gt 255 -or [string][int]$part -ne $part){throw 'Invalid IPv4 reverse zone'}}
   [array]::Reverse($parts);$count=$parts.Count;while($parts.Count -lt 4){$parts+=@('0')};$args.NetworkId=($parts -join '.')+'/'+($count*8)
  }elseif($name -match '^((?:[0-9a-f]\.){4,32})ip6\.arpa$') {
   $parts=@($Matches[1].TrimEnd('.').Split('.'));[array]::Reverse($parts);$prefix=$parts.Count*4;$hex=($parts -join '').PadRight(32,'0');$groups=@();for($i=0;$i -lt 32;$i+=4){$groups+=@($hex.Substring($i,4))};$args.NetworkId=($groups -join ':')+'/'+$prefix
  }else{throw 'Use an IPv4 octet or IPv6 nibble reverse zone name (IPv6 /16 or longer)'}
 }else{throw 'Unsupported zone type'}
 return $args
}
function Read-Kube([string]$kind,[string]$name) {
 $raw=& $kubectl --kubeconfig $kubeconfig -n $namespace get $kind $name -o json 2>$null
 if($LASTEXITCODE -ne 0){throw 'Kubernetes management read failed'}
 return $raw|ConvertFrom-Json
}
function Write-Kube($object) {
 $json=$object|ConvertTo-Json -Depth 40 -Compress
 $reply=$json | & $kubectl --kubeconfig $kubeconfig replace -f - 2>$null
 if($LASTEXITCODE -ne 0){throw 'Kubernetes revision conflict or management write failure'}
}
function Record-Value($record) {
 $d=$record.RecordData
 switch([string]$record.RecordType) {
  'A' {return [string]$d.IPv4Address}
  'AAAA' {return [string]$d.IPv6Address}
  'CNAME' {return ([string]$d.HostNameAlias).TrimEnd('.')}
  'PTR' {return ([string]$d.PtrDomainName).TrimEnd('.')}
  'NS' {return ([string]$d.NameServer).TrimEnd('.')}
  'TXT' {return ($d.DescriptiveText -join '')}
  'MX' {return "$($d.Preference) $(([string]$d.MailExchange).TrimEnd('.'))"}
  'SRV' {return "$($d.Priority) $($d.Weight) $($d.Port) $(([string]$d.DomainName).TrimEnd('.'))"}
  'SOA' {return "$($d.PrimaryServer) $($d.ResponsiblePerson) $($d.SerialNumber) $($d.RefreshInterval.TotalSeconds) $($d.RetryDelay.TotalSeconds) $($d.ExpireLimit.TotalSeconds) $($d.MinimumTimeToLive.TotalSeconds)"}
  default {return [string]$d}
 }
}
function Zone-Serial([string]$zone) {return [uint32](Get-DnsServerResourceRecord -ZoneName $zone -RRType SOA)[0].RecordData.SerialNumber}
function Review-Zone([string]$zone,$job,$snapshot) {
 if($zone -notin @(Available-Zones)){throw 'Zone is outside this bridge authorization'}
 $reviewed=$job.serials.PSObject.Properties[$zone].Value
 if(!$reviewed -or (Zone-Serial $zone) -ne [uint32]$reviewed){throw 'Windows zone changed after review'}
 $backup=@($snapshot.current.relatedConfigurations|Where-Object {$_.kind -eq 'DnsZone' -and $_.dns.zone.name -eq $zone})
 if($backup.Count -ne 1 -or [uint32]$backup[0].dns.zone.serial -ne [uint32]$reviewed){throw 'Snapshot does not cover the reviewed Windows zone revision'}
 $normalize={param($items);@($items|ForEach-Object {ConvertTo-Json -InputObject @($_.name,$_.type,$_.value,[int64]$_.ttl) -Compress}|Sort-Object)}
 $actualRecords=@(& $normalize (Read-Records $zone));$backupRecords=@(& $normalize $backup[0].dns.records)
 if($actualRecords.Count -ne $backupRecords.Count -or $actualRecords.Count -gt 0 -and (Compare-Object $actualRecords $backupRecords)){throw 'Snapshot does not cover the complete reviewed Windows zone records'}
}
function Read-Records([string]$zone) {
 return @(Get-DnsServerResourceRecord -ZoneName $zone | ForEach-Object {
  [pscustomobject]@{name=$_.HostName;type=[string]$_.RecordType;value=(Record-Value $_);ttl=[int64]$_.TimeToLive.TotalSeconds}
 })
}
function Match-Record($record,[string]$identity) {
 $parts=$identity|ConvertFrom-Json
 if($parts.Count -ne 3){throw 'Invalid record identity'}
 return $record.HostName -eq $parts[0] -and [string]$record.RecordType -eq $parts[1] -and (Record-Value $record) -eq $parts[2]
}
function Record-Arguments($operation) {
 $type=[string]$operation.type;$value=[string]$operation.value
 $args=@{ZoneName=[string]$operation.zone;Name=[string]$operation.name;TimeToLive=[TimeSpan]::FromSeconds([int64]$operation.ttl);ErrorAction='Stop'}
 if(!$operation.name -or $operation.name.Length -gt 253 -or $operation.name -notmatch '^(?:@|[A-Za-z0-9_*-]+(?:\.[A-Za-z0-9_*-]+)*)$'){throw 'Invalid relative record name'}
 if([int64]$operation.ttl -lt 0 -or [int64]$operation.ttl -gt 604800){throw 'TTL must be from zero to seven days'}
 switch($type) {
  'A' { $ip=[Net.IPAddress]::Parse($value);if($ip.AddressFamily -ne 'InterNetwork'){throw 'Invalid IPv4 address'};$args.IPv4Address=$value }
  'AAAA' {$ip=[Net.IPAddress]::Parse($value);if($ip.AddressFamily -ne 'InterNetworkV6'){throw 'Invalid IPv6 address'};$args.IPv6Address=$value }
  {$_ -in @('CNAME','PTR')} {if($value -notmatch '^(?:[A-Za-z0-9_-]+\.)+[A-Za-z0-9_-]+\.?$'){throw 'Use an absolute DNS target name'};if($type -eq 'CNAME'){$args.HostNameAlias=$value}else{$args.PtrDomainName=$value}}
  'TXT' {if($value.Length -gt 2048){throw 'TXT data exceeds the manager limit'};$args.Txt=$true;$args.DescriptiveText=$value}
  'MX' {$parts=$value -split '\s+';if($parts.Count -ne 2 -or $parts[1] -notmatch '^(?:[A-Za-z0-9_-]+\.)+[A-Za-z0-9_-]+\.?$'){throw 'MX requires preference and an absolute exchange name'};$args.Preference=[uint16]$parts[0];$args.MailExchange=$parts[1];$args.MX=$true}
  'SRV' {$parts=$value -split '\s+';if($parts.Count -ne 4 -or $parts[3] -notmatch '^(?:\.|(?:[A-Za-z0-9_-]+\.)+[A-Za-z0-9_-]+\.?)$'){throw 'SRV requires priority, weight, port and an absolute target'};$args.Priority=[uint16]$parts[0];$args.Weight=[uint16]$parts[1];$args.Port=[uint16]$parts[2];$args.DomainName=$parts[3];$args.Srv=$true}
  'NS' {if($value -notmatch '^(?:[A-Za-z0-9_-]+\.)+[A-Za-z0-9_-]+\.?$'){throw 'NS requires an absolute nameserver'};$args.NS=$true;$args.NameServer=$value}
  default {throw 'Unsupported writable record type'}
 }
 return $args
}
function Validate-ZoneRecovery($operation) {
 $history=@(Read-Ownership|Where-Object {$_.name -eq $operation.zone -and $_.ownerId -eq $operation.previousOwnerId -and $_.status -eq 'Deleted'})
 if($history.Count -ne 1){throw 'Deleted-zone restoration ownership is unavailable or changed'}
 $items=@($operation.records)
 if(!$items.Count -or $items.Count -gt 5000){throw 'Zone restoration requires complete records within the recovery limit'}
 $soa=@($items|Where-Object type -eq 'SOA');$ns=@($items|Where-Object {$_.type -eq 'NS' -and $_.name -eq '@'})
 if($soa.Count -ne 1 -or $soa[0].name -ne '@' -or !$ns.Count -or !@($ns|Where-Object {$_.value.TrimEnd('.') -eq 'domain02.cormierconsulting.com'}).Count){throw 'Zone restoration requires its apex SOA and Windows nameserver'}
 $parts=[string]$soa[0].value -split '\s+'
 if($parts.Count -ne 7 -or @($parts[0..1]|Where-Object {$_ -notmatch '^(?:[A-Za-z0-9_-]+\.)+[A-Za-z0-9_-]+\.?$'}).Count){throw 'Invalid recovery SOA names'}
 foreach($number in $parts[2..6]){if($number -notmatch '^\d+$' -or [uint64]$number -gt [uint32]::MaxValue){throw 'Invalid recovery SOA number'}}
 if([string]$soa[0].ttl -notmatch '^\d+$' -or [uint64]$soa[0].ttl -gt 604800){throw 'Invalid recovery SOA TTL'}
 $identities=@{}
 foreach($record in $items){
  if([string]$record.ttl -notmatch '^\d+$' -or [uint64]$record.ttl -gt 604800){throw 'Invalid recovery record TTL'}
  $key=ConvertTo-Json -InputObject @($record.name,$record.type,$record.value) -Compress
  if($identities.ContainsKey($key)){throw 'Duplicate recovery record identity'};$identities[$key]=$true
  if($record.type -eq 'SOA'){continue}
  if($record.type -notin @('A','AAAA','CNAME','PTR','TXT','MX','SRV','NS')){throw 'Unsupported recovery record type'}
  $null=Record-Arguments ([pscustomobject]@{zone=$operation.zone;name=$record.name;type=$record.type;value=$record.value;ttl=$record.ttl})
  if($record.type -eq 'CNAME' -and ($record.name -eq '@' -or @($items|Where-Object {$_.name -eq $record.name -and $_.type -ne 'CNAME'}).Count -or @($items|Where-Object {$_.name -eq $record.name -and $_.type -eq 'CNAME'}).Count -ne 1)){throw 'Recovery CNAME conflicts with another record'}
 }
}
function Restore-ZoneRecords($operation) {
 # The target is a newly created, attested file zone; no existing zone records are overwritten.
 foreach($record in @(Get-DnsServerResourceRecord -ZoneName $operation.zone|Where-Object RecordType -eq 'NS')){Remove-DnsServerResourceRecord -ZoneName $operation.zone -InputObject $record -Force}
 foreach($record in @($operation.records|Where-Object type -ne 'SOA')){Apply-Record ([pscustomobject]@{zone=$operation.zone;operation='Create';name=$record.name;type=$record.type;value=$record.value;ttl=$record.ttl})}
 $saved=@($operation.records|Where-Object type -eq 'SOA')[0];$parts=[string]$saved.value -split '\s+'
 $old=@(Get-DnsServerResourceRecord -ZoneName $operation.zone -RRType SOA)[0];$next=[Microsoft.Management.Infrastructure.CimInstance]::new($old)
 $next.TimeToLive=[TimeSpan]::FromSeconds([int64]$saved.ttl);$data=$next.RecordData
 $data.PrimaryServer=$parts[0];$data.ResponsiblePerson=$parts[1];$data.SerialNumber=[uint32](([uint64]$parts[2]+1)%4294967296)
 $data.RefreshInterval=[TimeSpan]::FromSeconds([uint32]$parts[3]);$data.RetryDelay=[TimeSpan]::FromSeconds([uint32]$parts[4]);$data.ExpireLimit=[TimeSpan]::FromSeconds([uint32]$parts[5]);$data.MinimumTimeToLive=[TimeSpan]::FromSeconds([uint32]$parts[6])
 Set-DnsServerResourceRecord -ZoneName $operation.zone -OldInputObject $old -NewInputObject $next
 $observed=@(Read-Records $operation.zone);$normalize={param($items);@($items|Where-Object type -ne 'SOA'|ForEach-Object {ConvertTo-Json -InputObject @($_.name,$_.type,$_.value,[int64]$_.ttl) -Compress}|Sort-Object)}
 $actual=@(& $normalize $observed);$expected=@(& $normalize $operation.records)
 if($actual.Count -ne $expected.Count -or (Compare-Object $actual $expected)){throw 'Restored zone records and TTLs did not match the complete recovery configuration'}
 $actualSoa=@($observed|Where-Object type -eq 'SOA')[0];$actualParts=[string]$actualSoa.value -split '\s+'
 $actualSettings=@($actualParts[0..1]+$actualParts[3..6]) -join ' ';$savedSettings=@($parts[0..1]+$parts[3..6]) -join ' '
 $serialDistance=([uint64]$actualParts[2]+4294967296-[uint64]$parts[2])%4294967296
 if($actualSoa.ttl -ne $saved.ttl -or $actualSettings -ne $savedSettings -or !$serialDistance -or $serialDistance -ge 2147483648){throw 'Restored SOA settings or serial freshness did not match'}
}
function Apply-Record($operation) {
 if($operation.operation -eq 'Delete') {
  $records=@(Get-DnsServerResourceRecord -ZoneName $operation.zone -Name $operation.name | Where-Object {Match-Record $_ $operation.targetId})
  if($records.Count -ne 1){throw 'Delete target changed or is ambiguous'}
  Remove-DnsServerResourceRecord -ZoneName $operation.zone -InputObject $records[0] -Force
  return
 }
 $args=Record-Arguments $operation
 if($operation.operation -eq 'Update') {
  $old=@(Get-DnsServerResourceRecord -ZoneName $operation.zone -Name $operation.name | Where-Object {Match-Record $_ $operation.targetId})
  $next=@(Get-DnsServerResourceRecord -ZoneName $operation.zone -Name $operation.name | Where-Object {Match-Record $_ $operation.targetId})
  if($old.Count -ne 1 -or $next.Count -ne 1){throw 'Update target changed or is ambiguous'}
  $next=$next[0];$d=$next.RecordData
  switch([string]$operation.type) {
   'A' {$d.IPv4Address=[Net.IPAddress]$args.IPv4Address}
   'AAAA' {$d.IPv6Address=[Net.IPAddress]$args.IPv6Address}
   'CNAME' {$d.HostNameAlias=$args.HostNameAlias}
   'PTR' {$d.PtrDomainName=$args.PtrDomainName}
   'TXT' {$d.DescriptiveText=[string[]]@($args.DescriptiveText)}
   'MX' {$d.Preference=$args.Preference;$d.MailExchange=$args.MailExchange}
   'SRV' {$d.Priority=$args.Priority;$d.Weight=$args.Weight;$d.Port=$args.Port;$d.DomainName=$args.DomainName}
  }
  $next.TimeToLive=$args.TimeToLive
  Set-DnsServerResourceRecord -ZoneName $operation.zone -OldInputObject $old[0] -NewInputObject $next
 }else{
  switch([string]$operation.type) {
   'A' {Add-DnsServerResourceRecordA @args}
   'AAAA' {Add-DnsServerResourceRecordAAAA @args}
   'CNAME' {Add-DnsServerResourceRecordCName @args}
   'PTR' {Add-DnsServerResourceRecordPtr @args}
   default {Add-DnsServerResourceRecord @args}
  }
 }
}
function Update-Job($job) {
 for($attempt=0;$attempt -lt 3;$attempt++) {
  $cm=Read-Kube configmap $queueName
  $jobs=@(($cm.data.'jobs.json'|ConvertFrom-Json)|ForEach-Object {$_})
  $index=-1;for($i=0;$i -lt $jobs.Count;$i++){if($jobs[$i].id -eq $job.id){$index=$i;break}}
  if($index -lt 0){throw 'Job disappeared; stop without replaying DNS writes'}
  $jobs[$index]=$job;$cm.data.'jobs.json'=ConvertTo-Json -InputObject $jobs -Depth 35 -Compress
  try{Write-Kube $cm;return}catch{if($attempt -eq 2){throw}}
 }
}
function Process-Job($job) {
 if(Test-Path -LiteralPath (Join-Path (Split-Path $ConfigurationPath -Parent) 'credential-recovery-active.json')){throw 'DNS writes are paused for credential recovery'}
 foreach($field in @('startedAt','finishedAt','receipts','error')){if(!$job.PSObject.Properties[$field]){$job|Add-Member -NotePropertyName $field -NotePropertyValue $null}}
 $receipts=@();$mutated=$false;$job.status='Running';$job.startedAt=[DateTime]::UtcNow.ToString('o');Update-Job $job
 try {
  if([DateTime]::UtcNow - [DateTime]::Parse($job.createdAt).ToUniversalTime() -gt [TimeSpan]::FromMinutes(10)){throw 'Review expired; refresh and review again'}
  if($job.snapshotId -notmatch '^[0-9a-f-]{36}$'){throw 'A durable pre-change snapshot is required'}
  $path='/api/v1/namespaces/manager-system/services/http:dns-manager-snapshots:8080/proxy/api/snapshots/'+$job.snapshotId
  $raw=& $kubectl --kubeconfig $kubeconfig get --raw $path 2>$null
  if($LASTEXITCODE -ne 0){throw 'Pre-change snapshot cannot be read or unlocked'}
  $snapshot=$raw|ConvertFrom-Json
  if([DateTime]::UtcNow - [DateTime]::Parse($snapshot.createdAt).ToUniversalTime() -gt [TimeSpan]::FromHours(24)){throw 'Pre-change snapshot is too old'}
  if(!$job.operations -or $job.operations.Count -gt 50){throw 'Choose one to fifty DNS changes'}
  $authorized=Available-Zones
  foreach($zone in @($job.operations.zone|Select-Object -Unique)) {
   $create=@($job.operations|Where-Object {$_.zone -eq $zone -and $_.operation -in @('CreateZone','RestoreZone')})
   if($create.Count){
    if($create.Count -ne 1 -or @($job.operations|Where-Object zone -eq $zone).Count -ne 1){throw 'Apply zone creation separately from record changes'}
    $null=Zone-Arguments $create[0]
    if($create[0].operation -eq 'RestoreZone'){Validate-ZoneRecovery $create[0]}
    if(Get-DnsServerZone -Name $zone -ErrorAction SilentlyContinue){throw 'Proposed zone already exists on Windows'}
    if(@($snapshot.current.relatedConfigurations|Where-Object {$_.kind -eq 'DnsZone' -and $_.dns.zone.name -eq $zone}).Count){throw 'Snapshot expected this zone to exist; review again'}
    if($snapshot.current.configuration.kind -ne 'DnsSource' -or $snapshot.current.configuration.dns.host -ne 'domain02.cormierconsulting.com' -or $snapshot.current.configuration.dns.address -ne '10.99.3.2'){throw 'Snapshot does not cover this Windows source'}
    $parents=@(Get-DnsServerZone|Where-Object {$create[0].zone.EndsWith('.'+$_.ZoneName)}|Sort-Object {$_.ZoneName.Length} -Descending)
    if($parents.Count){
     if($parents[0].ZoneName -ne $create[0].parentZone -or $parents[0].ZoneName -notin $authorized){throw 'Review must include the authorized parent zone and its automatic delegation'}
     Review-Zone $parents[0].ZoneName $job $snapshot
    }elseif($create[0].parentZone){throw 'Reviewed parent zone changed'}
    continue
   }
   if($zone -notin $authorized){throw 'Zone is outside this bridge authorization'}
   $reviewed=$job.serials.PSObject.Properties[$zone].Value
   if(!$reviewed -or (Zone-Serial $zone) -ne [uint32]$reviewed){throw 'Windows zone changed after review'}
   $backup=@($snapshot.current.relatedConfigurations|Where-Object {$_.kind -eq 'DnsZone' -and $_.dns.zone.name -eq $zone})
   if($backup.Count -ne 1 -or [uint32]$backup[0].dns.zone.serial -ne [uint32]$reviewed){throw 'Snapshot does not cover the reviewed Windows zone revision'}
   $normalize={param($items);@($items|ForEach-Object {ConvertTo-Json -InputObject @($_.name,$_.type,$_.value,[int64]$_.ttl) -Compress}|Sort-Object)}
   $actualRecords=@(& $normalize (Read-Records $zone));$backupRecords=@(& $normalize $backup[0].dns.records)
   if($actualRecords.Count -ne $backupRecords.Count -or $actualRecords.Count -gt 0 -and (Compare-Object $actualRecords $backupRecords)){throw 'Snapshot does not cover the complete reviewed Windows zone records'}
  }
  $targets=@{}
  foreach($op in $job.operations) {
   if($op.operation -in @('CreateZone','RestoreZone','DeleteZone')) {
    $key="$($op.zone)/zone";if($targets.ContainsKey($key) -or @($job.operations|Where-Object zone -eq $op.zone).Count -ne 1){throw 'Conflicting operations target one zone'};$targets[$key]=$true
    if($op.operation -eq 'DeleteZone'){
     if($op.zone -in $allowedZones){throw 'Existing source zones cannot be deleted'}
     $owned=Owned-Zone $op.zone $op.ownerId
     if($owned.delegationRecords.Count){
      Review-Zone $owned.parentZone $job $snapshot
      foreach($record in $owned.delegationRecords){$matches=@(Get-DnsServerResourceRecord -ZoneName $owned.parentZone -Name $record.name -ErrorAction SilentlyContinue|Where-Object {[string]$_.RecordType -eq $record.type -and (Record-Value $_) -eq $record.value});if($matches.Count -ne 1 -or [int64]$matches[0].TimeToLive.TotalSeconds -ne [int64]$record.ttl){throw 'Owned parent delegation changed; review before deletion'}}
     }
    }
    continue
   }
   if($op.operation -notin @('Create','Update','Delete')){throw 'Unsupported DNS operation'}
   if($op.type -notin @('A','AAAA','CNAME','PTR','TXT','MX','SRV')){throw 'Unsupported writable record type'}
   $targetIdentity=if($op.operation -eq 'Create'){$op.value}else{$op.targetId}
   $key=ConvertTo-Json -InputObject @($op.zone,$op.name,$op.type,$targetIdentity) -Compress
   if($targets.ContainsKey($key)){throw 'Conflicting operations target one record'};$targets[$key]=$true
   $existing=@(Get-DnsServerResourceRecord -ZoneName $op.zone -Name $op.name -ErrorAction SilentlyContinue)
   if($op.operation -eq 'Create') {
    $null=Record-Arguments $op
    if($existing|Where-Object {[string]$_.RecordType -eq $op.type -and (Record-Value $_) -eq $op.value}){throw 'The proposed record already exists'}
   } else {
    $target=$op.targetId|ConvertFrom-Json
    if($target.Count -ne 3 -or $target[0] -ne $op.name -or $target[1] -ne $op.type -or $op.operation -eq 'Delete' -and $target[2] -ne $op.value){throw 'Operation identity does not match the reviewed target'}
    if(@($existing|Where-Object {Match-Record $_ $op.targetId}).Count -ne 1){throw 'Reviewed DNS target changed or is ambiguous'}
    if($op.operation -eq 'Update'){$null=Record-Arguments $op}
   }
  }
  foreach($op in $job.operations) {
   if($op.operation -in @('CreateZone','RestoreZone')) {
    $entries=@(Read-Ownership);$entry=[pscustomobject]@{name=$op.zone;ownerId=([Guid]::NewGuid().ToString());zoneFile=('manager-'+[Guid]::NewGuid().ToString('N')+'.dns');status='Creating';jobId=$job.id;createdAt=[DateTime]::UtcNow.ToString('o');parentZone=$op.parentZone;delegationRecords=@()}
    $parentBefore=if($entry.parentZone){@(Read-Records $entry.parentZone)}else{@()}
    # Keep the intent before the native write. Interrupted jobs are never replayed.
    $entries=@($entries|Where-Object name -ne $op.zone)+@($entry);Save-Ownership $entries
    $args=Zone-Arguments $op;$args.ZoneFile=$entry.zoneFile
    $mutated=$true;Add-DnsServerPrimaryZone @args
    if($entry.parentZone){
     $parentAfter=@(Read-Records $entry.parentZone)
     $added=@($parentAfter|Where-Object {$record=$_;!@($parentBefore|Where-Object {$_.name -eq $record.name -and $_.type -eq $record.type -and $_.value -eq $record.value -and $_.ttl -eq $record.ttl}).Count -and $_.type -ne 'SOA'})
     $child=$entry.name.Substring(0,$entry.name.Length-$entry.parentZone.Length-1);$nameservers=@(Read-Records $entry.name|Where-Object {$_.name -eq '@' -and $_.type -eq 'NS'})
     if(@($added|Where-Object {$_.name -ne $child -or $_.type -ne 'NS' -or $_.value -notin $nameservers.value}).Count){throw 'Unexpected automatic parent-zone changes require reconciliation'}
     $entry.delegationRecords=$added;Save-Ownership $entries
    }
    $policy=Get-DnsServerZone -Name 'cormierconsulting.com'
    if([string]$policy.SecureSecondaries -ne 'TransferToSecureServers' -or !$policy.SecondaryServers -or !$policy.NotifyServers){throw 'Approved transfer policy is unavailable; created zone requires reconciliation'}
    Set-DnsServerPrimaryZone -Name $op.zone -SecureSecondaries TransferToSecureServers -SecondaryServers $policy.SecondaryServers -Notify NotifyServers -NotifyServers $policy.NotifyServers
    $read=Get-DnsServerZone -Name $op.zone
    if($read.ZoneFile -ne $entry.zoneFile -or $read.IsDsIntegrated -or [string]$read.DynamicUpdate -ne 'None' -or [string]$read.SecureSecondaries -ne 'TransferToSecureServers' -or [string]$read.Notify -ne 'NotifyServers' -or (Compare-Object @($read.SecondaryServers|ForEach-Object IPAddressToString|Sort-Object) @($policy.SecondaryServers|ForEach-Object IPAddressToString|Sort-Object)) -or (Compare-Object @($read.NotifyServers|ForEach-Object IPAddressToString|Sort-Object) @($policy.NotifyServers|ForEach-Object IPAddressToString|Sort-Object))){throw 'Created zone policy readback did not match'}
    if($op.operation -eq 'RestoreZone'){Restore-ZoneRecords $op}
    $entry.status='Active';Save-Ownership $entries;$null=Owned-Zone $op.zone $entry.ownerId
    $receipts+=@{zone=$op.zone;operation=$op.operation;ownerId=$entry.ownerId;serial=(Zone-Serial $op.zone);readBack=$true;restoredFromOwnerId=$op.previousOwnerId;restoredRecords=if($op.operation -eq 'RestoreZone'){@($op.records).Count}else{0};parentZone=$entry.parentZone;parentSerial=if($entry.parentZone){[string](Zone-Serial $entry.parentZone)}else{$null}}
   }elseif($op.operation -eq 'DeleteZone') {
    $entry=Owned-Zone $op.zone $op.ownerId;$entries=@(Read-Ownership);$entry=@($entries|Where-Object {$_.name -eq $op.zone -and $_.ownerId -eq $op.ownerId})[0];$entry.status='Deleting';Save-Ownership $entries
    $mutated=$true;Remove-DnsServerZone -Name $op.zone -Force
    if(Get-DnsServerZone -Name $op.zone -ErrorAction SilentlyContinue){throw 'Deleted zone is still present on Windows'}
    foreach($record in $entry.delegationRecords){
     $match=@(Get-DnsServerResourceRecord -ZoneName $entry.parentZone -Name $record.name -ErrorAction SilentlyContinue|Where-Object {[string]$_.RecordType -eq $record.type -and (Record-Value $_) -eq $record.value -and [int64]$_.TimeToLive.TotalSeconds -eq [int64]$record.ttl})
     if($match.Count -ne 1){throw 'Owned parent delegation changed during deletion'}
     Remove-DnsServerResourceRecord -ZoneName $entry.parentZone -InputObject $match[0] -Force
     if(@(Read-Records $entry.parentZone|Where-Object {$_.name -eq $record.name -and $_.type -eq $record.type -and $_.value -eq $record.value}).Count){throw 'Parent delegation deletion was not confirmed'}
    }
    $entry.status='Deleted';Save-Ownership $entries
    $receipts+=@{zone=$op.zone;operation=$op.operation;ownerId=$entry.ownerId;readBack=$true;parentZone=if($entry.delegationRecords.Count){$entry.parentZone}else{$null};parentSerial=if($entry.delegationRecords.Count){[string](Zone-Serial $entry.parentZone)}else{$null}}
   }else{
   $mutated=$true
   Apply-Record $op
   $observed=Read-Records $op.zone
   $present=@($observed|Where-Object {$_.name -eq $op.name -and $_.type -eq $op.type -and $_.value -eq $op.value})
   if($op.operation -ne 'Delete' -and ($present.Count -ne 1 -or $present[0].ttl -ne [int64]$op.ttl) -or $op.operation -eq 'Delete' -and $present.Count -ne 0){throw 'Windows readback did not match the applied record and TTL'}
   $receipts+=@{zone=$op.zone;name=$op.name;type=$op.type;operation=$op.operation;serial=(Zone-Serial $op.zone);readBack=$true}
   }
   $job.receipts=$receipts;Update-Job $job
  }
  $job.status='Applied';$job.error=''
 } catch {$job.status=if($mutated -or $receipts.Count){'PartialFailure'}else{'Rejected'};$job.error=$_.Exception.Message}
 $job.receipts=$receipts
 Publish-Inventory
 $job.finishedAt=[DateTime]::UtcNow.ToString('o');Update-Job $job
}
function Publish-Inventory {
 $zones=@();$records=@{}
 foreach($zone in @(Available-Zones)){
  $entry=@(Read-Ownership|Where-Object {$_.name -eq $zone -and $_.status -eq 'Active'})
  $delegations=@()
  if($entry.Count -eq 1){$delegations=@($entry[0].delegationRecords|Where-Object {$_ -and $_.type})}
  $zones+=@{id=$zone;name=$zone;serial=[string](Zone-Serial $zone);kind=if($zone -match '\.(in-addr|ip6)\.arpa$'){'Reverse'}elseif($zone.StartsWith('_msdcs.')){'AD'}else{'Forward'};managed=($entry.Count -eq 1);ownerId=if($entry.Count -eq 1){$entry[0].ownerId}else{$null};parentZone=if($entry.Count -eq 1){$entry[0].parentZone}else{$null};delegationRecords=$delegations};$records[$zone]=Read-Records $zone
 }
 $cm=Read-Kube configmap $inventoryName
 $cm.data.'inventory.json'=ConvertTo-Json -InputObject @{observedAt=[DateTime]::UtcNow.ToString('o');host=[Net.Dns]::GetHostEntry('localhost').HostName;zones=$zones;records=$records;managedZones=@(Read-Ownership);managementReachable=$true;credentialRecoveryGuard=@{version=1;sourceDigest=$bridgeRuntimeSourceDigest};allowedOperations=@('Create','Update','Delete','CreateZone','DeleteZone');limitations=@('Existing source zones are protected from deletion; source configuration changes require a separate management operation')} -Depth 25 -Compress
 Write-Kube $cm
}
function Invoke-BridgeIteration {
 $queue=Read-Kube configmap $queueName
 $jobs=@(($queue.data.'jobs.json'|ConvertFrom-Json)|ForEach-Object {$_})
 foreach($job in $jobs|Where-Object status -eq 'Running') {
  foreach($field in @('startedAt','finishedAt','receipts','error')){if(!$job.PSObject.Properties[$field]){$job|Add-Member -NotePropertyName $field -NotePropertyValue $null}}
  $job.status='Interrupted';$job.error='Interrupted operation requires review against Windows inventory; no writes are replayed.';$job.finishedAt=[DateTime]::UtcNow.ToString('o');Update-Job $job
 }
 foreach($job in $jobs|Where-Object status -eq 'Queued'){Process-Job $job}
 Publish-Inventory
}
function Run-Bridge {
 $root=Split-Path $ConfigurationPath -Parent;$path=Join-Path $root 'bridge-mutation.lock'
 if((Test-Path -LiteralPath $path) -and ((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Unsafe DNS operation lock'}
 $handle=[IO.File]::Open($path,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 try{if(Test-Path -LiteralPath (Join-Path $root 'credential-recovery-active.json')){return};Invoke-BridgeIteration}finally{$handle.Dispose()}
}
do {
 try{Run-Bridge}catch{[IO.File]::WriteAllText((Join-Path (Split-Path $ConfigurationPath -Parent) 'last-error.json'),(@{at=[DateTime]::UtcNow.ToString('o');message=$_.Exception.Message}|ConvertTo-Json));[Console]::Error.WriteLine('DNS bridge iteration failed: '+$_.Exception.Message)}
 if($Continuous){Start-Sleep -Seconds 5}
}while($Continuous)
