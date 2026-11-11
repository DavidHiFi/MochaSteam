// MochaSteam settings dialog helper (Millennium quick-access sidebar in the main Steam window).
// 1. Font "Custom": a text box under the Font row; the name is stored in the hidden
//    "Custom font name" condition (a slider condition, so Millennium itself writes it as
//    --st-custom-font into every Steam window and every store/community page).
// 2. Colors page: a Presets row that sets the hidden "Colour preset" condition.
// 3. Open dropdown menus: marks the item that matches the current choice (selected box).

const THEME_TAB_SEL = '.MillenniumDesktopSidebar';
const PRESETS = [
    ['Custom', 'Custom'],
    ['Steam default', 'Steam default'],
    ['Catppuccin Mocha', 'Mocha'],
    ['Catppuccin Frappe', 'Frappé'],
    ['Catppuccin Latte', 'Latte'],
    ['Catppuccin Macchiato', 'Macchiato'],
];
const PRESET_FILES = {
    'Steam default': 'steam',
    'Catppuccin Mocha': 'mocha',
    'Catppuccin Frappe': 'frappe',
    'Catppuccin Latte': 'latte',
    'Catppuccin Macchiato': 'macchiato',
};

const host = () => (window.MILLENNIUM_API ? window : window.opener) || window;
const core = () => host().PLUGIN_LIST?.core;
const themeName = () => core()?.activeTheme?.native || 'MochaSteam';
const conditionals = () => {
    const c = core();
    if (!c) return {};
    c.conditionals = c.conditionals || {};
    return (c.conditionals[themeName()] = c.conditionals[themeName()] || {});
};
const themeUrl = path => ['https://millennium.host/v1/themes', themeName(), path].join('/');

const popupDocs = () => {
    const docs = new Set([document]);
    try {
        for (const p of host().g_PopupManager?.GetPopups?.() || []) {
            if (p?.window?.document) docs.add(p.window.document);
        }
    } catch (e) { /* popup list unavailable */ }
    return [...docs];
};

const saveCondition = async (name, value) => {
    conditionals()[name] = value;
    const api = host().MILLENNIUM_API;
    if (!api?.ffi) return false;
    try {
        const res = await api.ffi('core', 'Core_ChangeCondition')(themeName(), value, name);
        if (typeof res === 'string') { try { return !!JSON.parse(res)?.success; } catch (e) { return true; } }
        return res?.success ?? !!res;
    } catch (e) {
        console.error('[MochaSteam] could not save', name, e);
        return false;
    }
};

// ---------- Custom font ----------

