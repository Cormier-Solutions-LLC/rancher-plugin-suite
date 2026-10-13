# The queue ACL authenticates the publisher. JWE protects credential values
# and integrity; possession of the recipient public key is not authorization.
function ConvertTo-DnsBase64Url([byte[]]$Bytes){return [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+','-').Replace('/','_')}
function ConvertFrom-DnsBase64Url([string]$Value){if(!$Value -or $Value.Length -gt 131072 -or $Value -cnotmatch '^[A-Za-z0-9_-]+$'){throw 'Invalid encoding'};$text=$Value.Replace('-','+').Replace('_','/');switch($text.Length%4){0{};2{$text+='=='};3{$text+='='};default{throw 'Invalid encoding'}};$bytes=[Convert]::FromBase64String($text);if((ConvertTo-DnsBase64Url $bytes) -cne $Value){throw 'Invalid encoding'};return ,$bytes}
function Get-DnsChannelPublicKey($Rsa){$parameters=$Rsa.ExportParameters($false);$n=ConvertTo-DnsBase64Url $parameters.Modulus;$e=ConvertTo-DnsBase64Url $parameters.Exponent;$canonical='{"e":"'+$e+'","kty":"RSA","n":"'+$n+'"}';$hash=[Security.Cryptography.SHA256]::Create();try{$kid=ConvertTo-DnsBase64Url ($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonical)))}finally{$hash.Dispose()};return @{kty='RSA';e=$e;n=$n;kid=$kid;alg='RSA-OAEP-256';use='enc'}}
function New-DnsRecoveryChannelKey([string]$Root){
 $Root=Assert-DnsRecoveryRoot $Root;$path=Join-Path $Root 'recovery-channel-key.dpapi';if(Test-Path -LiteralPath $path){$rsa=Get-DnsRecoveryChannelKey $Root;try{return Get-DnsChannelPublicKey $rsa}finally{$rsa.Dispose()}}
 $rsa=[Security.Cryptography.RSACng]::new(3072);try{$xml=$rsa.ToXmlString($true);$bytes=[Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($xml),[Text.Encoding]::UTF8.GetBytes('DnsRecoveryChannelKey/v1'),[Security.Cryptography.DataProtectionScope]::LocalMachine);Write-DnsRecoveryFile $path $bytes;return Get-DnsChannelPublicKey $rsa}finally{$rsa.Dispose();$xml=$null}
}
function Get-DnsRecoveryChannelKey([string]$Root){
 $Root=Assert-DnsRecoveryRoot $Root;$path=Join-Path $Root 'recovery-channel-key.dpapi';if((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Unsafe recovery key file'}
 $bytes=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($path),[Text.Encoding]::UTF8.GetBytes('DnsRecoveryChannelKey/v1'),[Security.Cryptography.DataProtectionScope]::LocalMachine);$rsa=[Security.Cryptography.RSACng]::new();try{$rsa.FromXmlString([Text.Encoding]::UTF8.GetString($bytes));return $rsa}catch{$rsa.Dispose();throw}finally{[Array]::Clear($bytes,0,$bytes.Length)}
}
function Assert-DnsRecoveryMessage($Message,[string]$ClusterUid,[string]$AccountUid,[int64]$Now,[bool]$AllowExpired=$false){
 $uuid='^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 if($ClusterUid -cnotmatch $uuid -or $AccountUid -cnotmatch $uuid){throw 'Installed recovery identity is unavailable'}
 if($Message.version -ne 1 -or $Message.id -cnotmatch $uuid -or $Message.requestId -cnotmatch $uuid -or $Message.userId -cnotmatch '^user-[a-z0-9-]+$' -or $Message.clusterUid -cne $ClusterUid -or $Message.accountUid -cne $AccountUid -or $Message.action -notin @('prepare','commit','reconcile','status') -or $Message.issuedAt -isnot [ValueType] -or $Message.expiresAt -isnot [ValueType] -or [decimal]$Message.issuedAt -ne [int64]$Message.issuedAt -or [decimal]$Message.expiresAt -ne [int64]$Message.expiresAt -or $Message.issuedAt -gt $Now+30 -or (!$AllowExpired -and ($Message.issuedAt -lt $Now-600 -or $Message.expiresAt -le $Now)) -or $Message.expiresAt -le $Message.issuedAt -or $Message.expiresAt-$Message.issuedAt -gt 600){throw 'Recovery message identity or validity differs'}
 foreach($property in $Message.PSObject.Properties){if($property.Name -notin @('version','id','requestId','userId','clusterUid','accountUid','action','issuedAt','expiresAt','target')){throw 'Unsupported recovery message field'}}
 if($Message.action -eq 'prepare'){if($Message.target.configuration -isnot [string] -or !$Message.target.configuration -or $Message.target.configuration.Length -gt 65536 -or @($Message.target.PSObject.Properties).Count -ne 1){throw 'Recovery target is incomplete'}}elseif($Message.PSObject.Properties['target']){throw 'Unexpected recovery target'}
 return $Message
}
function Read-DnsRecoveryEnvelope {
 param([string]$Root,[string]$Envelope,[string]$ClusterUid,[string]$AccountUid,[int64]$Now=([DateTimeOffset]::UtcNow.ToUnixTimeSeconds()),[switch]$AllowExpired)
 $rsa=$null;$cek=$null;$aes=$null;$mac=$null;$transform=$null;$plaintext=$null
 try{
  if(!$Envelope -or $Envelope.Length -gt 131072){throw 'Invalid envelope'};$parts=$Envelope.Split('.');if($parts.Count -ne 5){throw 'Invalid envelope'}
  $header=[Text.Encoding]::UTF8.GetString((ConvertFrom-DnsBase64Url $parts[0]))|ConvertFrom-Json
  if($header.alg -cne 'RSA-OAEP-256' -or $header.enc -cne 'A256CBC-HS512' -or $header.typ -cne 'dns-recovery+jwe' -or @($header.PSObject.Properties).Count -ne 4){throw 'Unsupported envelope algorithms'}
  $rsa=Get-DnsRecoveryChannelKey $Root;$public=Get-DnsChannelPublicKey $rsa;if($header.kid -cne $public.kid){throw 'Different recipient'}
  $wrapped=ConvertFrom-DnsBase64Url $parts[1];$iv=ConvertFrom-DnsBase64Url $parts[2];$ciphertext=ConvertFrom-DnsBase64Url $parts[3];$tag=ConvertFrom-DnsBase64Url $parts[4]
  if($wrapped.Length -ne $rsa.KeySize/8 -or $iv.Length -ne 16 -or $tag.Length -ne 32 -or !$ciphertext.Length -or $ciphertext.Length%16){throw 'Invalid envelope lengths'}
  $cek=$rsa.Decrypt($wrapped,[Security.Cryptography.RSAEncryptionPadding]::OaepSHA256);if($cek.Length -ne 64){throw 'Invalid envelope key'}
  $aad=[Text.Encoding]::ASCII.GetBytes($parts[0]);$length=[BitConverter]::GetBytes([uint64]($aad.Length*8));if([BitConverter]::IsLittleEndian){[Array]::Reverse($length)}
  $mac=[Security.Cryptography.HMACSHA512]::new([byte[]]$cek[0..31]);$signed=[byte[]]($aad+$iv+$ciphertext+$length);$expected=$mac.ComputeHash($signed);$difference=0;for($i=0;$i -lt 32;$i++){$difference=$difference -bor ($expected[$i] -bxor $tag[$i])};if($difference){throw 'Envelope authentication failed'}
  $aes=[Security.Cryptography.Aes]::Create();$aes.Mode=[Security.Cryptography.CipherMode]::CBC;$aes.Padding=[Security.Cryptography.PaddingMode]::PKCS7;$aes.Key=[byte[]]$cek[32..63];$aes.IV=$iv;$transform=$aes.CreateDecryptor();$plaintext=$transform.TransformFinalBlock($ciphertext,0,$ciphertext.Length);if($plaintext.Length -gt 65536){throw 'Oversized recovery payload'}
  $message=[Text.UTF8Encoding]::new($false,$true).GetString($plaintext)|ConvertFrom-Json;return Assert-DnsRecoveryMessage $message $ClusterUid $AccountUid $Now ([bool]$AllowExpired)
 }catch{throw 'Windows recovery envelope verification failed'}
 finally{foreach($resource in @($transform,$aes,$mac,$rsa)){if($resource){$resource.Dispose()}};foreach($bytes in @($cek,$plaintext)){if($bytes){[Array]::Clear($bytes,0,$bytes.Length)}}}
}
