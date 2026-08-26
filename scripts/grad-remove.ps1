# Stop the grad product instance and remove its profile directory. Web profile untouched.
param(
  [string]$ProfileName = "grad"
)

$ErrorActionPreference = "Stop"
$ProfileDir = Join-Path $env:USERPROFILE ".dsh\profiles\$ProfileName"

$procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match "--profile\s+$ProfileName" }
foreach ($p in $procs) {
  Write-Host "[grad-remove] killing pid=$($p.ProcessId) ($ProfileName instance)"
  Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}

if (Test-Path $ProfileDir) {
  Remove-Item $ProfileDir -Recurse -Force
  Write-Host "[grad-remove] removed $ProfileDir"
} else {
  Write-Host "[grad-remove] profile dir not present"
}