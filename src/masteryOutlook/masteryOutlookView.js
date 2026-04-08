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
import { readMasteryOutlookCache } from './masteryOutlookCacheService.js';
import { fetchOutcomeNames } from './masteryOutlookDataService.js';
import { getThreshold, saveThreshold } from './thresholdStorage.js';
import { getCourseId } from '../utils/canvas.js';
import { AVG_OUTCOME_NAME, EXCLUDED_OUTCOME_KEYWORDS } from '../config.js';
import { buildHeatmapGrid } from './masteryOutlookHeatmap.js';
import { openFullScreenHeatmap } from './masteryOutlookHeatmapFullScreen.js';

const FONT = "font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif;";

// ─── Outcome Type Helpers ────────────────────────────────────────────────────

function isCurrentScoreOutcome(title) {
    return title === AVG_OUTCOME_NAME;
}

function isExcludedOutcome(title) {
    return EXCLUDED_OUTCOME_KEYWORDS.some(kw => title.includes(kw));
}

function isSpecialOutcome(title) {
    return isCurrentScoreOutcome(title) || isExcludedOutcome(title);
}

function isRegularOutcome(outcome) {
    return !isSpecialOutcome(outcome.title);
}

/**
 * Calculate a student's PL Avg from their regular outcome PL Predictions
 * Used for Current Score outcome
 */
function calculateStudentPLAvg(student, cache) {
    const regularOutcomes = cache.outcomes.filter(o => isRegularOutcome(o));

    const plPredictions = student.outcomes
        .filter(so => {
            // Check if this outcome is a regular outcome
            const outcome = regularOutcomes.find(ro => String(ro.id) === String(so.outcomeId));
            return outcome && so.plPrediction !== null;
        })
        .map(so => so.plPrediction);

    if (plPredictions.length === 0) return null;

    return plPredictions.reduce((sum, p) => sum + p, 0) / plPredictions.length;
}

/**
 * Compute class stats for Current Score outcome
 * Based on student PL Avgs (average of their regular outcome PL Predictions)
 */
