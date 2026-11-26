const MILLENNIUM_IS_CLIENT_MODULE = true;
const pluginName = 'mochasteam-material';
async function initialize() {
    // Steam otherwise opens Friends at startup whenever unread messages exist.
    const quietStartup = app => { app.ShowPopupFriendsListAtStartup = () => {}; };
    if (window.g_FriendsUIApp) quietStartup(g_FriendsUIApp);
    else Object.defineProperty(window, 'g_FriendsUIApp', {
        configurable: true,
        set(app) {
            Object.defineProperty(window, 'g_FriendsUIApp', { value: app, writable: true, configurable: true });
            quietStartup(app);
        },
    });
    // Each toast window is named notificationtoasts_<notificationID>_desktop. The card
    // stays solid Mocha until the native acrylic is confirmed on that exact window,
    // then the theme drops the fill (html.mocha-acrylic) so the real frost shows.
    const apply = async (name, win) => {
        let applied = false;
        try {
            const result = await Millennium.callServerMethod(pluginName, 'apply_notification_material', { name });
            applied = result === true || result === 'true';
        } catch (error) {
            console.error('[mochasteam-material]', error);
        }
        win?.document?.documentElement?.classList.toggle('mocha-acrylic', applied);
        return applied;
    };
    const timers = new Map();
    const schedule = (name, win) => {
        for (const t of timers.get(name) || []) clearTimeout(t);
        let done = false;
        const attempt = () => { if (!done) apply(name, win).then(ok => { done = done || ok; }); };
        attempt();
        timers.set(name, [60, 180, 400, 900].map(ms => setTimeout(attempt, ms)));
    };
    const call = async (method, args = {}) => {
        try {
            const result = await Millennium.callServerMethod(pluginName, method, args);
            return result === true || result === 'true';
        } catch (error) {
            console.error('[mochasteam-material]', error);
            return false;
        }
    };
    const burst = (task, delays) => {
        const timers = delays.map(ms => setTimeout(task, ms));
        return () => timers.forEach(clearTimeout);
    };
    const watched = new WeakSet();
    // Main window: the title bar mod repaints the caption flat on every focus change,
    // so put the glass caption back right after each one.
    let cancelMain = () => {};
    const scheduleMain = () => {
        cancelMain();
        cancelMain = burst(() => call('apply_main_window_material'), [0, 40, 160, 600]);
    };
    const onMainWindow = win => {
        if (!win || watched.has(win)) return;
        watched.add(win);
        for (const type of ['focus', 'blur']) win.addEventListener(type, scheduleMain);
        win.document.addEventListener('visibilitychange', scheduleMain);
        scheduleMain();
    };
    // Small windows (game properties, settings, dialogs): the same glass caption as the
    // main window. The page fades in from clear (html.mocha-glass-caption) only once the
    // caption is confirmed, so a failed call keeps the solid look.
    const dialogCancels = new WeakMap();
    const scheduleDialog = win => {
        dialogCancels.get(win)?.();
        dialogCancels.set(win, burst(() => {
            const title = String(win.document?.title || '');
            if (!title || title === 'Steam') return;
            call('apply_window_material', { title }).then(ok => {
                if (ok) win.document?.documentElement?.classList.add('mocha-glass-caption');
            });
        }, [0, 40, 160, 600, 1500]));
    };
    const onDialog = win => {
        if (!win || watched.has(win)) return;
        watched.add(win);
        for (const type of ['focus', 'blur', 'load']) win.addEventListener(type, () => scheduleDialog(win));
        win.document.addEventListener('visibilitychange', () => scheduleDialog(win));
        scheduleDialog(win);
    };
    // Pop-up menus: frost the menu window itself, then let the card drop its solid
    // fill (html.mocha-acrylic). The card stays solid Mocha until that is confirmed.
    const menuTimers = new Map();
    // Dropdown lists: Steam sizes the menu window from a measure taken before the theme
    // has restyled the list, so the window came out too narrow (the frame's left edge
    // scrolled off) and too tall (empty space under the last choice). Size the window
    // to the styled list instead, keeping the side that touches the button in place.
    const dropdownSize = win => {
        const doc = win?.document;
        const menu = doc?.querySelector('.DialogDropDownMenu');
        const last = menu?.lastElementChild;
        if (!menu || !last || doc.hidden) return null;
        const ms = win.getComputedStyle(menu);
        const px = v => parseFloat(v) || 0;
        const edgeX = px(ms.borderLeftWidth) + px(ms.borderRightWidth);
        const top = menu.getBoundingClientRect().top;
        const bottom = last.getBoundingClientRect().bottom + px(win.getComputedStyle(last).marginBottom);
        const w = Math.ceil(menu.scrollWidth + edgeX);
        const h = Math.ceil(bottom - top + menu.scrollTop + px(ms.paddingBottom) + px(ms.borderBottomWidth));
        if (!(w > 40 && h > 20)) return null;
        // A long list Steam capped to the screen keeps its cap and scrolls.
        const room = (win.screen?.availHeight || 0) + (win.screen?.availTop || 0) - win.screenY;
        return { w, h: room > 40 ? Math.min(h, room) : h };
    };
    const opensUpward = win => {
        try {
            for (const [, popup] of window.g_PopupManager?.m_mapPopups || []) {
                const owner = popup.m_popup;
                if (!owner || owner === win) continue;
                const button = owner.document?.querySelector('.DialogDropDown.Active');
                if (button) return win.screenY < owner.screenY + button.getBoundingClientRect().top;
            }
        } catch (error) {
            console.error('[mochasteam-material]', error);
        }
        return false;
    };
    const fitDropdown = win => {
        const size = dropdownSize(win);
        const steamWindow = win?.SteamClient?.Window;
        if (!size || !steamWindow) return;
        // Steam scrolls the focused choice into view; in a too-narrow window that slid
        // the whole list sideways, so the frame's left edge went missing.
        const doc = win.document;
        for (const el of [doc.documentElement, doc.body, doc.querySelector('.DialogMenuPosition')]) {
            if (el && el.scrollLeft) el.scrollLeft = 0;
        }
        const dpr = win.devicePixelRatio || 1;
        const dw = size.w - win.innerWidth, dh = size.h - win.innerHeight;
        if (Math.abs(dw) < 1 && Math.abs(dh) < 1) return;
        if (opensUpward(win) && Math.abs(dh) >= 1) steamWindow.MoveTo(win.screenX, win.screenY - dh, dpr);
        steamWindow.ResizeTo(size.w, size.h, dpr);
    };
    const scheduleMenu = win => {
        const title = String(win?.document?.title || '');
        if (!title) return;
        menuTimers.get(win)?.();
        // Steam finishes placing and showing a menu after the first calls, which can
        // wipe the glass, so every step of the burst applies it again.
        let done = false;
        const attempt = () => {
            try { fitDropdown(win); } catch (error) { console.error('[mochasteam-material]', error); }
            const dpr = win.devicePixelRatio || 1;
            const rect = [win.screenX, win.screenY, win.outerWidth, win.outerHeight]
                .map(v => Math.round(v * dpr)).join(',');
            // Screen box first: dropdown and right-click menus show "Menu" in the page but
            // their window title is blank, and the title lookup would frost other hidden
            // "Menu" windows and report success.
            call('apply_menu_material_at', { rect })
                .then(ok => ok || call('apply_menu_material', { title }))
                .then(ok => {
                    if (ok) done = true;
                    win.document?.documentElement?.classList.toggle('mocha-acrylic', ok || done);
                });
        };
        menuTimers.set(win, burst(attempt, [0, 60, 200, 500, 1000, 2000]));
    };
    const onMenu = win => {
        if (!win) return;
        if (!watched.has(win)) {
            watched.add(win);
            for (const method of ['ShowWindow', 'BringToFront']) {
                const original = win.SteamClient?.Window?.[method];
                if (typeof original !== 'function') continue;
                win.SteamClient.Window[method] = function (...args) {
                    const result = original.apply(this, args);
                    scheduleMenu(win);
                    return result;
                };
            }
            win.document.addEventListener('visibilitychange', () => {
                if (!win.document.hidden) scheduleMenu(win);
            });
            win.addEventListener('resize', () => scheduleMenu(win));
        }
        scheduleMenu(win);
    };
    const onPopup = popup => {
        const name = String(popup.m_strName);
        if (name.startsWith('SP Desktop_')) return onMainWindow(popup.m_popup);
        if (/^contextmenu_\d+_/.test(name)) return onMenu(popup.m_popup);
        if (/^PopupWindow_/.test(name)) return onDialog(popup.m_popup);
        if (!/^notificationtoasts_.+_desktop$/.test(name)) return;
        const win = popup.m_popup;
        const scheduleThis = () => schedule(name, win);
        if (win && !watched.has(win)) {
            watched.add(win);
            for (const method of ['ShowWindow', 'BringToFront']) {
                const original = win.SteamClient?.Window?.[method];
                if (typeof original !== 'function') continue;
                win.SteamClient.Window[method] = function (...args) {
                    const result = original.apply(this, args);
                    scheduleThis();
                    return result;
                };
            }
            // Steam slides the toast in with MoveTo steps that end flush on the
            // screen corner. Shift every step so it floats 16 px inside instead.
            const moveTo = win.SteamClient?.Window?.MoveTo;
            if (typeof moveTo === 'function') {
                win.SteamClient.Window.MoveTo = function (x, y, scale, ...rest) {
                    const inset = Math.round(16 * (scale || 1));
                    return moveTo.call(this, x - inset, y - inset, scale, ...rest);
                };
            }
            win.document.addEventListener('visibilitychange', () => {
                if (!win.document.hidden) scheduleThis();
            });
        }
        scheduleThis();
    };
    // Dropdown lists (library shelf and sort, the filters pane, settings) open inside the
    // page by default, where only CSS blur can reach them and it reads as a dark smudge.
    // Open them as their own menu windows instead (Steam's own path for narrow windows),
    // so onMenu above gives them the same Windows acrylic as every other menu.
    const forceDropdownPopups = () => {
        let req;
        try {
            window.webpackChunksteamui?.push([[Symbol(pluginName)], {}, r => { req = r; }]);
        } catch (error) {
            console.error('[mochasteam-material]', error);
        }
        if (!req?.m) return false;
        const ids = Object.keys(req.m);
        ids.sort((a, b) => (b === '13240') - (a === '13240'));
        for (const id of ids) {
            const source = String(req.m[id]);
            if (!source.includes('CreateContextMenuInstance(') || !source.includes('GetAllMenus(')) continue;
            for (const value of Object.values(req(id) || {})) {
                const proto = typeof value === 'function' ? value.prototype : null;
                if (typeof proto?.CreateContextMenuInstance !== 'function') continue;
                if (proto.mochaDropdownPopups) return true;
                const original = proto.CreateContextMenuInstance;
                proto.CreateContextMenuInstance = function (content, target, x, y, options) {
                    // As a window, a list matched to the button width cuts off longer
                    // choices (Sort by), so size it to its content, never under the button.
                    if (!options?.bForcePopup && target?.closest?.('.DialogDropDown')) {
                        options = { ...options, bForcePopup: true, bMatchWidth: false, bGrowToElementWidth: true };
                    }
                    return original.call(this, content, target, x, y, options);
                };
                proto.mochaDropdownPopups = true;
                return true;
            }
        }
        return false;
    };
    try {
        if (!forceDropdownPopups()) console.warn('[mochasteam-material] dropdown menu hook not found');
    } catch (error) {
        console.error('[mochasteam-material]', error);
    }
    Millennium.AddWindowCreateHook(onPopup);
    // Windows that existed before the plugin loaded (the main window, the root menus).
    try {
        for (const [, popup] of window.g_PopupManager?.m_mapPopups || []) onPopup(popup);
    } catch (error) {
        console.error('[mochasteam-material]', error);
    }
}
window.PLUGIN_LIST ||= {};
window.PLUGIN_LIST[pluginName] = {
    default: initialize,
    __millennium_internal_plugin_name_do_not_use_or_change__: pluginName,
};
initialize().then(() => MILLENNIUM_BACKEND_IPC.postMessage(1, { pluginName }));
