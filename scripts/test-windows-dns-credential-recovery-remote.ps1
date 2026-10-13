param([ValidateSet('Synthetic','Authenticated')][string]$Mode='Synthetic',[ValidateSet('original','canonical')][string]$Version='original')
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$taskId=[Guid]::NewGuid().ToString();$taskDirectory='C:\ProgramData\CormierDnsManager\RecoveryAcceptance-'+$taskId
$taskSession=New-PSSession -ComputerName domain02.cormierconsulting.com
$taskLedger=@{id=$taskId;host='domain02.cormierconsulting.com';directory=$taskDirectory;startedAt=[DateTime]::UtcNow.ToString('o');status='Intent';productionWrites=0}
$taskLedgerFile=Join-Path $taskRoot $(if($Mode -eq 'Authenticated'){'.local/manager-installation/windows-dns-credential-recovery-auth-owned.json'}else{'.local/manager-installation/windows-dns-credential-recovery-remote-owned.json'})
if($Version -eq 'canonical'){$taskLedgerFile=$taskLedgerFile.Replace('-owned.json','-canonical-owned.json')}
$taskTests=Join-Path $taskRoot $(if($Mode -eq 'Authenticated'){'scripts/test-windows-dns-credential-recovery-auth.ps1'}else{'scripts/test-windows-dns-credential-recovery.ps1'})
if(Test-Path -LiteralPath $taskLedgerFile){$previous=Get-Content -LiteralPath $taskLedgerFile -Raw|ConvertFrom-Json;$absent=Invoke-Command -Session $taskSession -ArgumentList $previous.directory -ScriptBlock {param($directory);if(Test-Path -LiteralPath $directory){return 'Present'};return 'Absent'};if($previous.passed -ne $false -or $absent -ne 'Absent'){Remove-PSSession $taskSession;throw 'Reconcile the existing Windows recovery acceptance receipt'};Copy-Item -LiteralPath $taskLedgerFile -Destination ($taskLedgerFile.Replace('.json','-'+$previous.id+'.json'))}
function Save-TestReceipt {$taskLedger|ConvertTo-Json -Depth 15|Set-Content -LiteralPath $taskLedgerFile}
Save-TestReceipt
try{
 Invoke-Command -Session $taskSession -ArgumentList $taskDirectory -ScriptBlock {param($directory);$ErrorActionPreference='Stop';if(Test-Path -LiteralPath $directory){throw 'Test directory exists'};New-Item -ItemType Directory -Path $directory|Out-Null;[IO.File]::WriteAllText((Join-Path $directory 'owner.txt'),[IO.Path]::GetFileName($directory))}
 $taskLedger.status='Owned directory created';Save-TestReceipt
 Copy-Item -LiteralPath (Join-Path $taskRoot 'live-management/windows-dns-credential-recovery.ps1') -Destination ($taskDirectory+'\recovery.ps1') -ToSession $taskSession
 Copy-Item -LiteralPath $taskTests -Destination ($taskDirectory+'\test.ps1') -ToSession $taskSession
 $taskHashes=@{source=(Get-FileHash -LiteralPath (Join-Path $taskRoot 'live-management/windows-dns-credential-recovery.ps1')).Hash;tests=(Get-FileHash -LiteralPath $taskTests).Hash}
 $taskLedger.sourceHashes=$taskHashes;$taskLedger.testIntent=[DateTime]::UtcNow.ToString('o');Save-TestReceipt
 $taskOutput=Invoke-Command -Session $taskSession -ArgumentList $taskDirectory,$taskHashes -ScriptBlock {
  param($directory,$hashes);$ErrorActionPreference='Stop';if((Get-FileHash -LiteralPath ($directory+'\recovery.ps1')).Hash -ne $hashes.source -or (Get-FileHash -LiteralPath ($directory+'\test.ps1')).Hash -ne $hashes.tests){throw 'Transferred test source changed'}
  & ($directory+'\test.ps1') -Source ($directory+'\recovery.ps1') -TestParent $directory
 }
 $taskLedger.results=($taskOutput|Out-String|ConvertFrom-Json);if(!$taskLedger.results.passed){throw 'Windows acceptance did not pass'};$taskLedger.passed=$true;$taskLedger.status='Verified; cleanup pending';Save-TestReceipt
}catch{$taskLedger.passed=$false;$taskLedger.status='Failed; cleanup pending';$taskLedger.error=$_.Exception.Message;Save-TestReceipt;throw}
finally{
 try{$taskCleaned=Invoke-Command -Session $taskSession -ArgumentList $taskDirectory -ScriptBlock {
  param($directory);$ErrorActionPreference='Stop';$resolved=[IO.Path]::GetFullPath($directory);$parent=[IO.Path]::GetFullPath('C:\ProgramData\CormierDnsManager').TrimEnd('\')+'\';if(!$resolved.StartsWith($parent,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notmatch '^RecoveryAcceptance-[0-9a-f-]{36}$'){throw 'Cleanup path differs from owned test directory'}
  if(Test-Path -LiteralPath $resolved){if([IO.File]::ReadAllText((Join-Path $resolved 'owner.txt')) -cne [IO.Path]::GetFileName($resolved)){throw 'Test directory ownership differs'};Remove-Item -LiteralPath $resolved -Recurse -Force};return !(Test-Path -LiteralPath $resolved)
 };$taskLedger.ownedDirectoryRemoved=[bool]$taskCleaned;$taskLedger.finishedAt=[DateTime]::UtcNow.ToString('o');$taskLedger.status=if($taskLedger.passed -and $taskCleaned){'Verified; owned remote test directory removed'}else{'Failed; owned remote test directory removed'};Save-TestReceipt}
 finally{Remove-PSSession $taskSession}
}
$taskLedger.results|ConvertTo-Json -Depth 10
