$ErrorActionPreference = 'Stop'
$opensearchCredential = kubectl -n opensearch get secret opensearch-admin-password -o json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Could not read the OpenSearch credential Secret.' }
$opensearchPassword = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($opensearchCredential.data.password))
Set-Clipboard -Value $opensearchPassword
Remove-Variable opensearchPassword, opensearchCredential
Write-Output 'Admin password copied to the clipboard. Username: admin'
