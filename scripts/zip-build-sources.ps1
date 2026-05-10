# Build-source zip: archive root contains app/, components/, data/, package.json, etc.
# (not a "." folder). Excludes node_modules, .next, .git, dist-deploy, and local secrets (.env*).
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$out = Join-Path $root "dsa-nexus-build-sources.zip"
$temp = Join-Path $root "_zip_stage_build"

if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
New-Item -ItemType Directory -Path $temp -Force | Out-Null

# /XF: skip loose secrets (robocopy matches these names in any folder)
robocopy $root $temp /E `
  /XD node_modules .next .git dist-deploy _zip_stage_build `
  /XF dsa-nexus-build-sources.zip .env .env.local .env.development .env.development.local .env.production .env.production.local .env.test .env.test.local `
  /NFL /NDL /NJH /NJS | Out-Null

# Drop any other .env.* files except tracked templates like .env.example
Get-ChildItem $temp -Recurse -Force -File -ErrorAction SilentlyContinue | Where-Object {
  ($_.Name -eq ".env") -or ($_.Name -like ".env.*" -and $_.Name -ne ".env.example")
} | Remove-Item -Force

if (Test-Path $out) { Remove-Item $out -Force }
Compress-Archive -Path (Join-Path $temp "*") -DestinationPath $out -Force
Remove-Item $temp -Recurse -Force

Write-Host "Wrote $out"
