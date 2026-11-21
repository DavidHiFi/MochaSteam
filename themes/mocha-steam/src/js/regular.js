(() => {
// Page-state flags for the stylesheets. A `body:has(.x)` selector makes Chrome
// re-check the whole page on every DOM change: on a Library game page that
// cost ~400 ms per change (measured 2026-11-12). The CSS matches these body
// classes instead; body.flag has the same specificity as body:has(.x).
// getElementsByClassName returns live lists, so each check is a cheap length read.
const FLAGS = [
    ['st-has-library', '_3x1HklzyDs4TEjACrRO2tB'],
    ['st-has-game-list', '_1ijTaXJJA5YWl_fW2IxcaT'],
    ['st-has-3e5i', '_3E5iVG630BkOHTaJJaMEMw'],
    ['st-has-z8gy', 'z8GYwNt_nbBZrf7OVjs-s'],
    ['st-has-millennium-sidebar', 'MillenniumDesktopSidebar'],
    ['st-has-special-offers', '_1N7O3VXbkpN2z55HsSDZsi'],
].map(([flag, cls]) => [flag, document.getElementsByClassName(cls)]);
const downloadBars = document.getElementsByClassName('_1_yS5UP7el0aN4vntx3dx');

const setFlag = (cl, flag, on) => {
    if (cl.contains(flag) !== on) cl.toggle(flag, on);
};
const updateFlags = () => {
    const body = document.body;
    if (!body) return;
    const cl = body.classList;
    for (const [flag, list] of FLAGS) setFlag(cl, flag, list.length > 0);
    let downloading = false;
    for (const bar of downloadBars) {
        if (bar.getElementsByClassName('wi0pDywRgOCxhG7OqQNaA').length) { downloading = true; break; }
    }
    setFlag(cl, 'st-has-download-active', downloading);
};

// Move setting option input element into the title element for better styling
const listSelector = '.aFxOaYcllWYkCfVYQJFs0';
const cardSelector = '.eKmEXJCm_lgme24Fp_HWt';
const elementSelector = '.PSZtxj2h3MlyYv-c9dgke';
const titleSelector = '._2VcTlXFC64Jtg9gvtT6cmY';
const settingsLists = document.getElementsByClassName(listSelector.slice(1));

const moveElements = () => {
    if (!settingsLists.length) return;
    for (const list of settingsLists) {
        list.querySelectorAll(cardSelector).forEach((card) => {
            const elementToMove = card.querySelector(elementSelector);
            const title = card.querySelector(titleSelector);
            if (elementToMove && title && !title.contains(elementToMove)) {
                title.appendChild(elementToMove);
            }
        });
    }
};

const start = () => {
    updateFlags();
    moveElements();
    // Runs before the next paint, so a flag never lags a frame behind the DOM.
    new MutationObserver(() => { updateFlags(); moveElements(); })
        .observe(document.body, { subtree: true, childList: true });
    // Steam can rewrite body's class list; put the flags back if it does.
    new MutationObserver(updateFlags)
        .observe(document.body, { attributes: true, attributeFilter: ['class'] });
};
if (document.body) start();
else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
