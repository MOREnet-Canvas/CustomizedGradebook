// src/outcomesDashboard/outcomesDashboardView.js
/**
 * Outcomes Dashboard — main view
 *
 * Renders in two states:
 *   1. Default (no cache) — outcome names from Canvas, NE placeholders,
 *      prominent refresh prompt
 *   2. Loaded (cache exists) — full Power Law data, distribution bars,
 *      intervention sidebar
 *
 * Entry point: renderOutcomesDashboard()
 */

import { logger } from '../utils/logger.js';

const FONT = "font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif;";

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * @param {Object} options
 * @param {HTMLElement} options.containerEl  - Root element to render into
 * @param {string|number} options.courseId
 * @param {Object} options.apiClient
 * @param {Function} options.onRefresh       - Async callback that triggers
 *                                            recompute and returns fresh cache
 */
export async function renderOutcomesDashboard({ containerEl, courseId, apiClient, onRefresh }) {
    containerEl.innerHTML = '';
    containerEl.style.cssText = `${FONT} max-width:1100px; margin:0 auto; padding:1rem;`;

    // Shell renders immediately — no waiting on cache or outcomes fetch
    const shell = buildShell(containerEl);

    // Try to load cache first
    let cache = await tryLoadCache(courseId, apiClient);

    if (!cache) {
        // No cache yet — pull outcome names from Canvas for the default state
        renderDefaultState(shell, courseId, apiClient, onRefresh);
    } else {
        renderLoadedState(shell, cache, onRefresh);
    }
}

// ─── Shell ───────────────────────────────────────────────────────────────────

function buildShell(containerEl) {
    containerEl.innerHTML = `
        <div id="od-header" style="display:flex; justify-content:space-between; 
             align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:8px;">
            <div>
                <div id="od-title" style="font-size:1.1rem; font-weight:700; 
                     color:#333;">Outcomes Dashboard</div>
                <div id="od-subtitle" style="font-size:0.8rem; color:#888; 
                     margin-top:2px;">Power Law predictions</div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span id="od-last-updated" style="font-size:0.8rem; 
                      color:#888;"></span>
                <button id="od-refresh-btn" style="${FONT} font-size:0.85rem; 
                        padding:7px 16px; border-radius:6px; border:1px solid #0374B5; 
                        background:#0374B5; color:#fff; cursor:pointer; 
                        font-weight:600; min-width:120px;">
                    Refresh Data
                </button>
            </div>
        </div>

        <div id="od-metrics" style="display:grid; 
             grid-template-columns:repeat(4, minmax(0,1fr)); 
             gap:8px; margin-bottom:1rem;">
        </div>

        <div id="od-body" style="display:grid; 
             grid-template-columns:1fr 260px; gap:12px;">
            <div id="od-outcomes-col">
                <div id="od-col-headers" style="display:grid; 
                     grid-template-columns:20px 1fr 80px 100px 80px 80px 24px; 
                     gap:8px; padding:4px 12px 6px; 
                     border-bottom:1px solid #e0e0e0; margin-bottom:4px;">
                    ${colHeader('#')}
                    ${colHeader('Outcome')}
                    ${colHeader('PL avg', true)}
                    ${colHeader('Spread', true)}
                    ${colHeader('Below threshold', true)}
                    ${colHeader('Status', true)}
                    <div></div>
                </div>
                <div id="od-outcomes-list"></div>
            </div>
            <div id="od-sidebar"></div>
        </div>

        <div id="od-status-bar" style="font-size:0.8rem; color:#888; 
             margin-top:12px; min-height:20px;"></div>
    `;

    return {
        titleEl:       containerEl.querySelector('#od-title'),
        subtitleEl:    containerEl.querySelector('#od-subtitle'),
        lastUpdatedEl: containerEl.querySelector('#od-last-updated'),
        refreshBtn:    containerEl.querySelector('#od-refresh-btn'),
        metricsEl:     containerEl.querySelector('#od-metrics'),
        outcomesEl:    containerEl.querySelector('#od-outcomes-list'),
        sidebarEl:     containerEl.querySelector('#od-sidebar'),
        statusEl:      containerEl.querySelector('#od-status-bar'),
    };
}

function colHeader(label, center = false) {
    return `<div style="font-size:10px; font-weight:600; color:#999; 
            text-transform:uppercase; letter-spacing:.04em;
            ${center ? 'text-align:center;' : ''}">${label}</div>`;
}

// ─── Default state (no cache) ─────────────────────────────────────────────────

