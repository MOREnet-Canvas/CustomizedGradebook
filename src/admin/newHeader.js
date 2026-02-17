// headerToolbar.js
import { createButton } from "./canvasFormHelpers.js";
import { createElement } from "./domHelpers.js";

function scrollToId(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function renderHeader(container) {
    const bar = createElement("div", { attrs: { class: "cg-toolbar" } });
    const inner = createElement("div", { attrs: { class: "cg-toolbar__inner" } });

    const left = createElement("div", { attrs: { class: "cg-toolbar__left" } });
    const right = createElement("div", { attrs: { class: "cg-toolbar__right" } });

    const title = createElement("div", {
        attrs: { class: "cg-toolbar__title" },
        text: "Release & Configuration Manager",
    });

    const nav = createElement("div", { attrs: { class: "cg-toolbar__nav" } });

    const navItems = [
        ["Summary", "cg-section-summary"],
        ["Installed Theme", "cg-section-theme-status"],
        ["Account Filter", "cg-section-account-filter"],
        ["Settings", "cg-section-settings"],
        ["Loader Builder", "cg-section-loader"],
    ];

    navItems.forEach(([label, id]) => {
        const btn = createButton({
            text: label,
            type: "secondary",

            onClick: () => scrollToId(id),
            attrs: { class: "Button Button--secondary Button--small" },
        });
        nav.appendChild(btn);
    });

    left.appendChild(title);
    left.appendChild(nav);

    const generateBtn = createButton({
        text: "Generate",
        type: "primary",
        onClick: () => window.dispatchEvent(new CustomEvent("cg:generate-loader")),
    });

    const downloadBtn = createButton({
        text: "Download",
        type: "secondary",
        attrs: { class: "Button Button--secondary Button--small" },

        onClick: () => window.dispatchEvent(new CustomEvent("cg:download-loader")),
    });

    const copyBtn = createButton({
        text: "Copy",
        type: "secondary",
        attrs: { class: "Button Button--secondary Button--small" },

        onClick: () => window.dispatchEvent(new CustomEvent("cg:copy-loader")),
    });

    right.appendChild(generateBtn);
    right.appendChild(downloadBtn);
    right.appendChild(copyBtn);

    inner.appendChild(left);
    inner.appendChild(right);
    bar.appendChild(inner);
    container.appendChild(bar);
}