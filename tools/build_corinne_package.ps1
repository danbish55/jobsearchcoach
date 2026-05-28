$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$clientId = Read-Host "Google OAuth Desktop Client ID"
$clientSecret = Read-Host "Google OAuth Desktop Client Secret"

if ([string]::IsNullOrWhiteSpace($clientId) -or [string]::IsNullOrWhiteSpace($clientSecret)) {
    throw "Client ID and Client Secret are required for the install package."
}

$env:JSC_GOOGLE_CLIENT_ID = $clientId
$env:JSC_GOOGLE_CLIENT_SECRET = $clientSecret
$env:JSC_PACKAGE_NAME = "JobSearchCoach-Install"

python tools\build_corinne_package.py

Write-Host ""
Write-Host "Package is ready:"
Write-Host "  dist\JobSearchCoach-Install.zip"
