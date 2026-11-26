param(
    [string]$Name = 'proof-studio-wazuh-canary',
    [switch]$UseScheduledTemplate
)
$ErrorActionPreference = 'Stop'
function Read-KubeJson {
    $raw = kubectl @args -o json
    if ($LASTEXITCODE -ne 0) { throw 'Kubernetes read failed' }
    $raw | ConvertFrom-Json
}
function Apply-KubeJson($Object) {
    $json = $Object | ConvertTo-Json -Depth 60 -Compress
    $json | kubectl apply --dry-run=server -f -
    if ($LASTEXITCODE -ne 0) { throw 'Kubernetes server dry run failed' }
    $json | kubectl apply -f -
    if ($LASTEXITCODE -ne 0) { throw 'Kubernetes apply failed' }
}
$ns = 'proofing'
$cron = Read-KubeJson -n $ns get cronjob proof-studio-search-sync
$cert = Read-KubeJson -n wazah get secret wazuh-indexer-node-tls
$ca = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($cert.data.'ca.crt'))
if (!$ca.StartsWith('-----BEGIN CERTIFICATE-----')) { throw 'Wazuh indexer CA is missing' }
$url = 'https://wazuh-indexer.wazah.svc.cluster.local:9200'
$spec = $cron.spec.jobTemplate.spec
$pod = $spec.template.spec
$container = @($pod.containers | Where-Object name -eq 'sync')
if ($container.Count -ne 1) { throw 'Proof Studio job template changed' }
$endpoint = @($container[0].env | Where-Object name -eq 'SEARCH_URL')
$trust = @($pod.volumes | Where-Object name -eq 'search-trust')
if ($endpoint.Count -ne 1 -or $trust.Count -ne 1) { throw 'Proof Studio endpoint or trust volume changed' }
$caName = 'proof-studio-wazuh-ca'
if ($UseScheduledTemplate) {
    if ($endpoint[0].value -ne $url -or $trust[0].configMap.name -ne $caName) {
        throw 'Scheduled Proof Studio template still points to upstream'
    }
} else {
    $endpoint[0].value = $url
    $trust[0].configMap.name = $caName
}
Apply-KubeJson @{
    apiVersion = 'v1'; kind = 'ConfigMap'; metadata = @{name = $caName; namespace = $ns}
    data = @{'ca.crt' = $ca}
}
Apply-KubeJson @{
    apiVersion = 'v1'; kind = 'ConfigMap'; metadata = @{name = 'proof-studio-wazuh-verification'; namespace = $ns}
    data = @{'verify.py' = (Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'proof-verify.py'))}
}
$container[0].command = @('python3', '-B', '/etc/wazuh-verification/verify.py')
$container[0].volumeMounts += @{name = 'wazuh-verification'; mountPath = '/etc/wazuh-verification'; readOnly = $true}
$pod.volumes += @{name = 'wazuh-verification'; configMap = @{name = 'proof-studio-wazuh-verification'}}
$spec | Add-Member -NotePropertyName backoffLimit -NotePropertyValue 0 -Force
$spec | Add-Member -NotePropertyName ttlSecondsAfterFinished -NotePropertyValue 3600 -Force
Apply-KubeJson @{
    apiVersion = 'batch/v1'; kind = 'Job'; metadata = @{name = $Name; namespace = $ns}
    spec = $spec
}
