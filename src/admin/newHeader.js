// headerToolbar.js
import { createButton } from "./canvasFormHelpers.js";
import { createElement } from "./domHelpers.js";

function scrollToId(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Navigate to a panel by ID, opening it and closing all others
 * @param {string} targetId - ID of the panel to navigate to
 */
function navigateToPanel(targetId) {
    const targetPanel = document.getElementById(targetId);
    if (!targetPanel) {
        console.warn(`[Header] Panel with ID "${targetId}" not found`);
        return;
    }

    // Get all panels
    const allPanels = document.querySelectorAll('.cg-panel');

    // Close all panels and open the target panel
    allPanels.forEach(panel => {
        const isTarget = panel.id === targetId;
        const toggle = panel.querySelector('.cg-panel__header-toggle');

        if (isTarget) {
            // Open target panel
            panel.classList.remove('cg-panel--collapsed');
            if (toggle) {
                toggle.className = 'icon-mini-arrow-down cg-panel__header-toggle';
            }
        } else {
            // Close other panels
            panel.classList.add('cg-panel--collapsed');
            if (toggle) {
                toggle.className = 'icon-mini-arrow-right cg-panel__header-toggle';
            }
        }
    });

    // Scroll to the target panel
    targetPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function renderHeader(container) {
    const bar = createElement("div", { attrs: { class: "cg-toolbar" } });
    const inner = createElement("div", { attrs: { class: "cg-toolbar__inner" } });

    const left = createElement("div", { attrs: { class: "cg-toolbar__left" } });


    const titleBlock = createElement("div", {
        attrs: { class: "cg-toolbar__titleBlock" }
    });

    const title = createElement("div", {
        attrs: { class: "cg-toolbar__title" },
        text: "Release & Configuration Manager",
    });

    const subtitle = createElement("div", {
        attrs: { class: "cg-toolbar__subtitle" },
        text: "by MOREnet",
    });

    titleBlock.appendChild(title);
    titleBlock.appendChild(subtitle);


    const nav = createElement("div", { attrs: { class: "cg-toolbar__nav" } });

    const navItems = [
        ["Summary", "cg-section-summary"],
        ["Account Filter", "cg-section-account-filter"],
        ["Settings", "cg-section-settings"],
        ["Loader Builder", "cg-section-loader"],
    ];

    navItems.forEach(([label, id]) => {
        const btn = createButton({
            text: label,
            type: "secondary",

            onClick: () => navigateToPanel(id),
            attrs: { class: "Button Button--secondary Button--small" },
        });
        nav.appendChild(btn);
    });

    left.appendChild(titleBlock);
    left.appendChild(nav);





    inner.appendChild(left);

    bar.appendChild(inner);
    container.appendChild(bar);
}