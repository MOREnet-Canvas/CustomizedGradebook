// src/MasteryOutlook/MasteryOutlookView.js
/**
 * Mastery Outlook — main view
 *
 * Renders in two states:
 *   1. Default (no cache) — outcome names from Canvas, NE placeholders,
 *      prominent refresh prompt
 *   2. Loaded (cache exists) — full Power Law data, distribution bars,
 *      intervention sidebar
 *
 * Entry point: renderMasteryOutlook()
 */

import { logger } from '../utils/logger.js';
import { injectStyles } from '../ui/styles.js';
import { PL_OUTLOOK_CSS } from './plOutlookStyles.js';
import { readMasteryOutlookCache } from './masteryOutlookCacheService.js';
import { startPolling, stopPolling, startVisibilityListener, stopVisibilityListener } from './masteryOutlookPollingService.js';
import { getThreshold, saveThreshold } from './thresholdStorage.js';
import { getColorScheme, saveColorScheme } from './colorSchemeStorage.js';
import { fetchCourseStudents } from '../services/enrollmentService.js';
import { findMasteryDashboardPageUrl, getPage } from '../services/pageService.js';
import { VIEWS, getView } from './viewRegistry.js';
import {
    isRegularOutcome,
    renderOutcomeSyncDefault,
    buildCrossOutcomeExceptionsView,
} from './outcomeSyncView.js';

// Current color scheme (set on init). Read by buildViewContext so views
// always see the live selection.
let currentColorScheme = 'soft';

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * @param {Object} options
 * @param {HTMLElement} options.containerEl  - Root element to render into
 * @param {string|number} options.courseId
 * @param {Object} options.apiClient
 * @param {Function} options.onRefresh       - Async callback that triggers
 *                                            recompute and returns fresh cache
 */
export async function renderMasteryOutlook({ containerEl, courseId, apiClient, onRefresh }) {
    injectStyles(PL_OUTLOOK_CSS, 'pl-outlook-styles');

    containerEl.innerHTML = '';
    // Apply .mo-shell so all scoped CSS rules resolve correctly
    containerEl.classList.add('mo-shell');

    // Shell renders immediately — no waiting on cache or outcomes fetch
    const shell = buildShell(containerEl);

    // Try to load cache first
    let cache = await tryLoadCache(courseId, apiClient);

    if (!cache) {
        // No cache yet — pull outcome names from Canvas for the default state
        renderDefaultState(shell, courseId, apiClient, onRefresh);
    } else {
        renderLoadedState(shell, cache, courseId, apiClient, onRefresh);
    }
}

// ─── Shell ───────────────────────────────────────────────────────────────────

