import './webkit/community/friendsThatPlayed.js';
import { waitForElement } from './utils.js';

// LuaTools looks for the old store-header class "_1wn1lBlAzl3HMRqS1llwie" to
// hang its settings button on. Steam renamed that class, so the button stopped
// appearing. Put the old name back on the Wishlist container in the store bar;
// LuaTools' own observer then inserts the button. React can rewrite className,
// so the check repeats on DOM changes (one querySelector, no work when present).
(function() {
    const LEGACY = '_1wn1lBlAzl3HMRqS1llwie';
    const tag = () => {
        if (document.querySelector('.' + LEGACY)) return;
        const form = document.querySelector('form[role="search"]');
        const bar = form && form.closest('.Panel.Focusable:has(> div form[role="search"])');
        const wish = bar && bar.querySelector('a[href*="/wishlist"]');
        if (wish && wish.parentElement) wish.parentElement.classList.add(LEGACY);
    };
    let queued = false;
    const observer = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        // setTimeout, not rAF: rAF never fires while the store view is hidden,
        // which left 'queued' stuck and the tag never applied.
        setTimeout(() => { queued = false; tag(); }, 100);
    });
    const start = () => {
        tag();
        observer.observe(document.body, { childList: true, subtree: true });
    };
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
})();

(async function() {
    // should work only on search page
    if (!window.location.pathname.startsWith('/search')) return;

    const containerParent = await waitForElement('.searchbar');
    const searchResultsRows = await waitForElement('#search_resultsRows');
    if (!containerParent) return;

    const btnContainer = document.createElement('div');
    btnContainer.className = 'st-search-view-toggle';

    const listBtn = document.createElement('div');
    listBtn.className = 'st-btn list';
    listBtn.innerHTML = `
        <svg></svg>
    `;

    const gridBtn = document.createElement('div');
    gridBtn.className = 'st-btn grid';
    gridBtn.innerHTML = `
        <svg></svg>
    `;

    btnContainer.appendChild(listBtn);
    btnContainer.appendChild(gridBtn);
    if (searchResultsRows && searchResultsRows.parentElement === containerParent) {
        containerParent.insertBefore(btnContainer, searchResultsRows);
    } else {
        containerParent.appendChild(btnContainer);
    }


    gridBtn.addEventListener('click', () => {
        document.body.classList.add('st-grid-view');
        localStorage.setItem('st-search-view', 'grid');
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
    });

    listBtn.addEventListener('click', () => {
        document.body.classList.remove('st-grid-view');
        localStorage.setItem('st-search-view', 'list');
        listBtn.classList.add('active');
        gridBtn.classList.remove('active');
    });

    if (localStorage.getItem('st-search-view') === 'list') {
        document.body.classList.remove('st-grid-view');
        listBtn.classList.add('active');
    } else {
        document.body.classList.add('st-grid-view');
        gridBtn.classList.add('active');
    }
    
    const parentObserver = new MutationObserver(() => {
        if (!document.body.contains(btnContainer)) {
            const rows = searchResultsRows;
            if (rows && rows.parentElement) {
                rows.parentElement.insertBefore(btnContainer, rows);
                return;
            }
            if (containerParent) {
                containerParent.appendChild(btnContainer);
            }
        }
    });

    parentObserver.observe(containerParent, {
        childList: true,
        subtree: true
    });
})();
