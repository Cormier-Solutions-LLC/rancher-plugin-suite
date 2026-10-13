$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$kubectl='C:\Program Files\Docker\Docker\resources\bin\kubectl.exe'
$query=Join-Path $root 'dns-manager-dev/tests/LiveQuery/bin/Release/net10.0/LiveQuery.dll'
$results=[Collections.Generic.List[object]]::new()
function AssertDns([string]$server,[string]$name='rancher.cormierconsulting.io',[string]$type='A',[string]$rcode='NoError') {
 $raw=& dotnet $query $server $name $type udp
 if($LASTEXITCODE -ne 0){throw "DNS transport failed at $server"}
 $response=$raw|ConvertFrom-Json
 if($response.rcode -ne $rcode){throw "DNS returned $($response.rcode) at $server for $name"}
 if($name -eq 'rancher.cormierconsulting.io' -and !($response.answers|Where-Object value -eq '10.99.15.50')){throw 'Retained internal record missing'}
 $results.Add([pscustomobject]@{server=$server;name=$name;type=$type;rcode=$response.rcode;passed=$true})
}
$policyName='manager-acceptance-source-outage'
$policy=@{apiVersion='networking.k8s.io/v1';kind='NetworkPolicy';metadata=@{name=$policyName;namespace='dns-system'};spec=@{podSelector=@{matchLabels=@{'statefulset.kubernetes.io/pod-name'='dns-manager-engine-2'}};policyTypes=@('Egress');egress=@(@{to=@(@{ipBlock=@{cidr='0.0.0.0/0';except=@('10.99.3.2/32')}})})}}
$policyPath=Join-Path $root '.local/manager-installation/dns-source-outage-policy.json'
$policy|ConvertTo-Json -Depth 15|Set-Content $policyPath
try {
 foreach($server in @('10.99.15.55','10.99.15.56','10.99.15.57','10.99.15.58')){
  AssertDns $server
  AssertDns $server 'cloudflare.com' A
  AssertDns $server 'cloudflare.com' AAAA
  AssertDns $server 'dnssec-failed.org' A 'ServerFailure'
 }
 $before=(& $kubectl -n dns-system get pod dns-manager-engine-2 -o json)|ConvertFrom-Json
 & $kubectl -n dns-system delete pod dns-manager-engine-2 --wait=false
 if($LASTEXITCODE -ne 0){throw 'Candidate restart failed'}
 # Query the shared VIP and both surviving replicas during rescheduling.
 for($i=0;$i -lt 30;$i++){
  foreach($server in @('10.99.15.55','10.99.15.56','10.99.15.58')){AssertDns $server}
  Start-Sleep -Milliseconds 300
 }
 & $kubectl -n dns-system wait --for=condition=Ready pod/dns-manager-engine-2 --timeout=120s
 if($LASTEXITCODE -ne 0){throw 'Restarted candidate did not become ready'}
 $after=(& $kubectl -n dns-system get pod dns-manager-engine-2 -o json)|ConvertFrom-Json
 if($after.metadata.uid -eq $before.metadata.uid){throw 'Pod did not restart'}
 AssertDns '10.99.15.57'
 & $kubectl apply -f $policyPath
 if($LASTEXITCODE -ne 0){throw 'Candidate source-outage policy failed'}
 Start-Sleep -Seconds 5
 & $kubectl -n dns-system exec dns-manager-engine-2 -- bash -c 'timeout 3 bash -c "exec 3<>/dev/tcp/10.99.3.2/53"' 2>$null
 if($LASTEXITCODE -ne 124){throw 'Source outage was not proven; the TCP probe must time out'}
 for($i=0;$i -lt 5;$i++){
  AssertDns '10.99.15.57'
  AssertDns '10.99.15.57' 'cloudflare.com' A
  AssertDns '10.99.15.58'
 }
 & $kubectl -n dns-system delete networkpolicy $policyName
 if($LASTEXITCODE -ne 0){throw 'Source policy cleanup failed'}
 & $kubectl -n dns-system exec dns-manager-engine-2 -- bash -c 'timeout 3 bash -c "exec 3<>/dev/tcp/10.99.3.2/53"'
 if($LASTEXITCODE -ne 0){throw 'Source connection did not recover'}
 AssertDns '10.99.15.57'
 Write-Output "Passed $($results.Count) live DNSSEC, restart and candidate source-outage assertions."
} finally {
 & $kubectl -n dns-system delete networkpolicy $policyName --ignore-not-found | Out-Null
 $results|ConvertTo-Json -Depth 8|Set-Content (Join-Path $root '.local/manager-installation/dns-live-recovery-tests.json')
}
