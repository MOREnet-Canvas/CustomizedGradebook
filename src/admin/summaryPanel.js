import { createCollapsiblePanel, createTable } from "./canvasFormHelpers.js";
import {
    getAccountId,
    getInstalledThemeJsUrl,
    getInstalledThemeCssUrl,
    getBrandConfigMetadata
} from "./pageDetection.js";

export function renderSummaryPanel(container, ctx) {
    const { panel, body } = createCollapsiblePanel("Summary", true);

    const accountId = getAccountId();
    const jsUrl = getInstalledThemeJsUrl();
    const cssUrl = getInstalledThemeCssUrl();
    const brandMeta = getBrandConfigMetadata();

    const config = ctx?.getConfig?.() || {};

    const rows = [
        ["Account ID", accountId || "Unknown"],
        ["JS Override Installed", jsUrl ? "Yes" : "No"],
        ["CSS Override Installed", cssUrl ? "Yes" : "No"],
        ["Brand Created", brandMeta?.created_at || "Unknown"],
        ["Account Filter Enabled", config.ENABLE_ACCOUNT_FILTER ? "Yes" : "No"],
        ["Default Grading Scheme", config.DEFAULT_GRADING_SCHEME_ID || "None"],
    ];

    const { table } = createTable({
        headers: ["Setting", "Value"],
        rows,
        hover: false,
        striped: true
    });

    body.appendChild(table);
    container.appendChild(panel);
}