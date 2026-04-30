// src/masteryOutlook/outcomeSyncView.js
/**
 * Mastery Outlook — Outcome Sync view (peer of the Heatmap view).
 *
 * Owns the outcome-row list, per-outcome detail panel (tabs + filter tables),
 * the cross-outcome exceptions view, and the default (no-cache) state for
 * outcome rows. Conforms to the view-registry contract:
 *   mount(shell, cache, ctx) → { teardown, refresh }
 *
 * Per-mount state (expandedOutcomeId, activeTab, currentDetailTeardown) lives
 * in a closure created inside mountOutcomeSyncView so the host can teardown
 * and re-mount cleanly.
 *
 * Threshold + color scheme are read from ctx (getThreshold/getColorScheme) on
 * every render so chrome controls trigger refresh() without re-mounting.
 */

import { logger } from '../utils/logger.js';
import { escapeHtml } from '../utils/html.js';
import { getMasteryColor } from '../ui/masteryColors.js';
import { getSyncStatus, aggregateSyncStatus } from './plOutlookSyncStatus.js';
import {
    handleSyncOneStudent, handleConfirmOverride, handleDismissOverride, handleRevertOverride,
} from './plOutlookActions.js';
import { renderOutcomeStudentTable, wireOutcomeStudentTable } from './studentSyncTable.js';
import { fetchOutcomeNames } from './masteryOutlookDataService.js';
import { findMasteryDashboardPageUrl, getPage, updatePage } from '../services/pageService.js';
import { AVG_OUTCOME_NAME, EXCLUDED_OUTCOME_KEYWORDS } from '../config.js';

// ─── Outcome Type Helpers ────────────────────────────────────────────────────

export function isCurrentScoreOutcome(title) {
    return title === AVG_OUTCOME_NAME;
}

function isExcludedOutcome(title) {
    return EXCLUDED_OUTCOME_KEYWORDS.some(kw => title.includes(kw));
}

function isSpecialOutcome(title) {
    return isCurrentScoreOutcome(title) || isExcludedOutcome(title);
}

export function isRegularOutcome(outcome) {
    return !isSpecialOutcome(outcome.title);
}

/**
 * Calculate a student's PL Avg from their regular outcome PL Predictions.
 * Used for Current Score outcome rendering.
 */
function calculateStudentPLAvg(student, cache) {
    const regularOutcomes = cache.outcomes.filter(o => isRegularOutcome(o));

    const plPredictions = student.outcomes
        .filter(so => {
            const outcome = regularOutcomes.find(ro => String(ro.id) === String(so.outcomeId));
            return outcome && so.plPrediction !== null;
        })
        .map(so => so.plPrediction);

    if (plPredictions.length === 0) return null;

    return plPredictions.reduce((sum, p) => sum + p, 0) / plPredictions.length;
}

/**
 * Compute class stats for Current Score outcome based on student PL Avgs
 * (the average of each student's regular outcome PL Predictions).
 */
