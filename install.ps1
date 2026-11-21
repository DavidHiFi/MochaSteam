<#
.SYNOPSIS
    Installs Mocha Steam and its desktop fixes plugin (mochasteam-material) into a Millennium install.

.DESCRIPTION
    Read-only audit by default: it prints what exists and what it would replace.
    -Apply backs up and installs. -Configure also points Millennium at Mocha Steam
    and writes its options (requires Steam to be closed).

    A SpaceTheme install is never touched - it stays a separate, stock theme.

.EXAMPLE
    pwsh -File .\install.ps1
    pwsh -File .\install.ps1 -Apply
    pwsh -File .\install.ps1 -Apply -Configure
#>
[CmdletBinding()]
param(
    [string]$SteamPath = 'C:\Program Files (x86)\Steam',
    [switch]$Apply,
    [switch]$Audit,
    [switch]$Configure
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$themeSrc = Join-Path $root 'themes\mocha-steam'
$pluginSrc = Join-Path $root 'plugins\mochasteam-material'
$themeDst = Join-Path $SteamPath 'millennium\themes\MochaSteam'
$pluginDst = Join-Path $SteamPath 'millennium\plugins\mochasteam-material'
$backupRoot = Join-Path $SteamPath 'millennium\_backups'
$configPath = Join-Path $SteamPath 'millennium\config\config.json'
$themeId = 'MochaSteam'
$pluginId = 'mochasteam-material'
$stamp = (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
if ($Audit -and $Apply) { throw 'Choose -Audit or -Apply, not both.' }

function Copy-Tree([string]$from, [string]$to) {
    robocopy $from $to /E /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Copy failed: $from -> $to, robocopy exit $LASTEXITCODE" }
}

function Step([string]$text) { Write-Host "==> $text" }

foreach ($p in @($SteamPath, $themeSrc, $pluginSrc)) {
    if (-not (Test-Path -LiteralPath $p)) { throw "Missing: $p" }
}

Step "Steam:   $SteamPath"
Step "Theme:   $themeSrc  ->  $themeDst"
Step "Plugin:  $pluginSrc  ->  $pluginDst"
if ($Configure) { Step "Config:  $configPath" }

$steamRunning = [bool](Get-Process steam -ErrorAction SilentlyContinue)
Write-Host ("Steam is {0}" -f $(if ($steamRunning) { 'RUNNING' } else { 'not running' }))

if (-not $Apply) {
    Write-Host ''
    Write-Host 'Audit only. Nothing was changed. Re-run with -Apply to install.'
    if (Test-Path -LiteralPath $themeDst) { Write-Host "  note: $themeDst exists and would be backed up then replaced." }
    if (Test-Path -LiteralPath $pluginDst) { Write-Host "  note: $pluginDst exists and would be backed up then replaced." }
    if ($Configure -and $steamRunning) { Write-Host '  note: -Configure needs Steam closed.' }
    exit 0
}

# Validate before backups or replacing any files.
if ($steamRunning) { throw 'Exit Steam completely before installing. No files were changed.' }
if (-not (Test-Path -LiteralPath (Join-Path $SteamPath 'millennium'))) {
    throw 'Install Millennium first. This installer does not install Millennium itself.'
}
$steamRoot = [IO.Path]::GetFullPath($SteamPath).TrimEnd('\') + '\'
foreach ($dst in @($themeDst, $pluginDst)) {
    if (-not [IO.Path]::GetFullPath($dst).StartsWith($steamRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Destination is outside Steam: $dst"
    }
}
if ($Configure) {
    $skin = Get-Content -LiteralPath (Join-Path $themeSrc 'skin.json') -Raw | ConvertFrom-Json
    $cfg = if (Test-Path -LiteralPath $configPath) { Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json } else { [pscustomobject]@{} }
    if (-not $cfg.plugins) { $cfg | Add-Member -NotePropertyName plugins -NotePropertyValue ([pscustomobject]@{}) -Force }
    if (-not $cfg.plugins.enabledPlugins) { $cfg.plugins | Add-Member -NotePropertyName enabledPlugins -NotePropertyValue @() -Force }
    if ($cfg.plugins.enabledPlugins -notcontains $pluginId) {
        $cfg.plugins.enabledPlugins = @($cfg.plugins.enabledPlugins) + $pluginId
    }
    if (-not $cfg.themes) { $cfg | Add-Member -NotePropertyName themes -NotePropertyValue ([pscustomobject]@{}) -Force }
    if (-not $cfg.themes.conditions) { $cfg.themes | Add-Member -NotePropertyName conditions -NotePropertyValue ([pscustomobject]@{}) -Force }
    if (-not $cfg.themes.conditions.$themeId) { $cfg.themes.conditions | Add-Member -NotePropertyName $themeId -NotePropertyValue ([pscustomobject]@{}) -Force }
    $opts = $cfg.themes.conditions.$themeId
    foreach ($condition in $skin.Conditions.PSObject.Properties) {
        if (-not $opts.PSObject.Properties[$condition.Name]) {
            $value = $condition.Value.default
            $opts | Add-Member -NotePropertyName $condition.Name -NotePropertyValue $value
        }
    }
    $cfg.themes | Add-Member -NotePropertyName activeTheme -NotePropertyValue $themeId -Force
}

# --- backups -------------------------------------------------------------
$backup = Join-Path $backupRoot $stamp
New-Item -ItemType Directory -Path $backup -Force | Out-Null
foreach ($pair in @(@{ src = $themeDst; name = 'theme-MochaSteam' }, @{ src = $pluginDst; name = "plugin-$pluginId" })) {
    if (Test-Path -LiteralPath $pair.src) {
        Step "Backup $($pair.src) -> $(Join-Path $backup $pair.name)"
        Copy-Tree $pair.src (Join-Path $backup $pair.name)
    }
}
if ($Configure -and (Test-Path -LiteralPath $configPath)) {
    Copy-Item -LiteralPath $configPath -Destination (Join-Path $backup 'config.json') -Force
    Step "Backup config.json -> $(Join-Path $backup 'config.json')"
}

# --- install -------------------------------------------------------------
foreach ($dst in @($themeDst, $pluginDst)) {
    if (Test-Path -LiteralPath $dst) { Step "Removing old $(Split-Path $dst -Leaf)"; Remove-Item -LiteralPath $dst -Recurse -Force }
}
Step 'Copying theme'
Copy-Tree $themeSrc $themeDst
Step 'Copying plugin'
Copy-Tree $pluginSrc $pluginDst

# --- config --------------------------------------------------------------
if ($Configure) {
    Step 'Updating Millennium config'
    New-Item -ItemType Directory -Path (Split-Path $configPath) -Force | Out-Null
    $cfg | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $configPath -Encoding UTF8
    Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json | Out-Null
    Step "config.json written and re-parsed OK (activeTheme = $themeId)"
}

Write-Host ''
Write-Host 'Done. Restart Steam, then in Millennium check:'
Write-Host '  Themes: Mocha Steam enabled (SpaceTheme left as its own separate theme)'
Write-Host '  Plugins: MochaSteam Desktop Fixes enabled'
Write-Host "Restore from: $backup"
