param([switch]$Publish)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location $root
$vendor=Join-Path $root '.local/dns-vendor/DnsServer'
$commit='8d30bab46eea70f6d4f6772f25113a929bd97f14'
$base='technitium/dns-server:15.6.1@sha256:e5474007d142d509c7de0d855132e3f0469bd6d5d77abf23dff5dad4e2975d09'
$image='harbor.cormierconsulting.io/automation/dns-manager-engine:15.6.1-axfr1'
if(!(Test-Path $vendor)) {
 & git clone --depth 1 --branch v15.6.1 https://github.com/TechnitiumSoftware/DnsServer.git $vendor
 if($LASTEXITCODE -ne 0){throw 'Pinned source clone failed'}
}
if((& git -C $vendor rev-parse HEAD).Trim() -ne $commit){throw 'Unexpected vendor commit; preserve and review the existing checkout.'}
& docker pull $base
if($LASTEXITCODE -ne 0){throw 'Pinned image pull failed'}
$extract='dns-build-extract-'+[Guid]::NewGuid().ToString('N').Substring(0,10)
try {
 & docker create --name $extract $base | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Extraction container creation failed'}
 $libraryRoot=Join-Path $root '.local/dns-vendor/TechnitiumLibrary/bin'
 New-Item -ItemType Directory -Force $libraryRoot | Out-Null
 foreach($library in @('TechnitiumLibrary.dll','TechnitiumLibrary.Net.dll','TechnitiumLibrary.IO.dll','TechnitiumLibrary.ByteTree.dll','TechnitiumLibrary.Security.OTP.dll')) {
  & docker cp "${extract}:/opt/technitium/dns/$library" (Join-Path $libraryRoot $library)
  if($LASTEXITCODE -ne 0){throw "Library extraction failed: $library"}
 }
} finally {& docker rm $extract | Out-Null}
& node scripts/patch-dns-secondary.mjs
if($LASTEXITCODE -ne 0){throw 'Compatibility patch failed'}
& dotnet build .local/dns-vendor/DnsServer/DnsServerCore/DnsServerCore.csproj -c Release -o .local/dns-vendor/compat-build
if($LASTEXITCODE -ne 0){throw 'Core build failed'}
& docker build -f live-management/Dockerfile.dns-compat -t $image .
if($LASTEXITCODE -ne 0){throw 'Image build failed'}
[pscustomobject]@{sourceCommit=$commit;baseImage=$base;coreSha256=(Get-FileHash .local/dns-vendor/compat-build/DnsServerCore.dll -Algorithm SHA256).Hash;builtAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content .local/manager-installation/dns-compat-provenance.json
if($Publish){& docker push $image;if($LASTEXITCODE -ne 0){throw 'Image publication failed'}}
