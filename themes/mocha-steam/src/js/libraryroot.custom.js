import { waitForElement, createContainerTracker, getFiber, CssClassNames } from './utils.js';

// Create Loading Screen
const createLoadingDiv = () => {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'st-loading-div';

    // Radial Loader
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'st-radial-loader';

    loadingDiv.appendChild(loadingIndicator);

    // Apply to body
    document.body.appendChild(loadingDiv);

    // Timer
    setTimeout(() => {
        document.body.removeChild(loadingDiv);
    }, 2500);
};

// Patch to body
waitForElement(CssClassNames.HtmlRoot).then(() => {
    if (!document.getElementById('st-loading-div')) {
        createLoadingDiv();
    }
});




// Store Sidebar Width fix
async function syncWidthIfTargetHidden() {
    const sourceClass = CssClassNames.Library.Body;
    const targetClass = CssClassNames.MainBody;

    let sourceEl = null;
    let targetEl = null;
    let sourceObserver = null;
    let targetObserver = null;

    const setWidth = () => {
        const width = sourceEl.style.width;
        const scrollbarWidth = '16px';
        if (width) {
            targetEl.style.flex = `0 0 calc(${width} + ${scrollbarWidth})`;
            // Used by the "Sidebar only on hover" option for the expanded width.
            // Only set on changes, every style change triggers the observer below again.
            if (targetEl.style.getPropertyValue('--st-sidebar-width') !== width) {
                targetEl.style.setProperty('--st-sidebar-width', width);
            }
        }
    };

    const removeWidth = () => {
        targetEl.style.removeProperty('flex');
        if (targetEl.style.getPropertyValue('--st-sidebar-width')) {
            targetEl.style.removeProperty('--st-sidebar-width');
        }
    };

    const handleTargetDisplayChange = () => {
        if (targetEl.style.display === 'none') {
            setWidth();
        } else {
            removeWidth();
        }
    };


    const disconnectObservers = () => {
        sourceObserver?.disconnect();
        sourceObserver = null;

        targetObserver?.disconnect();
        targetObserver = null;
    };

    const bindObservers = () => {
        disconnectObservers();

        sourceObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    if (targetEl.style.display === 'none') {
                        setWidth();
                    }
                }
            }
        });

        // Watch for style changes on source
        sourceObserver.observe(sourceEl, {
            attributes: true,
            attributeFilter: ['style'],
        });

        // Watch for style changes on target (especially display)
        targetObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    handleTargetDisplayChange();
                }
            }
        });

        targetObserver.observe(targetEl, {
            attributes: true,
            attributeFilter: ['style'],
        });
    };

    const setupElements = async () => {
        sourceEl = await waitForElement(sourceClass);
        targetEl = await waitForElement(targetClass);
        bindObservers();
        handleTargetDisplayChange();
    };

    const sourceTracker = createContainerTracker(sourceClass, {
        onCleanup: disconnectObservers,
        onSetup: setupElements,
    });

    const rootObserver = new MutationObserver(async () => await sourceTracker.rebind());
    rootObserver.observe(document.body, {
        subtree: true,
        childList: true,
    });

    await setupElements();
}
syncWidthIfTargetHidden();




