import { createCollapsiblePanel, createTable } from "./canvasFormHelpers.js";
import {
    getAccountId,
    getInstalledThemeJsUrl,
    getInstalledThemeCssUrl
} from "./pageDetection.js";

const ACCOUNTS_CACHE_KEY = "cg_admin_accounts_cache";

export async function renderSummaryPanel(container, ctx) {
    const { panel, body } = createCollapsiblePanel("Summary", true);

    const accountId = getAccountId();
    const jsUrl = getInstalledThemeJsUrl();
    const cssUrl = getInstalledThemeCssUrl();

    const config = ctx?.getConfig?.() || window.CG_MANAGED?.config || {};

    const rows = [
        ["Installed on account", await buildInstalledAccountCell(accountId)],
        ["Theme JS", formatThemeAsset(jsUrl, "Theme JavaScript", config)],
        ["Theme CSS", formatThemeAsset(cssUrl, "Theme CSS", config)],
        ["Default grading scheme", formatDefaultGradingScheme(config)],
        ["Account filter", formatAccountFilter(config)],
    ];

    const { table } = createTable({
        headers: ["Setting", "Value"],
        rows,
        hover: false,
        striped: true
    });

    // Reduce spacing without custom CSS
    table.classList.add("ic-Table--condensed");

    body.appendChild(table);
    container.appendChild(panel);
}

/* ---------------------------
   Installed Account
---------------------------- */

async function buildInstalledAccountCell(accountId) {
    if (!accountId) return "Unknown";

    const cacheMap = getAccountsCacheMap();
    const cached = cacheMap?.get(String(accountId));
    const name = cached?.name || await fetchAccountName(accountId) || "Unknown";

    return {
        html: `
            <div>
                <strong>${escapeHtml(name)}</strong> (ID: ${escapeHtml(accountId)})
                <div style="margin-top:4px; color:#6b7785; font-size:12px;">
                    This is the account where the theme script is installed.
                </div>
            </div>
        `
    };
}

/* ---------------------------
   Theme JS / CSS
---------------------------- */

function formatThemeAsset(url, label, config) {
    if (!url) return "Not installed";

    const file = url.split("?")[0].split("/").pop();
    const dateMatch = file?.match(/\d{4}-\d{2}-\d{2}/);
    const date = dateMatch ? dateMatch[0] : null;

    const channel = config.channel || config.CHANNEL || null;
    const version = config.version || config.VERSION || config.CG_VERSION || null;

    const metaLines = [
        [channel, version].filter(Boolean).join(" · "),
        date ? `Build: ${date}` : null,
        file ? `File: ${file}` : null
    ].filter(Boolean);

    return {
        html: `
            <div>
                <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">
                    ${escapeHtml(label)}
                </a>
                ${
            metaLines.length
                ? `<div style="margin-top:4px; color:#6b7785; font-size:12px;">
                              ${metaLines.map(escapeHtml).join("<br>")}
                           </div>`
                : ""
        }
            </div>
        `
    };
}

/* ---------------------------
   Grading Scheme
---------------------------- */

function formatDefaultGradingScheme(config) {
    const id = config.DEFAULT_GRADING_SCHEME_ID;
    const scheme = config.DEFAULT_GRADING_SCHEME;

    if (!id) return "None";

    const title = scheme?.title || scheme?.name || "Unknown";

    return `${id} — ${title}`;
}

/* ---------------------------
   Account Filter
---------------------------- */

function formatAccountFilter(config) {
    const enabled = !!config.ENABLE_ACCOUNT_FILTER;
    const ids = Array.isArray(config.ALLOWED_ACCOUNT_IDS)
        ? config.ALLOWED_ACCOUNT_IDS
        : [];

    if (!enabled) return "Off (runs on all accounts)";
    if (!ids.length) return "On (no accounts selected)";

    const cacheMap = getAccountsCacheMap();

    const first3 = ids.slice(0, 3).map(id => {
        const acct = cacheMap?.get(String(id));
        return acct?.name
            ? `${acct.name} (ID: ${id})`
            : `ID: ${id}`;
    });

    const more = ids.length > 3
        ? ` +${ids.length - 3} more`
        : "";

    return `On — ${first3.join(", ")}${more}`;
}

/* ---------------------------
   Account Cache Helpers
---------------------------- */

function getAccountsCacheMap() {
    try {
        const raw = sessionStorage.getItem(ACCOUNTS_CACHE_KEY);
        if (!raw) return null;

        const { data } = JSON.parse(raw);
        if (!Array.isArray(data)) return null;

        const map = new Map();
        data.forEach(a => map.set(String(a.id), a));
        return map;
    } catch {
        return null;
    }
}

async function fetchAccountName(accountId) {
    try {
        const r = await fetch(`/api/v1/accounts/${accountId}`, {
            credentials: "same-origin",
            headers: { Accept: "application/json" }
        });
        if (!r.ok) return null;
        const acct = await r.json();
        return acct?.name || null;
    } catch {
        return null;
    }
}

/* ---------------------------
   Utility
---------------------------- */

function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}