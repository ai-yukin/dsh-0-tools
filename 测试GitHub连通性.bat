@echo off
title GitHub Connectivity Test
color 0A

echo ========================================
echo      GitHub Connectivity Test
echo ========================================
echo.
echo Testing... Please wait...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$sites = @('github.com','api.github.com','raw.githubusercontent.com','gitee.com'); $results = @(); foreach ($s in $sites) { try { $sw = [Diagnostics.Stopwatch]::StartNew(); $r = Invoke-WebRequest -Uri \"https://$s\" -Method Head -TimeoutSec 8 -UseBasicParsing; $sw.Stop(); $ok = ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400); $results += [PSCustomObject]@{Site=$s; Ok=$ok; Ms=$sw.ElapsedMilliseconds} } catch { $results += [PSCustomObject]@{Site=$s; Ok=$false; Ms=0} } }; Write-Host '----------------------------------------'; Write-Host ('{0,-25} {1,-8} {2}' -f 'Site','Status','Latency'); Write-Host '----------------------------------------'; $allOk = $true; foreach ($r in $results) { if ($r.Ok) { Write-Host ('{0,-25} {1,-8} {2} ms' -f $r.Site,'OK',$r.Ms) -ForegroundColor Green } else { Write-Host ('{0,-25} {1,-8} {2}' -f $r.Site,'FAIL','-') -ForegroundColor Red; $allOk = $false } }; Write-Host '----------------------------------------'; Write-Host ''; if ($allOk) { Write-Host '[OK] GitHub is accessible. You can proceed.' -ForegroundColor Green } else { $okCount = ($results | Where-Object { $_.Ok }).Count; if ($okCount -ge 2) { Write-Host '[WARN] GitHub is unstable. Some sites failed. Try again later or use Gitee.' -ForegroundColor Yellow } else { Write-Host '[FAIL] GitHub is not accessible. Use Gitee mirror or check network.' -ForegroundColor Red } }"

echo.
echo ========================================
echo Press any key to exit...
pause >nul
