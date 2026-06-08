param (
    [Parameter(Mandatory = $true)]
    [string]$FilePath,

    [Parameter(Mandatory = $true)]
    [string]$ExpectedThumbprint
)

if (-not (Test-Path $FilePath)) {
    throw "Signed Windows file not found at $FilePath"
}

Write-Host "Verifying signature for $FilePath..."

$signature = Get-AuthenticodeSignature -FilePath $FilePath

if (-not $signature.SignerCertificate) {
    throw "No Authenticode signer certificate was found. Status: $($signature.Status)"
}

if ($signature.SignatureType -ne "Authenticode") {
    throw "Expected an Authenticode signature, found $($signature.SignatureType)."
}

$certificate = $signature.SignerCertificate
if ($certificate.Thumbprint -ne $ExpectedThumbprint) {
    throw "The signer thumbprint does not match the configured Windows certificate."
}

$codeSigningOid = "1.3.6.1.5.5.7.3.3"
$enhancedKeyUsage = $certificate.Extensions |
    Where-Object { $_ -is [Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension] }
if (-not $enhancedKeyUsage -or $codeSigningOid -notin $enhancedKeyUsage.EnhancedKeyUsages.Value) {
    throw "The signer certificate is not valid for code signing."
}

$now = Get-Date
if ($now -lt $certificate.NotBefore -or $now -gt $certificate.NotAfter) {
    throw "The signer certificate is not currently valid."
}

$acceptedStatuses = @("Valid", "UnknownError")
if ($signature.Status.ToString() -notin $acceptedStatuses) {
    throw "Signature verification failed. Status: $($signature.Status). $($signature.StatusMessage)"
}

if ($signature.Status -eq "UnknownError") {
    if ($certificate.Subject -ne $certificate.Issuer) {
        throw "The certificate is not self-signed, but Windows could not validate its trust chain."
    }

    Write-Warning "The signature is present but its trust chain is unknown on this runner. This is expected only for a self-signed certificate."
}

Write-Host "Signature verified."
Write-Host "  Signer: $($certificate.Subject)"
Write-Host "  Thumbprint: $($certificate.Thumbprint)"
Write-Host "  Trust status: $($signature.Status)"