async function renderDefaultState(shell, courseId, apiClient, onRefresh) {
    setStatus(shell.statusEl, 'Loading outcomes…');

    // Render empty metric cards immediately
    renderMetricCards(shell.metricsEl, null);

    // Render default sidebar
    renderDefaultSidebar(shell.sidebarEl);

    // Fetch outcome names from Canvas
    let outcomes = [];
    try {
        outcomes = await fetchOutcomeNames(courseId, apiClient);
    } catch (e) {
        logger.warn('[OutcomesDashboard] Could not fetch outcome names', e);
    }

    // Render outcome rows in default/empty state
    renderDefaultOutcomeRows(shell.outcomesEl, outcomes);

    // Prominent refresh prompt if no outcomes loaded
    if (outcomes.length === 0) {
        shell.outcomesEl.innerHTML = buildEmptyPrompt();
    }

    setStatus(shell.statusEl, '');
    setLastUpdated(shell.lastUpdatedEl, null);

    wireRefreshButton(shell, onRefresh, courseId, apiClient);
}

function renderDefaultOutcomeRows(outcomesEl, outcomes) {
    outcomesEl.innerHTML = '';

    if (outcomes.length === 0) {
        outcomesEl.innerHTML = buildEmptyPrompt();
        return;
    }

    outcomes.forEach((outcome, i) => {
        const row = document.createElement('div');
        row.style.cssText = `display:grid; 
            grid-template-columns:20px 1fr 80px 100px 80px 80px 24px; 
            gap:8px; align-items:center; padding:9px 12px; 
            border:0.5px solid #e0e0e0; border-radius:8px; 
            margin-bottom:6px; background:#fff;`;
        row.innerHTML = `
            <div style="font-size:11px; color:#999; font-weight:500;">${i + 1}</div>
            <div style="font-size:13px; color:#333; font-weight:500; 
                 white-space:nowrap; overflow:hidden; 
                 text-overflow:ellipsis;">${escapeHtml(outcome.title)}</div>
            <div style="text-align:center;">${neChip()}</div>
            <div>${emptySpread()}</div>
            <div style="text-align:center; font-size:11px; color:#bbb;">—</div>
            <div style="text-align:center;">${pendingBadge()}</div>
            <div></div>
        `;
        outcomesEl.appendChild(row);
    });

    // Prompt below rows
    const prompt = document.createElement('div');
    prompt.innerHTML = buildRefreshPrompt();
    outcomesEl.appendChild(prompt);
}

function buildEmptyPrompt() {
    return `
        <div style="text-align:center; padding:2rem 1rem; color:#888;">
            <div style="font-size:2rem; margin-bottom:0.5rem;">📋</div>
            <div style="font-size:0.95rem; font-weight:600; 
                 color:#555; margin-bottom:0.4rem;">
                No outcome data yet
            </div>
            <div style="font-size:0.85rem; line-height:1.6; max-width:340px; 
                 margin:0 auto;">
                Hit <strong>Refresh Data</strong> to calculate Power Law 
                predictions for all students and outcomes in this course.
            </div>
        </div>`;
}

function buildRefreshPrompt() {
    return `
        <div style="margin-top:10px; padding:10px 14px; background:#f0f7ff; 
             border:1px solid #b8d6f5; border-radius:8px; 
             font-size:0.82rem; color:#0374B5; line-height:1.6;">
            Outcome names loaded from Canvas. Hit 
            <strong>Refresh Data</strong> to calculate Power Law predictions, 
            class distribution, and intervention flags.
        </div>`;
}

function neChip() {
    return `<span style="${FONT} font-size:10px; font-weight:600; 
            padding:2px 7px; border-radius:8px; 
            background:#f0f0f0; color:#999;">NE</span>`;
}

function pendingBadge() {
    return `<span style="${FONT} font-size:10px; font-weight:600; 
            padding:2px 7px; border-radius:8px; 
            background:#f0f0f0; color:#999;">Pending</span>`;
}

function emptySpread() {
    return `<div style="height:16px; border-radius:4px; 
            background:#f0f0f0; width:100%;"></div>`;
}

// ─── Loaded state (cache exists) ─────────────────────────────────────────────

function renderLoadedState(shell, cache, onRefresh) {
    setLastUpdated(shell.lastUpdatedEl, cache.meta.computedAt);
    shell.subtitleEl.textContent =
        `${cache.meta.studentCount} students · 
         ${cache.meta.outcomeCount} outcomes · 
         Power Law predictions`;

    renderMetricCards(shell.metricsEl, cache);
    renderLoadedOutcomeRows(shell.outcomesEl, cache);
    renderSidebar(shell.sidebarEl, cache);

    wireRefreshButton(shell, onRefresh);
}

