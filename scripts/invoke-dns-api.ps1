param([int]$Replica=0,[Parameter(Mandatory)][string]$Endpoint,[hashtable]$Values=@{})
$ErrorActionPreference='Stop'
$folder=Join-Path (Split-Path $PSScriptRoot -Parent) '.local/manager-installation'
$port=15580+$Replica
$forward=Start-Process kubectl -ArgumentList @('port-forward',"pod/dns-manager-engine-$Replica",'-n','dns-system',"${port}:5380",'--address=127.0.0.1') -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $folder "api-forward-$Replica.log") -RedirectStandardError (Join-Path $folder "api-forward-$Replica.err")
try{
 $base="http://127.0.0.1:$port/api";$session=$null
 for($attempt=0;$attempt -lt 30;$attempt++){
  try{$session=Invoke-RestMethod "$base/user/login" -Method Post -Body @{user='admin';pass=[IO.File]::ReadAllText((Join-Path $folder 'dns-admin-password.txt'))};if($session.status -eq 'ok'){break}}catch{Start-Sleep -Milliseconds 300}
 }
 if($session.status -ne 'ok'){throw 'DNS API login failed'}
 $response=Invoke-RestMethod "$base/$Endpoint" -Method Post -Headers @{Authorization="Bearer $($session.token)"} -Body $Values
 if($response.status -ne 'ok'){throw $response.errorMessage}
 $response.response
}finally{if(-not $forward.HasExited){Stop-Process -Id $forward.Id}}
