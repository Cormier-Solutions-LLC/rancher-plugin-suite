$ErrorActionPreference = 'Stop'
$prototypeRoot = Split-Path $PSScriptRoot -Parent
$composeFile = Join-Path $prototypeRoot 'compose.prototype.yaml'
& (Join-Path $PSScriptRoot 'Prepare-Prototype.ps1')
foreach ($project in @('tests/Gateway/Gateway.csproj', 'tests/Prototype/Prototype.csproj')) {
    & dotnet build (Join-Path $prototypeRoot $project) --nologo
    if ($LASTEXITCODE -ne 0) { throw "Build failed: $project" }
}
& docker compose -f $composeFile config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Invalid prototype Compose configuration.' }
try {
    & docker compose -f $composeFile up -d
    if ($LASTEXITCODE -ne 0) { throw 'Prototype services did not start.' }
    & dotnet run --no-build --project (Join-Path $prototypeRoot 'tests/Prototype/Prototype.csproj') -- $prototypeRoot
    if ($LASTEXITCODE -ne 0) { throw 'Prototype checks failed; see artifacts/results.json.' }
} finally {
    # The harness also stops these services; this covers setup failures and interruptions.
    & docker compose -f $composeFile stop --timeout 1
}
