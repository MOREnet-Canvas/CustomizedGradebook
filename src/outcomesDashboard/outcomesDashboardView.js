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
import { readOutcomesCache } from './outcomesCacheService.js';
import { fetchOutcomeNames } from './outcomesDataService.js';

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
    return `<div style="font-size:12px; font-weight:600; color:#999;
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

    wireRefreshButton(shell, onRefresh);
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
            <div style="font-size:13px; color:#999; font-weight:500;">${i + 1}</div>
            <div style="font-size:15px; color:#333; font-weight:500;
                 white-space:nowrap; overflow:hidden;
                 text-overflow:ellipsis;">${escapeHtml(outcome.title)}</div>
            <div style="text-align:center;">${neChip()}</div>
            <div>${emptySpread()}</div>
            <div style="text-align:center; font-size:13px; color:#bbb;">—</div>
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
    return `<span style="${FONT} font-size:12px; font-weight:600;
            padding:3px 8px; border-radius:8px;
            background:#f0f0f0; color:#999;">NE</span>`;
}

function pendingBadge() {
    return `<span style="${FONT} font-size:12px; font-weight:600;
            padding:3px 8px; border-radius:8px;
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

// ─── Outcome row expansion ───────────────────────────────────────────────────

let expandedOutcomeId = null;
let activeTab = 'students';

function renderLoadedOutcomeRows(outcomesEl, cache) {
    outcomesEl.innerHTML = '';
    cache.outcomes.forEach((outcome, i) => {
        const outcomeContainer = document.createElement('div');
        outcomeContainer.style.cssText = `margin-bottom:6px;`;

        // Header row (clickable)
        const row = document.createElement('div');
        const isExpanded = expandedOutcomeId === outcome.id;
        row.style.cssText = `display:grid;
            grid-template-columns:20px 1fr 80px 100px 80px 80px 24px;
            gap:8px; align-items:center; padding:9px 12px;
            border:0.5px solid #e0e0e0; border-radius:8px;
            background:#fff; cursor:pointer;
            ${isExpanded ? 'border-bottom-left-radius:0; border-bottom-right-radius:0;' : ''}`;

        const chevron = isExpanded ? '▼' : '›';
        row.innerHTML = `
            <div style="font-size:13px; color:#999;">${i + 1}</div>
            <div style="font-size:15px; font-weight:500; color:#333;
                 white-space:nowrap; overflow:hidden;
                 text-overflow:ellipsis;">${escapeHtml(outcome.title)}</div>
            <div style="text-align:center;">${plAvgChip(outcome.classStats)}</div>
            <div>${spreadBar(outcome.classStats)}</div>
            <div style="text-align:center; font-size:14px;
                 color:${outcome.classStats.belowThresholdCount > 3 ? '#A32D2D' : '#666'};">
                ${outcome.classStats.belowThresholdCount}
            </div>
            <div style="text-align:center;">${statusBadge(outcome.classStats)}</div>
            <div style="font-size:14px; color:#999; text-align:center;">${chevron}</div>
        `;

        row.addEventListener('click', () => {
            expandedOutcomeId = (expandedOutcomeId === outcome.id) ? null : outcome.id;
            activeTab = 'students'; // Reset to default tab when expanding
            renderLoadedOutcomeRows(outcomesEl, cache);
        });

        row.addEventListener('mouseenter', () => {
            row.style.background = '#f5f5f3';
        });

        row.addEventListener('mouseleave', () => {
            row.style.background = '#fff';
        });

        outcomeContainer.appendChild(row);

        // Detail panel (expanded content)
        if (isExpanded) {
            const detailPanel = buildOutcomeDetailPanel(outcome, cache, outcomesEl);
            outcomeContainer.appendChild(detailPanel);
        }

        outcomesEl.appendChild(outcomeContainer);
    });
}


function buildOutcomeDetailPanel(outcome, cache, outcomesEl) {
    const panel = document.createElement('div');
    panel.style.cssText = `
        border:0.5px solid #e0e0e0;
        border-top:none;
        border-bottom-left-radius:8px;
        border-bottom-right-radius:8px;
        background:#fff;
        overflow:hidden;`;

    // Tabs
    const tabBar = document.createElement('div');
    tabBar.style.cssText = `
        display:flex;
        gap:0;
        border-bottom:0.5px solid #e0e0e0;
        background:#fafafa;`;

    const strugglingCount = countStrugglingStudents(outcome, cache);
    const growingCount = countGrowingStudents(outcome, cache);

    const tabs = [
        { id: 'students', label: `All Students (${cache.students.length})` },
        { id: 'struggling', label: `Struggling (${strugglingCount})` },
        { id: 'growing', label: `Growing (${growingCount})` }
    ];

    tabs.forEach(tab => {
        const tabBtn = document.createElement('button');
        const isActive = activeTab === tab.id;
        tabBtn.style.cssText = `
            ${FONT}
            font-size:13px;
            padding:8px 16px;
            cursor:pointer;
            color:${isActive ? '#185FA5' : '#666'};
            border:none;
            border-bottom:2px solid ${isActive ? '#185FA5' : 'transparent'};
            background:${isActive ? '#fff' : 'transparent'};
            font-weight:${isActive ? '500' : '400'};`;
        tabBtn.textContent = tab.label;
        tabBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            activeTab = tab.id;
            renderLoadedOutcomeRows(outcomesEl, cache);
        });
        tabBar.appendChild(tabBtn);
    });

    panel.appendChild(tabBar);

    // Tab content
    const content = document.createElement('div');
    content.style.cssText = `padding:12px; max-height:400px; overflow-y:auto;`;
    content.innerHTML = buildStudentTable(outcome, cache, activeTab);
    panel.appendChild(content);

    return panel;
}