function buildShell(containerEl) {
    containerEl.innerHTML = `
        <div id="od-header" class="od-header">
            <div>
                <div id="od-title" class="od-title">Mastery Outlook</div>
                <div id="od-subtitle">Power Law predictions</div>
            </div>
            <div class="od-header-actions">
                <span id="od-last-updated"></span>
                <button id="od-exceptions-btn" class="od-btn-exceptions">
                    View exceptions
                </button>
                <button id="od-refresh-btn" class="od-btn-refresh">
                    Refresh Data
                </button>
            </div>
        </div>

        <!-- 4c: Refresh banner — shown when background poll detects new grading activity -->
        <div id="od-refresh-banner" class="od-refresh-banner">
            <span class="od-refresh-banner-text">
                ℹ New scores have been graded — your data may be out of date.
            </span>
            <button id="od-banner-refresh-btn" class="od-btn-banner-refresh">
                Refresh now
            </button>
        </div>

        <!-- 3e: Cross-outcome exceptions panel (hidden until "View exceptions" clicked) -->
        <div id="od-exceptions-panel" class="od-exceptions-panel"></div>

        <div id="od-metrics" class="od-metrics"></div>

        <div class="od-controls-row">
            <div id="od-threshold-control" class="od-threshold-control">
                <span class="od-control-label">Re-teach threshold:</span>
                <input type="range" id="od-threshold-slider" class="od-threshold-slider"
                       min="1.5" max="3.5" step="0.1" value="2.2">
                <span id="od-threshold-value" class="od-threshold-value">2.2</span>
            </div>

            <div id="od-color-scheme-control" class="od-color-scheme-control">
                <span class="od-control-label">Colors:</span>
                <div class="od-color-toggle">
                    <button id="od-color-soft" class="od-color-btn" data-scheme="soft">
                        Soft
                    </button>
                    <button id="od-color-canvas" class="od-color-btn" data-scheme="canvas">
                        Canvas
                    </button>
                </div>
            </div>
        </div>

        <div id="od-body" class="od-body">
            <div id="od-outcomes-col">
                <!-- Tab bar + view containers are generated from VIEWS registry -->
                <div id="od-tab-bar" class="od-tab-bar">
                    ${VIEWS.map(v => `
                        <button class="od-tab" data-tab="${v.id}">${v.label}</button>
                    `).join('')}
                </div>
                ${VIEWS.map(v => `
                    <div id="od-${v.id}-view" class="od-view-container" data-view-id="${v.id}"></div>
                `).join('')}
            </div>
            <div id="od-sidebar"></div>
        </div>

        <div id="od-status-bar" class="od-status-bar"></div>
    `;

    // Per-view container init (e.g. outcomes view scaffolds its column
    // headers + list). Stored in a map so switchToView can iterate. Only
    // the first registered view starts visible; switchToView toggles
    // visibility once the loaded-state tab bar wires up.
    const viewContainers = {};
    VIEWS.forEach((v, i) => {
        const el = containerEl.querySelector(`#od-${v.id}-view`);
        viewContainers[v.id] = el;
        v.initContainer?.(el);
        el.style.display = i === 0 ? 'block' : 'none';
    });

    return {
        titleEl:          containerEl.querySelector('#od-title'),
        subtitleEl:       containerEl.querySelector('#od-subtitle'),
        lastUpdatedEl:    containerEl.querySelector('#od-last-updated'),
        refreshBtn:       containerEl.querySelector('#od-refresh-btn'),
        bannerEl:         containerEl.querySelector('#od-refresh-banner'),
        bannerRefreshBtn: containerEl.querySelector('#od-banner-refresh-btn'),
        exceptionsBtn:    containerEl.querySelector('#od-exceptions-btn'),
        exceptionsPanel:  containerEl.querySelector('#od-exceptions-panel'),
        thresholdSlider:  containerEl.querySelector('#od-threshold-slider'),
        thresholdValue:   containerEl.querySelector('#od-threshold-value'),
        metricsEl:        containerEl.querySelector('#od-metrics'),
        outcomesEl:       containerEl.querySelector('#od-outcomes-list'),
        sidebarEl:        containerEl.querySelector('#od-sidebar'),
        statusEl:         containerEl.querySelector('#od-status-bar'),
        tabBar:           containerEl.querySelector('#od-tab-bar'),
        viewContainers,
        // Convenience aliases for views that still reference shell.heatmapView etc.
        heatmapView:      viewContainers.heatmap,
        bodyEl:           containerEl.querySelector('#od-body'),
        colorSoftBtn:     containerEl.querySelector('#od-color-soft'),
        colorCanvasBtn:   containerEl.querySelector('#od-color-canvas'),
    };
}

// ─── Default state (no cache) ─────────────────────────────────────────────────

async function renderDefaultState(shell, courseId, apiClient, onRefresh) {
    setStatus(shell.statusEl, 'Loading outcomes…');

    renderMetricCards(shell.metricsEl, null);
    renderDefaultSidebar(shell.sidebarEl);

    // Outcome-row default state lives with the outcomes view module so it
    // owns its own markup + empty/refresh prompts.
    await renderOutcomeSyncDefault(shell, courseId, apiClient);

    setStatus(shell.statusEl, '');
    setLastUpdated(shell.lastUpdatedEl, null);

    wireRefreshButton(shell, courseId, apiClient, onRefresh);
}

// ─── Loaded state (cache exists) ─────────────────────────────────────────────

// Controller object for the currently mounted view: { id, teardown, refresh }.
// Set by switchToView; consumed by wireColorSchemeToggle / wireThresholdSlider
// to trigger a re-render in place when shared chrome state changes.
let activeViewController = null;