function computeCurrentScoreClassStats(cache) {
    const threshold = getCurrentThreshold();

    // Calculate PL Avg for each student
    const studentPLAvgs = cache.students
        .map(student => calculateStudentPLAvg(student, cache))
        .filter(v => v !== null);

    if (studentPLAvgs.length === 0) {
        return {
            plAvg: null,
            distribution: { '1': 0, '2': 0, '3': 0, '4': 0 },
            belowThresholdCount: 0,
            computedThreshold: threshold,
            avgSlope: null,
            neCount: cache.students.length
        };
    }

    // Compute distribution
    const distribution = { '1': 0, '2': 0, '3': 0, '4': 0 };
    studentPLAvgs.forEach(plAvg => {
        if (plAvg < 1.5)      distribution['1']++;
        else if (plAvg < 2.5) distribution['2']++;
        else if (plAvg < 3.5) distribution['3']++;
        else                  distribution['4']++;
    });

    // Compute class PL avg
    const classPLAvg = studentPLAvgs.reduce((sum, v) => sum + v, 0) / studentPLAvgs.length;

    // Count below threshold
    const belowThresholdCount = studentPLAvgs.filter(plAvg => plAvg < threshold).length;

    return {
        plAvg: parseFloat(classPLAvg.toFixed(4)),
        distribution,
        belowThresholdCount,
        computedThreshold: threshold,
        avgSlope: null,  // Not meaningful for Current Score
        neCount: cache.students.length - studentPLAvgs.length
    };
}

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
                     color:#333;">Mastery Outlook</div>
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

        <div id="od-threshold-control" style="display:flex; align-items:center;
             gap:10px; padding:10px 12px; background:#f9f9f9; border-radius:8px;
             margin-bottom:1rem;">
            <span style="font-size:0.9rem; color:#666; font-weight:500;">Re-teach threshold:</span>
            <input type="range" id="od-threshold-slider" min="1.5" max="3.5"
                   step="0.1" value="2.2" style="width:150px; cursor:pointer;">
            <span id="od-threshold-value" style="font-size:0.95rem; font-weight:600;
                  color:#333; min-width:32px; text-align:center;">2.2</span>
        </div>

        <div id="od-body" style="display:grid;
             grid-template-columns:1fr 260px; gap:12px;">
            <div id="od-outcomes-col">
                <!-- Tab bar -->
                <div id="od-tab-bar" style="display:flex; gap:4px;
                     border-bottom:2px solid #e0e0e0; margin-bottom:8px;">
                    <button class="od-tab" data-tab="outcomes" style="${FONT}
                        font-size:13px; padding:8px 16px; cursor:pointer;
                        border:none; background:transparent; color:#666;
                        border-bottom:2px solid transparent; font-weight:400;">
                        Outcomes
                    </button>
                    <button class="od-tab" data-tab="heatmap" style="${FONT}
                        font-size:13px; padding:8px 16px; cursor:pointer;
                        border:none; background:transparent; color:#666;
                        border-bottom:2px solid transparent; font-weight:400;">
                        🔥 Heatmap
                    </button>
                </div>

                <!-- Outcomes view -->
                <div id="od-outcomes-view">
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

                <!-- Heatmap view -->
                <div id="od-heatmap-view" style="display:none;">
                </div>
            </div>
            <div id="od-sidebar"></div>
        </div>

        <div id="od-status-bar" style="font-size:0.8rem; color:#888;
             margin-top:12px; min-height:20px;"></div>
    `;

    return {
        titleEl:         containerEl.querySelector('#od-title'),
        subtitleEl:      containerEl.querySelector('#od-subtitle'),
        lastUpdatedEl:   containerEl.querySelector('#od-last-updated'),
        refreshBtn:      containerEl.querySelector('#od-refresh-btn'),
        thresholdSlider: containerEl.querySelector('#od-threshold-slider'),
        thresholdValue:  containerEl.querySelector('#od-threshold-value'),
        metricsEl:       containerEl.querySelector('#od-metrics'),
        outcomesEl:      containerEl.querySelector('#od-outcomes-list'),
        sidebarEl:       containerEl.querySelector('#od-sidebar'),
        statusEl:        containerEl.querySelector('#od-status-bar'),
        tabBar:          containerEl.querySelector('#od-tab-bar'),
        outcomesView:    containerEl.querySelector('#od-outcomes-view'),
        heatmapView:     containerEl.querySelector('#od-heatmap-view'),
        bodyEl:          containerEl.querySelector('#od-body'),
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
        logger.warn('[MasteryOutlook] Could not fetch outcome names', e);
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

let currentViewMode = 'outcomes';  // 'outcomes' or 'heatmap'

function renderLoadedState(shell, cache, onRefresh) {
    setLastUpdated(shell.lastUpdatedEl, cache.meta.computedAt);
    shell.subtitleEl.textContent =
        `${cache.meta.studentCount} students ·
         ${cache.meta.outcomeCount} outcomes ·
         Power Law predictions`;

    wireThresholdSlider(shell, cache);
    renderMetricCards(shell.metricsEl, cache);
    renderLoadedOutcomeRows(shell.outcomesEl, cache);
    renderSidebar(shell.sidebarEl, cache);

    wireRefreshButton(shell, onRefresh);
    wireTabBar(shell, cache);
}

// ─── Outcome row expansion ───────────────────────────────────────────────────

let expandedOutcomeId = null;
let activeTab = 'students';

function getCurrentThreshold() {
    const slider = document.querySelector('#od-threshold-slider');
    return slider ? parseFloat(slider.value) : 2.2;
}

function renderLoadedOutcomeRows(outcomesEl, cache) {
    outcomesEl.innerHTML = '';

    // Sort outcomes: Current Score → Excluded → Regular
    const currentScore = cache.outcomes.find(o => isCurrentScoreOutcome(o.title));
    const excluded = cache.outcomes.filter(o => isExcludedOutcome(o.title) && !isCurrentScoreOutcome(o.title));
    const regular = cache.outcomes.filter(o => isRegularOutcome(o));

    // Add "No Current Score found" message if missing
    if (!currentScore) {
        const noCurrentScore = document.createElement('div');
        noCurrentScore.style.cssText = `
            padding: 12px;
            font-size: 13px;
            color: #888;
            font-style: italic;
            margin-bottom: 6px;
        `;
        noCurrentScore.textContent = 'No Current Score found';
        outcomesEl.appendChild(noCurrentScore);
    }

    const sortedOutcomes = [
        ...(currentScore ? [currentScore] : []),
        ...excluded,
        ...regular
    ];

    // Track regular outcome numbering
    let regularIndex = 0;

    sortedOutcomes.forEach((outcome, i) => {
        const isSpecial = isSpecialOutcome(outcome.title);
        const displayNumber = isSpecial ? '' : ++regularIndex;
        const isCurrentScoreRow = isCurrentScoreOutcome(outcome.title);

        // For Current Score, use computed stats instead of cached stats
        const displayStats = isCurrentScoreRow ? computeCurrentScoreClassStats(cache) : outcome.classStats;

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
            <div style="font-size:13px; color:#999;">${displayNumber}</div>
            <div style="font-size:15px; font-weight:500; color:#333;
                 white-space:nowrap; overflow:hidden;
                 text-overflow:ellipsis;">${escapeHtml(outcome.title)}</div>
            <div style="text-align:center;">${plAvgChip(displayStats)}</div>
            <div>${spreadBar(displayStats)}</div>
            <div style="text-align:center; font-size:14px;
                 color:${displayStats.belowThresholdCount > 3 ? '#A32D2D' : '#666'};">
                ${displayStats.belowThresholdCount}
            </div>
            <div style="text-align:center;">${statusBadge(displayStats)}</div>
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

        // Add divider after last special outcome, before first regular
        const isLastSpecial = isSpecial &&
                              (i === sortedOutcomes.length - 1 || !isSpecialOutcome(sortedOutcomes[i + 1].title));

        if (isLastSpecial && regular.length > 0) {
            const divider = document.createElement('div');
            divider.style.cssText = `
                height: 1px;
                background: #e0e0e0;
                margin: 12px 0;
            `;
            outcomesEl.appendChild(divider);
        }
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
    const decliningCount = countDecliningStudents(outcome, cache);
    const growingCount = countGrowingStudents(outcome, cache);

    const tabs = [
        { id: 'students', label: `All Students (${cache.students.length})` },
        { id: 'struggling', label: `Struggling (${strugglingCount})` },
        { id: 'declining', label: `Declining (${decliningCount})` },
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
    const threshold = getCurrentThreshold();
    const isCurrentScore = isCurrentScoreOutcome(outcome.title);

    return cache.students.filter(student => {
        let plValue;

        if (isCurrentScore) {
            // For Current Score, use calculated PL Avg (average of regular outcome PL Predictions)
            plValue = calculateStudentPLAvg(student, cache);
        } else {
            // For regular outcomes, use stored plPrediction
            const outcomeData = student.outcomes.find(o => o.outcomeId === outcome.id);
            plValue = outcomeData ? outcomeData.plPrediction : null;
        }

        return plValue !== null && plValue < threshold;
    }).length;
}

function countDecliningStudents(outcome, cache) {
    // NOTE: For Current Score, this uses the outcome's own slope data (from Current Score attempts)
    // If we want to calculate a "meta-slope" based on how student PL Avgs are trending over time,
    // we would need to add special handling here similar to countStrugglingStudents()
    return cache.students.filter(student => {
        const outcomeData = student.outcomes.find(o => o.outcomeId === outcome.id);
        return outcomeData && outcomeData.slope !== null && outcomeData.slope < -0.05;
    }).length;
}

function countGrowingStudents(outcome, cache) {
    // NOTE: For Current Score, this uses the outcome's own slope data (from Current Score attempts)
    // If we want to calculate a "meta-slope" based on how student PL Avgs are trending over time,
    // we would need to add special handling here similar to countStrugglingStudents()
    return cache.students.filter(student => {
        const outcomeData = student.outcomes.find(o => o.outcomeId === outcome.id);
        return outcomeData && outcomeData.slope !== null && outcomeData.slope > 0.05;
    }).length;
}

function buildStudentTable(outcome, cache, filter) {
    const isCurrentScore = isCurrentScoreOutcome(outcome.title);

    let students = cache.students.map(student => {
        const outcomeData = student.outcomes.find(o => o.outcomeId === outcome.id);
        const studentRow = {
            id: student.id,  // Add student ID for linking
            name: student.name || student.sortableName,
            sortableName: student.sortableName,
            ...outcomeData
        };

        // For Current Score, override plPrediction with calculated PL Avg
        if (isCurrentScore) {
            studentRow.plPrediction = calculateStudentPLAvg(student, cache);
        }

        return studentRow;
    });

    const threshold = getCurrentThreshold();

    // Filter students based on active tab
    if (filter === 'struggling') {
        students = students.filter(s => s.plPrediction !== null && s.plPrediction < threshold);
    } else if (filter === 'declining') {
        students = students.filter(s => s.slope !== null && s.slope < -0.05);
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
    } else if (filter === 'declining') {
        // Declining: Sort by slope (most negative first)
        students.sort((a, b) => {
            if (a.slope === null) return 1;
            if (b.slope === null) return -1;
            return a.slope - b.slope;  // Most negative first
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
                <td style="font-size:13px; padding:6px 8px;">
                    <a href="/courses/${cache.meta.courseId}/pages/mastery-dashboard?cg_web=1&student_id=${s.id}"
                       style="color:#333; text-decoration:none;"
                       onmouseenter="this.style.textDecoration='underline'; this.style.color='#0374B5';"
                       onmouseleave="this.style.textDecoration='none'; this.style.color='#333';"
                       title="View ${escapeHtml(s.name)}'s individual mastery dashboard">
                        ${escapeHtml(s.name)}
                    </a>
                </td>
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

    // Use "PL Avg" header for Current Score, "PL Pred." for all others
    const plColumnHeader = isCurrentScore ? 'PL Avg' : 'PL Pred.';

    return `
        <table style="${FONT} width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
                <tr style="border-bottom:0.5px solid #e0e0e0;">
                    <th style="font-weight:500; color:#666; text-align:left;
                               padding:6px 8px; font-size:12px;">Student</th>
                    <th style="font-weight:500; color:#666; text-align:center;
                               padding:6px 8px; font-size:12px;">${plColumnHeader}</th>
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