// Custom hover effect for game items
async function setupGamesHovers() {
    const gamesContainerSelector = `${CssClassNames.Library.Games.Container} .ReactVirtualized__Grid__innerScrollContainer`;
    const itemSelector = CssClassNames.Library.Games.Game;
    const separatorSelector = CssClassNames.Library.Games.Separator;
    const widthContainerSelector = CssClassNames.Library.Games.Name;
    const pxPerSec = 70;
    const minDurationSec = 2;
    const navTextOffset = 5;
    let attrObserver = null;
    let childObserver = null;
    let rafId = 0;

    const setHoverVariables = (item, overflow) => {
        if (overflow <= navTextOffset) {
            item.style.removeProperty('--st-game-overflow');
            item.style.removeProperty('--st-game-hover-duration');
            return;
        }

        const value = `${overflow}px`;
        if (item.style.getPropertyValue('--st-game-overflow') === value) return;
        const duration = Math.max(minDurationSec, overflow / pxPerSec);
        item.style.setProperty('--st-game-overflow', value);
        item.style.setProperty('--st-game-hover-duration', `${duration}s`);
    };

    const handleGamesHover = () => {
        const gamesContainer = containerTracker.getContainer();
        if (!gamesContainer) {
            return;
        }

        // Reads and writes are batched: writing padding and then reading a
        // width in the same loop forced one full layout per visible row.
        const rows = [];
        for (const item of gamesContainer.querySelectorAll(itemSelector)) {
            const itemText = item.querySelector('span:not(.pdb-dot)');
            if (!itemText) continue;
            const separator = itemText.querySelector(separatorSelector);
            if (!itemText.dataset.stHoverText) {
                const text = itemText.innerText;
                itemText.dataset.stHoverText = separator ? `${text} ${separator.textContent}` : text;
            }
            rows.push({ item, itemText, separator, sepWidth: separator ? separator.offsetWidth : 0 });
        }
        for (const r of rows) {
            if (!r.separator) continue;
            const pad = `${r.sepWidth + 4}px`;
            if (r.itemText.style.paddingRight !== pad) r.itemText.style.setProperty('padding-right', pad);
        }
        for (const r of rows) {
            const widthContainer = r.separator && r.item.querySelector(widthContainerSelector);
            r.overflow = Math.max(0, Math.ceil(widthContainer
                ? widthContainer.scrollWidth - widthContainer.clientWidth
                : r.itemText.scrollWidth - r.itemText.clientWidth + navTextOffset));
        }
        for (const r of rows) setHoverVariables(r.item, r.overflow);
    };

    const scheduleHoverUpdate = () => {
        if (!rafId) {
            rafId = requestAnimationFrame(() => {
                rafId = 0;
                handleGamesHover();
            });
        }
    };

    const disconnectContainerObservers = () => {
        attrObserver?.disconnect();
        attrObserver = null;

        childObserver?.disconnect();
        childObserver = null;
    };

    const bindContainerObservers = () => {
        const gamesContainer = containerTracker.getContainer();
        if (!gamesContainer) {
            return;
        }

        disconnectContainerObservers();

        attrObserver = new MutationObserver(scheduleHoverUpdate);
        attrObserver.observe(gamesContainer, { attributes: true, attributeFilter: ['style'] });

        childObserver = new MutationObserver(scheduleHoverUpdate);
        childObserver.observe(gamesContainer, { childList: true, subtree: true });
    };

    const containerTracker = createContainerTracker(gamesContainerSelector, {
        onCleanup: disconnectContainerObservers,
        onSetup: bindContainerObservers,
        onUpdate: scheduleHoverUpdate,
    });

    const rootObserver = new MutationObserver(async () => await containerTracker.rebind());
    rootObserver.observe(document.body, {
        subtree: true,
        childList: true,
    });

    await containerTracker.rebind();
}
setupGamesHovers();



