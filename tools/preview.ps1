# Serves the site at http://localhost:8080/ so you can look at it before uploading.
# Handles many requests at once (so videos never block page clicks) and supports video seeking.
# Close this window to stop it.
$root = Join-Path (Split-Path -Parent $PSScriptRoot) 'site'
$port = 8080

$listener = New-Object Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try { $listener.Start() } catch {
    Write-Host "Could not start on port $port. Is another preview window already open? Close it and try again." -ForegroundColor Red
    Read-Host "Press Enter to close"; exit
}
Write-Host "Preview running at http://localhost:$port/  (close this window to stop)" -ForegroundColor Cyan
Start-Process "http://localhost:$port/"

$handler = {
    param($ctx, $root)
    $types = @{ '.html'='text/html; charset=utf-8'; '.css'='text/css'; '.js'='text/javascript'; '.png'='image/png';
                '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.gif'='image/gif'; '.webp'='image/webp'; '.svg'='image/svg+xml';
                '.mp4'='video/mp4'; '.txt'='text/plain'; '.ico'='image/x-icon' }
    $res = $ctx.Response
    try {
        $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
        $file = Join-Path $root ($path -replace '/', '\')
        if (Test-Path -LiteralPath $file -PathType Container) {
            if ($path -ne '' -and -not $path.EndsWith('/')) { $res.Redirect("/$path/"); $res.Close(); return }
            $file = Join-Path $file 'index.html'
        }
        $code = 200
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { $file = Join-Path $root '404.html'; $code = 404 }
        $ext = [IO.Path]::GetExtension($file).ToLower()
        $res.ContentType = $(if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' })
        $res.Headers['Accept-Ranges'] = 'bytes'
        $fs = [IO.File]::Open($file, 'Open', 'Read', 'ReadWrite')
        try {
            $len = $fs.Length; $start = 0; $end = $len - 1
            $range = $ctx.Request.Headers['Range']
            if ($code -eq 200 -and $range -match '^bytes=(\d*)-(\d*)$') {
                if ($matches[1] -ne '') { $start = [long]$matches[1] }
                if ($matches[2] -ne '') { $end = [Math]::Min([long]$matches[2], $len - 1) }
                elseif ($matches[1] -eq '') { $start = [Math]::Max(0, $len - [long]$matches[2]) }
                # stream videos in pieces so the browser can start playing quickly
                if ($end - $start -gt 4MB) { $end = $start + 4MB - 1 }
                $code = 206
                $res.Headers['Content-Range'] = "bytes $start-$end/$len"
            }
            $res.StatusCode = $code
            $res.ContentLength64 = $end - $start + 1
            $fs.Position = $start
            $buf = New-Object byte[] 65536
            $left = $end - $start + 1
            while ($left -gt 0) {
                $n = $fs.Read($buf, 0, [int][Math]::Min($buf.Length, $left))
                if ($n -le 0) { break }
                $res.OutputStream.Write($buf, 0, $n); $left -= $n
            }
        } finally { $fs.Close() }
    } catch { } finally { try { $res.Close() } catch { } }
}

$pool = [RunspaceFactory]::CreateRunspacePool(1, 16)
$pool.Open()
$jobs = New-Object System.Collections.ArrayList
while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $ps = [PowerShell]::Create().AddScript($handler).AddArgument($ctx).AddArgument($root)
    $ps.RunspacePool = $pool
    [void]$jobs.Add(@{ ps = $ps; h = $ps.BeginInvoke() })
    # tidy up finished requests
    for ($i = $jobs.Count - 1; $i -ge 0; $i--) {
        if ($jobs[$i].h.IsCompleted) { try { $jobs[$i].ps.EndInvoke($jobs[$i].h) } catch { }; $jobs[$i].ps.Dispose(); $jobs.RemoveAt($i) }
    }
}
