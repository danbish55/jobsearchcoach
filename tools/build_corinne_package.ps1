$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$clientId = Read-Host "Google OAuth Desktop Client ID"
$clientSecret = Read-Host "Google OAuth Desktop Client Secret"

if (-not $clientId -or -not $clientSecret) {
  throw "Both Google values are required to build Corinne's package."
}

$env:JSC_GOOGLE_CLIENT_ID = $clientId
$env:JSC_GOOGLE_CLIENT_SECRET = $clientSecret

python tools\build_corinne_package.py

Write-Host ""
Write-Host "Package is ready in the dist folder."
