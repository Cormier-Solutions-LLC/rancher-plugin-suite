param([switch]$UpdateApps)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$folder=Join-Path $root '.local/manager-installation'
$password=[IO.File]::ReadAllText((Join-Path $folder 'dns-admin-password.txt'))
$zones=@('_msdcs.cormierconsulting.com','99.10.in-addr.arpa','cormierconsulting.com','cormierconsulting.io')
# Administrators approve transfers only to this Kubernetes cluster's known nodes;
# kube-proxy/Calico egress is source-NATed to the serving node's address.
$nodes=(kubectl get nodes -o json | ConvertFrom-Json).items
$nodeAddresses=@($nodes|ForEach-Object {$_.status.addresses|Where-Object type -eq InternalIP|ForEach-Object address})
$notificationAddresses=@('10.99.15.55','10.99.15.56','10.99.15.57')
Invoke-Command -ComputerName domain02.cormierconsulting.com -ArgumentList (@{zones=$zones;nodes=$nodeAddresses;notifications=$notificationAddresses}|ConvertTo-Json -Compress) -ScriptBlock {
 param($configuration)
 $ErrorActionPreference='Stop';$config=$configuration|ConvertFrom-Json
 $zones=$config.zones;$nodes=$config.nodes;$notifications=$config.notifications
 foreach($zone in $zones){
  $old=Get-DnsServerZone -Name $zone
  $allowed=@(@($old.SecondaryServers|ForEach-Object ToString)+$nodes|Select-Object -Unique)
  $notify=@(@($old.NotifyServers|ForEach-Object ToString)+$notifications|Select-Object -Unique)
  Set-DnsServerPrimaryZone -Name $zone -SecureSecondaries TransferToSecureServers -SecondaryServers ([Net.IPAddress[]]$allowed) -Notify NotifyServers -NotifyServers ([Net.IPAddress[]]$notify)
  Get-DnsServerZone -Name $zone|Select-Object ZoneName,SecureSecondaries,Notify
 }
}
for($i=0;$i -lt 3;$i++){
 $port=15480+$i
 $out=Join-Path $folder "forward-$i.log"; $err=Join-Path $folder "forward-$i.err"
 $forward=Start-Process kubectl -ArgumentList @('port-forward',"pod/dns-manager-engine-$i",'-n','dns-system',"${port}:5380",'--address=127.0.0.1') -PassThru -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err
 try{
  $base="http://127.0.0.1:$port/api"
  $session=$null
  for($attempt=0;$attempt -lt 30;$attempt++){
   try{$session=Invoke-RestMethod "$base/user/login" -Method Post -Body @{user='admin';pass=$password};if($session.status -eq 'ok'){break}}catch{Start-Sleep -Milliseconds 300}
  }
  if($session.status -ne 'ok'){throw "DNS replica $i API login failed"}
  $headers=@{Authorization="Bearer $($session.token)"}
  function Call-Dns([string]$endpoint,[hashtable]$data){
   $r=Invoke-RestMethod "$base/$endpoint" -Method Post -Headers $headers -Body $data
   if($r.status -ne 'ok'){throw "Replica $i $endpoint failed: $($r.errorMessage)"};return $r
  }
  Call-Dns 'settings/set' @{dnssecValidation='true';dnsAppsEnableAutomaticUpdate='false';logQueries='true';minSoaRefresh='10';minSoaRetry='10';forwarders='8.8.8.8,8.8.4.4'}|Out-Null
  $known=(Call-Dns 'zones/list' @{}).response.zones.name
  foreach($zone in $zones){
   if($zone -notin $known){Call-Dns 'zones/create' @{zone=$zone;type='Secondary';primaryNameServerAddresses='10.99.3.2';zoneTransferProtocol='Tcp'}|Out-Null}
  }
  # Install only the owned lookup-policy package; preserve all transferred records.
  $package=Join-Path $folder 'LookupPolicy.zip'
  if(Test-Path $package){
   $apps=(Call-Dns 'apps/list' @{}).response.apps.name
   if('Cormier Lookup Policy' -notin $apps -or $UpdateApps){
    $action=if('Cormier Lookup Policy' -in $apps){'update'}else{'install'}
    $r=Invoke-RestMethod "$base/apps/$action`?name=Cormier%20Lookup%20Policy" -Headers $headers -Method Post -Form @{file=Get-Item $package}
    if($r.status -ne 'ok'){throw "Replica $i App installation failed: $($r.errorMessage)"}
   }
  }
  $state=(Call-Dns 'zones/list' @{}).response.zones|Select-Object name,type,isExpired,lastModified
  $state|ConvertTo-Json -Depth 4|Set-Content (Join-Path $folder "dns-$i-zones.json")
  Write-Output "Replica $i configured; authoritative transfer state saved."
 }finally{if(-not $forward.HasExited){Stop-Process -Id $forward.Id}}
}
