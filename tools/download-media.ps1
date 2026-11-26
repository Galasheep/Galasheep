# Downloads every image and video the site uses from Wix into the "media" folder.
# Safe to run again: files already downloaded are skipped.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = Join-Path (Split-Path -Parent $PSScriptRoot) 'site'
$list = Join-Path $PSScriptRoot 'media-list.txt'
$lines = Get-Content -LiteralPath $list -Encoding UTF8 | Where-Object { $_.Trim() -ne '' }
$total = $lines.Count; $n = 0; $ok = 0; $skipped = 0; $failed = @()

foreach ($line in $lines) {
    $n++
    $parts = $line -split "`t"
    $rel = $parts[0]; $urls = $parts[1..($parts.Count - 1)]
    $dest = Join-Path $root ($rel -replace '/', '\')
    if ((Test-Path -LiteralPath $dest) -and ((Get-Item -LiteralPath $dest).Length -gt 0)) { $skipped++; continue }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
    $done = $false
    foreach ($u in $urls) {
        try {
            Invoke-WebRequest -Uri $u -OutFile "$dest.part" -UseBasicParsing -TimeoutSec 300
            if ((Get-Item -LiteralPath "$dest.part").Length -gt 0) {
                Move-Item -LiteralPath "$dest.part" -Destination $dest -Force
                $done = $true; break
            }
        } catch { }
    }
    if (Test-Path -LiteralPath "$dest.part") { Remove-Item -LiteralPath "$dest.part" -Force }
    if ($done) { $ok++; Write-Host ("[{0}/{1}] {2}" -f $n, $total, $rel) }
    else { $failed += $rel; Write-Host ("[{0}/{1}] FAILED {2}" -f $n, $total, $rel) -ForegroundColor Red }
}

Write-Host ""
Write-Host "Downloaded: $ok   Already there: $skipped   Failed: $($failed.Count)" -ForegroundColor Cyan
if ($failed.Count) {
    $failed | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'failed-downloads.txt')
    Write-Host "The failed ones are listed in tools\failed-downloads.txt - run this again to retry." -ForegroundColor Yellow
}
