$ErrorActionPreference = "Stop"

$project = Get-Location
$source = Join-Path $project "reservations-page.tsx"
$target = Join-Path $project "app\reservations\page.tsx"

if (-not (Test-Path -LiteralPath $source)) {
    Write-Host ""
    Write-Host "ERROR: reservations-page.tsx was not found in the project root." -ForegroundColor Red
    Write-Host "Put reservations-page.tsx and this installer inside netpos-hospitality."
    Write-Host ""
    exit 1
}

$targetDirectory = [System.IO.Path]::GetDirectoryName($target)
[System.IO.Directory]::CreateDirectory($targetDirectory) | Out-Null

Copy-Item -LiteralPath $source -Destination $target -Force

Write-Host ""
Write-Host "NETPOS RESERVATION CALENDAR THEME INSTALLED" -ForegroundColor Green
Write-Host ""
Write-Host "Updated:"
Write-Host "  app\reservations\page.tsx"
Write-Host ""
Write-Host "Preserved:"
Write-Host "  - Two-click check-in/check-out selection"
Write-Host "  - Conflict prevention"
Write-Host "  - Same-day turnover logic"
Write-Host "  - 14-day availability board"
Write-Host "  - Reservation list"
Write-Host "  - Existing reservation opening"
Write-Host "  - Calendar to reservation wizard"
Write-Host ""
Write-Host "Restart Next.js:"
Write-Host "  Ctrl + C"
Write-Host "  npm run dev"
Write-Host ""