function renderLoadedState(shell, cache, courseId, apiClient, onRefresh) {
    // Apply design-token variants to the shell container so that
    // .mo-shell[data-density="comfortable"] and similar CSS rules resolve.
    const shellEl = shell.outcomesEl?.closest('.mo-shell');
    if (shellEl) {
        shellEl.dataset.density  = 'comfortable';
        shellEl.dataset.summary  = 'chip';
        shellEl.dataset.palette  = 'vivid';
        shellEl.dataset.emphasis = 'prosecutorial';
    }

    setLastUpdated(shell.lastUpdatedEl, cache.meta.computedAt);
    shell.subtitleEl.textContent =
        `${cache.meta.studentCount} students ·
         ${cache.meta.outcomeCount} outcomes ·
         Power Law predictions`;

    // Initialize color scheme from localStorage
    const userId = window.ENV?.current_user_id;
    if (userId) {
        currentColorScheme = getColorScheme(courseId, userId);
        logger.debug(`[MasteryOutlook] Initialized color scheme: ${currentColorScheme}`);
    }

    wireThresholdSlider(shell, cache, courseId, apiClient);
    wireColorSchemeToggle(shell, cache, courseId, apiClient);
    renderMetricCards(shell.metricsEl, cache);
    renderSidebar(shell.sidebarEl, cache);

    wireRefreshButton(shell, courseId, apiClient, onRefresh);
    // wireTabBar mounts the initial 'outcomes' view from the registry.
    wireTabBar(shell, cache, courseId, apiClient, onRefresh);

    // 3e — wire "View exceptions" button + cross-outcome panel
    wireExceptionsPanel(shell, cache);

    // 4c + 4f — banner, polling, auto-refresh toggle (Tweaks panel)
    wirePollingAndBanner(shell, cache, courseId, apiClient, onRefresh);
    wireTweaksPanel(shell.sidebarEl, courseId);
}

// ─── Polling + Refresh banner (4a–4c) ────────────────────────────────────────

const AUTO_REFRESH_KEY = (courseId) => `cg_autoRefresh_${courseId}`;

/**
 * Read the auto-refresh preference from localStorage.
 * Defaults to true (on) — teacher must explicitly opt out.
 *
 * @param {string} courseId
 * @returns {boolean}
 */
function getAutoRefreshEnabled(courseId) {
    return localStorage.getItem(AUTO_REFRESH_KEY(courseId)) !== 'false';
}

/**
 * Wire the refresh banner and start background polling when auto-refresh is on.
 *
 * onChangesDetected shows the banner and stops polling.
 * Banner "Refresh now" calls onRefresh, hides the banner on success, then
 * restarts polling against the new cache.
 *
 * @param {Object}   shell
 * @param {Object}   cache
 * @param {string}   courseId
 * @param {CanvasApiClient} apiClient
 * @param {Function} onRefresh - (onProgress) => Promise<freshCache>
 */
function wirePollingAndBanner(shell, cache, courseId, apiClient, onRefresh) {
    if (!shell.bannerEl || !shell.bannerRefreshBtn) return;

    let currentComputedAt = cache.meta?.computedAt ?? cache.metadata?.computedAt;

    const showBanner = () => {
        shell.bannerEl.style.display = 'flex';
    };

    const hideBanner = () => {
        shell.bannerEl.style.display = 'none';
    };

    // "Refresh now" button in the banner
    shell.bannerRefreshBtn.addEventListener('click', async () => {
        shell.bannerRefreshBtn.disabled    = true;
        shell.bannerRefreshBtn.textContent = 'Refreshing…';
        hideBanner();

        try {
            // onRefresh (= runFullRefresh) returns the new cache object
            // The view's existing wireRefreshButton handles progress display;
            // trigger the same refresh pathway via the existing button click
            shell.refreshBtn?.click();
        } catch {
            shell.bannerRefreshBtn.disabled    = false;
            shell.bannerRefreshBtn.textContent = 'Refresh now';
            showBanner();
        }
    });

    const autoRefreshOn = getAutoRefreshEnabled(courseId);

    if (!autoRefreshOn) {
        logger.debug('[MasteryOutlook] Auto-refresh disabled — polling not started');
        return;
    }

    const onChangesDetected = () => {
        logger.info('[MasteryOutlook] Poll: changes detected — showing banner');
        showBanner();
    };

    startPolling(courseId, currentComputedAt, onChangesDetected, apiClient);
    startVisibilityListener(courseId, () => currentComputedAt, onChangesDetected, apiClient);
}

