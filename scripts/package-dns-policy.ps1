$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$build=Join-Path $root 'dns-manager-dev/src/LookupPolicy/bin/Release/net10.0'
$output=Join-Path $root '.local/manager-installation/LookupPolicy.zip'
$zip=[IO.Compression.ZipArchive]::new([IO.File]::Create($output),[IO.Compression.ZipArchiveMode]::Create)
try {
 foreach($file in @('Cormier.Dns.LookupPolicy.dll','Cormier.Dns.LookupPolicy.deps.json')){
  [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,(Join-Path $build $file),$file)|Out-Null
 }
 $writer=[IO.StreamWriter]::new($zip.CreateEntry('dnsApp.config').Open())
 try {$writer.Write((@{Enabled=$true;SourceServer='10.99.3.2';PublicServer='8.8.8.8';ValidatePublicDnssec=$true;QueryTimeoutMilliseconds=1500;TotalTimeoutMilliseconds=10000}|ConvertTo-Json -Compress))}finally{$writer.Dispose()}
}finally{$zip.Dispose()}
Write-Output 'Production lookup package created with public DNSSEC validation.'
