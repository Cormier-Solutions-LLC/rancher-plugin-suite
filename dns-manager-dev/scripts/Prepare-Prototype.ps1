$ErrorActionPreference = 'Stop'
$prototypeRoot = Split-Path $PSScriptRoot -Parent
$workspaceRoot = Split-Path $prototypeRoot -Parent
$libraryRoot = Join-Path $workspaceRoot '.local/dns-prototype/lib'
$stateRoot = Join-Path $prototypeRoot '.state'
$image = 'technitium/dns-server:15.6.1@sha256:e5474007d142d509c7de0d855132e3f0469bd6d5d77abf23dff5dad4e2975d09'
New-Item -ItemType Directory -Force -Path $libraryRoot, $stateRoot | Out-Null
$passwordPath = Join-Path $stateRoot 'admin-password.txt'
if (-not (Test-Path -LiteralPath $passwordPath)) {
    $password = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
    [IO.File]::WriteAllText($passwordPath, $password, [Text.UTF8Encoding]::new($false))
}
& docker pull $image
if ($LASTEXITCODE -ne 0) { throw 'Pinned prototype image could not be pulled.' }
$extractContainer = 'dns-prototype-extract-' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
try {
    & docker create --name $extractContainer $image | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not create library extraction container.' }
    foreach ($library in @('DnsServerCore.ApplicationCommon.dll', 'TechnitiumLibrary.dll',
        'TechnitiumLibrary.Net.dll', 'TechnitiumLibrary.IO.dll')) {
        & docker cp "${extractContainer}:/opt/technitium/dns/$library" (Join-Path $libraryRoot $library)
        if ($LASTEXITCODE -ne 0) { throw "Could not extract $library." }
    }
} finally {
    & docker rm $extractContainer | Out-Null
}
Write-Host 'Pinned server libraries and local password are ready. The password was not printed.'
