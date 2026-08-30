$ErrorActionPreference = "Stop"

$project = Get-Location
$source = Join-Path $project "front-desk-page.tsx"
$target = Join-Path $project "app\front-desk\page.tsx"

if (-not (Test-Path -LiteralPath $source)) {
    Write-Host ""
    Write-Host "ERROR: front-desk-page.tsx was not found in the project root." -ForegroundColor Red
    Write-Host "Put front-desk-page.tsx and this installer inside netpos-hospitality."
    Write-Host ""
    exit 1
}

$targetDirectory = [System.IO.Path]::GetDirectoryName($target)
[System.IO.Directory]::CreateDirectory($targetDirectory) | Out-Null

Copy-Item -LiteralPath $source -Destination $target -Force

Write-Host ""
Write-Host "NETPOS FRONT DESK THEME INSTALLED" -ForegroundColor Green
Write-Host ""
Write-Host "Updated:"
Write-Host "  app\front-desk\page.tsx"
Write-Host ""
Write-Host "Existing Front Desk functions were preserved."
Write-Host "Duplicate page branding/navigation was removed because the global NETPOS shell now handles it."
Write-Host ""
Write-Host "Restart Next.js:"
Write-Host "  Ctrl + C"
Write-Host "  npm run dev"
Write-Host ""