const cleanFont = raw => raw.replace(/["';{}<>\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
const storedFont = () => {
    const v = conditionals()['Custom font name'];
    if (typeof v === 'string' && v) return v.replace(/^"|"$/g, '');
    const css = getComputedStyle(document.documentElement).getPropertyValue('--st-custom-font').trim();
    return css.replace(/^["']|["']$/g, '') || '';
};

const applyFontLive = (name) => {
    const value = `"${name}"`;
    const gfHref = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:ital,wght@0,300..900;1,300..900&display=swap`;
    for (const doc of popupDocs()) {
        // Same tag Millennium's own slider code writes, so it is replaced, not duplicated.
        let st = doc.getElementById('millennium-slider---st-custom-font');
        if (!st) {
            st = doc.createElement('style');
            st.id = 'millennium-slider---st-custom-font';
            doc.head.appendChild(st);
        }
        st.textContent = `:root { --st-custom-font: ${value}; }`;
        // Try Google Fonts for names that are not installed (ignored if it does not exist).
        let gf = doc.getElementById('st-custom-font-gf');
        if (!gf) {
            gf = Object.assign(doc.createElement('link'), { id: 'st-custom-font-gf', rel: 'stylesheet' });
            doc.head.appendChild(gf);
        }
        gf.href = gfHref;
        // Make sure the Custom font file is active without a reload.
        const href = themeUrl('options/fonts/custom.css');
        if (!doc.querySelector(`link[href^='${href}']`)) {
            doc.head.appendChild(Object.assign(doc.createElement('link'), { rel: 'stylesheet', href, id: 'millennium-injected' }));
        }
        for (const l of doc.querySelectorAll("link[href*='/options/fonts/']")) {
            if (!l.href.includes('/options/fonts/custom.css') && !/\/fonts\/(weight|spacing|italic)/.test(l.href)) l.remove();
        }
    }
};

const ensureFontBox = (root) => {
    const row = root.querySelector('[data-condition="Font"]');
    const existing = root.querySelector('.st-custom-font-row');
    const current = row?.querySelector('.DialogDropDown_CurrentDisplay')?.textContent?.trim();
    if (!row || current !== 'Custom') {
        existing?.remove();
        return;
    }
    if (existing && existing.previousElementSibling === row) return;
    existing?.remove();

    const box = document.createElement('div');
    box.className = 'st-custom-font-row Field Panel';
    box.innerHTML = `
        <label class="st-custom-font-label" for="st-custom-font-input">Custom font name</label>
        <div class="st-custom-font-controls">
            <input id="st-custom-font-input" class="st-custom-font-input" type="text" spellcheck="false"
                   placeholder="Any installed or Google font, e.g. Inter" />
            <button type="button" class="st-custom-font-apply DialogButton Secondary">Apply</button>
        </div>
        <div class="st-custom-font-hint">Installed fonts work everywhere. Google fonts load in the client windows.</div>`;
    const input = box.querySelector('input');
    const button = box.querySelector('button');
    const hint = box.querySelector('.st-custom-font-hint');
    input.value = storedFont();

    const apply = async () => {
        const name = cleanFont(input.value);
        input.value = name;
        if (!name) return;
        applyFontLive(name);
        const ok = await saveCondition('Custom font name', `"${name}"`);
        hint.textContent = ok ? `Saved: ${name}` : 'Applied here, but saving failed.';
    };
    button.addEventListener('click', apply);
    input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') apply();
    });
    // Steam's gamepad/focus navigation eats key events otherwise.
    for (const t of ['keyup', 'keypress', 'input']) input.addEventListener(t, e => e.stopPropagation());
    row.after(box);
};

// ---------- Colour presets ----------

const applyPresetLive = (value) => {
    for (const doc of popupDocs()) {
        for (const l of doc.querySelectorAll("link[href*='/options/colors/']")) l.remove();
        const file = PRESET_FILES[value];
        if (file) {
            doc.head.appendChild(Object.assign(doc.createElement('link'), {
                rel: 'stylesheet', href: themeUrl(`options/colors/${file}.css`), id: 'millennium-injected',
            }));
        }
    }
};

const ensurePresets = (root) => {
    const body = root.querySelector('.MillenniumDesktopSidebar_EditorContent .DialogBody, .DialogBody');
    const onColors = !!body?.querySelector('input.MillenniumColorPicker');
    const existing = root.querySelector('.st-presets-row');
    if (!onColors) {
        existing?.remove();
        return;
    }
    if (existing && existing.parentElement === body && body.firstElementChild === existing) return;
    existing?.remove();

    const current = conditionals()['Colour preset'] || 'Custom';
    const row = document.createElement('div');
    row.className = 'st-presets-row Field Panel';
    row.innerHTML = `
        <div class="st-presets-label">Presets</div>
        <div class="st-presets-chips" role="radiogroup"></div>
        <div class="st-presets-hint">Custom uses the colour pickers below. A preset overrides them.</div>`;
    const chips = row.querySelector('.st-presets-chips');
    for (const [value, label] of PRESETS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'st-preset-chip' + (value === current ? ' st-selected' : '');
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(value === current));
        b.dataset.preset = value;
        b.textContent = label;
        b.addEventListener('click', async () => {
            for (const c of chips.children) {
                const on = c === b;
                c.classList.toggle('st-selected', on);
                c.setAttribute('aria-checked', String(on));
            }
            applyPresetLive(value);
            const ok = await saveCondition('Colour preset', value);
            row.querySelector('.st-presets-hint').textContent = ok
                ? (value === 'Custom' ? 'Custom: the colour pickers below are used.' : `${label} is on. Pick Custom to use the colour pickers.`)
                : 'Applied here, but saving failed.';
        });
        chips.appendChild(b);
    }
    body.prepend(row);
};

// ---------- Selected item in open dropdown menus ----------

let lastDropDown = null;
document.addEventListener('pointerdown', (e) => {
    const dd = e.target?.closest?.('.DialogDropDown');
    if (dd) lastDropDown = dd;
}, true);
document.addEventListener('click', (e) => {
    const dd = e.target?.closest?.('.DialogDropDown');
    if (dd) lastDropDown = dd;
}, true);

const markMenu = () => {
    const menus = document.querySelectorAll('.DialogDropDownMenu');
    if (!menus.length) return;
    const want = lastDropDown?.isConnected
        ? lastDropDown.querySelector('.DialogDropDown_CurrentDisplay')?.textContent?.trim()
        : document.querySelector('.MillenniumDesktopSidebar_EditorHeader .DialogDropDown_CurrentDisplay')?.textContent?.trim();
    for (const menu of menus) {
        for (const item of menu.querySelectorAll('.DialogDropDownMenu_Item')) {
            const on = !!want && item.textContent.trim() === want;
            if (item.classList.contains('st-current') !== on) item.classList.toggle('st-current', on);
        }
    }
};

// ---------- Wiring ----------

let queued = false;
let watched = null;
const tick = () => {
    queued = false;
    const root = document.querySelector(THEME_TAB_SEL);
    if (root) {
        if (root !== watched) {
            sidebarObserver.disconnect();
            sidebarObserver.observe(root, { childList: true, subtree: true, characterData: true });
            watched = root;
        }
        ensureFontBox(root);
        ensurePresets(root);
    }
    markMenu();
};
const schedule = () => {
    if (queued) return;
    queued = true;
    // setTimeout, not requestAnimationFrame: rAF never fires while the window is hidden.
    setTimeout(tick, 16);
};

const sidebarObserver = new MutationObserver(() => schedule());
const bodyObserver = new MutationObserver(schedule);
const start = () => {
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    schedule();
};
if (document.body) start();
else document.addEventListener('DOMContentLoaded', start, { once: true });

const stop = () => { bodyObserver.disconnect(); sidebarObserver.disconnect(); watched = null; };
window.__mochaSettingsHelper?.stop?.();
window.__mochaSettingsHelper = { tick, stop, applyPresetLive, applyFontLive, saveCondition };