function computeCurrentScoreClassStats(cache, threshold) {
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

    const distribution = { '1': 0, '2': 0, '3': 0, '4': 0 };
    studentPLAvgs.forEach(plAvg => {
        if (plAvg < 1.5)      distribution['1']++;
        else if (plAvg < 2.5) distribution['2']++;
        else if (plAvg < 3.5) distribution['3']++;
        else                  distribution['4']++;
    });

    const classPLAvg = studentPLAvgs.reduce((sum, v) => sum + v, 0) / studentPLAvgs.length;
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

// ─── Container init (registry-driven) ────────────────────────────────────────

/**
 * Initialize the outcomes view's container with its column headers and the
 * outcomes-list mount point. Called by the host shell once per render so the
 * outcomes view owns its own internal DOM and the registry stays the single
 * source of truth for what each view contributes.
 *
 * @param {HTMLElement} containerEl
 */
export function initOutcomeSyncContainer(containerEl) {
    containerEl.innerHTML = `
        <div id="od-col-headers" class="od-col-headers">
            <div class="od-col-header">#</div>
            <div class="od-col-header">Outcome</div>
            <div class="od-col-header center">PL avg</div>
            <div class="od-col-header center">Spread</div>
            <div class="od-col-header center">Below threshold</div>
            <div></div>
        </div>
        <div id="od-outcomes-list"></div>`;
}

// ─── Default state (no cache) ────────────────────────────────────────────────

/**
 * Render the outcome-rows half of the Mastery Outlook default state: pull
 * outcome names from Canvas and render NE rows + a refresh prompt.
 *
 * @param {Object} shell
 * @param {string|number} courseId
 * @param {Object} apiClient
 */
export async function renderOutcomeSyncDefault(shell, courseId, apiClient) {
    let outcomes = [];
    try {
        outcomes = await fetchOutcomeNames(courseId, apiClient);
    } catch (e) {
        logger.warn('[MasteryOutlook] Could not fetch outcome names', e);
    }

    renderDefaultOutcomeRows(shell.outcomesEl, outcomes);

    if (outcomes.length === 0) {
        shell.outcomesEl.innerHTML = buildEmptyPrompt();
    }
}

function renderDefaultOutcomeRows(outcomesEl, outcomes) {
    outcomesEl.innerHTML = '';

    if (outcomes.length === 0) {
        outcomesEl.innerHTML = buildEmptyPrompt();
        return;
    }

    outcomes.forEach((outcome, i) => {
        const row = document.createElement('div');
        row.className = 'od-default-row';
        row.innerHTML = `
            <div class="od-num">${i + 1}</div>
            <div class="od-name">${escapeHtml(outcome.title)}</div>
            <div class="od-center">${neChip()}</div>
            <div>${emptySpread()}</div>
            <div class="od-below">—</div>
            <div></div>
        `;
        outcomesEl.appendChild(row);
    });

    const prompt = document.createElement('div');
    prompt.innerHTML = buildRefreshPrompt();
    outcomesEl.appendChild(prompt);
}

function buildEmptyPrompt() {
    return `
        <div class="od-empty-prompt">
            <div class="ep-icon">📋</div>
            <div class="ep-title">No outcome data yet</div>
            <div class="ep-body">
                Hit <strong>Refresh Data</strong> to calculate Power Law
                predictions for all students and outcomes in this course.
            </div>
        </div>`;
}

function buildRefreshPrompt() {
    return `
        <div class="od-refresh-prompt">
            Outcome names loaded from Canvas. Hit
            <strong>Refresh Data</strong> to calculate Power Law predictions,
            class distribution, and intervention flags.
        </div>`;
}

function neChip() {
    return `<span class="od-ne-chip">NE</span>`;
}

function emptySpread() {
    return `<div class="od-empty-spread"></div>`;
}

// ─── Cross-outcome exceptions view ───────────────────────────────────────────

/**
 * Build the cross-outcome exceptions table for 3e.
 * Shows every override, locked Will Post, and ignored alignment across all outcomes.
 * Read-only — no action buttons.
 *
 * Exported so the host's "View exceptions" panel can render this without
 * mounting the full outcome view.
 *
 * @param {Object}   cache
 * @param {Object}   opts
 * @param {boolean}  opts.showOverrides   - Include manual_override + locked Will Post rows
 * @param {boolean}  opts.showIgnored     - Include ignored alignment rows
 * @returns {string} HTML string
 */
export function buildCrossOutcomeExceptionsView(cache, { showOverrides = true, showIgnored = true } = {}) {
    const syncState    = cache.sync_state ?? {};
    const ignoredList  = cache.ignored_alignments ?? [];

    const outcomeById  = {};
    (cache.outcomes || []).forEach(o => { outcomeById[String(o.id)] = o; });
    const studentById  = {};
    (cache.students || []).forEach(s => { studentById[String(s.id)] = s; });

    const rows = [];

    if (showOverrides) {
        for (const [outcomeId, studentMap] of Object.entries(syncState)) {
            const outcome = outcomeById[outcomeId];
            if (!outcome) continue;

            for (const [studentId, entry] of Object.entries(studentMap)) {
                const student = studentById[studentId];
                if (!student) continue;
                if (!entry.manual_override && entry.will_post_lock !== 'locked') continue;

                const od         = student.outcomes?.find(o => String(o.outcomeId) === outcomeId);
                const typeParts  = [];
                if (entry.manual_override)              typeParts.push('Override');
                if (entry.will_post_lock === 'locked')  typeParts.push('Locked WP');

                rows.push({
                    outcomeName: outcome.title,
                    studentName: student.name || `Student ${studentId}`,
                    type:        typeParts.join(' + '),
                    typeClass:   'override',
                    canvas:      od?.canvasScore != null ? od.canvasScore.toFixed(2) : '—',
                    marzano:     od?.plPrediction != null ? od.plPrediction.toFixed(2) : 'NE',
                    willPost:    entry.will_post != null ? entry.will_post.toFixed(2) : '—',
                    note:        entry.will_post_note ?? '',
                    date:        entry.override_at ?? entry.last_synced_at ?? '',
                });
            }
        }
    }

    if (showIgnored) {
        for (const ia of ignoredList) {
            const outcome = outcomeById[String(ia.outcomeId)];
            const student = studentById[String(ia.studentId)];
            if (!outcome || !student) continue;

            rows.push({
                outcomeName: outcome.title,
                studentName: student.name || `Student ${ia.studentId}`,
                type:        'Ignored alignment',
                typeClass:   'ignored',
                canvas:      '—',
                marzano:     '—',
                willPost:    '—',
                note:        ia.reason ?? '',
                date:        ia.ignored_at ?? '',
            });
        }
    }

    if (rows.length === 0) {
        return `<p class="od-ex-empty padded">
            No overrides or ignored alignments recorded for this course.</p>`;
    }

    const rowsHtml = rows.map(r => {
        const dateDisp  = r.date ? new Date(r.date).toLocaleDateString() : '—';
        const pillClass = r.typeClass === 'override' ? 'override' : 'ignored';
        return `<tr>
            <td>${escapeHtml(r.outcomeName)}</td>
            <td class="od-name">${escapeHtml(r.studentName)}</td>
            <td><span class="od-ex-pill ${pillClass}">${escapeHtml(r.type)}</span></td>
            <td class="od-center">${r.canvas}</td>
            <td class="od-center">${r.marzano}</td>
            <td class="od-center">${r.willPost}</td>
            <td><div class="od-note-clip">${escapeHtml(r.note)}</div></td>
            <td class="od-date od-nowrap">${dateDisp}</td>
        </tr>`;
    }).join('');

    return `<table class="od-ex-table wide">
        <thead><tr>
            <th>Outcome</th>
            <th>Student</th>
            <th>Type</th>
            <th class="od-center">Canvas</th>
            <th class="od-center">Marzano</th>
            <th class="od-center">Will Post</th>
            <th>Note</th>
            <th>Date</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
    </table>`;
}

// ─── Mount ───────────────────────────────────────────────────────────────────

/**
 * Mount the Outcome Sync view.
 *
 * @param {Object} shell - shell handle from buildShell() in masteryOutlookView.js
 * @param {Object} cache - enriched mastery-outlook cache
 * @param {import('./viewRegistry.js').ViewContext} ctx
 * @returns {import('./viewRegistry.js').ViewController}
 */
export function mountOutcomeSyncView(shell, cache, ctx) {
    // Per-mount state. Module-level scope is intentionally avoided so the
    // host can teardown + remount cleanly without leaking selection.
    const state = {
        expandedOutcomeId:     null,
        activeTab:             'students',
        currentDetailTeardown: null,
    };

    /**
     * Get proficiency color based on PL prediction value, using the current
     * color scheme from ctx (so refresh() picks up scheme changes).
     */
    function profColor(v) {
        const c = getMasteryColor(v, { scheme: ctx.getColorScheme() });
        return { bg: c.bg, tx: c.fg, txOnDefault: c.fgOnSurface };
    }

    function plAvgChip(classStats) {
        if (classStats.plAvg === null) return neChip();
        const c = profColor(classStats.plAvg);
        return `<span class="od-pl-chip" style="background:${c.bg}; color:${c.tx};">
                ${classStats.plAvg.toFixed(2)}
                </span>`;
    }

    function spreadBar(classStats) {
        const total = Object.values(classStats.distribution).reduce((a, b) => a + b, 0);
        if (total === 0) return emptySpread();
        const d = classStats.distribution;

        const level4Color = profColor(4.0).bg;
        const level3Color = profColor(3.0).bg;
        const level2Color = profColor(2.0).bg;
        const level1Color = profColor(1.0).bg;

        return `<div class="od-spread-bar">
            <div style="width:${d['4']/total*100}%; background:${level4Color};"></div>
            <div style="width:${d['3']/total*100}%; background:${level3Color};"></div>
            <div style="width:${d['2']/total*100}%; background:${level2Color};"></div>
            <div style="width:${d['1']/total*100}%; background:${level1Color};"></div>
        </div>`;
    }

    /**
     * Build the sync count summary line shown beneath the outcome name in
     * each collapsed outcome row header (spec Section 12).
     */
    function buildSyncSummaryLine(outcome) {
        const plConfig = {
            pl_assignments: cache.pl_assignments ?? {},
            sync_state:     cache.sync_state     ?? {},
        };

        const counts = aggregateSyncStatus(cache.students || [], outcome.id, plConfig);

        if (!counts.hasSetup) return '';

        if (counts.needsSync > 0 || counts.possibleOverride > 0 || counts.manualOverride > 0) {
            const parts = [];
            if (counts.needsSync       > 0) parts.push(`<span class="needs">↑ ${counts.needsSync} need sync</span>`);
            if (counts.possibleOverride > 0) parts.push(`<span class="override">⚑ ${counts.possibleOverride} override?</span>`);
            if (counts.manualOverride   > 0) parts.push(`<span class="override">⚑ ${counts.manualOverride} confirmed</span>`);
            return `<div class="od-sync-summary">${parts.join(' <span class="sep">·</span> ')}</div>`;
        }

        if (counts.synced > 0 && counts.needsSync === 0 && counts.possibleOverride === 0) {
            return `<div class="od-sync-summary synced">✓ All synced</div>`;
        }

        return '';
    }

    function countStrugglingStudents(outcome) {
        const threshold = ctx.getThreshold();
        const isCurrentScore = isCurrentScoreOutcome(outcome.title);

        return cache.students.filter(student => {
            let plValue;
            if (isCurrentScore) {
                plValue = calculateStudentPLAvg(student, cache);
            } else {
                const outcomeData = student.outcomes.find(o => o.outcomeId === outcome.id);
                plValue = outcomeData ? outcomeData.plPrediction : null;
            }
            return plValue !== null && plValue < threshold;
        }).length;
    }

    function countDecliningStudents(outcome) {
        return cache.students.filter(student => {
            const outcomeData = student.outcomes.find(o => o.outcomeId === outcome.id);
            return outcomeData && outcomeData.slope !== null && outcomeData.slope < -0.05;
        }).length;
    }

    function countGrowingStudents(outcome) {
        return cache.students.filter(student => {
            const outcomeData = student.outcomes.find(o => o.outcomeId === outcome.id);
            return outcomeData && outcomeData.slope !== null && outcomeData.slope > 0.05;
        }).length;
    }

    function countExceptionStudents(outcome) {
        const syncState    = cache.sync_state ?? {};
        const outcomeSync  = syncState[String(outcome.id)] ?? {};
        const ignored      = (cache.ignored_alignments ?? []).filter(
            ia => String(ia.outcomeId) === String(outcome.id)
        );
        const ignoredStudentIds = new Set(ignored.map(ia => String(ia.studentId)));

        return cache.students.filter(student => {
            const sId   = String(student.id);
            const entry = outcomeSync[sId];
            return (
                entry?.will_post_lock === 'locked' ||
                entry?.manual_override === true     ||
                ignoredStudentIds.has(sId)
            );
        }).length;
    }

    /**
     * Build the per-outcome Exceptions table (read-only).
     * Shows students with locked Will Post, confirmed overrides, or ignored alignments.
     */
    function buildExceptionsTable(outcome) {
        const syncState   = cache.sync_state ?? {};
        const outcomeSync = syncState[String(outcome.id)] ?? {};
        const ignored     = (cache.ignored_alignments ?? []).filter(
            ia => String(ia.outcomeId) === String(outcome.id)
        );
        const ignoredStudentIds = new Set(ignored.map(ia => String(ia.studentId)));

        const exceptionStudents = cache.students.filter(student => {
            const sId   = String(student.id);
            const entry = outcomeSync[sId];
            return (
                entry?.will_post_lock === 'locked' ||
                entry?.manual_override === true     ||
                ignoredStudentIds.has(sId)
            );
        });

        if (exceptionStudents.length === 0) {
            return `<p class="od-ex-empty">No exceptions for this outcome.</p>`;
        }

        const rows = exceptionStudents.map(student => {
            const sId       = String(student.id);
            const entry     = outcomeSync[sId] ?? {};
            const od        = student.outcomes?.find(o => String(o.outcomeId) === String(outcome.id));
            const canvasDisp = od?.canvasScore != null ? od.canvasScore.toFixed(2) : '—';
            const marzDisp   = od?.plPrediction != null ? od.plPrediction.toFixed(2) : 'NE';
            const wpDisp     = entry.will_post != null ? entry.will_post.toFixed(2) : '—';
            const note       = escapeHtml(entry.will_post_note ?? '');
            const dateRaw    = entry.override_at ?? entry.last_synced_at ?? '';
            const dateFmt    = dateRaw ? new Date(dateRaw).toLocaleDateString() : '—';

            const types = [];
            if (entry.manual_override)             types.push('<span class="od-ex-pill override">Override</span>');
            if (entry.will_post_lock === 'locked') types.push('<span class="od-ex-pill locked">Locked WP</span>');
            if (ignoredStudentIds.has(sId))        types.push('<span class="od-ex-pill ignored">Ignored</span>');

            return `<tr>
                <td class="od-name">${escapeHtml(student.name || `Student ${student.id}`)}</td>
                <td>${types.join(' ')}</td>
                <td class="od-center">${canvasDisp}</td>
                <td class="od-center">${marzDisp}</td>
                <td class="od-center">${wpDisp}</td>
                <td class="od-note">${note}</td>
                <td class="od-date">${dateFmt}</td>
            </tr>`;
        }).join('');

        return `<table class="od-ex-table">
            <thead><tr>
                <th>Student</th>
                <th>Type</th>
                <th class="od-center">Canvas</th>
                <th class="od-center">Marzano</th>
                <th class="od-center">Will Post</th>
                <th>Note</th>
                <th>Date</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    }

    // ─── Filter tables (Struggling / Declining / Growing) ────────────────────
    // The All-Students sync table lives in ./studentSyncTable.js
    // ────────────────────────────────────────────────────────────────────────

    function buildStudentTable(outcome, filter) {
        const isCurrentScore = isCurrentScoreOutcome(outcome.title);
        const plConfig = { pl_assignments: cache.pl_assignments ?? {}, sync_state: cache.sync_state ?? {} };

        let students = cache.students.map(student => {
            const outcomeData = student.outcomes.find(o => o.outcomeId === outcome.id);
            const studentRow = {
                id: student.id,
                name: student.name || student.sortableName,
                sortableName: student.sortableName,
                ...outcomeData
            };

            if (isCurrentScore) {
                studentRow.plPrediction = calculateStudentPLAvg(student, cache);
            }

            return studentRow;
        });

        const threshold = ctx.getThreshold();

        if (filter === 'struggling') {
            students = students.filter(s => s.plPrediction !== null && s.plPrediction < threshold);
        } else if (filter === 'declining') {
            students = students.filter(s => s.slope !== null && s.slope < -0.05);
        } else if (filter === 'growing') {
            students = students.filter(s => s.slope !== null && s.slope > 0.05);
        }

        if (filter === 'students') {
            students.sort((a, b) => {
                const nameA = (a.sortableName || a.name || '').toLowerCase();
                const nameB = (b.sortableName || b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
        } else if (filter === 'declining') {
            students.sort((a, b) => {
                if (a.slope === null) return 1;
                if (b.slope === null) return -1;
                return a.slope - b.slope;
            });
        } else {
            students.sort((a, b) => {
                if (a.plPrediction === null) return 1;
                if (b.plPrediction === null) return -1;
                return a.plPrediction - b.plPrediction;
            });
        }

        if (students.length === 0) {
            return `<p class="od-stu-empty">No students in this category.</p>`;
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

            const scoreHistory = (s.attempts || [])
                .map(a => `<span class="od-score-history-attempt">${a.score}</span>`)
                .join(' ');

            const isFlagged = s.plPrediction !== null && s.plPrediction < threshold;

            const syncInfo = getSyncStatus(s.id, outcome.id, s.plPrediction, s.canvasScore, plConfig);
            const oIdStr   = String(outcome.id);
            const sIdStr   = String(s.id);
            let syncBadgeHtml = `<span class="sync-badge ${syncInfo.cssClass}">${syncInfo.label}</span>`;
            let syncActionsHtml = '';
            if (syncInfo.status === 'needs_sync') {
                syncActionsHtml = `<button class="btn btn-sm btn-ghost od-sync-action-btn"
                    data-action="sync-one" data-student-id="${sIdStr}" data-outcome-id="${oIdStr}">↑ Sync</button>`;
            } else if (syncInfo.status === 'possible_override') {
                syncActionsHtml = `
                    <button class="btn btn-sm btn-danger od-sync-action-btn compact"
                        data-action="confirm-override" data-student-id="${sIdStr}" data-outcome-id="${oIdStr}">Keep Canvas</button>
                    <button class="btn btn-sm btn-ghost od-sync-action-btn compact"
                        data-action="dismiss-override" data-student-id="${sIdStr}" data-outcome-id="${oIdStr}">Use PL</button>`;
            } else if (syncInfo.status === 'manual_override') {
                syncActionsHtml = `<button class="btn btn-sm btn-warn od-sync-action-btn compact"
                    data-action="revert-override" data-student-id="${sIdStr}" data-outcome-id="${oIdStr}">Revert to PL</button>`;
            }

            const masteryDashboardUrl = cache.meta.masteryDashboardUrl || 'mastery-dashboard';

            return `
                <tr class="${isFlagged ? 'od-flagged' : ''}">
                    <td class="od-name">
                        <a class="od-stu-link"
                           href="/courses/${cache.meta.courseId}/pages/${masteryDashboardUrl}?cg_web=1&student_id=${s.id}"
                           title="View ${escapeHtml(s.name)}'s individual mastery dashboard">
                            ${escapeHtml(s.name)}
                        </a>
                    </td>
                    <td class="od-pill-cell">
                        <span class="od-stu-pl-pill"
                              style="background:${c.bg}; color:${c.tx};">${plDisplay}</span>
                    </td>
                    <td class="od-center">${canvasScoreDisplay}</td>
                    <td class="od-sync-cell">
                        <div class="od-sync-actions">
                            ${syncBadgeHtml}
                            ${syncActionsHtml}
                        </div>
                    </td>
                    <td class="od-center">${decayingAvgDisplay}</td>
                    <td class="od-center">${meanDisplay}</td>
                    <td class="od-center">${recentDisplay}</td>
                    <td class="od-center">
                        <span class="od-trend" style="color:${trendColor};">${trendIcon}</span>
                    </td>
                    <td class="od-history">${scoreHistory}</td>
                </tr>`;
        }).join('');

        const plColumnHeader = isCurrentScore ? 'PL Avg' : 'PL Pred.';

        return `
            <table class="od-stu-table">
                <thead>
                    <tr>
                        <th>Student</th>
                        <th class="od-center">${plColumnHeader}</th>
                        <th class="od-center">Canvas Score</th>
                        <th class="od-center">Sync Status</th>
                        <th class="od-center">Decaying Avg</th>
                        <th class="od-center">Mean</th>
                        <th class="od-center">Recent</th>
                        <th class="od-center">Trend</th>
                        <th>Score History</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHTML}
                </tbody>
            </table>`;
    }

    // ─── Outcome rows + per-outcome detail panel ─────────────────────────────

    function buildOutcomeDetailPanel(outcome) {
        const panel = document.createElement('div');
        panel.className = 'od-detail-panel';

        const tabBar = document.createElement('div');
        tabBar.className = 'od-detail-tabs';

        const strugglingCount  = countStrugglingStudents(outcome);
        const decliningCount   = countDecliningStudents(outcome);
        const growingCount     = countGrowingStudents(outcome);
        const exceptionsCount  = countExceptionStudents(outcome);

        const tabs = [
            { id: 'students',   label: `All Students (${cache.students.length})` },
            { id: 'struggling', label: `Struggling (${strugglingCount})` },
            { id: 'declining',  label: `Declining (${decliningCount})` },
            { id: 'growing',    label: `Growing (${growingCount})` },
            // Only show the Exceptions tab when there are exceptions to review (3d)
            ...(exceptionsCount > 0
                ? [{ id: 'exceptions', label: `Exceptions (${exceptionsCount})` }]
                : []),
        ];

        tabs.forEach(tab => {
            const tabBtn = document.createElement('button');
            const isActive = state.activeTab === tab.id;
            tabBtn.className = 'od-detail-tab';
            tabBtn.style.cssText = `
                color:${isActive ? '#185FA5' : '#666'};
                border-bottom:2px solid ${isActive ? '#185FA5' : 'transparent'};
                background:${isActive ? '#fff' : 'transparent'};
                font-weight:${isActive ? '500' : '400'};`;
            tabBtn.textContent = tab.label;
            tabBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                state.activeTab = tab.id;
                renderRows();
            });
            tabBar.appendChild(tabBtn);
        });

        panel.appendChild(tabBar);

        const content = document.createElement('div');
        content.className = 'od-detail-content';

        const renderTable = () => {
            if (state.activeTab === 'exceptions') {
                content.innerHTML = buildExceptionsTable(outcome);
                return;
            }
            if (state.activeTab === 'students') {
                content.innerHTML = renderOutcomeStudentTable(outcome, cache);
                return;
            }
            content.innerHTML = buildStudentTable(outcome, state.activeTab);
        };
        renderTable();

        // ── Legacy per-row actions (non-students tabs only) ──────────────────
        content.addEventListener('click', async (e) => {
            const el = e.target.closest('[data-action]');
            if (!el) return;

            const action      = el.dataset.action;
            const stuId       = el.dataset.stu || el.dataset.studentId;
            const oId         = el.dataset.oid || el.dataset.outcomeId;
            const outcomeName = outcome.title || String(outcome.id);
            const courseId    = ctx.courseId;
            const apiClient   = ctx.apiClient;

            if (action === 'sync-one' && el.tagName === 'BUTTON') {
                if (el.disabled) return;
                el.disabled = true;
                el.textContent = '…';
                try {
                    await handleSyncOneStudent({ courseId, outcomeId: oId, outcomeName, studentId: stuId, apiClient, onRerender: renderTable });
                } catch (err) {
                    logger.error('[MasteryOutlook] sync-one failed', err);
                    el.disabled = false; el.textContent = '↑ Sync';
                }
                return;
            }
            if (action === 'confirm-override') { await handleConfirmOverride({ courseId, outcomeId: oId, studentId: stuId, apiClient, onRerender: renderTable }); return; }
            if (action === 'dismiss-override') { await handleDismissOverride({ courseId, outcomeId: oId, outcomeName, studentId: stuId, apiClient, onRerender: renderTable }); return; }
            if (action === 'revert-override')  { await handleRevertOverride({ courseId, outcomeId: oId, outcomeName, studentId: stuId, apiClient, onRerender: renderTable }); return; }
        });

        // ── Student-table slice (os-* + dot-* + os-note) ─────────────────────
        // Owns its own document-level "click outside dot" listener; teardown is
        // captured into closure state so the next render can release it.
        state.currentDetailTeardown = wireOutcomeStudentTable({
            contentEl: content,
            outcome,
            cache,
            courseId:  ctx.courseId,
            apiClient: ctx.apiClient,
            renderTable,
        });

        panel.appendChild(content);

        return panel;
    }

    function renderRows() {
        // Tear down listeners owned by the previous detail panel before its DOM
        // is dropped, so document-level handlers don't accumulate across renders.
        if (typeof state.currentDetailTeardown === 'function') {
            try { state.currentDetailTeardown(); } catch (err) { logger.warn('[MasteryOutlook] detail teardown failed', err); }
            state.currentDetailTeardown = null;
        }
        const outcomesEl = shell.outcomesEl;
        outcomesEl.innerHTML = '';

        const threshold = ctx.getThreshold();

        // Sort outcomes: Current Score → Excluded → Regular
        const currentScore = cache.outcomes.find(o => isCurrentScoreOutcome(o.title));
        const excluded = cache.outcomes.filter(o => isExcludedOutcome(o.title) && !isCurrentScoreOutcome(o.title));
        const regular = cache.outcomes.filter(o => isRegularOutcome(o));

        if (!currentScore) {
            const noCurrentScore = document.createElement('div');
            noCurrentScore.className = 'od-no-current-score';
            noCurrentScore.textContent = 'No Current Score found';
            outcomesEl.appendChild(noCurrentScore);
        }

        // Sort regular outcomes if custom order exists.
        // Note: wiki page stores IDs as strings; outcome.id from cache is a
        // number — coerce to string for comparison.
        if (cache.meta.customOutcomeOrder && Array.isArray(cache.meta.customOutcomeOrder)) {
            regular.sort((a, b) => {
                const indexA = cache.meta.customOutcomeOrder.indexOf(String(a.id));
                const indexB = cache.meta.customOutcomeOrder.indexOf(String(b.id));
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return 0;
            });
        }

        const sortedOutcomes = [
            ...(currentScore ? [currentScore] : []),
            ...excluded,
            ...regular
        ];

        let regularIndex = 0;

        sortedOutcomes.forEach((outcome, i) => {
            const isSpecial = isSpecialOutcome(outcome.title);
            const displayNumber = isSpecial ? '' : ++regularIndex;
            const isCurrentScoreRow = isCurrentScoreOutcome(outcome.title);

            // For Current Score, use computed stats instead of cached stats
            const displayStats = isCurrentScoreRow ? computeCurrentScoreClassStats(cache, threshold) : outcome.classStats;

            const outcomeContainer = document.createElement('div');
            outcomeContainer.className = 'od-outcome-container';

            const row = document.createElement('div');
            const isExpanded = state.expandedOutcomeId === outcome.id;
            row.className = `od-outcome-row${isExpanded ? ' expanded' : ''}`;

            const chevron = isExpanded ? '▼' : '›';
            const belowFlag = displayStats.belowThresholdCount > 3 ? ' flag' : '';

            // 2i — sync count summary line shown beneath the outcome name
            const syncSummaryHtml = buildSyncSummaryLine(outcome);

            row.innerHTML = `
                <div class="od-row-number row-num">${displayNumber}</div>
                <div>
                    <div class="row-title">${escapeHtml(outcome.title)}</div>
                    ${syncSummaryHtml}
                </div>
                <div class="row-cell-center">${plAvgChip(displayStats)}</div>
                <div>${spreadBar(displayStats)}</div>
                <div class="row-below${belowFlag}">${displayStats.belowThresholdCount}</div>
                <div class="row-chevron">${chevron}</div>
            `;

            row.addEventListener('click', () => {
                state.expandedOutcomeId = (state.expandedOutcomeId === outcome.id) ? null : outcome.id;
                state.activeTab = 'students';
                renderRows();
            });

            outcomeContainer.appendChild(row);

            if (isExpanded) {
                const detailPanel = buildOutcomeDetailPanel(outcome);
                outcomeContainer.appendChild(detailPanel);
            }

            if (!isSpecial) {
                outcomeContainer.draggable = true;
                outcomeContainer.dataset.outcomeId = outcome.id;

                outcomeContainer.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', outcome.id);
                    outcomeContainer.style.opacity = '0.5';
                });

                outcomeContainer.addEventListener('dragend', () => {
                    outcomeContainer.style.opacity = '1';

                    const newOrder = [];
                    outcomesEl.querySelectorAll('[data-outcome-id]').forEach(el => {
                        newOrder.push(el.dataset.outcomeId);
                    });

                    if (JSON.stringify(newOrder) !== JSON.stringify(cache.meta.customOutcomeOrder)) {
                        cache.meta.customOutcomeOrder = newOrder;
                        saveCustomOutcomeOrder(newOrder);
                        let newIndex = 0;
                        outcomesEl.querySelectorAll('[data-outcome-id]').forEach(el => {
                            newIndex++;
                            const numEl = el.querySelector('.od-row-number');
                            if (numEl) numEl.textContent = newIndex;
                        });
                    }
                });

                outcomeContainer.addEventListener('dragover', (e) => {
                    e.preventDefault(); // allow drop
                    const bounding = outcomeContainer.getBoundingClientRect();
                    const offset = bounding.y + (bounding.height / 2);
                    if (e.clientY - offset > 0) {
                        outcomeContainer.style.borderBottom = '2px solid #0374B5';
                        outcomeContainer.style.borderTop = '';
                    } else {
                        outcomeContainer.style.borderTop = '2px solid #0374B5';
                        outcomeContainer.style.borderBottom = '';
                    }
                });

                outcomeContainer.addEventListener('dragleave', () => {
                    outcomeContainer.style.borderTop = '';
                    outcomeContainer.style.borderBottom = '';
                });

                outcomeContainer.addEventListener('drop', (e) => {
                    e.preventDefault();
                    outcomeContainer.style.borderTop = '';
                    outcomeContainer.style.borderBottom = '';

                    const draggedId = e.dataTransfer.getData('text/plain');
                    if (draggedId === outcome.id) return;

                    const draggedEl = outcomesEl.querySelector(`[data-outcome-id="${draggedId}"]`);
                    if (draggedEl) {
                        const bounding = outcomeContainer.getBoundingClientRect();
                        const offset = bounding.y + (bounding.height / 2);
                        if (e.clientY - offset > 0) {
                            outcomeContainer.after(draggedEl);
                        } else {
                            outcomeContainer.before(draggedEl);
                        }
                    }
                });
            }

            outcomesEl.appendChild(outcomeContainer);

            // Add divider after last special outcome, before first regular
            const isLastSpecial = isSpecial &&
                                  (i === sortedOutcomes.length - 1 || !isSpecialOutcome(sortedOutcomes[i + 1].title));

            if (isLastSpecial && regular.length > 0) {
                const divider = document.createElement('div');
                divider.className = 'od-outcome-divider';
                outcomesEl.appendChild(divider);
            }
        });
    }

    async function saveCustomOutcomeOrder(orderArray) {
        const courseId  = ctx.courseId;
        const apiClient = ctx.apiClient;
        try {
            const pageUrl = await findMasteryDashboardPageUrl(courseId, apiClient);
            if (!pageUrl) {
                logger.warn('[MasteryOutlook] Cannot save outcome order — Mastery Dashboard page not found');
                return;
            }
            const page = await getPage(courseId, pageUrl, apiClient);
            if (page && page.body) {
                let newBody = page.body;
                const orderJson = JSON.stringify(orderArray);
                // Canvas HTML-encodes the body on save (e.g. " → &quot;), so match both quote styles
                if (newBody.includes('data-outcome-order=')) {
                    newBody = newBody.replace(/data-outcome-order=(?:"[^"]*"|'[^']*')/, `data-outcome-order='${orderJson}'`);
                } else {
                    newBody = newBody.replace(/<div\s+id=["']mastery-dashboard-root["']/, `<div id="mastery-dashboard-root" data-outcome-order='${orderJson}'`);
                }
                await updatePage(courseId, pageUrl, { body: newBody }, apiClient);
                logger.info('[MasteryOutlook] Saved custom outcome order to wiki page');
            }
        } catch (e) {
            logger.warn('[MasteryOutlook] Failed to save custom outcome order', e);
        }
    }

    function teardown() {
        if (typeof state.currentDetailTeardown === 'function') {
            try { state.currentDetailTeardown(); } catch (err) { logger.warn('[MasteryOutlook] detail teardown failed', err); }
            state.currentDetailTeardown = null;
        }
    }

    renderRows();

    return { teardown, refresh: renderRows };
}