param([switch]$Rollback)
$ErrorActionPreference = 'Stop'
function Read-KubeJson {
    $raw = kubectl @args -o json
    if ($LASTEXITCODE -ne 0) { throw 'Kubernetes read failed' }
    $raw | ConvertFrom-Json
}
function Set-Paths($Namespace, $Kind, $Name, $Replacements) {
    $object = Read-KubeJson -n $Namespace get $Kind $Name
    $patch = @(@{op = 'test'; path = '/metadata/resourceVersion'; value = $object.metadata.resourceVersion})
    $patch += $Replacements
    $body = ConvertTo-Json -InputObject $patch -Depth 12 -Compress
    kubectl -n $Namespace patch $Kind $Name --type=json --patch $body --dry-run=server
    if ($LASTEXITCODE -ne 0) { throw "$Kind/$Name dry run failed" }
    kubectl -n $Namespace patch $Kind $Name --type=json --patch $body
    if ($LASTEXITCODE -ne 0) { throw "$Kind/$Name cutover patch failed" }
}
function PropertyIndex($Items, $Value) {
    $indices = @(for ($i = 0; $i -lt $Items.Count; $i++) {
        if ($Items[$i].name -eq $Value) { $i }
    })
    if ($indices.Count -ne 1) { throw "Unexpected count for $Value" }
    $indices[0]
}
if ($Rollback) {
    $searchService = 'opensearch'
    $dashService = 'opensearch-dashboards'
    $searchTransport = 'opensearch-api'
    $ca = 'proof-studio-search-ca'
} else {
    $searchService = 'wazuh-indexer'
    $dashService = 'wazuh-indexer-dashboards'
    $searchTransport = 'wazuh-indexer'
    $ca = 'proof-studio-wazuh-ca'
    $canary = Read-KubeJson -n proofing get job proof-studio-wazuh-canary
    if ($canary.status.succeeded -ne 1) { throw 'Proof Studio canary must succeed' }
}
$cron = Read-KubeJson -n proofing get cronjob proof-studio-search-sync
$podSpec = $cron.spec.jobTemplate.spec.template.spec
$container = PropertyIndex $podSpec.containers 'sync'
$envIndex = PropertyIndex $podSpec.containers[$container].env 'SEARCH_URL'
$trust = PropertyIndex $podSpec.volumes 'search-trust'
$specPrefix = '/spec/jobTemplate/spec/template/spec'
$cronEdits = @(
    @{op = 'test'; path = "$specPrefix/containers/$container/env/$envIndex/name"; value = 'SEARCH_URL'},
    @{op = 'test'; path = "$specPrefix/volumes/$trust/name"; value = 'search-trust'},
    @{op = 'replace'; path = "$specPrefix/containers/$container/env/$envIndex/value"; value = "https://$searchService.opensearch.svc.cluster.local:9200"},
    @{op = 'replace'; path = "$specPrefix/volumes/$trust/configMap/name"; value = $ca}
)
$route = Read-KubeJson -n opensearch get ingressroute opensearch-private
$targets = @{
    'opensearch.cormierconsulting.io' = @{service = $dashService; transport = $dashService; port = 5601}
    'opensearch-api.cormierconsulting.io' = @{service = $searchService; transport = $searchTransport; port = 9200}
}
$ingressEdits = @(for ($i = 0; $i -lt $route.spec.routes.Count; $i++) {
    $rule = $route.spec.routes[$i]
    $match = [regex]::Match($rule.match, '^Host\(\x60([a-z.-]+)\x60\)$')
    if (!$match.Success -or !$targets.ContainsKey($match.Groups[1].Value) -or $rule.services.Count -ne 1) {
        throw 'Unexpected private search ingress rule'
    }
    $target = $targets[$match.Groups[1].Value]
    if ($rule.services[0].port -ne $target.port -or $rule.services[0].scheme -ne 'https' -or
        !($rule.middlewares.name -contains 'private-networks')) {
        throw 'Private search ingress security policy changed'
    }
    @{op = 'test'; path = "/spec/routes/$i/match"; value = $rule.match}
    @{op = 'replace'; path = "/spec/routes/$i/services/0/name"; value = $target.service}
    @{op = 'replace'; path = "/spec/routes/$i/services/0/serversTransport"; value = $target.transport}
})
if ($ingressEdits.Count -ne 6) { throw 'Expected two private search routes' }
Set-Paths proofing cronjob proof-studio-search-sync $cronEdits
Set-Paths opensearch ingressroute opensearch-private $ingressEdits