// Sync User panel and Download bar width with Store sidebar
function syncUserPanelWidth() {
    const sourceClass = CssClassNames.Library.Body;
    const userPanelSelector = CssClassNames.UserPanel.Container;
    const downloadBarSelector = CssClassNames.DownloadBar;

    let sourceEl = null;
    let userPanelEl = null;
    let downloadBarEl = null;
    let sourceObserver = null;
    let sourceResizeObserver = null;

    const setWidth = () => {
        if (!sourceEl) return;
        const computedWidth = window.getComputedStyle(sourceEl).width;
        if (computedWidth && computedWidth !== 'auto') {
            if (userPanelEl) {
                userPanelEl.style.width = computedWidth;
            }
            if (downloadBarEl) {
                downloadBarEl.style.width = computedWidth;
            }
        }
    };

    const bindObservers = () => {
        if (!sourceEl || (!userPanelEl && !downloadBarEl)) return;

        sourceObserver?.disconnect();

        sourceObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    setWidth();
                }
            }
        });

        sourceObserver.observe(sourceEl, {
            attributes: true,
            attributeFilter: ['style'],
        });

        // Width changes through CSS, e.g. the sidebar expanding on hover
        sourceResizeObserver?.disconnect();
        sourceResizeObserver = new ResizeObserver(setWidth);
        sourceResizeObserver.observe(sourceEl);

        setWidth();
    };

    // Called on every DOM change: rebind (and read the computed width, which
    // forces a style + layout pass) only when one of the three elements changed.
    const setupElements = () => {
        const nextSource = document.querySelector(sourceClass);
        const nextUserPanel = document.querySelector(userPanelSelector);
        const nextDownloadBar = document.querySelector(downloadBarSelector);
        if (nextSource === sourceEl && nextUserPanel === userPanelEl && nextDownloadBar === downloadBarEl) return;
        sourceEl = nextSource;
        userPanelEl = nextUserPanel;
        downloadBarEl = nextDownloadBar;

        if (sourceEl && (userPanelEl || downloadBarEl)) {
            bindObservers();
        }
    };

    window.addEventListener('resize', setWidth);
    new ResizeObserver(setWidth).observe(document.documentElement);
    window.visualViewport?.addEventListener('resize', setWidth);

    const rootObserver = new MutationObserver(() => setupElements());

    rootObserver.observe(document.body, {
        subtree: true,
        childList: true,
    });

    setupElements();
}
syncUserPanelWidth();




// Steam can replace these React controls after startup or an update.
(() => {
    const sync = () => {
        const parent = document.querySelector(CssClassNames.UserPanel.Container);
        if (!parent || !document.querySelector(CssClassNames.Library.Container)) return;
        let buttonContainer = parent.querySelector(':scope > .userpanel-buttoncontainer');
        if (!buttonContainer) {
            buttonContainer = document.createElement('div');
            buttonContainer.className = 'userpanel-buttoncontainer';
            parent.appendChild(buttonContainer);
        }
        for (const wrapper of [...parent.children]) {
            if (wrapper !== buttonContainer && wrapper.querySelector(CssClassNames.UserPanel.Button)) {
                buttonContainer.appendChild(wrapper);
            }
        }
        for (const selector of [CssClassNames.UserPanel.FriendButton, CssClassNames.UserPanel.FamilyButton]) {
            const button = document.querySelector(selector);
            if (button && button.parentElement !== buttonContainer) buttonContainer.appendChild(button);
        }
        if (buttonContainer.querySelector('.st-steam-settings')) return;
    // Create custom settings button
    const settingsButton = document.createElement('div');
    settingsButton.className = 'tool-tip-source Focusable st-steam-settings';
    settingsButton.style.order = '999';

    const settingsIconWrapper = document.createElement('div');
    settingsIconWrapper.className = `${CssClassNames.UserPanel.Button.slice(1)} _3LKQ3S_yqrebeNLF6aeiog`;

    const settingsIcon = document.createElement('svg');
    settingsIcon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    settingsIcon.setAttribute('viewBox', '0 0 20 19');
    settingsIcon.setAttribute('fill', 'none');
    settingsIcon.setAttribute('class', '_34bQcTHo5QKzuujoEyU1tm');

    settingsIconWrapper.appendChild(settingsIcon);
    settingsButton.appendChild(settingsIconWrapper);

    settingsButton.addEventListener('click', () => {
        window.opener.SteamClient.URL.ExecuteSteamURL("steam://millennium/sidebar");
    });

    buttonContainer.appendChild(settingsButton);

    };
    let pending = false;
    const observer = new MutationObserver(() => {
        if (pending) return;
        pending = true;
        queueMicrotask(() => { pending = false; sync(); });
    });
    window.__stUserPanelObserver?.disconnect();
    window.__stUserPanelObserver = observer;
    observer.observe(document.body, { childList: true, subtree: true });
    sync();
})();

// Sidebar width
// The custom resize behaviour only changes the element's style, so the width is saved here and given to Steam's library too.
// Otherwise the library falls back to its own width every time it gets mounted again (e.g. after the downloads page).
// Steam itself only restores whole percentages, so the exact width is kept in an own key.
const sidebarWidthKey = 'st-sidebar-width';

