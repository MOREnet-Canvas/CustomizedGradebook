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

    left.appendChild(titleBlock);
    left.appendChild(nav);





    inner.appendChild(left);

    bar.appendChild(inner);
    container.appendChild(bar);
}