// ─── Tweaks panel — auto-refresh toggle (4f) ─────────────────────────────────

/**
 * Append a "Settings" tweaks block to the sidebar that contains the
 * auto-refresh on/off toggle.  Persists the preference to localStorage.
 *
 * @param {HTMLElement} sidebarEl
 * @param {string}      courseId
 */
function wireTweaksPanel(sidebarEl, courseId) {
    if (!sidebarEl) return;

    const enabled = getAutoRefreshEnabled(courseId);

    const panel = document.createElement('div');
    panel.className = 'od-tweaks-card';
    panel.innerHTML = `
        <div class="od-tweaks-title">Settings</div>
        <label class="od-tweaks-toggle-label">
            <input type="checkbox" id="od-auto-refresh-toggle"
                   class="od-tweaks-toggle-input"
                   ${enabled ? 'checked' : ''}>
            <span class="od-tweaks-toggle-text">
                Auto-refresh (every 5 min)
            </span>
        </label>
        <div class="od-tweaks-help">
            Checks for new grading activity in the background.
        </div>`;

    sidebarEl.appendChild(panel);

    const toggle = panel.querySelector('#od-auto-refresh-toggle');
    toggle.addEventListener('change', () => {
        const nowEnabled = toggle.checked;
        localStorage.setItem(AUTO_REFRESH_KEY(courseId), nowEnabled ? 'true' : 'false');
        logger.info(`[MasteryOutlook] Auto-refresh toggled ${nowEnabled ? 'ON' : 'OFF'}`);

        if (!nowEnabled) {
            stopPolling();
            stopVisibilityListener();
        }
        // If turned back on, the next Refresh Data call will restart polling
        // (wirePollingAndBanner re-runs after onRefresh returns the new cache)
    });
}

/**
 * Wire up the "View exceptions" button and the cross-outcome exceptions panel.
 * Filter chips inside the panel use event delegation on the panel element.
 *
 * @param {Object} shell - Shell object from buildShell
 * @param {Object} cache - Enriched cache
 */
function wireExceptionsPanel(shell, cache) {
    if (!shell.exceptionsBtn || !shell.exceptionsPanel) return;

    let panelOpen     = false;
    let showOverrides = true;
    let showIgnored   = true;

    const renderPanel = () => {
        shell.exceptionsPanel.innerHTML = `
            <div class="od-ex-panel-header">
                <span class="od-ex-panel-title">
                    Exceptions across all outcomes
                </span>
                <div class="od-ex-panel-actions">
                    <button class="od-ex-chip overrides${showOverrides ? ' active' : ''}" data-filter="overrides">
                        Overrides
                    </button>
                    <button class="od-ex-chip ignored${showIgnored ? ' active' : ''}" data-filter="ignored">
                        Ignored alignments
                    </button>
                    <button class="od-ex-chip" data-filter="close">
                        ✕ Close
                    </button>
                </div>
            </div>
            <div class="od-ex-panel-body">
                ${buildCrossOutcomeExceptionsView(cache, { showOverrides, showIgnored })}
            </div>`;
    };

    shell.exceptionsBtn.addEventListener('click', () => {
        panelOpen = !panelOpen;
        if (panelOpen) {
            renderPanel();
            shell.exceptionsPanel.style.display = 'block';
            shell.exceptionsBtn.textContent = 'Hide exceptions';
        } else {
            shell.exceptionsPanel.style.display = 'none';
            shell.exceptionsBtn.textContent = 'View exceptions';
        }
    });

    shell.exceptionsPanel.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-filter]');
        if (!btn) return;
        const f = btn.dataset.filter;
        if (f === 'close') {
            panelOpen = false;
            shell.exceptionsPanel.style.display = 'none';
            shell.exceptionsBtn.textContent = 'View exceptions';
        } else if (f === 'overrides') {
            showOverrides = !showOverrides;
            renderPanel();
        } else if (f === 'ignored') {
            showIgnored = !showIgnored;
            renderPanel();
        }
    });
}

