param(
    [string]$Helm = (Join-Path $PSScriptRoot '../.tools/helm/windows-amd64/helm.exe'),
    [switch]$ConfigurePrivateDns,
    [switch]$RestartOneDataNode
)
$ErrorActionPreference = 'Stop'
$repository = Split-Path $PSScriptRoot -Parent
$previousDirectory = Get-Location

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed with exit code $LASTEXITCODE" }
}

try {
    Set-Location $repository
    $cache = Join-Path $repository '.local/opensearch'
    New-Item -ItemType Directory -Path $cache -Force | Out-Null
    $chart = Join-Path $cache 'opensearch-operator-3.0.14.tgz'
    if (-not (Test-Path -LiteralPath $chart)) {
        Invoke-WebRequest 'https://github.com/opensearch-project/opensearch-k8s-operator/releases/download/opensearch-operator-3.0.14/opensearch-operator-3.0.14.tgz' -OutFile $chart
    }
    if ((Get-FileHash -LiteralPath $chart -Algorithm SHA256).Hash -ne '0327D449AB61E112E0C13D54408BEF396706C500CBF9211DA965AA3AE94F9A68') {
        throw 'OpenSearch operator chart checksum mismatch.'
    }

    kubectl get namespace default -o name | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Kubernetes connection failed.' }
    $namespace = kubectl get namespace opensearch --ignore-not-found -o name
    if (-not $namespace) { Invoke-Checked kubectl @('create', 'namespace', 'opensearch') }
    $pools = [ordered]@{
        manager      = @('kubworker06', 'kubworker10', 'kubworker14')
        'data-pve09' = @('kubworker05', 'kubworker09', 'kubworker13', 'kubworker16')
        'data-pve06' = @('kubworker07', 'kubworker08', 'kubworker11', 'kubworker15')
    }
    $eligibleWorkers = @('kubworker05', 'kubworker06', 'kubworker07', 'kubworker08', 'kubworker09', 'kubworker10',
        'kubworker11', 'kubworker12', 'kubworker13', 'kubworker14', 'kubworker15', 'kubworker16')
    $allSelected = @($pools.Values | ForEach-Object { $_ })
    if (($allSelected | Sort-Object -Unique).Count -ne 11) { throw 'OpenSearch node assignments must be unique.' }
    $eligibleWorkers = 5..16 | ForEach-Object { 'kubworker{0:d2}' -f $_ }

    $nodes = (kubectl get nodes -o json | ConvertFrom-Json).items
    $longhornNodes = (kubectl -n longhorn-system get nodes.longhorn.io -o json | ConvertFrom-Json).items
    $requiredDiskTag = @{ manager = 'thin'; 'data-pve09' = 'proxmox09-nfs'; 'data-pve06' = 'proxmox06-nfs' }
    foreach ($pool in $pools.Keys) {
        foreach ($worker in $pools[$pool]) {
            $node = $nodes | Where-Object { $_.metadata.name -eq $worker }
            if (-not $node -or -not ($node.status.conditions | Where-Object { $_.type -eq 'Ready' -and $_.status -eq 'True' })) {
                throw "$worker is missing or not Ready."
            }
            if ($node.metadata.labels.'topology.kubernetes.io/zone' -in @('proxmox01', 'proxmox02')) {
                throw "$worker is in an excluded OpenSearch zone."
            }
            $longhornNode = $longhornNodes | Where-Object { $_.metadata.name -eq $worker }
            $tag = $requiredDiskTag[$pool]
            $eligibleDisks = @($longhornNode.spec.disks.PSObject.Properties | Where-Object {
                $_.Value.allowScheduling -and $_.Value.tags -contains $tag
            })
            if (-not $longhornNode.spec.allowScheduling -or $eligibleDisks.Count -eq 0) {
                throw "$worker does not have a schedulable Longhorn disk tagged $tag."
            }
        }
    }
    $dataZones = @($pools['data-pve09'] + $pools['data-pve06'] | ForEach-Object {
        $worker = $_
        ($nodes | Where-Object { $_.metadata.name -eq $worker }).metadata.labels.'topology.kubernetes.io/zone'
    })
    if (($dataZones | Sort-Object -Unique).Count -lt 6) { throw 'The eight data nodes must span all six eligible physical zones.' }
    $managerZones = @($pools.manager | ForEach-Object {
        $worker = $_
        ($nodes | Where-Object { $_.metadata.name -eq $worker }).metadata.labels.'topology.kubernetes.io/zone'
    })
    if (($managerZones | Sort-Object -Unique).Count -ne 3) { throw 'The three managers must span three physical zones.' }

    Invoke-Checked kubectl (@('label', 'node') + $eligibleWorkers + @('storage.cormierconsulting.io/opensearch-eligible=true', '--overwrite'))
    Invoke-Checked kubectl @('label', 'nodes', '-l', 'storage.cormierconsulting.io/opensearch-pool', 'storage.cormierconsulting.io/opensearch-pool-')
    Invoke-Checked kubectl @('label', 'nodes', '-l', 'storage.cormierconsulting.io/opensearch-eligible', 'storage.cormierconsulting.io/opensearch-eligible-')
    Invoke-Checked kubectl (@('label', 'node') + $eligibleWorkers + @('storage.cormierconsulting.io/opensearch-eligible=true', '--overwrite'))
    foreach ($pool in $pools.Keys) {
        Invoke-Checked kubectl (@('label', 'node') + $pools[$pool] + @("storage.cormierconsulting.io/opensearch-pool=$pool", '--overwrite'))
    }

    Invoke-Checked kubectl @('apply', '--dry-run=server', '-f', 'opensearch/prerequisites.yaml')
    Invoke-Checked kubectl @('apply', '-f', 'opensearch/prerequisites.yaml')
    Invoke-Checked $Helm @('lint', $chart, '-f', 'opensearch/operator-values.yaml')
    Invoke-Checked $Helm @('upgrade', '--install', 'opensearch-operator', $chart,
        '-n', 'opensearch', '-f', 'opensearch/operator-values.yaml', '--wait', '--timeout', '5m')

    foreach ($manifest in @('cluster.yaml', 'private-access.yaml', 'index-defaults.yaml')) {
        Invoke-Checked kubectl @('apply', '--dry-run=server', '-f', "opensearch/$manifest")
        Invoke-Checked kubectl @('apply', '-f', "opensearch/$manifest")
    }

    $expected = @{ 'opensearch-managers' = 3; 'opensearch-data-pve09' = 4; 'opensearch-data-pve06' = 4 }
    $deadline = (Get-Date).AddMinutes(30)
    do {
        $sets = @(kubectl -n opensearch get statefulset -o json | ConvertFrom-Json).items
        $ready = $true
        foreach ($name in $expected.Keys) {
            $set = $sets | Where-Object { $_.metadata.name -eq $name }
            if (-not $set -or $set.status.readyReplicas -ne $expected[$name] -or $set.status.updatedReplicas -ne $expected[$name]) {
                $ready = $false
            }
        }
        if ($ready) { break }
        Start-Sleep -Seconds 10
    } while ((Get-Date) -lt $deadline)
    if (-not $ready) { throw 'The OpenSearch node pools did not become ready within 30 minutes.' }

    # On a first install the operator removes the bootstrap node with a
    # controlled OnDelete pass. Replica allocation stays primary-only until
    # this component reports Ready.
    $deadline = (Get-Date).AddMinutes(30)
    $stableChecks = 0
    do {
        $cluster = kubectl -n opensearch get opensearchcluster opensearch -o json | ConvertFrom-Json
        $security = $cluster.status.componentsStatus | Where-Object { $_.component -eq 'Securityconfig' }
        $rolling = $cluster.status.componentsStatus | Where-Object { $_.component -eq 'RollingRestart' }
        if ($security.status -eq 'Ready' -and (-not $rolling -or $rolling.status -in @('Ready', 'Finished'))) {
            $stableChecks++
        } else {
            $stableChecks = 0
        }
        if ($stableChecks -ge 3) { break }
        Start-Sleep -Seconds 10
    } while ((Get-Date) -lt $deadline)
    if ($stableChecks -lt 3) { throw 'The OpenSearch operator did not finish its rolling restart within 30 minutes.' }

    Invoke-Checked kubectl @('-n', 'opensearch', 'rollout', 'status', 'deployment/opensearch-dashboards', '--timeout=10m')
    Invoke-Checked kubectl @('-n', 'opensearch', 'wait', '--for=condition=Ready', 'certificate/opensearch-private-ingress', '--timeout=15m')
    if ($ConfigurePrivateDns) {
        Invoke-Checked node @('opensearch/configure-private-dns.mjs')
    }
    $verifyArgs = @('opensearch/verify-live.mjs')
    if ($RestartOneDataNode) { $verifyArgs += '--restart-one-node' }
    Invoke-Checked node $verifyArgs
} finally {
    Set-Location $previousDirectory
}