function countStrugglingStudents(outcome, cache) {
    return cache.students.filter(student => {
        const outcomeData = student.outcomes.find(o => o.outcomeId === outcome.id);
        return outcomeData && outcomeData.plPrediction !== null &&
               outcomeData.plPrediction < (cache.meta.threshold || 2.2);
    }).length;
}

function countGrowingStudents(outcome, cache) {
    return cache.students.filter(student => {
        const outcomeData = student.outcomes.find(o => o.outcomeId === outcome.id);
        return outcomeData && outcomeData.slope !== null && outcomeData.slope > 0.05;
    }).length;
}

function buildStudentTable(outcome, cache, filter) {
    let students = cache.students.map(student => {
        const outcomeData = student.outcomes.find(o => o.outcomeId === outcome.id);
        return {
            name: student.name || student.sortableName,
            sortableName: student.sortableName,
            ...outcomeData
        };
    });

    const threshold = cache.meta.threshold || 2.2;

    // Filter students based on active tab
    if (filter === 'struggling') {
        students = students.filter(s => s.plPrediction !== null && s.plPrediction < threshold);
    } else if (filter === 'growing') {
        students = students.filter(s => s.slope !== null && s.slope > 0.05);
    }

    // Sort based on active tab
    if (filter === 'students') {
        // All Students: Alphabetical order by name
        students.sort((a, b) => {
            const nameA = (a.sortableName || a.name || '').toLowerCase();
            const nameB = (b.sortableName || b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
    } else {
        // Struggling/Growing: Sort by PL prediction (lowest first)
        students.sort((a, b) => {
            if (a.plPrediction === null) return 1;
            if (b.plPrediction === null) return -1;
            return a.plPrediction - b.plPrediction;
        });
    }

    if (students.length === 0) {
        return `<p style="${FONT} font-size:13px; color:#666; padding:12px 0;">No students in this category.</p>`;
    }

    const rowsHTML = students.map(s => {
        const c = s.plPrediction !== null ? profColor(s.plPrediction) : { bg: '#f5f5f3', tx: '#999' };
        const plDisplay = s.plPrediction !== null ? s.plPrediction.toFixed(2) : 'NE';
        const canvasScoreDisplay = s.canvasScore !== null && s.canvasScore !== undefined
            ? s.canvasScore.toFixed(2)
            : '—';
        const decayingAvgDisplay = s.decayingAvg !== null ? s.decayingAvg.toFixed(2) : '—';
        const meanDisplay = s.mean !== null ? s.mean.toFixed(2) : '—';
        const recentDisplay = s.mostRecent !== null ? s.mostRecent.toFixed(2) : '—';

        // Trend indicator
        let trendIcon = '→';
        let trendColor = '#999';
        if (s.slope !== null) {
            if (s.slope > 0.1) {
                trendIcon = '▲';
                trendColor = '#0F6E56';
            } else if (s.slope < -0.1) {
                trendIcon = '▼';
                trendColor = '#A32D2D';
            }
        }

        // Score history
        const scoreHistory = (s.attempts || [])
            .map(a => `<span style="opacity:0.6">${a.score}</span>`)
            .join(' ');

        const isFlagged = s.plPrediction !== null && s.plPrediction < threshold;

        return `
            <tr style="${isFlagged ? 'background:rgba(252,235,235,0.3);' : ''}">
                <td style="font-size:13px; padding:6px 8px;">${escapeHtml(s.name)}</td>
                <td style="text-align:center; padding:6px 8px;">
                    <span style="background:${c.bg}; color:${c.tx};
                           padding:2px 8px; border-radius:6px;
                           font-size:12px; font-weight:500;">${plDisplay}</span>
                </td>
                <td style="text-align:center; font-size:13px; padding:6px 8px;">${canvasScoreDisplay}</td>
                <td style="text-align:center; font-size:13px; padding:6px 8px;">${decayingAvgDisplay}</td>
                <td style="text-align:center; font-size:13px; padding:6px 8px;">${meanDisplay}</td>
                <td style="text-align:center; font-size:13px; padding:6px 8px;">${recentDisplay}</td>
                <td style="text-align:center; padding:6px 8px;">
                    <span style="color:${trendColor}; font-size:13px;">${trendIcon}</span>
                </td>
                <td style="font-size:11px; color:#999; letter-spacing:1px; padding:6px 8px;">${scoreHistory}</td>
            </tr>`;
    }).join('');

    return `
        <table style="${FONT} width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
                <tr style="border-bottom:0.5px solid #e0e0e0;">
                    <th style="font-weight:500; color:#666; text-align:left;
                               padding:6px 8px; font-size:12px;">Student</th>
                    <th style="font-weight:500; color:#666; text-align:center;
                               padding:6px 8px; font-size:12px;">PL Pred.</th>
                    <th style="font-weight:500; color:#666; text-align:center;
                               padding:6px 8px; font-size:12px;">Canvas Score</th>
                    <th style="font-weight:500; color:#666; text-align:center;
                               padding:6px 8px; font-size:12px;">Decaying Avg</th>
                    <th style="font-weight:500; color:#666; text-align:center;
                               padding:6px 8px; font-size:12px;">Mean</th>
                    <th style="font-weight:500; color:#666; text-align:center;
                               padding:6px 8px; font-size:12px;">Recent</th>
                    <th style="font-weight:500; color:#666; text-align:center;
                               padding:6px 8px; font-size:12px;">Trend</th>
                    <th style="font-weight:500; color:#666; text-align:left;
                               padding:6px 8px; font-size:12px;">Score History</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHTML}
            </tbody>
        </table>`;
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
            <div style="font-size:13px; color:#666; margin-bottom:3px;">
                ${c.label}
            </div>
            <div style="font-size:24px; font-weight:700; color:${c.color};">
                ${c.value}
            </div>
            <div style="font-size:12px; color:#999; margin-top:1px;">
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
            <div style="font-size:15px; font-weight:700; color:#333;
                 margin-bottom:8px;">Intervention list</div>
            <div style="font-size:13px; color:#aaa; padding:8px 0;">
                Refresh to identify students low on 3+ outcomes.
            </div>
        </div>
        <div style="background:#fff; border:0.5px solid #e0e0e0;
             border-radius:12px; padding:12px;">
            <div style="font-size:15px; font-weight:700; color:#333;
                 margin-bottom:8px;">Re-teach now</div>
            <div style="font-size:13px; color:#aaa; padding:8px 0;">
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

            // Reset button state after successful refresh
            shell.refreshBtn.textContent = 'Refresh Data';
            shell.refreshBtn.disabled = false;
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
    return `<span style="${FONT} font-size:13px; font-weight:600;
            padding:3px 10px; border-radius:8px;
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
    if (isReteach) return `<span style="${FONT} font-size:12px; font-weight:600;
        padding:3px 8px; border-radius:8px;
        background:#FCEBEB; color:#791F1F;">Re-teach</span>`;
    if (isSolid)   return `<span style="${FONT} font-size:12px; font-weight:600;
        padding:3px 8px; border-radius:8px;
        background:#E1F5EE; color:#085041;">Solid</span>`;
    return `<span style="${FONT} font-size:12px; font-weight:600;
        padding:3px 8px; border-radius:8px;
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
    // Count students appearing below threshold on 3+ outcomes
    const lowCounts = {};

    cache.students.forEach(student => {
        let lowCount = 0;
        student.outcomes.forEach(outcome => {
            // Find the threshold for this outcome
            const outcomeData = cache.outcomes.find(o => o.id === outcome.outcomeId);
            if (!outcomeData) return;

            const threshold = outcomeData.classStats.threshold_2_2;

            if (outcome.status === 'ok' && outcome.plPrediction < threshold) {
                lowCount++;
            }
        });

        if (lowCount >= 3) {
            lowCounts[student.id] = lowCount;
        }
    });

    return Object.keys(lowCounts).length;
}

async function tryLoadCache(courseId, apiClient) {
    try {
        const cache = await readOutcomesCache(courseId, apiClient);
        if (cache) {
            logger.info('[OutcomesDashboard] Cache loaded successfully');
            return {
                meta: cache.metadata,
                outcomes: cache.outcomes,
                students: cache.students
            };
        }
        return null;
    } catch (error) {
        logger.warn('[OutcomesDashboard] Could not load cache', error);
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

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]
    );
}