// ─── Threshold slider ─────────────────────────────────────────────────────────

function wireThresholdSlider(shell, cache) {
    const courseId = getCourseId();
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

        // Re-render to apply new threshold
        // Note: This just updates the UI, doesn't recompute cache
        renderMetricCards(shell.metricsEl, cache);
        renderLoadedOutcomeRows(shell.outcomesEl, cache);
        renderSidebar(shell.sidebarEl, cache);
    });
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
            logger.error('[MasteryOutlook] Refresh failed', e);
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
    const threshold = getCurrentThreshold();
    const isReteach = classStats.plAvg < threshold;
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

async function tryLoadCache(courseId, apiClient) {
    try {
        const cache = await readMasteryOutlookCache(courseId, apiClient);
        if (cache) {
            logger.info('[MasteryOutlook] Cache loaded successfully');
            return {
                meta: cache.metadata,
                outcomes: cache.outcomes,
                students: cache.students
            };
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

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]
    );
}

// ─── Tab Bar (Outcomes / Heatmap) ────────────────────────────────────────────

/**
 * Wire tab bar to switch between outcomes view and heatmap view
 */
function wireTabBar(shell, cache) {
    const tabs = shell.tabBar.querySelectorAll('.od-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchToView(tabName, shell, cache);
        });
    });

    // Set initial active tab
    switchToView('outcomes', shell, cache);
}

