$ErrorActionPreference = "Stop"

$project = Get-Location
$source = Join-Path $project "NetposAccessGuard.tsx"
$target = Join-Path $project "src\components\NetposAccessGuard.tsx"

if (-not (Test-Path -LiteralPath $source)) {
    Write-Host ""
    Write-Host "ERROR: NetposAccessGuard.tsx was not found in the project root." -ForegroundColor Red
    Write-Host "Put NetposAccessGuard.tsx and this installer inside the netpos-hospitality folder."
    Write-Host ""
    exit 1
}

$targetDirectory = [System.IO.Path]::GetDirectoryName($target)
[System.IO.Directory]::CreateDirectory($targetDirectory) | Out-Null

Copy-Item -LiteralPath $source -Destination $target -Force

Write-Host ""
Write-Host "NETPOS GLOBAL THEME INSTALLED" -ForegroundColor Green
Write-Host ""
Write-Host "Updated:"
Write-Host "  src\components\NetposAccessGuard.tsx"
Write-Host ""
Write-Host "Global navigation order:"
Write-Host "  Front Desk > Reservations > Quotations > Guests > Billing > Housekeeping > Reports > Setup > Users > X Report / EOD"
Write-Host ""
Write-Host "X Report / EOD is anchored at the far right for users who have access."
Write-Host ""
Write-Host "Restart Next.js:"
Write-Host "  Ctrl + C"
Write-Host "  npm run dev"
Write-Host ""
