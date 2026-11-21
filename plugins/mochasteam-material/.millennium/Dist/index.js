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
    // Pop-up menus: frost the menu window itself, then let the card drop its solid
    // fill (html.mocha-acrylic). The card stays solid Mocha until that is confirmed.
    const menuTimers = new Map();
    const scheduleMenu = win => {
        const title = String(win?.document?.title || '');
        if (!title) return;
        menuTimers.get(win)?.();
        let done = false;
        const attempt = () => {
            if (done) return;
            const dpr = win.devicePixelRatio || 1;
            const rect = [win.screenX, win.screenY, win.outerWidth, win.outerHeight]
                .map(v => Math.round(v * dpr)).join(',');
            call('apply_menu_material', { title })
                .then(ok => ok || call('apply_menu_material_at', { rect }))
                .then(ok => {
                    if (ok) done = true;
                    win.document?.documentElement?.classList.toggle('mocha-acrylic', ok || done);
                });
        };
        menuTimers.set(win, burst(attempt, [0, 60, 200, 500]));
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
        }
        scheduleMenu(win);
    };
    const onPopup = popup => {
        const name = String(popup.m_strName);
        if (name.startsWith('SP Desktop_')) return onMainWindow(popup.m_popup);
        if (/^contextmenu_\d+_/.test(name)) return onMenu(popup.m_popup);
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