// Placeholder — full implementation in next pass
function renderLoadedOutcomeRows(outcomesEl, cache) {
    outcomesEl.innerHTML = '';
    cache.outcomes.forEach((outcome, i) => {
        const row = document.createElement('div');
        row.style.cssText = `display:grid; 
            grid-template-columns:20px 1fr 80px 100px 80px 80px 24px; 
            gap:8px; align-items:center; padding:9px 12px; 
            border:0.5px solid #e0e0e0; border-radius:8px; 
            margin-bottom:6px; background:#fff; cursor:pointer;`;
        row.innerHTML = `
            <div style="font-size:11px; color:#999;">${i + 1}</div>
            <div style="font-size:13px; font-weight:500; color:#333; 
                 white-space:nowrap; overflow:hidden; 
                 text-overflow:ellipsis;">${escapeHtml(outcome.title)}</div>
            <div style="text-align:center;">${plAvgChip(outcome.classStats)}</div>
            <div>${spreadBar(outcome.classStats)}</div>
            <div style="text-align:center; font-size:12px; 
                 color:${outcome.classStats.belowThresholdCount > 3 ? '#A32D2D' : '#666'};">
                ${outcome.classStats.belowThresholdCount}
            </div>
            <div style="text-align:center;">${statusBadge(outcome.classStats)}</div>
            <div style="font-size:12px; color:#999; text-align:center;">›</div>
        `;
        outcomesEl.appendChild(row);
    });
}

// ─── Metric cards ─────────────────────────────────────────────────────────────