// ─── Threshold helper (read live slider value for shared chrome) ─────────────

function getCurrentThreshold() {
    const slider = document.querySelector('#od-threshold-slider');
    return slider ? parseFloat(slider.value) : 2.2;
}

// ─── Metric cards ─────────────────────────────────────────────────────────────

function renderMetricCards(metricsEl, cache) {
    const threshold = getCurrentThreshold();

    // Only include regular outcomes in metrics (exclude Current Score and excluded outcomes)
    const regularOutcomes = cache ? cache.outcomes.filter(o => isRegularOutcome(o)) : [];

    const cards = cache ? [
        {
            label: 'Class PL avg',
            value: overallPlAvg(cache, regularOutcomes),
            sub:   'across all outcomes',
            color: '#0F6E56'
        },
        {
            label: 'Re-teach flagged',
            value: regularOutcomes.filter(
                o => o.classStats.plAvg !== null &&
                    o.classStats.plAvg < threshold
            ).length,
            sub:   `of ${regularOutcomes.length} outcomes`,
            color: '#A32D2D'
        },
        {
            label: 'Intervention',
            value: countInterventionStudents(cache),
            sub:   'low on 3+ outcomes',
            color: '#A32D2D'
        },
        {
            label: 'Growing outcomes',
            value: regularOutcomes.filter(
                o => o.classStats.avgSlope !== null &&
                    o.classStats.avgSlope > 0.05
            ).length,
            sub:   'positive PL slope',
            color: '#0F6E56'
        }
    ] : [
        { label: 'Class PL avg',      value: '—', sub: 'no data yet',       color: '#bbb' },
        { label: 'Re-teach flagged',  value: '—', sub: 'no data yet',       color: '#bbb' },
        { label: 'Intervention',      value: '—', sub: 'no data yet',       color: '#bbb' },
        { label: 'Growing outcomes',  value: '—', sub: 'no data yet',       color: '#bbb' }
    ];

    metricsEl.innerHTML = cards.map(c => `
        <div class="od-metric-card">
            <div class="od-mc-label">${c.label}</div>
            <div class="od-mc-value" style="color:${c.color};">${c.value}</div>
            <div class="od-mc-sub">${c.sub}</div>
        </div>`
    ).join('');
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function renderDefaultSidebar(sidebarEl) {
    sidebarEl.innerHTML = `
        <div class="od-sidebar-card">
            <div class="od-sidebar-title">Intervention list</div>
            <div class="od-sidebar-empty">
                Refresh to identify students low on 3+ outcomes.
            </div>
        </div>
        <div class="od-sidebar-card">
            <div class="od-sidebar-title">Re-teach now</div>
            <div class="od-sidebar-empty">
                Refresh to flag outcomes below threshold.
            </div>
        </div>`;
}

function renderSidebar(sidebarEl, cache) {
    // Full sidebar implementation in next pass
    // Intervention list and re-teach panel
    renderDefaultSidebar(sidebarEl);
}

// ─── Color Scheme Toggle ──────────────────────────────────────────────────────

/**
 * Wire color scheme toggle buttons
 * Allows switching between 'soft' (pastel) and 'canvas' (Canvas mastery) colors
 */
function wireColorSchemeToggle(shell, cache, courseId, apiClient) {
    const userId = window.ENV?.current_user_id;

    if (!userId) {
        logger.warn('[MasteryOutlook] No user ID, cannot persist color scheme preference');
        return;
    }

    // Update button states based on current scheme
    const updateButtonStates = () => {
        const buttons = [shell.colorSoftBtn, shell.colorCanvasBtn];
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.scheme === currentColorScheme);
        });
    };

    // Set initial state
    updateButtonStates();

    // Wire click handlers
    [shell.colorSoftBtn, shell.colorCanvasBtn].forEach(btn => {
        btn.addEventListener('click', () => {
            const newScheme = btn.dataset.scheme;

            if (newScheme === currentColorScheme) {
                // Already active, no change
                return;
            }

            // Update current scheme
            currentColorScheme = newScheme;

            // Save to localStorage
            saveColorScheme(courseId, userId, newScheme);

            // Update button states
            updateButtonStates();

            // Re-render shared chrome + ask the active view to refresh in place.
            logger.info(`[MasteryOutlook] Color scheme changed to: ${newScheme}`);
            renderMetricCards(shell.metricsEl, cache);
            renderSidebar(shell.sidebarEl, cache);
            activeViewController?.refresh?.();
        });
    });
}

