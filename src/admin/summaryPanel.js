import { createCollapsiblePanel, createTable } from "./canvasFormHelpers.js";
import {
    getAccountId,
    getInstalledThemeJsUrl,
    getInstalledThemeCssUrl
} from "./pageDetection.js";

const ACCOUNTS_CACHE_KEY = "cg_admin_accounts_cache";

export function renderSummaryPanel(container, ctx) {
    const { panel, body } = createCollapsiblePanel("Summary", false);

    const accountId = getAccountId();
    const jsUrl = getInstalledThemeJsUrl();
    const cssUrl = getInstalledThemeCssUrl();

    // Build rows synchronously with placeholders
    const rows = [
        ["Installed on account", installedAccountPlaceholder(accountId)],
        ["Theme JS", formatThemeAsset(jsUrl, "Theme JavaScript")],
        ["Theme CSS", formatThemeAsset(cssUrl, "Theme CSS")],
        ["Default grading scheme", formatDefaultGradingScheme(getConfigNow(ctx))],
        ["Account filter", formatAccountFilter(getConfigNow(ctx))],
    ];

    const { table } = createTable({
        headers: ["Setting", "Value"],
        rows,
        hover: false,
        striped: true
    });

    table.classList.add("ic-Table--condensed");

    body.appendChild(table);
    container.appendChild(panel);

    // Hydrate async bits AFTER render so ordering never changes
    void hydrateInstalledAccountCell(accountId);
    void hydrateDynamicConfigCells(ctx);
}

/* ---------------------------
   Config access (safe)
---------------------------- */

function getConfigNow(ctx) {
    return ctx?.getConfig?.() || window.CG_MANAGED?.config || {};
}

/* ---------------------------
   Installed account hydration
---------------------------- */

function installedAccountPlaceholder(accountId) {
    if (!accountId) return "Unknown";

    // If cache has name, show immediately
    const cacheMap = getAccountsCacheMap();
    const cached = cacheMap?.get(String(accountId));
    if (cached?.name) {
        return {
            html: `
              <div>
                <strong>${escapeHtml(cached.name)}</strong> (ID: ${escapeHtml(accountId)})
                <div style="margin-top:4px; color:#6b7785; font-size:12px;">
                  This is the account where the theme script is installed.
                </div>
              </div>
            `
        };
    }

    // Otherwise placeholder + data hook for later update
    return {
        html: `
          <div data-cg-installed-account>
            <strong>ID: ${escapeHtml(accountId)}</strong>
            <div style="margin-top:4px; color:#6b7785; font-size:12px;">
              Loading account name…
            </div>
          </div>
        `
    };
}

async function hydrateInstalledAccountCell(accountId) {
    if (!accountId) return;

    const el = document.querySelector("[data-cg-installed-account]");
    if (!el) return; // already hydrated from cache

    const cacheMap = getAccountsCacheMap();
    const cached = cacheMap?.get(String(accountId));
    const name = cached?.name || await fetchAccountName(accountId) || "Unknown";

    el.innerHTML = `
      <strong>${escapeHtml(name)}</strong> (ID: ${escapeHtml(accountId)})
      <div style="margin-top:4px; color:#6b7785; font-size:12px;">
        This is the account where the theme script is installed.
      </div>
    `;
}

/* ---------------------------
   Dynamic config hydration
   (optional but recommended)
---------------------------- */

function hydrateDynamicConfigCells(ctx) {
    // If config isn't ready yet at first render, refresh those cells later.
    // You can call this again when settings change or after loader generation.

    // If you want, we can add data hooks to those cells too.
    // For now, simplest is: no-op, or re-render table later.
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

function formatThemeAsset(url, label) {
    if (!url) return "Not installed";

    const file = url.split("?")[0].split("/").pop();
    const dateMatch = file?.match(/\d{4}-\d{2}-\d{2}/);
    const date = dateMatch ? dateMatch[0] : null;

    const isJs = file?.toLowerCase().endsWith(".js");

    const metaLines = [
        isJs ? getFriendlyChannelLabel() : null,
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

    return `${title} (ID:${id})`;
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

    const cacheMap = getAccountsCacheMap();
    const allAccounts = cacheMap ? Array.from(cacheMap.values()) : [];

    if (!ids.length) return "On (no accounts selected)";

    const rootId = ids[0];
    const rootName = cacheMap?.get(String(rootId))?.name || `ID: ${rootId}`;

    const subCount = Math.max(0, ids.length - 1);
    const notIncluded = Math.max(0, allAccounts.length - ids.length);

    return `
        On — ${rootName} (ID: ${rootId})
        · ${subCount} sub-account${subCount === 1 ? "" : "s"} selected
        · ${notIncluded} account${notIncluded === 1 ? "" : "s"} not included
    `;
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
function getReleaseInfoFromRuntime() {
    const release = window.CG_MANAGED?.release;
    if (!release) return null;

    const { channel, version, versionTrack } = release;

    if (channel === "auto-patch" && versionTrack) {
        return `Auto-Patch (${versionTrack})`;
    }

    if (channel && version) {
        return `${channel.toUpperCase()} · ${version}`;
    }

    return null;
}

function getFriendlyChannelLabel() {
    const ch = window.CG_MANAGED?.release?.channel;
    if (ch === "dev") return "Development";
    if (ch === "prod" || ch === "production") return "Production";
    if (ch === "auto-patch") {
        return "Auto-patch (Large version updates will still need to be manually reloaded)";
    }
    return null;
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