const getSidebarWidth = () => {
    const width = parseFloat(localStorage.getItem(sidebarWidthKey) ?? localStorage.getItem('GameListWidthPercentage'));
    return Number.isNaN(width) ? null : width;
};

const getLibraryInstance = body => {
    for (let fiber = getFiber(body); fiber; fiber = fiber.return) {
        if (fiber.stateNode?.SetGameListWidth) return fiber.stateNode;
    }
    return null;
};

const applySidebarWidth = body => {
    const width = getSidebarWidth();
    if (width === null) return;

    const library = getLibraryInstance(body);
    if (!library) {
        body.style.width = `${width}%`;
    } else if (library.state.nListWidthPercentage !== width) {
        library.setState({ nListWidthPercentage: width });
    }
};

const saveSidebarWidth = (body, width) => {
    localStorage.setItem(sidebarWidthKey, width);
    localStorage.setItem('GameListWidthPercentage', width);
    getLibraryInstance(body)?.setState({ nListWidthPercentage: width });
};

// The downloads chip below the game list is positioned outside the sidebar, so it gets the sidebar's
// real width as --st-live-sidebar-width (px) and follows every resize, window resize and restore.
(() => {
    const root = document.documentElement;
    let observed = null;
    const observer = new ResizeObserver(entries => {
        const width = Math.round(entries[entries.length - 1].borderBoxSize?.[0]?.inlineSize ?? entries[entries.length - 1].target.getBoundingClientRect().width);
        if (width > 0 && root.style.getPropertyValue('--st-live-sidebar-width') !== `${width}px`) {
            root.style.setProperty('--st-live-sidebar-width', `${width}px`);
        }
    });
    const rebind = () => {
        const body = document.querySelector(CssClassNames.Library.Body);
        if (body === observed) return;
        if (observed) observer.unobserve(observed);
        observed = body;
        if (body) observer.observe(body);
    };
    rebind();
    new MutationObserver(rebind).observe(document.body, { childList: true, subtree: true });
})();



