# Create/refresh the dedicated grad product profile from profiles/grad-template.
# Idempotent. Never touches the `web` profile.
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$ProfileName = "grad"
)

$ErrorActionPreference = "Stop"
$ProfileDir = Join-Path $env:USERPROFILE ".dsh\profiles\$ProfileName"
$TemplateDir = Join-Path $RepoRoot "profiles\grad-template"

# ── 1. detect DSH installation + version ──
$binCandidates = Get-ChildItem "$env:USERPROFILE\AppData\Local\npm-cache\_npx\*\node_modules\@deepseek-ai\dsh\lib\bin.js" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending
if (-not $binCandidates) { throw "DSH installation not found in npx cache" }
$DshBin = $binCandidates[0].FullName
$DshVersion = (& node $DshBin --version) 2>$null
Write-Host "[grad-init] DSH detected: version=$DshVersion path=$DshBin"

# ── 2. build product packages before linking ──
foreach ($pkg in @("grad-shell", "dsh-grad-workbench")) {
  Push-Location (Join-Path $RepoRoot "packages\$pkg")
  npm install --no-audit --no-fund 2>&1 | Out-Null
  npm run build 2>&1 | Select-Object -Last 1
  Pop-Location
}

# ── 3. materialize profile dir from template ──
New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
foreach ($f in @("package.json", "cordis.patch.yml", "pnpm-workspace.yaml")) {
  $text = Get-Content (Join-Path $TemplateDir $f) -Raw
  $text = $text.Replace("__GRAD_REPO__", ($RepoRoot -replace '\\', '/'))
  [System.IO.File]::WriteAllText((Join-Path $ProfileDir $f), $text, [System.Text.UTF8Encoding]::new($false))
}

# ── 4. junctions for every @grad package (hoisted-resolution guarantee) ──
$scopeDir = Join-Path $ProfileDir "node_modules\@grad"
New-Item -ItemType Directory -Force -Path $scopeDir | Out-Null
foreach ($pkg in @("grad-suite", "grad-shell", "dsh-grad-workbench")) {
  $linkPath = Join-Path $scopeDir $pkg
  $target = Join-Path $RepoRoot "packages\$pkg"
  if (-not (Test-Path $linkPath)) {
    cmd /c mklink /J "$linkPath" "$target" | Out-Null
    Write-Host "[grad-init] junction: $pkg"
  }
}

# ── 5. install ──
Push-Location $ProfileDir
try {
  if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm install --no-frozen-lockfile 2>&1 | Select-Object -Last 2
  } else {
    npm install --no-audit --no-fund 2>&1 | Select-Object -Last 2
  }
} finally {
  Pop-Location
}

# ── 6. resolution check ──
foreach ($pkg in @("grad-suite", "grad-shell", "dsh-grad-workbench")) {
  $p = Join-Path $ProfileDir "node_modules\@grad\$pkg\package.json"
  if (-not (Test-Path $p)) { throw "dependency not resolvable after install: @grad/$pkg" }
}
Write-Host "[grad-init] profile '$ProfileName' ready. Next: scripts/grad-profile-verify.ps1, then scripts/grad-start.ps1"