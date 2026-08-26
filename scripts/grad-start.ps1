# Start the Graduate OS product instance (port 3101 by default).
param(
  [string]$ProfileName = "grad",
  [int]$Port = 3101,
  [string]$DshBin = "",
  [switch]$Foreground
)

$ErrorActionPreference = "Stop"

if (-not $DshBin) {
  $candidates = Get-ChildItem "$env:USERPROFILE\AppData\Local\npm-cache\_npx\*\node_modules\@deepseek-ai\dsh\lib\bin.js" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending
  if (-not $candidates) { throw "dsh bin.js not found in npx cache; pass -DshBin explicitly" }
  $DshBin = $candidates[0].FullName
}

if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
  Write-Host "[grad-start] port $Port already listening — assuming instance is up"
  exit 0
}

# Correct CLI form for a custom profile: `dsh --profile <name> [--port N --no-open]`.
$args_ = @($DshBin, "--profile", $ProfileName, "--port", "$Port", "--no-open")
Write-Host "[grad-start] node $($args_ -join ' ')"

if ($Foreground) {
  node @args_
} else {
  $p = Start-Process -FilePath "node" -ArgumentList $args_ -WorkingDirectory $env:USERPROFILE -PassThru -WindowStyle Hidden
  Write-Host "[grad-start] started pid=$($p.Id); waiting for :$Port"
  $deadline = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 1500
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
      Write-Host "[grad-start] UP on http://127.0.0.1:$Port"
      exit 0
    }
    if ($p.HasExited) { throw "process exited early with code $($p.ExitCode)" }
  }
  if ($p.HasExited) { throw "process exited early with code $($p.ExitCode)" }
  throw "timed out waiting for :$Port"
}