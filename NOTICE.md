# Third-party notices

This repo contains work by other people. Their licenses are kept alongside the
code:

| Component | Upstream | License | Upstream license file |
| --- | --- | --- | --- |
| `themes/mocha-steam` | [SpaceTheme/Steam](https://github.com/SpaceTheme/Steam) by SpaceEnergy | MIT | `themes/mocha-steam/LICENSE` |
| `themes/mocha-steam/src/icons/fluent` | Microsoft Fluent System Icons, as shipped by SpaceTheme | MIT (see upstream) | `themes/mocha-steam/src/icons/fluent/_font/LICENSE-3rdParty.md` |

Palette values come from [Catppuccin](https://github.com/catppuccin/catppuccin)
(MIT), colour values only, no code.

Provenance of the snapshot the theme is based on:

- SpaceTheme for Steam, commit `ed560f2bd9aae88f1194b9b12e170231cff84640`.
  Mocha Steam has no `metadata.json`, so Millennium treats it as a local theme and
  does not offer to update it back to the upstream store build. A SpaceTheme install
  is untouched by this repo's `install.ps1`.
  Updates through `ce67165b14dc933bc21f84a51d87f9e020a1ba8d` were integrated on
  2026-10-04. This includes SpaceEnergy's Store and friend-status changes,
  ForgottenHero's hover-sidebar fix and EldinBegano's dropdown styling.
  Later SpaceTheme fixes (Size on Disk icon, Downloads page sidebar) were ported by hand
  on 2026-11-21. Mocha keeps its own palette, glass fills and popup corner corrections.

My changes are MIT, see `LICENSE`. `plugins/mochasteam-material` (MochaSteam Desktop
Fixes) is my own code, also MIT.

## Plugins installed by the setup script

`setup/Install-MochaSetup.ps1` reads `setup/manifest.json`. Upstream repositories and
commits come from [SteamClientHomebrew/PluginDatabase](https://github.com/SteamClientHomebrew/PluginDatabase),
which pins each approved plugin.

- **Release**: the script downloads the built zip from the upstream release. The version is the release tag.
- **Vendored**: `setup/vendor/` holds the built plugin copied from a working install, with
  the upstream `LICENSE` added. The six plugins are MIT licensed.
- **Bundled**: MochaSteam Desktop Fixes is in `plugins/mochasteam-material`.
- **Manual**: the upstream repo publishes no license, so the repo does not redistribute the code.
  The README lists the commit to install.
- **Excluded**: `luatools-collection` is not shipped. It adds a collection for SteamTools Lua scripts.

| Plugin | Upstream | Version | Source |
| --- | --- | --- | --- |
| achievement-groups | BossSloth/SteamHunter-plugin | 2.1.1 | Release |
| dotastats | BambooFury/Dota-Stats | 2.0.0 | Release |
| extendium | BossSloth/Extendium | 2.0.5 | Release |
| global_launch_options | BlafKing/steam-global-launch-options | 1.1.0 | Release |
| gratitude | BlythT/Gratitude-Millennium-Plugin | 1.3.3 | Release |
| hltb-for-millennium | jcdoll/hltb-millennium-plugin | 2.1.0 | Release |
| leetify-extension | TOR968/leetify-extension | 2.1.0 | Release |
| non-steam-playtimes | k0d13/steam-non-steam-playtimes | 2.0.3 | Release |
| playercount-badge | swindlesmccoop/playercount-badge | 1.0 | Release |
| protondb | unicxrn/protondb-millennium | 1.0.0 | Release |
| protondb-library-badges | Yohlo/protondb-library-badges | 1.0.1 | Release |
| recent-chats | Alex979/Steam-Recent-Chats-plugin | 0.4.1 | Release |
| RSS-feed-in-whats-new | diemonic1/RSS-feed-in-whats-new | 1.0.2 | Release |
| size-on-disk | k0d13/steam-size-on-disk | 1.2.1 | Release |
| steam-game-renamer | Inceptofn/Steam-GameRenamer-Plugin | 1.0.3 | Release |
| steam-share | wopln/Steam-Share | 1.1.0 | Release |
| steam-collections-plus | luthor112/steam-collections-plus | 3.1.3 | Vendored (MIT, Copyright 2025 luthor112) |
| steam-easygrid | luthor112/steam-easygrid | 4.1.0 + local fix | Vendored (MIT, Copyright 2025 luthor112) |
| steam-librarian | luthor112/steam-librarian | 3.0.2 | Vendored (MIT, Copyright 2025 luthor112) |
| steam-taskbar-progress | luthor112/steam-taskbar-progress | 2.3.0 + local fix | Vendored (MIT, Copyright 2025 luthor112) |
| veygax.valve-internal-enabler | veygax/valve-internal-enabler | 1.0.0 | Vendored (MIT, Copyright 2025 veygax) |
| uwp-library-sync | xwxfox/millennium-uwp-library-sync | 0.0.1 | Vendored (MIT, Copyright 2025 Steam Client Homebrew) |
| mochasteam-material | this repo | 1.0.0 | Bundled (MIT) |

Three plugins have no license and are not redistributed: adamraichu.auto-accept-custom-launch-args,
browser_history and easy-restart-reload-for-steam. The README lists their commits.

The two local fixes are small. steam-easygrid no longer crashes when a cover search returns an
empty image or key. steam-taskbar-progress waits for the taskbar instead of failing when Steam
starts before Explorer.
