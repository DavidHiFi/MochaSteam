# Mocha Steam

DavidHiFi's Catppuccin Mocha fork of SpaceTheme by SpaceEnergy. The dedicated [MochaSteam repository](https://github.com/DavidHiFi/MochaSteam) has a root-level `skin.json`. This bundle keeps a mirror in `themes/mocha-steam` next to the MochaSteam Desktop Fixes plugin.

## Current behavior

Mocha colours, rounded controls and blue to mauve accents cover Library, Store, Console, settings, friends and chat, menus and notifications. Every hover gets the same 2px blue to mauve ring, and resting borders use the dark Mocha edge. The SpaceTheme title bar label is removed. The top bar keeps its nav pill in a narrow window: one row down to 940px wide, then the menu and nav sit centred on two rows. Options keep the modular upstream structure, with extra font choices. Fonts must be installed separately.

Floating cards use a Mocha tint with a CSS backdrop blur. Menu shells are clear outside the rounded card, so no square corners show. Inner dialogs stay clear to avoid stacked blur layers.

## Glass

CSS blur only samples content inside Steam's own page. Two other pieces make the rest of the glass:

- **MochaSteam Desktop Fixes** (`plugins/mochasteam-material`) gives Steam's separate menu windows and desktop toasts a real Windows frosted backdrop. It also opens the main window's frame so a title bar mod can show glass behind it, and stops the Friends list from opening at startup.
- **A see-through main window** on the author's PC also uses a Windhawk title bar mod. Without one, the main window is a solid dark theme. Everything else still works.

The author's options use 55% main window tint with "Mica & Acrylic plugin support" on. That option removes the in-page blur on the main window, because the window itself is the glass. Turn it off if your window is not see-through. Existing options are kept by the installer. New installs use the `skin.json` defaults.

Steam sometimes recreates its main window after an update. The see-through setting is applied only when the window is created, so the glass turns black until Steam is restarted.

## SpaceTheme integration

Integrated through `ce67165b14dc933bc21f84a51d87f9e020a1ba8d`, with Mocha colours and rounded clipping kept. On 2026-11-21 two later fixes were ported by hand: the Size on Disk icon, and the game sidebar on the Downloads page with its width saved. `configs/mocha-steam-upstream.json` records the checkpoint.

## Verification limits

The narrow top bar was measured at seven window widths from 1400 to 700px with no overlap. The hover sidebar, Downloads sidebar and glass were checked on the live client on 2026-11-21 and 22. These checks cover one PC and one Steam build, not every future Steam version or graphics card.
