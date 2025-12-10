(function initDropzones() {
    const zones = document.querySelectorAll('[data-dropzone]');
    zones.forEach(zone => {
        const input = zone.querySelector('input[type="file"]');
        const label = zone.querySelector('[data-drop-label]');
        const setLabel = (text) => { if (label) label.textContent = text; };
        const updateFromInput = () => {
            if (input && input.files && input.files.length) {
                setLabel(input.files[0].name);
            }
        };
        zone.addEventListener('click', (e) => {
            if (e.target.tagName.toLowerCase() === 'input') return;
            input?.click();
        });
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', (e) => { if (e.target === zone) zone.classList.remove('dragover'); });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            const files = e.dataTransfer?.files;
            if (input && files && files.length) {
                const dt = new DataTransfer();
                dt.items.add(files[0]);
                input.files = dt.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        input?.addEventListener('change', updateFromInput);
        updateFromInput();
    });
})();

(function initLanguageSelects() {
    document.querySelectorAll('[data-lang-select]').forEach(select => {
        select.addEventListener('change', () => {
            const url = new URL(window.location.href);
            url.searchParams.set('lang', select.value);
            window.location.href = url.toString();
        });
    });
})();

(function initThemePickers() {
    const defaultMenuRoot = document.querySelector('.menu-page');
    const applyTheme = (target, value) => {
        const classes = [...target.classList].filter(c => !c.startsWith('theme-') && !c.startsWith('menu-theme-'));
        if (value) classes.push(`menu-theme-${value}`);
        target.className = classes.join(' ').trim();
    };
    document.querySelectorAll('[data-theme-picker]').forEach(select => {
        const targetSelector = select.dataset.themeTarget;
        const target = targetSelector ? document.querySelector(targetSelector) : defaultMenuRoot;
        if (!target) return;
        const initial = select.value || select.dataset.defaultTheme;
        const existingTheme = [...target.classList].find(cls => cls.startsWith('theme-'));
        if (!existingTheme && initial) {
            applyTheme(target, initial);
        }
        select.addEventListener('change', () => applyTheme(target, select.value || existingTheme || initial || 'classic'));
    });
})();

(function initSmoothScroll() {
    const categoryNav = document.querySelector('.category-nav');
    const searchBar = document.querySelector('.search-bar');
    const mobileQuery = window.matchMedia('(max-width: 720px)');
    let navSpacer = null;
    let navInitialTop = categoryNav ? categoryNav.getBoundingClientRect().top + window.scrollY : 0;
    let suppressUnpinUntil = 0;

    const isNavSticky = () => {
        if (!categoryNav) return false;
        const position = window.getComputedStyle(categoryNav).position;
        return categoryNav.classList.contains('is-fixed') || position === 'sticky' || position === 'fixed';
    };

    const getStickyOffset = () => {
        let offset = 0;
        if (isNavSticky()) {
            offset += categoryNav.getBoundingClientRect().height;
        }
        return offset + 6;
    };

    const scrollToAnchor = (el) => {
        if (!el) return;
        suppressUnpinUntil = Date.now() + 800;
        const align = (behavior = 'auto') => {
            const offset = getStickyOffset();
            const targetTop = el.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top: Math.max(targetTop, 0), behavior });
        };
        align('smooth');
        [160, 320].forEach((delay) => setTimeout(() => align('auto'), delay));
    };

    const setInitialTop = () => {
        if (!categoryNav || categoryNav.classList.contains('is-fixed')) return;
        navInitialTop = categoryNav.getBoundingClientRect().top + window.scrollY;
    };

    const refreshSpacerHeight = () => {
        if (navSpacer && categoryNav) {
            navSpacer.style.height = `${categoryNav.offsetHeight}px`;
        }
    };

    const pinNavOnMobile = () => {
        if (!categoryNav || !mobileQuery.matches || categoryNav.classList.contains('is-fixed')) return;
        setInitialTop();
        if (!navSpacer) {
            navSpacer = document.createElement('div');
            navSpacer.className = 'category-nav-spacer';
        }
        navSpacer.style.height = `${categoryNav.offsetHeight}px`;
        if (!navSpacer.isConnected) {
            categoryNav.after(navSpacer);
        }
        categoryNav.classList.add('is-fixed');
        refreshSpacerHeight();
    };

    const unpinNav = () => {
        if (!categoryNav) return;
        categoryNav.classList.remove('is-fixed');
        if (navSpacer?.parentNode) {
            navSpacer.parentNode.removeChild(navSpacer);
        }
        navSpacer = null;
        setInitialTop();
    };

    mobileQuery.addEventListener('change', (event) => {
        if (event.matches) {
            setInitialTop();
            refreshSpacerHeight();
        } else {
            unpinNav();
        }
    });
    window.addEventListener('resize', () => {
        refreshSpacerHeight();
        setInitialTop();
    });

    const handleScroll = () => {
        if (!categoryNav || !mobileQuery.matches) return;
        if (Date.now() < suppressUnpinUntil) return;
        if (categoryNav.classList.contains('is-fixed')) {
            const threshold = Math.max(navInitialTop - 10, 0);
            if (window.scrollY <= 2 || window.scrollY <= threshold) {
                unpinNav();
            }
        } else {
            setInitialTop();
        }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    document.querySelectorAll('[data-scroll-to]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-scroll-to');
            if (!id) return;
            const target = document.getElementById(id);
            if (!target) return;
            const trigger = target.querySelector('[data-acc-toggle]');
            if (mobileQuery.matches) {
                pinNavOnMobile();
            }
            if (trigger) {
                if (typeof window.openAccordionExclusive === 'function') {
                    window.openAccordionExclusive(trigger);
                } else if (!trigger.classList.contains('open')) {
                    trigger.click();
                }
                requestAnimationFrame(() => {
                    scrollToAnchor(trigger);
                    setTimeout(() => scrollToAnchor(trigger), 180);
                });
            } else {
                requestAnimationFrame(() => {
                    scrollToAnchor(target);
                    setTimeout(() => scrollToAnchor(target), 180);
                });
            }
        });
    });
})();

(function initSidebarToggle() {
    const toggle = document.querySelector('[data-sidebar-toggle]');
    const sidebar = document.querySelector('[data-dashboard-sidebar]');
    if (!toggle || !sidebar) return;
    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar-open');
    });
})();
