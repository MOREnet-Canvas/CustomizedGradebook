import { createCollapsiblePanel, createTable } from "./canvasFormHelpers.js";
import {
    getAccountId,
    getInstalledThemeJsUrl,
    getInstalledThemeCssUrl
} from "./pageDetection.js";
import {logger} from "../utils/logger.js";

const ACCOUNTS_CACHE_KEY = "cg_admin_accounts_cache";

export function renderSummaryPanel(container, ctx) {
    const { panel, body } = createCollapsiblePanel("Summary", false, "cg-section-summary");

    const accountId = getAccountId();
    const jsUrl = getInstalledThemeJsUrl();
    const cssUrl = getInstalledThemeCssUrl();

    // Build rows synchronously with placeholders
    const rows = [
        ["Installed on Account", installedAccountPlaceholder(accountId)],
        ["Account Filter", formatAccountFilter(getConfigNow(ctx))],
        ["Theme JS", formatThemeAsset(jsUrl, "Theme JavaScript")],
        ["Theme CSS", formatThemeAsset(cssUrl, "Theme CSS")],
        ["Grading Scheme", formatDefaultGradingScheme(getConfigNow(ctx))],
        ["Custom Grade Status", formatCustomStatus(getConfigNow(ctx))],
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
    // Use double requestAnimationFrame to ensure DOM is fully painted
    // First rAF: DOM is in render tree
    // Second rAF: DOM is fully painted and visible
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            logger.debug('[SummaryPanel] Hydrating installed account cell...');
            void hydrateInstalledAccountCell(accountId);
            logger.debug('[SummaryPanel] Hydrating account filter cell...');
            void hydrateAccountFilterCell(ctx);
            logger.debug('[SummaryPanel] Hydrating custom status cell...');
            void hydrateCustomStatusCell(ctx);
            logger.debug('[SummaryPanel] Hydrating dynamic config cells...');
            void hydrateDynamicConfigCells(ctx);
        });
    });
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
   Account Filter hydration
---------------------------- */

async function hydrateAccountFilterCell(ctx) {
    const el = document.querySelector("[data-cg-account-filter]");
    if (!el) {
        console.log("[SummaryPanel] Hydration: Element not found, returning early");
        return; // already hydrated
    }

    console.log("[SummaryPanel] Hydration: Starting polling for cache and config");

    // Poll until BOTH cache AND config are ready
    const maxAttempts = 120; // 120 attempts * 250ms = 30 seconds max wait
    const pollInterval = 250; // 250ms between checks

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const cacheMap = getAccountsCacheMap();
        const allAccounts = cacheMap ? Array.from(cacheMap.values()) : [];
        const cacheReady = cacheMap && allAccounts.length > 0;

        // Check if config is populated (Loader Generator has run)
        const config = window.CG_MANAGED?.config || {};
        const configReady = config.hasOwnProperty('ENABLE_ACCOUNT_FILTER');

        // Log every 10th attempt (every 2.5 seconds)
        if (attempt % 10 === 0 || attempt === 1) {
            console.log(`[SummaryPanel] Hydration attempt ${attempt}/${maxAttempts}: cache=${cacheReady} (${allAccounts.length} accounts), config=${configReady}`);
        }

        // Wait for both cache and config to be ready
        if (cacheReady && configReady) {
            console.log(`[SummaryPanel] Hydration: Both ready at attempt ${attempt}, updating element`);

            const enabled = !!config.ENABLE_ACCOUNT_FILTER;
            const ids = Array.isArray(config.ALLOWED_ACCOUNT_IDS)
                ? config.ALLOWED_ACCOUNT_IDS
                : [];

            if (!enabled) {
                el.textContent = "Off (runs on all accounts)";
                console.log("[SummaryPanel] Hydration: Set to 'Off'");
                return;
            }

            if (!ids.length) {
                el.textContent = "On (no accounts selected)";
                console.log("[SummaryPanel] Hydration: Set to 'On (no accounts selected)'");
                return;
            }

            const rootId = ids[0];
            const rootName = cacheMap?.get(String(rootId))?.name || `ID: ${rootId}`;

            const subCount = Math.max(0, ids.length - 1);
            const notIncluded = Math.max(0, allAccounts.length - ids.length);

            el.innerHTML = `
                On — ${escapeHtml(rootName)} (ID: ${escapeHtml(rootId)})<br>
                · ${subCount} sub-account${subCount === 1 ? "" : "s"} selected<br>
                · ${notIncluded} account${notIncluded === 1 ? "" : "s"} not included
            `;
            console.log(`[SummaryPanel] Hydration: Updated with root=${rootName}, sub=${subCount}, notIncluded=${notIncluded}`);
            return;
        }

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Timeout - check what's missing
    console.log("[SummaryPanel] Hydration: Timeout reached after 30 seconds");
    const cacheMap = getAccountsCacheMap();
    const allAccounts = cacheMap ? Array.from(cacheMap.values()) : [];
    const cacheReady = cacheMap && allAccounts.length > 0;
    const config = window.CG_MANAGED?.config || {};
    const configReady = config.hasOwnProperty('ENABLE_ACCOUNT_FILTER');

    console.log(`[SummaryPanel] Hydration timeout: cache=${cacheReady} (${allAccounts.length} accounts), config=${configReady}`);
    console.log("[SummaryPanel] Config object:", config);

    if (cacheReady && !configReady) {
        // Cache ready but config never populated - error
        el.textContent = "Error: Configuration not loaded";
        el.style.color = "#cf1322";
        console.log("[SummaryPanel] Hydration: Failed - config not loaded");
    } else {
        // Cache never populated
        el.textContent = "Failed to load account information";
        el.style.color = "#cf1322";
        console.log("[SummaryPanel] Hydration: Failed - cache not loaded");
    }
}

