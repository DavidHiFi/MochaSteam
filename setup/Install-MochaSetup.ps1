<#
.SYNOPSIS
    Sets up Mocha Steam for Millennium, with the same plugins and settings as the author's install.

.DESCRIPTION
    No download step is needed. Run this in PowerShell:

        irm https://raw.githubusercontent.com/DavidHiFi/millennium-stuff/main/setup/Install-MochaSetup.ps1 | iex

    From an extracted copy of the repository:

        powershell -NoProfile -ExecutionPolicy Bypass -File .\setup\Install-MochaSetup.ps1

    Steps:
      1. Install Millennium with its official installer if it is missing (you click through it).
      2. Close Steam, if it is running (steam.exe -shutdown).
      3. Install the Mocha Steam theme and its desktop fixes plugin (install.ps1).
      4. Install the plugins in setup\manifest.json: release zips from GitHub, vendored copies,
         or a list of manual installs for plugins that publish no license.
      5. Merge setup\config\config.template.json into Millennium's config.json and copy
         setup\config\millennium-settings.json. Personal data is not included.

    Every file that is replaced is backed up to Steam\millennium\_backups\. Plugin data folders
    are overlaid, not deleted, so existing data such as the Gratitude friend list is kept.

.PARAMETER SteamPath
    Steam folder. Default: the path from the Windows registry, else C:\Program Files (x86)\Steam.

.PARAMETER Audit
    Read-only. Prints the plan and changes nothing.

.PARAMETER SkipMillenniumInstall
    Do not run the Millennium installer, even if Millennium is missing.

.PARAMETER SkipTheme
    Do not run install.ps1 (theme and desktop fixes plugin). Used for re-runs and testing.
