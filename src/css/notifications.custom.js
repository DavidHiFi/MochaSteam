// Move the complete desktop popup, so its native edge stays with the card.
(() => {
    if (window.__mochaToastInset) return;
    window.__mochaToastInset = true;
    setTimeout(async () => {
        if (!document.body.classList.contains('DesktopToastContainer')) return;
        const details = await SteamClient.Window.GetWindowRestoreDetails();
        SteamClient.Window.PositionWindowRelative(details, -10, 0, 0, 0);
    }, 1200);
})();
