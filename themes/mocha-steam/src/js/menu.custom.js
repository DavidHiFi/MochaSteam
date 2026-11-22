// Popup menus: Steam sizes a popup window from the stock layout before the theme's
// menu styles finish loading, then never measures again, so a themed menu (more
// padding, 2px edges) gets its bottom cut off. Grow the window to fit the menu.
// Only grows, only in menu windows, and only while the window is showing.
(() => {
    if (!/(Menu|Supernav)$/.test(document.title)) return;
    const W = window.SteamClient && SteamClient.Window;
    if (!W || typeof W.ResizeTo !== "function") return;

    let watched = null;
    const fit = () => {
        if (document.visibilityState !== "visible" || innerHeight === 0) return;
        const m = document.querySelector(".contextMenu");
        if (!m) return;
        const w = Math.ceil(m.offsetWidth), h = Math.ceil(m.offsetHeight);
        if (h > innerHeight + 0.5 || w > innerWidth + 0.5) {
            W.ResizeTo(Math.max(innerWidth, w), Math.max(innerHeight, h), true);
        }
    };
    const ro = new ResizeObserver(fit);
    const watch = () => {
        const m = document.querySelector(".contextMenu");
        if (m && m !== watched) {
            if (watched) ro.unobserve(watched);
            ro.observe(m);
            watched = m;
        }
        fit();
    };
    new MutationObserver(watch).observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener("visibilitychange", fit);
    window.addEventListener("load", watch);
    watch();
    setTimeout(watch, 300);
    setTimeout(watch, 1000);
})();
