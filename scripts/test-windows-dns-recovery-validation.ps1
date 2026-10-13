$ErrorActionPreference='Stop'
$source=Join-Path $PSScriptRoot '../live-management/windows-dns-bridge.ps1'
$tokens=$null;$parseErrors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($source,[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count){throw 'Windows bridge source does not parse.'}
foreach($name in @('Record-Arguments','Validate-ZoneRecovery')){
 $definition=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
 if(!$definition){throw "Missing $name"};Invoke-Expression $definition.Extent.Text
}
function Read-Ownership {[pscustomobject]@{name='recovery.example.test';ownerId='original-owner';status='Deleted'}}
function Fixture {
 $records=@([pscustomobject]@{name='@';type='SOA';value='domain02.cormierconsulting.com. hostmaster.example.test. 4294967295 900 600 86400 3600';ttl=3600},[pscustomobject]@{name='@';type='NS';value='domain02.cormierconsulting.com';ttl=3600})
 foreach($pair in @(@('A','192.0.2.8'),@('AAAA','2001:db8::8'),@('CNAME','target.example.test'),@('PTR','target.example.test'),@('TXT','recovery fixture'),@('MX','10 mail.example.test'),@('SRV','10 5 443 target.example.test'))){$records+=[pscustomobject]@{name=$pair[0].ToLower();type=$pair[0];value=$pair[1];ttl=30}}
 return [pscustomobject]@{zone='recovery.example.test';previousOwnerId='original-owner';records=$records}
}
$valid=Fixture;Validate-ZoneRecovery $valid
$cases=@(
 @{name='wrong owner';change={param($op) $op.previousOwnerId='foreign-owner'}},
 @{name='missing SOA';change={param($op) $op.records=@($op.records|Where-Object type -ne 'SOA')}},
 @{name='missing apex NS';change={param($op) $op.records=@($op.records|Where-Object type -ne 'NS')}},
 @{name='wrong source NS';change={param($op) $op.records[1].value='foreign.example.test'}},
 @{name='duplicate';change={param($op) $op.records+=@($op.records[2])}},
 @{name='fractional TTL';change={param($op) $op.records[2].ttl=30.5}},
 @{name='oversized TTL';change={param($op) $op.records[2].ttl=604801}},
 @{name='negative TTL';change={param($op) $op.records[2].ttl=-1}},
 @{name='invalid IPv4';change={param($op) $op.records[2].value='999.0.2.1'}},
 @{name='malformed name';change={param($op) $op.records[2].name='bad;name'}},
 @{name='unsupported type';change={param($op) $op.records[2].type='CAA'}},
 @{name='invalid SOA number';change={param($op) $op.records[0].value='domain02.cormierconsulting.com. hostmaster.example.test. 4294967296 900 600 86400 3600'}},
 @{name='CNAME conflict';change={param($op) $op.records[4].name='a'}}
)
foreach($case in $cases){$op=Fixture;& $case.change $op;$rejected=$false;try{Validate-ZoneRecovery $op}catch{$rejected=$true};if(!$rejected){throw "Accepted invalid $($case.name) recovery."}}
Write-Output ('Windows recovery preflight: complete seven-type recovery and '+$cases.Count+' rejection cases passed.')