// ─── Threshold slider ─────────────────────────────────────────────────────────

function wireThresholdSlider(shell, cache, courseId, apiClient) {
    const userId = window.ENV?.current_user_id;

    if (!userId) {
        logger.warn('[MasteryOutlook] Cannot wire threshold slider - no user ID');
        return;
    }

    // Load stored threshold or use default
    const storedThreshold = getThreshold(courseId, userId);
    shell.thresholdSlider.value = storedThreshold;
    shell.thresholdValue.textContent = storedThreshold.toFixed(1);

    // Update display and save on change
    shell.thresholdSlider.addEventListener('input', (e) => {
        const newThreshold = parseFloat(e.target.value);
        shell.thresholdValue.textContent = newThreshold.toFixed(1);
        saveThreshold(courseId, userId, newThreshold);

        // Re-render shared chrome + ask the active view to refresh in place.
        // Note: This just updates the UI, doesn't recompute cache.
        renderMetricCards(shell.metricsEl, cache);
        renderSidebar(shell.sidebarEl, cache);
        activeViewController?.refresh?.();
    });
}

// ─── Refresh button ───────────────────────────────────────────────────────────

function wireRefreshButton(shell, courseId, apiClient, onRefresh) {
    shell.refreshBtn.addEventListener('click', async () => {
        shell.refreshBtn.disabled = true;
        shell.refreshBtn.textContent = 'Fetching scores…';
        setStatus(shell.statusEl, 'Fetching outcome results and submissions…');

        try {
            // onRefresh handles fetch → compute → cache write
            // and reports progress via the callback
            let freshCache = await onRefresh((progressMsg) => {
                shell.refreshBtn.textContent = progressMsg;
                setStatus(shell.statusEl, progressMsg);
            });

            // Add dynamically loaded names and custom outcome order
            freshCache = await enrichCache(freshCache, courseId, apiClient);

            // Reset button state after successful refresh
            shell.refreshBtn.textContent = 'Refresh Data';
            shell.refreshBtn.disabled = false;
            setStatus(shell.statusEl, '');
            setLastUpdated(shell.lastUpdatedEl, freshCache.meta.computedAt);
            renderLoadedState(shell, freshCache, courseId, apiClient, onRefresh);

        } catch (e) {
            logger.error('[MasteryOutlook] Refresh failed', e);
            setStatus(shell.statusEl, 'Refresh failed — see console for details.');
            shell.refreshBtn.textContent = 'Retry Refresh';
            shell.refreshBtn.disabled = false;
        }
    });
}

// ─── Metric-card math helpers ────────────────────────────────────────────────

