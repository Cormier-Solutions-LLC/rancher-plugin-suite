$ErrorActionPreference='Stop'
$source=Join-Path $PSScriptRoot '../live-management/windows-dns-bridge.ps1'
$tokens=$null;$parseErrors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($source,[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count){throw 'Windows bridge source does not parse.'}
$definition=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Publish-Inventory'},$true)
if(!$definition){throw 'Inventory publisher was not found.'}
Invoke-Expression $definition.Extent.Text
function Available-Zones {'owned.example.test'}
function Read-Ownership {$script:fixtureEntries}
function Zone-Serial {'123'}
function Read-Records {@()}
function Read-Kube { @{data=@{}} }
function Write-Kube {param($cm) $script:published=$cm.data.'inventory.json'}
foreach($count in @(0,1,2)){
 $items=@();for($index=0;$index -lt $count;$index++){$items+=[pscustomobject]@{name=('child'+$index);type='NS';value='source.example.test';ttl=3600}}
 $script:fixtureEntries=@([pscustomobject]@{name='owned.example.test';status='Active';ownerId='fixture-owner';parentZone='example.test';delegationRecords=$items})
 Publish-Inventory
 $parsed=ConvertFrom-Json $script:published
 if($parsed.zones[0].delegationRecords -isnot [array] -or $parsed.zones[0].delegationRecords.Count -ne $count){throw "Delegation JSON shape failed for $count records."}
}
$script:fixtureEntries=@();Publish-Inventory
$parsed=ConvertFrom-Json $script:published
if($parsed.zones[0].managed -or $parsed.zones[0].delegationRecords -isnot [array] -or $parsed.zones[0].delegationRecords.Count){throw 'Unmanaged zone metadata is not an empty list.'}
Write-Output 'Windows bridge delegation JSON: empty, single, multiple, and unmanaged cases passed.'
