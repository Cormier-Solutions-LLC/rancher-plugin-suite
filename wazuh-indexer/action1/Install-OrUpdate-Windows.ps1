#Requires -Version 5.1

param(
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9.-]*$')]
    [string]$Manager = 'wazah.cormierconsulting.io',
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
if (-not $ValidateOnly) {
    $principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Run as an administrator or through Action1.'
    }
}
$targetVersion = [version]'4.14.11'
$package = "wazuh-agent-$targetVersion-1.msi"
$packageUrl = "https://packages.wazuh.com/4.x/windows/$package"
$checksum = 'EF7416EFC09B01267A9FBCCB40B64512C57743AA1F7D41800148F61778B2C2757B44FBCC6EE8FE4AB1A4CB32A8FD31712F825F08B62D61CA56E490542072609E'

function Get-WazuhAgentVersion {
    $versions = foreach ($view in 'Registry64', 'Registry32') {
        $localMachine = [Microsoft.Win32.RegistryKey]::OpenBaseKey('LocalMachine', $view)
        try {
            $uninstall = $localMachine.OpenSubKey('SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall')
            if ($null -eq $uninstall) { continue }
            try {
                foreach ($name in $uninstall.GetSubKeyNames()) {
                    $entry = $uninstall.OpenSubKey($name)
                    if ($null -eq $entry) { continue }
                    try {
                        if ($entry.GetValue('DisplayName') -eq 'Wazuh Agent') {
                            [version]$entry.GetValue('DisplayVersion')
                        }
                    } finally {
                        $entry.Dispose()
                    }
                }
            } finally {
                $uninstall.Dispose()
            }
        } finally {
            $localMachine.Dispose()
        }
    }
    $versions | Sort-Object -Descending | Select-Object -First 1
}

function Initialize-WazuhEnrollment {
    param([string]$ManagerName)

    $addresses = @([Net.Dns]::GetHostAddresses($ManagerName) | ForEach-Object { $_.IPAddressToString })
    if (-not $addresses) { throw "Wazuh manager '$ManagerName' did not resolve to an IP address." }

    $ports = '1514', '1515'
    $rule = @{
        Name = 'WazuhAgent-Action1-Egress'
        PolicyStore = 'PersistentStore'
        Direction = 'Outbound'
        Enabled = 'True'
        Action = 'Allow'
        Profile = 'Any'
        Protocol = 'TCP'
        RemoteAddress = $addresses
        RemotePort = $ports
    }
    if (Get-NetFirewallRule -Name $rule.Name -PolicyStore $rule.PolicyStore -ErrorAction SilentlyContinue) {
        Set-NetFirewallRule @rule
    } else {
        New-NetFirewallRule @rule -DisplayName 'Wazuh Agent to Manager (Action1)' | Out-Null
    }

    foreach ($port in $ports) {
        $client = [Net.Sockets.TcpClient]::new()
        try {
            $connected = $client.ConnectAsync($ManagerName, [int]$port).Wait(5000) -and $client.Connected
        } catch {
            $connected = $false
        } finally {
            $client.Dispose()
        }
        if (-not $connected) {
            throw "Wazuh manager '$ManagerName' is unreachable on TCP $port. Check the endpoint firewall and the manager's private listener."
        }
    }

    $programFiles = [Environment]::GetFolderPath('ProgramFilesX86')
    if (-not $programFiles) { $programFiles = $env:ProgramFiles }
    $credentialPath = Join-Path $programFiles 'ossec-agent\authd.pass'
    $credential = Get-Item -LiteralPath $credentialPath -ErrorAction SilentlyContinue
    if (-not $credential -or $credential.PSIsContainer -or $credential.Length -eq 0) {
        throw "Stage the Wazuh enrollment credential at '$credentialPath' through a secure channel before installing."
    }
}

$installedVersion = Get-WazuhAgentVersion
if ($installedVersion -and $installedVersion -ge $targetVersion) {
    Write-Output "Wazuh Agent $installedVersion is already installed. Target is $targetVersion."
    exit 0
}

$freshInstall = -not $installedVersion -and -not (Get-Service -Name WazuhSvc -ErrorAction SilentlyContinue)
if ($freshInstall -and -not $ValidateOnly) {
    Initialize-WazuhEnrollment -ManagerName $Manager
}

$workDir = Join-Path ([System.IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString('N'))
New-Item -Path $workDir -ItemType Directory | Out-Null
$msiPath = Join-Path $workDir $package

try {
    Invoke-WebRequest -UseBasicParsing -Uri $packageUrl -OutFile $msiPath -TimeoutSec 120
    if ((Get-FileHash -LiteralPath $msiPath -Algorithm SHA512).Hash -ne $checksum) {
        throw 'Wazuh Agent MSI checksum did not match.'
    }
    if ((Get-AuthenticodeSignature -LiteralPath $msiPath).Status -ne 'Valid') {
        throw 'Wazuh Agent MSI did not pass Authenticode validation.'
    }

    if ($ValidateOnly) {
        Write-Output "Validated Wazuh Agent $targetVersion. No package changes were made."
        return
    }

    $msiArguments = "/i `"$msiPath`" /qn /norestart"
    if ($freshInstall) {
        $msiArguments += " WAZUH_MANAGER=$Manager"
    }
    $install = Start-Process -FilePath "$env:SystemRoot\System32\msiexec.exe" `
        -ArgumentList $msiArguments -Wait -PassThru -WindowStyle Hidden
    if ($install.ExitCode -notin 0, 3010) {
        throw "Wazuh Agent MSI failed with exit code $($install.ExitCode)."
    }
    $actualVersion = Get-WazuhAgentVersion
    if ($actualVersion -ne $targetVersion) {
        throw "Expected Wazuh Agent $targetVersion, found '$actualVersion'."
    }
    if ($install.ExitCode -eq 3010) {
        Write-Output "Wazuh Agent $actualVersion is installed. Windows Installer reports a reboot is required."
        return
    }

    Set-Service -Name WazuhSvc -StartupType Automatic
    Start-Service -Name WazuhSvc
    Write-Output "Wazuh Agent $actualVersion is running. Verify agent check-in in the Wazuh console."
} finally {
    if (Test-Path -LiteralPath $msiPath) {
        Remove-Item -LiteralPath $msiPath -Force
    }
    Remove-Item -LiteralPath $workDir
}
