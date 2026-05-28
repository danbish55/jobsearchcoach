$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$clientId = Read-Host "Google OAuth Desktop Client ID (press Enter to leave blank for test package)"
$clientSecret = Read-Host "Google OAuth Desktop Client Secret (press Enter to leave blank for test package)"

$env:JSC_GOOGLE_CLIENT_ID = $clientId
$env:JSC_GOOGLE_CLIENT_SECRET = $clientSecret

python tools\build_corinne_package.py

Write-Host ""
Write-Host "Package is ready in the dist folder."
