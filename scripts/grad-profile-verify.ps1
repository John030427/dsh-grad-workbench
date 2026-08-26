# Verify the grad product profile composition and (optionally) live health.
param(
  [string]$ProfileName = "grad",
  [switch]$Live,
  [int]$Port = 3101
)

$ErrorActionPreference = "Stop"
$binCandidates = Get-ChildItem "$env:USERPROFILE\AppData\Local\npm-cache\_npx\*\node_modules\@deepseek-ai\dsh\lib\bin.js" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending
if (-not $binCandidates) { throw "DSH installation not found in npx cache" }
$DshBin = $binCandidates[0].FullName

Write-Host "[grad-verify] composition for profile '$ProfileName':"
& node $DshBin --profile $ProfileName --dump-config 2>&1 | Select-String -Pattern "grad-shell|dsh-grad-workbench|ui-layout" -Context 0,3

if ($Live) {
  Write-Host "[grad-verify] live probes on :$Port"
  $health = Invoke-RestMethod "http://127.0.0.1:$Port/api/grad/health" -TimeoutSec 5
  $shell = Invoke-WebRequest "http://127.0.0.1:$Port/plugins/@grad/grad-shell/client.js" -TimeoutSec 5
  $domain = Invoke-WebRequest "http://127.0.0.1:$Port/plugins/@grad/dsh-grad-workbench/client.js" -TimeoutSec 5
  Write-Host ("  grad health ok={0} workflows={1}" -f $health.ok, $health.workflows.Count)
  Write-Host ("  shell client {0} ({1} bytes), domain client {0} ({2} bytes)" -f $shell.StatusCode, $shell.Content.Length, $domain.Content.Length)
}