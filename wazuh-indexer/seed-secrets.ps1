$ErrorActionPreference = 'Stop'
function Read-KubeJson {
    $raw = kubectl @args -o json
    if ($LASTEXITCODE -ne 0) { throw 'Kubernetes read failed' }
    $raw | ConvertFrom-Json
}
function New-ScopedSecret($Name, $Data) {
    $existing = kubectl -n opensearch get secret $Name --ignore-not-found -o name
    if ($LASTEXITCODE -ne 0) { throw 'Kubernetes secret lookup failed' }
    if ($existing) { return }
    @{
        apiVersion = 'v1'; kind = 'Secret'; type = 'Opaque'
        metadata = @{name = $Name; namespace = 'opensearch'}
        data = $Data
    } | ConvertTo-Json -Depth 8 -Compress | kubectl create -f -
    if ($LASTEXITCODE -ne 0) { throw "Could not create $Name" }
}
function New-EncodedPassword {
    $password = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24)) + 'aB3!'
    [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($password))
}
$proof = (Read-KubeJson -n proofing get secret proof-studio-search-sync).data
if (!$proof.SEARCH_USERNAME -or !$proof.SEARCH_PASSWORD) { throw 'Proof Studio search credentials are unavailable' }
New-ScopedSecret 'wazuh-indexer-proof-bootstrap' @{
    SEARCH_USERNAME = $proof.SEARCH_USERNAME
    SEARCH_PASSWORD = $proof.SEARCH_PASSWORD
}
New-ScopedSecret 'wazuh-indexer-dashboards-user' @{password = (New-EncodedPassword)}
New-ScopedSecret 'wazuh-manager-credentials' @{
    'indexer-password' = (New-EncodedPassword)
    'dashboard-api-password' = (New-EncodedPassword)
    'api-admin-password' = (New-EncodedPassword)
    'enrollment-password' = (New-EncodedPassword)
}
$script = Join-Path $PSScriptRoot 'bootstrap.py'
kubectl -n opensearch create configmap wazuh-indexer-bootstrap "--from-file=$script" --dry-run=client -o yaml |
    kubectl apply -f -
if ($LASTEXITCODE -ne 0) { throw 'Could not stage Wazuh bootstrap source' }