/**
 * Switch between outcomes and heatmap views
 */
function switchToView(viewMode, shell, cache) {
    currentViewMode = viewMode;

    const tabs = shell.tabBar.querySelectorAll('.od-tab');
    tabs.forEach(tab => {
        const isActive = tab.dataset.tab === viewMode;
        tab.style.color = isActive ? '#185FA5' : '#666';
        tab.style.borderBottom = isActive ? '2px solid #185FA5' : '2px solid transparent';
        tab.style.fontWeight = isActive ? '500' : '400';
        tab.style.background = isActive ? '#fff' : 'transparent';
    });

    if (viewMode === 'outcomes') {
        // Show outcomes view, show sidebar
        shell.outcomesView.style.display = 'block';
        shell.heatmapView.style.display = 'none';
        shell.sidebarEl.style.display = 'block';
        shell.bodyEl.style.gridTemplateColumns = '1fr 260px';

        logger.debug('[MasteryOutlook] Switched to outcomes view');
    } else if (viewMode === 'heatmap') {
        // Show heatmap view, hide sidebar
        shell.outcomesView.style.display = 'none';
        shell.heatmapView.style.display = 'block';
        shell.sidebarEl.style.display = 'none';
        shell.bodyEl.style.gridTemplateColumns = '1fr';

        renderHeatmapView(shell, cache);

        logger.debug('[MasteryOutlook] Switched to heatmap view');
    }
}

/**
 * Render heatmap view
 */
function renderHeatmapView(shell, cache) {
    shell.heatmapView.innerHTML = '';

    if (!cache || !cache.students || cache.students.length === 0) {
        // No data state
        shell.heatmapView.innerHTML = `
            <div style="text-align:center; padding:2rem 1rem; color:#888;">
                <div style="font-size:2rem; margin-bottom:0.5rem;">🔥</div>
                <div style="font-size:0.95rem; font-weight:600;
                     color:#555; margin-bottom:0.4rem;">
                    No heatmap data yet
                </div>
                <div style="font-size:0.85rem; line-height:1.6; max-width:340px;
                     margin:0 auto;">
                    Hit <strong>Refresh Data</strong> to calculate Power Law
                    predictions and generate the class heatmap.
                </div>
            </div>
        `;
        return;
    }

    const heatmapGrid = buildHeatmapGrid(cache, {
        cellWidth: 80,
        cellHeight: 28,
        onFullScreen: () => {
            const courseName = window.ENV?.COURSE?.name || 'Course';
            openFullScreenHeatmap(cache, { courseName });
        }
    });

    shell.heatmapView.appendChild(heatmapGrid);
    logger.info('[MasteryOutlook] Heatmap rendered');
}