// Game sidebar on the downloads page
// Steam routes the downloads page next to the library instead of inside it, so the game list is never rendered there.
// The downloads page component gets patched to render the game list through a portal into a container
// that mirrors the library's left list, so the sidebar styles, width sync and resize behaviour apply to it as well.
(() => {
    const React = window.opener?.SP_REACT;
    const ReactDOM = window.opener?.SP_REACTDOM;
    if (!React || !ReactDOM) return;

    let libraryParts = null;
    let downloadsPatched = false;

    const findFiberDown = (fiber, predicate, depth = 0) => {
        for (let f = fiber; f && depth < 60; f = f.sibling) {
            if (predicate(f)) return f;
            const found = findFiberDown(f.child, predicate, depth + 1);
            if (found) return found;
        }
        return null;
    };

    // Steam's route switch with the downloads and the library route, exists on both pages
    const isRouteSwitch = fiber => {
        const children = fiber.memoizedProps?.children;
        return Array.isArray(children) && children.some(child => child?.props?.children?.type?.WrappedComponent);
    };

    // Render the library component once to get the game list and its wrappers, the library doesn't have to be open for it
    const getLibraryParts = () => {
        const fiber = findFiberDown(getFiber(document.querySelector(CssClassNames.MainBody)), isRouteSwitch);
        if (!fiber) return null;

        const libraryElement = fiber.memoizedProps.children.find(child => child?.props?.children?.type?.WrappedComponent).props.children;
        const library = libraryElement.type.WrappedComponent;
        const tree = library.prototype.render.call({ props: { ...libraryElement.props }, state: { loaded: true }, context: {} });

        let gameList = null;
        const walk = node => {
            if (!node || gameList || typeof node !== 'object') return;
            if (Array.isArray(node)) return node.forEach(walk);
            if (node.props?.bSmallMode === false) {
                gameList = node.type;
                return;
            }
            walk(node.props?.children);
        };
        walk(tree);
        if (!gameList) return null;

        const [keyHandler] = [].concat(tree.props.children);
        return { wrapper: tree.type, keyHandler: keyHandler.type, gameList };
    };

    const renderSidebar = () => React.createElement(libraryParts.wrapper, null,
        React.createElement(libraryParts.keyHandler, { key: 'keys' }),
        React.createElement(libraryParts.gameList, { key: 'games', bSmallMode: false }),
    );

    const createSidebarElements = () => {
        const sidebar = document.createElement('div');
        sidebar.className = `${CssClassNames.Library.Body.slice(1)} st-downloads-sidebar`;
        const width = getSidebarWidth();
        if (width !== null) sidebar.style.width = `${width}%`;

        const divider = document.createElement('div');
        divider.className = CssClassNames.Library.Divider.slice(1);

        return { sidebar, divider };
    };

    const attachSidebar = instance => {
        const elements = instance.stSidebarElements;
        if (!elements || elements.sidebar.isConnected) return;

        const rightPanel = document.querySelector(`${CssClassNames.MainBody} > ${CssClassNames.RightPanel}`);
        if (!rightPanel) return;

        rightPanel.before(elements.sidebar, elements.divider);
    };

    const patchDownloadsPage = downloadsPage => {
        const proto = downloadsPage.prototype;
        const { render, componentDidMount, componentDidUpdate, componentWillUnmount } = proto;

        proto.render = function (...args) {
            const result = render.apply(this, args);
            if (this.props.bInGamepadUI || !libraryParts) return result;

            this.stSidebarElements ??= createSidebarElements();
            return React.createElement(React.Fragment, null, result, ReactDOM.createPortal(renderSidebar(), this.stSidebarElements.sidebar));
        };

        proto.componentDidMount = function (...args) {
            attachSidebar(this);
            return componentDidMount?.apply(this, args);
        };

        proto.componentDidUpdate = function (...args) {
            attachSidebar(this);
            return componentDidUpdate?.apply(this, args);
        };

        proto.componentWillUnmount = function (...args) {
            this.stSidebarElements?.sidebar.remove();
            this.stSidebarElements?.divider.remove();
            return componentWillUnmount?.apply(this, args);
        };
    };

    // The downloads page component can only be found while it's open, so wait for it and patch it on the first visit
    const tryPatch = () => {
        if (downloadsPatched) return;

        try {
            libraryParts ??= getLibraryParts();
        } catch (error) {
            console.error('[SpaceTheme] Could not find the game list', error);
        }
        if (!libraryParts) return;

        const rightPanel = document.querySelector(`${CssClassNames.MainBody} > ${CssClassNames.RightPanel}`);
        const downloadsFiber = findFiberDown(getFiber(rightPanel), fiber =>
            fiber.tag === 1 && 'bOffline' in (fiber.memoizedProps || {}) && 'onShowRemoteClientMenu' in fiber.memoizedProps);
        if (!downloadsFiber) return;

        downloadsPatched = true;
        patchDownloadsPage(downloadsFiber.type);
        downloadsFiber.stateNode.forceUpdate();
        rootObserver.disconnect();
    };

    let rafId = 0;
    const rootObserver = new MutationObserver(() => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            rafId = 0;
            tryPatch();
        });
    });
    rootObserver.observe(document.body, {
        subtree: true,
        childList: true,
    });

    tryPatch();
})();



