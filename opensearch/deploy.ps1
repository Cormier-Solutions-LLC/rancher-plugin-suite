param(
    [string]$Helm = (Join-Path $PSScriptRoot '../.tools/helm/windows-amd64/helm.exe'),
    [switch]$ConfigurePrivateDns
)
$ErrorActionPreference = 'Stop'
$opensearchRepo = Split-Path $PSScriptRoot -Parent
$opensearchPreviousDirectory = Get-Location
function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed with exit code $LASTEXITCODE" }
}
try {
    Set-Location $opensearchRepo
    $opensearchCache = Join-Path $opensearchRepo '.local/opensearch'
    New-Item -ItemType Directory -Path $opensearchCache -Force | Out-Null
    $opensearchChart = Join-Path $opensearchCache 'opensearch-operator-3.0.14.tgz'
    if (-not (Test-Path -LiteralPath $opensearchChart)) {
        Invoke-WebRequest 'https://github.com/opensearch-project/opensearch-k8s-operator/releases/download/opensearch-operator-3.0.14/opensearch-operator-3.0.14.tgz' -OutFile $opensearchChart
    }
    if ((Get-FileHash -LiteralPath $opensearchChart -Algorithm SHA256).Hash -ne '0327D449AB61E112E0C13D54408BEF396706C500CBF9211DA965AA3AE94F9A68') {
        throw 'OpenSearch operator chart checksum mismatch.'
    }
    kubectl get namespace opensearch --ignore-not-found -o name | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Kubernetes connection failed.' }
    $opensearchNamespace = kubectl get namespace opensearch --ignore-not-found -o name
    if (-not $opensearchNamespace) { Invoke-Checked kubectl @('create', 'namespace', 'opensearch') }
    Invoke-Checked kubectl @('apply', '--dry-run=server', '-f', 'opensearch/prerequisites.yaml')
    Invoke-Checked kubectl @('apply', '-f', 'opensearch/prerequisites.yaml')
    Invoke-Checked $Helm @('lint', $opensearchChart, '-f', 'opensearch/operator-values.yaml')
    Invoke-Checked $Helm @('upgrade', '--install', 'opensearch-operator', $opensearchChart,
        '-n', 'opensearch', '-f', 'opensearch/operator-values.yaml', '--wait', '--timeout', '5m')
    foreach ($opensearchManifest in @('cluster.yaml', 'private-access.yaml', 'index-defaults.yaml')) {
        Invoke-Checked kubectl @('apply', '--dry-run=server', '-f', "opensearch/$opensearchManifest")
        Invoke-Checked kubectl @('apply', '-f', "opensearch/$opensearchManifest")
    }
    # The operator uses OnDelete and rolls nodes itself; kubectl rollout status
    # does not support that strategy. Wait for all pods to use the new template.
    $opensearchDeadline = (Get-Date).AddMinutes(15)
    do {
        $opensearchStatefulSet = kubectl -n opensearch get statefulset opensearch-nodes -o json | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { throw 'Could not inspect OpenSearch rollout.' }
        $opensearchRolledOut = $opensearchStatefulSet.status.readyReplicas -eq 3 -and $opensearchStatefulSet.status.updatedReplicas -eq 3
        if ($opensearchRolledOut) { break }
        Start-Sleep -Seconds 5
    } while ((Get-Date) -lt $opensearchDeadline)
    if (-not $opensearchRolledOut) { throw 'OpenSearch operator rolling restart did not complete in 15 minutes.' }
    Invoke-Checked kubectl @('-n', 'opensearch', 'rollout', 'status', 'deployment/opensearch-dashboards', '--timeout=5m')
    Invoke-Checked kubectl @('-n', 'opensearch', 'wait', '--for=condition=Ready', 'certificate/opensearch-private-ingress', '--timeout=15m')
    if ($ConfigurePrivateDns) {
        # Requires a running `kubectl proxy --port=18089 --address=127.0.0.1`.
        Invoke-Checked node @('opensearch/configure-private-dns.mjs')
    }
    Invoke-Checked node @('opensearch/verify-live.mjs')
} finally {
    Set-Location $opensearchPreviousDirectory
}
