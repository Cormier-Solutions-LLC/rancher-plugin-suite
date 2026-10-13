param([switch]$Publish)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location $root
$vendor=Join-Path $root '.local/traefik-vendor'
$commit='e8f398ee30ca5643158ea9094b701b8eae9849e5'
$image='harbor.cormierconsulting.io/automation/traefik:3.7.12-udp2'
if(!(Test-Path -LiteralPath $vendor)){
 & git clone --depth 1 --branch v3.7.12 https://github.com/traefik/traefik.git $vendor
 if($LASTEXITCODE -ne 0){throw 'Pinned Traefik source clone failed'}
}
if((& git -C $vendor rev-parse HEAD).Trim() -ne $commit){throw 'Unexpected Traefik source commit; preserve and review the checkout'}
& node scripts/patch-traefik-udp.mjs $vendor
if($LASTEXITCODE -ne 0){throw 'UDP compatibility patch failed'}
Copy-Item -LiteralPath (Join-Path $root 'live-management/traefik-ready.go') -Destination (Join-Path $vendor 'manager-ready.go')
& docker build -f live-management/Dockerfile.traefik-compat -t $image $vendor
if($LASTEXITCODE -ne 0){throw 'Traefik compatibility build failed'}
& node scripts/test-traefik-udp-compat.mjs
if($LASTEXITCODE -ne 0){throw 'Isolated compatibility regression failed; do not publish'}
if($Publish){& docker push $image;if($LASTEXITCODE -ne 0){throw 'Traefik image publication failed'}}
$digest=(& docker image inspect $image --format '{{json .RepoDigests}}')|ConvertFrom-Json
@{sourceCommit=$commit;upstreamVersion='3.7.12';image=$image;published=[bool]$Publish;repoDigests=$digest;change='Clear handlers for UDP entrypoints missing from replacement configuration';verifiedAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 10|Set-Content -LiteralPath '.local/manager-installation/traefik-build-provenance.json' -Encoding utf8
