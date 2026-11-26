$root = Split-Path $PSScriptRoot -Parent
$project = [xml](Get-Content -Raw -LiteralPath (Join-Path $root 'dns-manager-dev/src/LookupPolicy/LookupPolicy.csproj'))
$version = $project.SelectSingleNode('/Project/PropertyGroup/Version').InnerText
if ($version -notmatch '^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$') {
    throw 'LookupPolicy must declare a valid release version.'
}
Join-Path $root ".local/manager-installation/LookupPolicy-$version.zip"