function renderMetricCards(metricsEl, cache) {
    const cards = cache ? [
        {
            label: 'Class PL avg',
            value: overallPlAvg(cache),
            sub:   'across all outcomes',
            color: '#0F6E56'
        },
        {
            label: 'Re-teach flagged',
            value: cache.outcomes.filter(
                o => o.classStats.plAvg !== null &&
                    o.classStats.plAvg < o.classStats.computedThreshold
            ).length,
            sub:   `of ${cache.meta.outcomeCount} outcomes`,
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
            value: cache.outcomes.filter(
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
        <div style="background:#f5f5f3; border-radius:8px; padding:10px 12px;">
            <div style="font-size:11px; color:#666; margin-bottom:3px;">
                ${c.label}
            </div>
            <div style="font-size:20px; font-weight:700; color:${c.color};">
                ${c.value}
            </div>
            <div style="font-size:10px; color:#999; margin-top:1px;">
                ${c.sub}
            </div>
        </div>`
    ).join('');
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function renderDefaultSidebar(sidebarEl) {
    sidebarEl.innerHTML = `
        <div style="background:#fff; border:0.5px solid #e0e0e0; 
             border-radius:12px; padding:12px; margin-bottom:10px;">
            <div style="font-size:13px; font-weight:700; color:#333; 
                 margin-bottom:8px;">Intervention list</div>
            <div style="font-size:11px; color:#aaa; padding:8px 0;">
                Refresh to identify students low on 3+ outcomes.
            </div>
        </div>
        <div style="background:#fff; border:0.5px solid #e0e0e0; 
             border-radius:12px; padding:12px;">
            <div style="font-size:13px; font-weight:700; color:#333; 
                 margin-bottom:8px;">Re-teach now</div>
            <div style="font-size:11px; color:#aaa; padding:8px 0;">
                Refresh to flag outcomes below threshold.
            </div>
        </div>`;
}

function renderSidebar(sidebarEl, cache) {
    // Full sidebar implementation in next pass
    // Intervention list and re-teach panel
    renderDefaultSidebar(sidebarEl);
}

// ─── Refresh button ───────────────────────────────────────────────────────────

function wireRefreshButton(shell, onRefresh) {
    shell.refreshBtn.addEventListener('click', async () => {
        shell.refreshBtn.disabled = true;
        shell.refreshBtn.textContent = 'Fetching scores…';
        setStatus(shell.statusEl, 'Fetching outcome results and submissions…');

        try {
            // onRefresh handles fetch → compute → cache write
            // and reports progress via the callback
            const freshCache = await onRefresh((progressMsg) => {
                shell.refreshBtn.textContent = progressMsg;
                setStatus(shell.statusEl, progressMsg);
            });

            setStatus(shell.statusEl, '');
            setLastUpdated(shell.lastUpdatedEl, freshCache.meta.computedAt);
            renderLoadedState(shell, freshCache, onRefresh);

        } catch (e) {
            logger.error('[OutcomesDashboard] Refresh failed', e);
            setStatus(shell.statusEl, 'Refresh failed — see console for details.');
            shell.refreshBtn.textContent = 'Retry Refresh';
            shell.refreshBtn.disabled = false;
        }
    });
}

// ─── Chip / badge helpers ─────────────────────────────────────────────────────

function plAvgChip(classStats) {
    if (classStats.plAvg === null) return neChip();
    const c = profColor(classStats.plAvg);
    return `<span style="${FONT} font-size:11px; font-weight:600; 
            padding:2px 8px; border-radius:8px; 
            background:${c.bg}; color:${c.tx};">
            ${classStats.plAvg.toFixed(2)}
            </span>`;
}

function spreadBar(classStats) {
    const total = Object.values(classStats.distribution).reduce((a, b) => a + b, 0);
    if (total === 0) return emptySpread();
    const d = classStats.distribution;
    return `<div style="display:flex; height:16px; border-radius:4px; 
            overflow:hidden; gap:1px;">
        <div style="width:${d['4']/total*100}%; background:#C0DD97;"></div>
        <div style="width:${d['3']/total*100}%; background:#9FE1CB;"></div>
        <div style="width:${d['2']/total*100}%; background:#FAC775;"></div>
        <div style="width:${d['1']/total*100}%; background:#F7C1C1;"></div>
    </div>`;
}

function statusBadge(classStats) {
    if (classStats.plAvg === null) return pendingBadge();
    const isReteach = classStats.plAvg < classStats.computedThreshold;
    const isSolid   = classStats.plAvg >= 3.0;
    if (isReteach) return `<span style="${FONT} font-size:10px; font-weight:600; 
        padding:2px 7px; border-radius:8px; 
        background:#FCEBEB; color:#791F1F;">Re-teach</span>`;
    if (isSolid)   return `<span style="${FONT} font-size:10px; font-weight:600; 
        padding:2px 7px; border-radius:8px; 
        background:#E1F5EE; color:#085041;">Solid</span>`;
    return `<span style="${FONT} font-size:10px; font-weight:600; 
        padding:2px 7px; border-radius:8px; 
        background:#FAEEDA; color:#633806;">Monitor</span>`;
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function profColor(v) {
    if (v >= 3.5) return { bg: '#C0DD97', tx: '#27500A' };
    if (v >= 3.0) return { bg: '#9FE1CB', tx: '#085041' };
    if (v >= 2.0) return { bg: '#FAC775', tx: '#633806' };
    return             { bg: '#F7C1C1', tx: '#791F1F' };
}

function overallPlAvg(cache) {
    const avgs = cache.outcomes
        .map(o => o.classStats.plAvg)
        .filter(v => v !== null);
    if (avgs.length === 0) return '—';
    return (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(2);
}

function countInterventionStudents(cache) {
    // Count unique userIds appearing below threshold on 3+ outcomes
    const lowCounts = {};
    cache.outcomes.forEach(outcome => {
        outcome.students
            .filter(s => s.computed.status === 'ok' &&
                s.computed.plPrediction < outcome.classStats.computedThreshold)
            .forEach(s => {
                lowCounts[s.userId] = (lowCounts[s.userId] ?? 0) + 1;
            });
    });
    return Object.values(lowCounts).filter(count => count >= 3).length;
}

async function tryLoadCache(courseId, apiClient) {
    // Placeholder — outcomesCacheService.readOutcomesCache goes here
    return null;
}

async function fetchOutcomeNames(courseId, apiClient) {
    // Placeholder — returns [{ id, title, displayOrder }]
    // Full implementation in outcomesDataService
    try {
        const groups = await apiClient.get(
            `/api/v1/courses/${courseId}/outcome_groups`
        );
        const results = await Promise.all(
            groups.map(g =>
                apiClient.get(
                    `/api/v1/courses/${courseId}/outcome_groups/${g.id}/outcomes`
                )
            )
        );
        return results.flat().map((o, i) => ({
            id:           o.outcome.id,
            title:        o.outcome.title,
            displayOrder: i + 1
        }));
    } catch (e) {
        logger.warn('[OutcomesDashboard] fetchOutcomeNames failed', e);
        return [];
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

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]
    );
}