#>
[CmdletBinding()]
param(
    [string]$SteamPath,
    [switch]$Audit,
    [switch]$SkipMillenniumInstall,
    [switch]$SkipTheme
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$RepoZipUrl = 'https://codeload.github.com/DavidHiFi/millennium-stuff/zip/refs/heads/main'
$MillenniumInstallerUrl = 'https://github.com/SteamClientHomebrew/Installer/releases/latest/download/MillenniumInstaller-Windows.exe'

function Step([string]$text) { Write-Host "==> $text" }
function Note([string]$text) { Write-Host "    $text" }

# Windows PowerShell blocks script files under its default policy, so the child
# scripts run in their own process with Bypass. A hashtable splatted into a native
# command does not become named parameters, so the bound parameters are rebuilt
# as an argument list. Add any new parameter here too.

# Without a repository on disk (irm | iex), download the repository and run its copy of this script.
$repoRoot = $null
if ($PSScriptRoot) {
    $candidate = Split-Path -Parent $PSScriptRoot
    if (Test-Path -LiteralPath (Join-Path $candidate 'themes\mocha-steam')) { $repoRoot = $candidate }
}
if (-not $repoRoot) {
    $work = Join-Path $env:TEMP ('mocha-steam-setup-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
    New-Item -ItemType Directory -Path $work -Force | Out-Null
    $zip = Join-Path $work 'millennium-stuff.zip'
    Step 'Downloading the Mocha Steam setup from GitHub'
    Invoke-WebRequest -Uri $RepoZipUrl -OutFile $zip -UseBasicParsing
    Expand-Archive -LiteralPath $zip -DestinationPath $work -Force
    $extracted = Get-ChildItem -LiteralPath $work -Directory | Where-Object {
        Test-Path -LiteralPath (Join-Path $_.FullName 'setup\Install-MochaSetup.ps1')
    } | Select-Object -First 1
    if (-not $extracted) { throw 'The downloaded archive does not contain the setup folder.' }
    $childScript = Join-Path $extracted.FullName 'setup\Install-MochaSetup.ps1'
    $childArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $childScript)
    if ($SteamPath) { $childArgs += @('-SteamPath', $SteamPath) }
    if ($Audit) { $childArgs += '-Audit' }
    if ($SkipMillenniumInstall) { $childArgs += '-SkipMillenniumInstall' }
    if ($SkipTheme) { $childArgs += '-SkipTheme' }
    & powershell.exe @childArgs
    return
}

if (-not $SteamPath) {
    $reg = Get-ItemProperty -Path 'HKCU:\Software\Valve\Steam' -Name SteamPath -ErrorAction SilentlyContinue
    $SteamPath = if ($reg -and $reg.SteamPath) { $reg.SteamPath -replace '/', '\' } else { 'C:\Program Files (x86)\Steam' }
}
if (-not (Test-Path -LiteralPath (Join-Path $SteamPath 'steam.exe'))) { throw "Steam was not found at $SteamPath. Pass -SteamPath." }

$millennium = Join-Path $SteamPath 'millennium'
$pluginDir = Join-Path $millennium 'plugins'
$configPath = Join-Path $millennium 'config\config.json'
$settingsPath = Join-Path $millennium 'settings.json'
$backupRoot = Join-Path $millennium '_backups'
$backup = Join-Path $backupRoot ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-mocha-setup')

$manifest = Get-Content -LiteralPath (Join-Path $repoRoot 'setup\manifest.json') -Raw | ConvertFrom-Json
$template = Get-Content -LiteralPath (Join-Path $repoRoot 'setup\config\config.template.json') -Raw | ConvertFrom-Json
$settingsTemplate = Join-Path $repoRoot 'setup\config\millennium-settings.json'

function Backup-Item([string]$path, [string]$relative) {
    if (-not (Test-Path -LiteralPath $path)) { return }
    $dest = Join-Path $backup $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
    Copy-Item -LiteralPath $path -Destination $dest -Recurse -Force
}

function Set-Prop($obj, [string]$name, $value) {
    if ($obj.PSObject.Properties[$name]) { $obj.$name = $value }
    else { $obj | Add-Member -NotePropertyName $name -NotePropertyValue $value -Force }
}

function Get-Child($obj, [string]$name) {
    if (-not $obj.PSObject.Properties[$name] -or $null -eq $obj.$name) { Set-Prop $obj $name ([pscustomobject]@{}) }
    return $obj.$name
}

function Get-SteamProcesses {
    Get-Process -Name steam -ErrorAction SilentlyContinue | Where-Object {
        try { $_.Path -eq (Join-Path $SteamPath 'steam.exe') } catch { $false }
    }
}

function Copy-PluginFolder([string]$source, [string]$destination, $plugin) {
    $pluginJson = Get-Content -LiteralPath (Join-Path $source 'plugin.json') -Raw | ConvertFrom-Json
    if ($pluginJson.name -ne $plugin.id) {
        Note "warning: $($plugin.folder) plugin.json says '$($pluginJson.name)', manifest expects '$($plugin.id)'"
    }
    if (Test-Path -LiteralPath $destination) {
        Backup-Item $destination (Join-Path 'plugins' (Split-Path -Leaf $destination))
    }
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    Copy-Item -Path (Join-Path $source '*') -Destination $destination -Recurse -Force
}

function Install-ReleasePlugin($plugin, [string]$destination) {
    $src = $plugin.source
    $url = "https://github.com/$($src.repo)/releases/download/$($src.tag)/$($src.asset)"
    $tmp = Join-Path $env:TEMP ('mocha-plugin-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null
    try {
        $zip = Join-Path $tmp $src.asset
        Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
        $extract = Join-Path $tmp 'x'
        Expand-Archive -LiteralPath $zip -DestinationPath $extract -Force
        $pluginJson = Get-ChildItem -LiteralPath $extract -Recurse -Filter plugin.json -File |
            Sort-Object { $_.FullName.Split('\').Count } | Select-Object -First 1
        if (-not $pluginJson) { throw "No plugin.json inside $($src.asset)" }
        Copy-PluginFolder $pluginJson.Directory.FullName $destination $plugin
    }
    finally {
        Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$downloadable = @($manifest.plugins | Where-Object { $_.source.type -in 'release', 'vendored' -or ($_.source.type -eq 'bundled' -and $_.source.path) })
$manualPlugins = @($manifest.plugins | Where-Object { $_.source.type -eq 'manual' })
$excludedPlugins = @($manifest.plugins | Where-Object { $_.source.type -eq 'excluded' })

if ($Audit) {
    Step "Audit (no changes)"
    Note "Steam:      $SteamPath"
    Note "Millennium: $(if (Test-Path -LiteralPath $millennium) { 'installed' } else { 'NOT installed' })"
    Note "Steam running: $([bool](Get-SteamProcesses))"
    foreach ($p in $manifest.plugins) {
        $state = if (Test-Path -LiteralPath (Join-Path $pluginDir $p.folder)) { 'present' } else { 'missing' }
        Note ("{0,-42} {1,-8} {2,-8} {3}" -f $p.folder, $p.source.type, $state, $(if ($p.enabled) { 'enabled' } else { 'off' }))
    }
    Note "Config: $(if (Test-Path -LiteralPath $configPath) { 'exists (merged, backed up)' } else { 'will be created' })"
    return
}

if (-not (Test-Path -LiteralPath $millennium)) {
    if ($SkipMillenniumInstall) { throw 'Millennium is not installed and -SkipMillenniumInstall was given.' }
    Step 'Installing Millennium with its official installer'
    $installer = Join-Path $env:TEMP 'MillenniumInstaller-Windows.exe'
    Invoke-WebRequest -Uri $MillenniumInstallerUrl -OutFile $installer -UseBasicParsing
    Note 'Click through the Millennium installer. This script waits for it to finish.'
    Start-Process -FilePath $installer -Wait
    if (-not (Test-Path -LiteralPath $millennium)) {
        throw 'Millennium is still not installed. Run the installer to completion, then run this script again.'
    }
}

$running = Get-SteamProcesses
if ($running) {
    Step 'Closing Steam'
    Start-Process -FilePath (Join-Path $SteamPath 'steam.exe') -ArgumentList '-shutdown' | Out-Null
    $deadline = (Get-Date).AddSeconds(90)
    while ((Get-SteamProcesses) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 2 }
    if (Get-SteamProcesses) { throw 'Steam did not close. Close it yourself and run this script again.' }
}

if (-not $SkipTheme) {
    Step 'Theme and desktop fixes plugin (install.ps1 -Apply)'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'install.ps1') -Apply -SteamPath $SteamPath
    if ($LASTEXITCODE -ne 0) { throw "install.ps1 failed with exit code $LASTEXITCODE" }
}

Step "Plugins ($($downloadable.Count) to download or copy)"
foreach ($p in $manifest.plugins) {
    $destination = Join-Path $pluginDir $p.folder
    switch ($p.source.type) {
        'release' {
            Note "$($p.folder) $($p.source.tag)"
            Install-ReleasePlugin $p $destination
        }
        'vendored' {
            Note "$($p.folder) (vendored, $($p.source.license))"
            Copy-PluginFolder (Join-Path $repoRoot $p.source.path) $destination $p
        }
        'bundled' {
            if ($p.source.path) {
                Note "$($p.folder) (bundled)"
                Copy-PluginFolder (Join-Path $repoRoot $p.source.path) $destination $p
            }
        }
        default { }
    }
}

Step 'Millennium config'
$cfg = if (Test-Path -LiteralPath $configPath) { Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json } else { [pscustomobject]@{} }
foreach ($section in 'general', 'misc', 'notifications') {
    $target = Get-Child $cfg $section
    foreach ($prop in $template.$section.PSObject.Properties) { Set-Prop $target $prop.Name $prop.Value }
}
$plugins = Get-Child $cfg 'plugins'
Set-Prop $plugins 'enabledPlugins' @($template.plugins.enabledPlugins)
foreach ($block in $template.plugins.PSObject.Properties) {
    if ($block.Name -eq 'enabledPlugins' -or -not $block.Value.config) { continue }
    $pluginConfig = Get-Child (Get-Child $plugins $block.Name) 'config'
    foreach ($prop in $block.Value.config.PSObject.Properties) { Set-Prop $pluginConfig $prop.Name $prop.Value }
}
$themes = Get-Child $cfg 'themes'
Set-Prop $themes 'activeTheme' $template.themes.activeTheme
Set-Prop $themes 'allowedScripts' $template.themes.allowedScripts
Set-Prop $themes 'allowedStyles' $template.themes.allowedStyles
Set-Prop (Get-Child $themes 'conditions') 'MochaSteam' $template.themes.conditions.MochaSteam
Set-Prop (Get-Child $themes 'themeColors') 'MochaSteam' $template.themes.themeColors.MochaSteam

Backup-Item $configPath 'config.json'
New-Item -ItemType Directory -Path (Split-Path -Parent $configPath) -Force | Out-Null
$json = $cfg | ConvertTo-Json -Depth 100
[IO.File]::WriteAllText($configPath, $json, (New-Object Text.UTF8Encoding($false)))
$null = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
Note "written and re-parsed: $configPath"

Step 'Millennium plugin settings (settings.json)'
Backup-Item $settingsPath 'settings.json'
Copy-Item -LiteralPath $settingsTemplate -Destination $settingsPath -Force
Note "copied to $settingsPath"

Step 'Checking the result'
$missing = @()
foreach ($p in $downloadable) {
    $dir = Join-Path $pluginDir $p.folder
    $ok = Test-Path -LiteralPath (Join-Path $dir 'plugin.json')
    if (-not $ok) { $missing += $p.folder }
}
if ($missing) { Note "missing: $($missing -join ', ')" } else { Note "all $($downloadable.Count) downloadable plugins are in place" }
if ($manualPlugins) {
    Step 'Install these by hand (no license is published, so they are not bundled)'
    foreach ($p in $manualPlugins) {
        $note = if ($p.source.note) { " ($($p.source.note))" } else { '' }
        Note "$($p.folder): https://github.com/$($p.source.repo) at commit $($p.source.commit)$note"
    }
}
if ($excludedPlugins) {
    Step 'Not included'
    foreach ($p in $excludedPlugins) { Note "$($p.folder): $($p.source.reason)" }
}
Step "Done. Backups: $backup"
Note 'Start Steam. In Millennium, check Themes: Mocha Steam is active and Plugins lists the set.'