function overallPlAvg(cache, regularOutcomes) {
    const outcomes = regularOutcomes || cache.outcomes;
    const avgs = outcomes
        .map(o => o.classStats.plAvg)
        .filter(v => v !== null);
    if (avgs.length === 0) return '—';
    return (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(2);
}

function countInterventionStudents(cache) {
    // Count students appearing below threshold on 3+ outcomes
    const threshold = getCurrentThreshold();
    const lowCounts = {};

    cache.students.forEach(student => {
        let lowCount = 0;
        student.outcomes.forEach(outcome => {
            if (outcome.plPrediction !== null && outcome.plPrediction < threshold) {
                lowCount++;
            }
        });

        if (lowCount >= 3) {
            lowCounts[student.id] = lowCount;
        }
    });

    return Object.keys(lowCounts).length;
}

async function enrichCache(cache, courseId, apiClient) {
    if (!cache) return null;

    try {
        const [students, pageUrl] = await Promise.all([
            fetchCourseStudents(courseId, apiClient),
            findMasteryDashboardPageUrl(courseId, apiClient)
        ]);

        const dashboardPage = pageUrl ? await getPage(courseId, pageUrl, apiClient) : null;

        // Map student names
        const studentMap = new Map();
        students.forEach(s => studentMap.set(s.userId, s));

        cache.students.forEach(cs => {
            const stu = studentMap.get(cs.id);
            if (stu) {
                cs.name = stu.name;
                cs.sortableName = stu.sortableName;
            } else {
                cs.name = `Student ${cs.id}`;
                cs.sortableName = `Student ${cs.id}`;
            }
        });

        // Map custom outcome order
        if (dashboardPage && dashboardPage.body) {
            const match = dashboardPage.body.match(/data-outcome-order=(['"])(.*?)\1/);
            if (match && match[2]) {
                try {
                    cache.meta.customOutcomeOrder = JSON.parse(match[2].replace(/&quot;/g, '"'));
                } catch (e) {
                    logger.warn('[MasteryOutlook] Failed to parse custom outcome order', e);
                }
            }
        }
    } catch (e) {
        logger.warn('[MasteryOutlook] Failed to enrich cache', e);
    }
    return cache;
}

async function tryLoadCache(courseId, apiClient) {
    try {
        let cache = await readMasteryOutlookCache(courseId, apiClient);
        if (cache) {
            logger.info('[MasteryOutlook] Cache loaded successfully');
            cache = {
                meta:               cache.metadata,
                outcomes:           cache.outcomes,
                students:           cache.students,
                // Preserve PL data so sync status badges and action buttons work
                pl_assignments:     cache.pl_assignments     ?? {},
                sync_state:         cache.sync_state         ?? {},
                ignored_alignments: cache.ignored_alignments ?? [],
            };
            return await enrichCache(cache, courseId, apiClient);
        }
        return null;
    } catch (error) {
        logger.warn('[MasteryOutlook] Could not load cache', error);
        return null;
    }
}

function setStatus(el, msg) {
    if (el) el.textContent = msg;
}

function setLastUpdated(el, isoString) {
    if (!el) return;
    if (!isoString) {
        el.textContent = 'No data computed yet';
        return;
    }
    const d = new Date(isoString);
    el.textContent = `Last updated: ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

// ─── Tab Bar / View router ───────────────────────────────────────────────────

/**
 * Build the per-render context handed to each view's mount() function.
 * Functions (not values) for color/threshold so the view always reads the
 * current selection without needing to be re-mounted.
 */
function buildViewContext(courseId, apiClient, onRefresh) {
    return {
        courseId,
        apiClient,
        onRefresh,
        getColorScheme: () => currentColorScheme,
        getThreshold:   () => getCurrentThreshold(),
    };
}

/**
 * Wire the tab bar to switch between registered views and mount the
 * initial 'outcomes' view.
 */
function wireTabBar(shell, cache, courseId, apiClient, onRefresh) {
    const ctx = buildViewContext(courseId, apiClient, onRefresh);

    shell.tabBar.querySelectorAll('.od-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchToView(tab.dataset.tab, shell, cache, ctx);
        });
    });

    switchToView('outcomes', shell, cache, ctx);
}

/**
 * Tear down the active view (if any) and mount the requested one. Toggles
 * tab .active state, hides every view container, then shows + mounts the
 * target. Sidebar visibility comes from the descriptor's hasSidebar flag.
 */
function switchToView(viewId, shell, cache, ctx) {
    const descriptor = getView(viewId);
    if (!descriptor) {
        logger.warn(`[MasteryOutlook] Unknown view id: ${viewId}`);
        return;
    }

    if (activeViewController?.teardown) {
        try { activeViewController.teardown(); } catch (err) { logger.warn('[MasteryOutlook] view teardown failed', err); }
    }
    activeViewController = null;

    shell.tabBar.querySelectorAll('.od-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === viewId);
    });

    // Hide every registered view container; the active one is shown below.
    Object.values(shell.viewContainers).forEach(el => {
        if (el) el.style.display = 'none';
    });

    const containerEl = shell.viewContainers[viewId];
    if (containerEl) containerEl.style.display = 'block';

    shell.sidebarEl.style.display       = descriptor.hasSidebar ? '' : 'none';
    shell.bodyEl.style.gridTemplateColumns = descriptor.hasSidebar ? '' : '1fr';

    const controller = descriptor.mount(shell, cache, ctx) || {};
    activeViewController = { id: viewId, ...controller };

    logger.debug(`[MasteryOutlook] Switched to ${viewId} view`);
}