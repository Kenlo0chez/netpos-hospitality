$ErrorActionPreference = "Stop"

$project = Get-Location
$target = Join-Path $project "app\reservations\[id]\page.tsx"
$source = Join-Path $project "reservation-folio-page.tsx"

if (-not (Test-Path -LiteralPath $source)) {
    Write-Host "ERROR: reservation-folio-page.tsx must be in the project root." -ForegroundColor Red
    exit 1
}

$targetDir = [System.IO.Path]::GetDirectoryName($target)
[System.IO.Directory]::CreateDirectory($targetDir) | Out-Null

Copy-Item -LiteralPath $source -Destination $target -Force

Write-Host ""
Write-Host "NETPOS GUEST FOLIO INSTALLED" -ForegroundColor Green
Write-Host "Updated: app\reservations\[id]\page.tsx"
Write-Host ""
Write-Host "Restart Next.js:"
Write-Host "  Ctrl + C"
Write-Host "  npm run dev"
Write-Host ""
