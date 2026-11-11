# Mocha Steam

Catppuccin Mocha for Steam, with rounded controls, frosted menus and Blue/Lavender accents. By DavidHiFi, forked from [SpaceTheme for Steam](https://github.com/SpaceTheme/Steam) by SpaceEnergy.

![Mocha Steam preview](https://raw.githubusercontent.com/DavidHiFi/MochaSteam/main/.github/assets/preview.png)

## Install

Install [Millennium](https://docs.steambrew.app/users/getting-started/installation) first.

For the complete Windows 11 acrylic setup, download the **millennium-stuff ZIP** from the [bundle release](https://github.com/DavidHiFi/millennium-stuff/releases/latest). Extract it, exit Steam completely, and run PowerShell in the extracted folder:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Apply -Configure
```

Start Steam. The installer enables Mocha Steam and the bundled Window Styler plugin, backs up replaced files, and preserves existing options and other plugins. Add `-SteamPath 'D:\Steam'` for a custom Steam location.

For a theme-only install, download [the repository ZIP](https://github.com/DavidHiFi/MochaSteam/archive/refs/heads/main.zip). Exit Steam, extract the folder containing `skin.json` to `Steam\millennium\themes\MochaSteam`, start Steam and select **Mocha Steam** in Millennium's Themes tab.

The theme-only download does not install a plugin. Native acrylic behind separate Steam windows requires Windows 11 and the patched **DWMX / Window Styler** plugin from the bundle. Enable **Mica & Acrylic plugin support** when that plugin is installed. The theme works as an ordinary dark theme without it. Select a font installed on your machine.

## Customization

Options include sidebar behavior, fonts, window controls, gift-card visibility and favorite-friend status backgrounds. Native popup acrylic is applied on display events, without polling. Library icons and status indicators share one alignment slot. SpaceTheme changes are integrated through `ce67165`.

Steam updates can change selectors and popup behavior. Report problems in [GitHub issues](https://github.com/DavidHiFi/MochaSteam/issues) with your Steam, Millennium and Windows versions.

## Credits

SpaceTheme by SpaceEnergy supplies the MIT-licensed base. The Catppuccin palette is MIT licensed. DavidHiFi maintains this fork and its theme changes. Original attribution is retained in `LICENSE` and `NOTICE.md`. The separate DWMX plugin is Apache-2.0 licensed and retains its own license in the bundle.
