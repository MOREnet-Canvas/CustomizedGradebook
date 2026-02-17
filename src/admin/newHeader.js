import { createBreadcrumbs, createGridRow, createButton, createDropdown, createContentBox } from "./canvasFormHelpers.js";
import { createElement } from "./domHelpers.js";
import { getAccountId } from "./pageDetection.js";

export function renderHeader(container) {
    const { container: breadcrumbs } = createBreadcrumbs({
        items: [
            { icon: "icon-home", text: "Theme Editor", href: "#" },
            { text: "Release & Configuration Manager", href: "#" },
        ],
        showToggle: false,
    });

    const title = createElement("h1", { text: "Release & Configuration Manager" });

    const tagline = createElement("div", {
        text: "by MOREnet",
        style: {
            fontSize: "16px",
            color: "#888",
            marginTop: "-8px",
            marginBottom: "12px",
            fontWeight: "400",
        },
    });

    const accountLine = createElement("div", {
        attrs: { class: "ic-Label" },
        html: `
      Account ID: <strong>${getAccountId() || "unknown"}</strong>
      <span class="cg-tip" title="This dashboard is operating at the root account level.">&#9432;</span>
    `,
    });

    const envStatus = createElement("div", {
        attrs: { class: "ic-Label" },
        html: `Environment: <strong>Dev</strong>
          <span class="cg-tip" title="Dev channel may include unstable features.">&#9432;</span>`,
    });

    const scopeStatus = createElement("div", {
        attrs: { class: "ic-Label" },
        html: `Scope: <strong>Filtered</strong>`,
    });

    const overrideStatus = createElement("div", {
        attrs: { class: "ic-Label" },
        html: `Final Grade Override: <strong>Enabled</strong>`,
    });

    const generateBtn = createButton({
        text: "Generate Loader",
        type: "primary",
        onClick: () => {
            // Later: call loader generation
        },
    });

    const { container: exportDropdown } = createDropdown({
        triggerText: "Export",
        items: [
            { text: "Download Loader File", onClick: () => {} },
            { text: "Copy Loader Code", onClick: () => {} },
        ],
    });

    // ✅ prevent the trigger anchor from jumping the page
    exportDropdown.querySelector("a.al-trigger")?.addEventListener("click", (e) => e.preventDefault());

    const { row: statusRow } = createGridRow({
        columns: [
            { md: 2, content: envStatus },
            { md: 2, content: scopeStatus },
            { md: 3, content: overrideStatus },
            { md: 2 }, // spacer
            { md: 2, content: generateBtn },
            { md: 1, content: exportDropdown },
        ],
    });

    const statusBox = createContentBox({ content: statusRow, mini: true });

    // Canvas-native order: crumbs → title → tagline → context → controls
    container.appendChild(breadcrumbs);
    container.appendChild(title);
    container.appendChild(tagline);
    container.appendChild(accountLine);
    container.appendChild(statusBox);
}