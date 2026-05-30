$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$clientId = Read-Host "Google OAuth Desktop Client ID"
$clientSecret = Read-Host "Google OAuth Desktop Client Secret"

if ([string]::IsNullOrWhiteSpace($clientId) -or [string]::IsNullOrWhiteSpace($clientSecret)) {
    throw "Client ID and Client Secret are required for the install package."
}

$clientId = $clientId.Trim()
$clientSecret = $clientSecret.Trim()

if ($clientId -notmatch '^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$') {
    throw "The Client ID does not look like a Google OAuth Desktop Client ID. It should end with .apps.googleusercontent.com."
}

if ($clientSecret -notmatch '^GOCSPX-[A-Za-z0-9_-]+$') {
    throw "The Client Secret does not look right. Paste only the client_secret value, not the whole downloaded JSON file."
}

$env:JSC_GOOGLE_CLIENT_ID = $clientId
$env:JSC_GOOGLE_CLIENT_SECRET = $clientSecret
Remove-Item Env:\JSC_PACKAGE_NAME -ErrorAction SilentlyContinue

python tools\build_corinne_package.py

Write-Host ""
Write-Host "Package is ready:"
Write-Host "  See the Built zip package line above."