/* ---------------------------
   Custom Status hydration
---------------------------- */

async function hydrateCustomStatusCell(ctx) {
    const el = document.querySelector("[data-cg-custom-status]");
    if (!el) return; // already has name

    const config = getConfigNow(ctx);
    const statusId = config.DEFAULT_CUSTOM_STATUS_ID;

    if (!statusId) {
        el.textContent = "Not enabled";
        return;
    }

    // Poll for custom statuses to be loaded by Custom Grade Status Panel
    // The panel stores statuses in window.cgCustomStatuses after fetching
    const maxAttempts = 60; // 60 attempts * 250ms = 15 seconds max wait
    const pollInterval = 250; // 250ms between checks

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Check if Custom Grade Status Panel has populated the statuses
        const statuses = window.cgCustomStatuses;

        if (statuses && Array.isArray(statuses) && statuses.length > 0) {
            // Find the status by ID
            const status = statuses.find(s => s._id === statusId);

            if (status) {
                // Update the cell with the actual name
                el.textContent = `${status.name} (ID: ${statusId})`;
                logger.debug(`[SummaryPanel] Custom status hydrated: ${status.name} (ID: ${statusId})`);

                // Also save the name to config for future renders
                ctx.updateConfig({ DEFAULT_CUSTOM_STATUS_NAME: status.name });
                return;
            }
        }

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Timeout - status not found
    logger.warn(`[SummaryPanel] Custom status hydration timeout for ID: ${statusId}`);
    el.innerHTML = `<span style="color:#cf1322;">Unknown (ID: ${escapeHtml(statusId)})</span>`;
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

    // Extract filename from URL and decode URL encoding (handles double-encoding)
    const encodedFile = url.split("?")[0].split("/").pop();
    let file = decodeURIComponent(encodedFile);

    // Decode again to handle double-encoding (e.g., %2528 → %28 → "(")
    try {
        file = decodeURIComponent(file);
    } catch (e) {
        // If second decode fails, use the first decoded version
    }

    const dateMatch = file?.match(/\d{4}-\d{2}-\d{2}/);
    const date = dateMatch ? dateMatch[0] : null;

    const isJs = file?.toLowerCase().endsWith(".js");

    // Build metadata lines (excluding filename since it's now the link text)
    const metaLines = [
        isJs ? getFriendlyChannelLabel() : null,
        date ? `Build: ${date}` : null
    ].filter(Boolean);

    return {
        html: `
            <div>
                <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">
                    ${escapeHtml(file || label)}
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

    return `${title} (ID: ${id})`;
}

/* ---------------------------
   Custom Status
---------------------------- */

function formatCustomStatus(config) {
    const enabled = config.ENABLE_GRADE_CUSTOM_STATUS;
    const statusId = config.DEFAULT_CUSTOM_STATUS_ID;
    const statusName = config.DEFAULT_CUSTOM_STATUS_NAME;

    if (!enabled) return "Not enabled";
    if (!statusId) return "Not enabled";

    // If name not available, return placeholder with data hook for hydration
    if (!statusName) {
        return {
            html: `<div data-cg-custom-status>ID: ${escapeHtml(statusId)} <span style="color:#999;">(Loading...)</span></div>`
        };
    }

    return `${statusName} (ID: ${statusId})`;
}

/**
 * Format boolean value as Yes/No
 * @param {boolean} value - Boolean value
 * @returns {string} "Yes" or "No"
 */
function formatBoolean(value) {
    return value ? "Yes" : "No";
}

/* ---------------------------
   Account Filter
---------------------------- */

function formatAccountFilter(config) {
    // Always return placeholder during initial render
    // Config might not be populated yet (Loader Generator runs last)
    return {
        html: `
            <div data-cg-account-filter>
                Loading account information…
            </div>
        `
    };
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