// Custom side panel resize behaviour
(async () => {
    const containerSelector = CssClassNames.WebkitRoot;
    const panelSelector = CssClassNames.Library.Container;
    const panelBodySelector = CssClassNames.Library.Body;
    const panelResizerSelector = CssClassNames.Library.Divider;

    await waitForElement(panelSelector);

    let container = null;
    let body = null;
    let resizer = null;

    const minWidthPx = 256;
    let isResizing = false;
    let startX = 0;
    let startWidthPx = 0;
    let containerWidthPx = 0;
    let resizeDirection = 1;

    const clickCallback = e => {
        e.stopPropagation();
        isResizing = true;

        const containerRect = container.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();

        startX = e.clientX;
        startWidthPx = bodyRect.width;
        containerWidthPx = containerRect.width;

        const containerCenterX = containerRect.left + containerRect.width / 2;
        const bodyCenterX = bodyRect.left + bodyRect.width / 2;

        const panelIsOnLeft = bodyCenterX < containerCenterX;

        resizeDirection = panelIsOnLeft ? 1 : -1;
    };

    const moveCallback = e => {
        if (!isResizing) return;

        const dx = (e.clientX - startX) * resizeDirection;

        let newWidthPx = startWidthPx + dx;

        newWidthPx = Math.max(minWidthPx, newWidthPx);
        newWidthPx = Math.min(containerWidthPx, newWidthPx);

        const newWidthPercent = Math.min((newWidthPx / containerWidthPx) * 100, 50);

        body.style.width = `${newWidthPercent}%`;
    };
    const releaseCallback = () => {
        if (!isResizing) return;
        isResizing = false;

        const width = parseFloat(body.style.width);
        if (!Number.isNaN(width)) saveSidebarWidth(body, width);
    };

    const handleUpdate = () => {
        resizer.onmousedown = null;
        resizer.onpointerdown = null;
        resizer.onclick = null;

        resizer.addEventListener('mousedown', clickCallback);
        document.addEventListener("mousemove", moveCallback);
        document.addEventListener("mouseup", releaseCallback);
    }

    const handleSetup = async () => {
        container = await waitForElement(containerSelector);
        body = await waitForElement(panelBodySelector);
        resizer = await waitForElement(panelResizerSelector);
        applySidebarWidth(body);
    };

    const handleCleanup = () => {
        resizer.removeEventListener('mousedown', clickCallback);
        document.removeEventListener("mousemove", moveCallback);
        document.removeEventListener("mouseup", releaseCallback);
    };

    const containerTracker = createContainerTracker(panelSelector, {
        onSetup: handleSetup,
        onUpdate: handleUpdate,
        onCleanup: handleCleanup
    });

    const rootObserver = new MutationObserver(async () => await containerTracker.rebind());
    rootObserver.observe(document.body, {
        subtree: true,
        childList: true,
    });
    await containerTracker.rebind();
})();

// Extendium's Extensions window opens at a fixed share of the screen height, so
// with few or no extensions most of it was empty. Size the window height to the
// page (capped at 85% of the screen, the page scrolls past that), and again when
// the page changes. Width stays where the owner left it.
(() => {
    if (document.title !== 'Extensions') return;
    const W = window.SteamClient && SteamClient.Window;
    if (!W || typeof W.ResizeTo !== 'function') return;

    let watched = null;
    const fit = () => {
        const page = document.querySelector('.extension-manager-popup');
        const inner = page && page.closest('.DialogContent_InnerWidth');
        if (!inner || document.visibilityState !== 'visible') return;
        const outer = inner.closest('.DialogContent') || inner;
        const below = parseFloat(getComputedStyle(inner).paddingBottom) + parseFloat(getComputedStyle(outer).marginBottom);
        const bottom = page.getBoundingClientRect().bottom + inner.scrollTop + below;
        const want = Math.round(Math.min(screen.availHeight * 0.85, Math.max(160, bottom)));
        // A saved near full-screen size came back as a wall of empty space; keep the
        // width to Extendium's own 1280 up to 60% of the screen.
        const wantW = Math.round(Math.min(innerWidth, Math.max(1280, screen.availWidth * 0.6)));
        if (Math.abs(want - innerHeight) > 2 || wantW < innerWidth - 2) W.ResizeTo(wantW, want, true);
    };
    const ro = new ResizeObserver(() => requestAnimationFrame(fit));
    const watch = () => {
        const page = document.querySelector('.extension-manager-popup');
        if (page && page !== watched) {
            if (watched) ro.unobserve(watched);
            ro.observe(page);
            watched = page;
        }
    };
    new MutationObserver(watch).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('visibilitychange', fit);
    // Extendium restores its saved size after load; fit again once that lands.
    let settle = 0;
    window.addEventListener('resize', () => { clearTimeout(settle); settle = setTimeout(fit, 250); });
    watch();
    setTimeout(fit, 600);
    setTimeout(fit, 1500);
})();
