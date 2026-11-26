param([Parameter(Mandatory)][string]$RecoveryFile)
$ErrorActionPreference = 'Stop'
function K {
    kubectl @args
    if ($LASTEXITCODE -ne 0) { throw "Kubernetes command failed: $($args[0..([math]::Min(3,$args.Count-1))] -join ' ')" }
}
function Read-Kube {
    K @args -o json | ConvertFrom-Json
}
$namespace = 'opensearch'
$targetHost = 'https://wazuh-indexer.opensearch.svc.cluster.local:9200'
$verified = Read-Kube -n proofing get job proof-studio-wazuh-postcutover
if ($verified.status.succeeded -ne 1) { throw 'Post-cutover Proof Studio verification must complete' }
$job = @((Read-Kube -n proofing get jobs).items |
    Where-Object {$_.metadata.ownerReferences.name -contains 'proof-studio-search-sync'} |
    Sort-Object {$_.metadata.creationTimestamp})[-1]
if ($job.status.succeeded -ne 1 -or
    ($job.spec.template.spec.containers[0].env | Where-Object name -eq SEARCH_URL).value -ne $targetHost) {
    throw 'A scheduled Proof Studio run against Wazuh must succeed'
}
$target = Read-Kube -n $namespace get statefulset wazuh-indexer
if ($target.status.readyReplicas -ne 3 -or $target.status.updatedReplicas -ne 3) {
    throw 'All three Wazuh nodes must be ready on the current revision'
}
$source = Read-Kube -n $namespace get statefulset opensearch-local
if ($source.spec.persistentVolumeClaimRetentionPolicy.whenScaled -eq 'Delete') {
    throw 'Upstream claims would be deleted by scale-down'
}
$customResources = @((Read-Kube get opensearchcluster -A).items)
if ($customResources.Count -ne 1 -or $customResources[0].metadata.namespace -ne $namespace -or
    $customResources[0].metadata.name -ne 'opensearch') {
    throw 'The upstream operator manages additional or unexpected clusters'
}
$secrets = (Read-Kube -n $namespace get secret opensearch-admin-password).data
$headers = @{ Authorization = ('Basic ' + [Convert]::ToBase64String([byte[]](
    [Convert]::FromBase64String($secrets.username) + 58 + [Convert]::FromBase64String($secrets.password)))) }
$api = 'https://opensearch-api.cormierconsulting.io'
$health = Invoke-RestMethod "$api/_cluster/health" -Headers $headers -TimeoutSec 8
if ($health.cluster_name -ne 'wazuh-indexer' -or $health.status -ne 'green' -or $health.number_of_nodes -ne 3) {
    throw 'The private API is not served by a green three-node Wazuh cluster'
}
$index = 'proof-studio-projects-pilot'
$current = Invoke-RestMethod "$api/$index/_search?size=1000&track_total_hits=true&allow_partial_search_results=false" -Headers $headers -TimeoutSec 8
if ($current.timed_out -or $current._shards.failed -or $current.hits.total.value -ne $current.hits.hits.Count) {
    throw 'Could not read the complete Proof Studio index'
}
Add-Type -AssemblyName System.Security.Cryptography.ProtectedData
$payload = [Security.Cryptography.ProtectedData]::Unprotect(
    [IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $RecoveryFile).ProviderPath), $null,
    [Security.Cryptography.DataProtectionScope]::CurrentUser)
$backup = [Text.Encoding]::UTF8.GetString($payload) | ConvertFrom-Json -Depth 95
$baseline = @($backup.indices | Where-Object name -eq $index)
$hits = @($current.hits.hits)
if ($backup.sourceVersion -ne '3.9.0' -or $backup.sourceUuid -eq
    (Invoke-RestMethod "$api/" -Headers $headers -TimeoutSec 8).cluster_uuid -or
    $baseline.Count -ne 1 -or $baseline[0].documents.Count -ne $hits.Count) {
    throw 'The independent upstream recovery record does not match the expected source'
}
$comparison = @{}
foreach ($doc in $baseline[0].documents) { $comparison[$doc._id] = $doc._source.fingerprint }
foreach ($doc in $hits) {
    if ($comparison[$doc._id] -cne $doc._source.fingerprint) { throw 'Proof Studio fingerprint mismatch' }
}
# Keep both claims and original resource definitions for rollback.
foreach ($deployment in @('opensearch-operator','opensearch-dashboards')) {
    K -n $namespace scale "deployment/$deployment" --replicas=0 --dry-run=server
}
K -n $namespace scale statefulset/opensearch-local --replicas=0 --dry-run=server
K -n $namespace scale deployment/opensearch-operator --replicas=0
K -n $namespace rollout status deployment/opensearch-operator --timeout=90s
K -n $namespace scale deployment/opensearch-dashboards --replicas=0
K -n $namespace scale statefulset/opensearch-local --replicas=0
$oldSelector = 'opensearch.org/opensearch-cluster=opensearch'
if (@((Read-Kube -n $namespace get pods -l $oldSelector).items).Count) {
    K -n $namespace wait --for=delete pod -l $oldSelector --timeout=120s
}
$left = @((Read-Kube -n $namespace get pods -l opensearch.org/opensearch-cluster=opensearch).items)
if ($left.Count) { throw 'Old OpenSearch pods are still present' }
Write-Output "Retired the upstream pods after verifying all $($hits.Count) Proof Studio fingerprints against the recovery export."
