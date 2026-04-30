// src/masteryOutlook/outcomeRow.js
/**
 * Per-outcome row module — owns the collapsed row, the Initialize flow for
 * uninitialized outcomes, and the expanded detail panel (tabs + filter tables
 * + per-outcome exceptions). Peers with studentSyncTable.js, which it mounts
 * into the All-Students tab.
 *
 * Public surface:
 *   - isOutcomeInitialized(outcome, cache, { isSpecial }) → boolean
 *   - mountOutcomeRow({ outcome, cache, ctx, state, displayStats,
 *                       displayNumber, isSpecial, isCurrentScoreRow,
 *                       rerender, onReorderCommit }) → { rootEl, teardown }
 *
 * The host (outcomeSyncView.js) decides sort order, computes displayStats
 * (Current Score uses a derived stats object), and owns drag-reorder
 * persistence via the onReorderCommit callback.
 */

import { logger } from '../utils/logger.js';
import { escapeHtml } from '../utils/html.js';
import { getMasteryColor } from '../ui/masteryColors.js';
import { getSyncStatus, aggregateSyncStatus } from './plOutlookSyncStatus.js';
import {
    handleSyncOneStudent, handleConfirmOverride, handleDismissOverride, handleRevertOverride,
} from './plOutlookActions.js';
import { renderOutcomeStudentTable, wireOutcomeStudentTable } from './studentSyncTable.js';
import { runPLSync } from './plOutlookSync.js';
import { readMasteryOutlookCache } from './masteryOutlookCacheService.js';

// ─── Predicate ───────────────────────────────────────────────────────────────

/**
 * True when the outcome should be treated as set up for the PL Sync UI:
 *   - Special outcomes (Current Score + Excluded) never go through runPLSync.
 *     Current Score has its own assignment created by UpdateFlowStateMachine
 *     (see src/gradebook/stateHandlers.js); Excluded outcomes are not synced
 *     at all. Both are reported as initialized so the Initialize affordance
 *     is suppressed.
 *   - Regular outcomes are initialized once a Power Law assignment is recorded
 *     in cache.pl_assignments by handleCheckingSetup → CREATING_ASSIGNMENT.
 */
export function isOutcomeInitialized(outcome, cache, { isSpecial = false } = {}) {
    if (isSpecial) return true;
    return Boolean(cache?.pl_assignments?.[String(outcome.id)]?.assignment_id);
}

// ─── Tiny chip helpers (kept local to avoid a cycle with outcomeSyncView) ────

function neChip()       { return `<span class="od-ne-chip">NE</span>`; }
function emptySpread()  { return `<div class="od-empty-spread"></div>`; }

// ─── Color / chip / bar (closure over ctx for live color scheme) ─────────────

function makeRenderers(ctx) {
    function profColor(v) {
        const c = getMasteryColor(v, { scheme: ctx.getColorScheme() });
        return { bg: c.bg, tx: c.fg };
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
        const c4 = profColor(4.0).bg, c3 = profColor(3.0).bg;
        const c2 = profColor(2.0).bg, c1 = profColor(1.0).bg;
        return `<div class="od-spread-bar">
            <div style="width:${d['4']/total*100}%; background:${c4};"></div>
            <div style="width:${d['3']/total*100}%; background:${c3};"></div>
            <div style="width:${d['2']/total*100}%; background:${c2};"></div>
            <div style="width:${d['1']/total*100}%; background:${c1};"></div>
        </div>`;
    }

    return { profColor, plAvgChip, spreadBar };
}

// ─── Sync chip (collapsed row column 6) ──────────────────────────────────────

/**
 * Build the compact Canvas-sync chip rendered in the 6th column of each
 * collapsed outcome row. Returns a single span chip whose modifier reflects
 * the worst-priority state across the student cohort.
 *
 * Priority: needs > override > setup > synced > none.
 *
 * @param {Object} outcome
 * @param {Object} cache
 * @param {Object} [opts]
 * @param {boolean} [opts.isSpecial]
 * @returns {string} HTML
 */
function buildSyncChip(outcome, cache, { isSpecial = false } = {}) {
    if (!isOutcomeInitialized(outcome, cache, { isSpecial })) {
        return `<span class="od-sync-chip setup">⚙ Setup</span>`;
    }

    const plConfig = {
        pl_assignments: cache.pl_assignments ?? {},
        sync_state:     cache.sync_state     ?? {},
    };
    const counts = aggregateSyncStatus(cache.students || [], outcome.id, plConfig);

    if (counts.needsSync > 0) {
        return `<span class="od-sync-chip needs">↑ ${counts.needsSync} need</span>`;
    }
    if (counts.possibleOverride > 0 || counts.manualOverride > 0) {
        const n = counts.possibleOverride + counts.manualOverride;
        return `<span class="od-sync-chip override">⚑ ${n}</span>`;
    }
    if (counts.synced > 0) {
        return `<span class="od-sync-chip synced">✓ Synced</span>`;
    }
    return `<span class="od-sync-chip none">—</span>`;
}

// ─── Initialize panel (handoff sec. "initialize panel") ──────────────────────

function renderInitPanel(outcome, open) {
    const shortName = escapeHtml((outcome.title || '').split(' · ')[0] || outcome.title || '');
    return `
        <div class="init-panel${open ? ' open' : ''}" data-init-panel>
            <h4>Set up Power Law sync for ${shortName}</h4>
            <div>This will create a hidden Canvas assignment, fetch submission
                records for every student, and push Power Law projected scores
                to Canvas. Takes ~10 seconds.</div>
            <div class="init-steps">
                <div class="init-step"><span class="stp-num">1</span>Create assignment</div>
                <div class="init-step"><span class="stp-num">2</span>Fetch submissions</div>
                <div class="init-step"><span class="stp-num">3</span>Push to Canvas</div>
            </div>
            <div class="init-actions">
                <button class="btn btn-sm btn-primary" data-init-action="run">Initialize now</button>
                <button class="btn btn-sm" data-init-action="cancel">Cancel</button>
                <span class="init-progress" data-init-progress style="display:none;"></span>
            </div>
        </div>`;
}

// ─── Per-outcome counts (drive detail-panel tab labels) ──────────────────────

function calculateStudentPLAvg(student, cache, isRegularOutcome) {
    const regularOutcomes = cache.outcomes.filter(o => isRegularOutcome(o));
    const preds = student.outcomes
        .filter(so => {
            const outcome = regularOutcomes.find(ro => String(ro.id) === String(so.outcomeId));
            return outcome && so.plPrediction !== null;
        })
        .map(so => so.plPrediction);
    if (preds.length === 0) return null;
    return preds.reduce((sum, p) => sum + p, 0) / preds.length;
}

function countStrugglingStudents(outcome, cache, ctx, isRegularOutcome, isCurrentScoreRow) {
    const threshold = ctx.getThreshold();
    return cache.students.filter(student => {
        let plValue;
        if (isCurrentScoreRow) {
            plValue = calculateStudentPLAvg(student, cache, isRegularOutcome);
        } else {
            const od = student.outcomes.find(o => o.outcomeId === outcome.id);
            plValue = od ? od.plPrediction : null;
        }
        return plValue !== null && plValue < threshold;
    }).length;
}

function countDecliningStudents(outcome, cache) {
    return cache.students.filter(student => {
        const od = student.outcomes.find(o => o.outcomeId === outcome.id);
        return od && od.slope !== null && od.slope < -0.05;
    }).length;
}

function countGrowingStudents(outcome, cache) {
    return cache.students.filter(student => {
        const od = student.outcomes.find(o => o.outcomeId === outcome.id);
        return od && od.slope !== null && od.slope > 0.05;
    }).length;
}

function countExceptionStudents(outcome, cache) {
    const outcomeSync = (cache.sync_state ?? {})[String(outcome.id)] ?? {};
    const ignored     = (cache.ignored_alignments ?? []).filter(
        ia => String(ia.outcomeId) === String(outcome.id)
    );
    const ignoredIds = new Set(ignored.map(ia => String(ia.studentId)));

    return cache.students.filter(student => {
        const sId   = String(student.id);
        const entry = outcomeSync[sId];
        return (
            entry?.will_post_lock === 'locked' ||
            entry?.manual_override === true     ||
            ignoredIds.has(sId)
        );
    }).length;
}

// ─── Per-outcome exceptions table (detail panel "Exceptions" tab) ────────────

function buildExceptionsTable(outcome, cache) {
    const outcomeSync = (cache.sync_state ?? {})[String(outcome.id)] ?? {};
    const ignored     = (cache.ignored_alignments ?? []).filter(
        ia => String(ia.outcomeId) === String(outcome.id)
    );
    const ignoredIds = new Set(ignored.map(ia => String(ia.studentId)));

    const exceptionStudents = cache.students.filter(student => {
        const sId   = String(student.id);
        const entry = outcomeSync[sId];
        return (
            entry?.will_post_lock === 'locked' ||
            entry?.manual_override === true     ||
            ignoredIds.has(sId)
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
        if (ignoredIds.has(sId))               types.push('<span class="od-ex-pill ignored">Ignored</span>');

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

// ─── Filter tables (Struggling / Declining / Growing) ────────────────────────

function buildStudentTable(outcome, filter, cache, ctx, isCurrentScoreRow, isRegularOutcome, profColor) {
    const plConfig = { pl_assignments: cache.pl_assignments ?? {}, sync_state: cache.sync_state ?? {} };

    let students = cache.students.map(student => {
        const od = student.outcomes.find(o => o.outcomeId === outcome.id);
        const row = {
            id: student.id,
            name: student.name || student.sortableName,
            sortableName: student.sortableName,
            ...od
        };
        if (isCurrentScoreRow) {
            row.plPrediction = calculateStudentPLAvg(student, cache, isRegularOutcome);
        }
        return row;
    });

    const threshold = ctx.getThreshold();

    if      (filter === 'struggling') students = students.filter(s => s.plPrediction !== null && s.plPrediction < threshold);
    else if (filter === 'declining')  students = students.filter(s => s.slope !== null && s.slope < -0.05);
    else if (filter === 'growing')    students = students.filter(s => s.slope !== null && s.slope > 0.05);

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
            ? s.canvasScore.toFixed(2) : '—';
        const decayingAvgDisplay = s.decayingAvg !== null ? s.decayingAvg.toFixed(2) : '—';
        const meanDisplay        = s.mean !== null ? s.mean.toFixed(2) : '—';
        const recentDisplay      = s.mostRecent !== null ? s.mostRecent.toFixed(2) : '—';

        let trendIcon = '→', trendColor = '#999';
        if (s.slope !== null) {
            if (s.slope > 0.1)       { trendIcon = '▲'; trendColor = '#0F6E56'; }
            else if (s.slope < -0.1) { trendIcon = '▼'; trendColor = '#A32D2D'; }
        }

        const scoreHistory = (s.attempts || [])
            .map(a => `<span class="od-score-history-attempt">${a.score}</span>`).join(' ');

        const isFlagged = s.plPrediction !== null && s.plPrediction < threshold;

        const syncInfo = getSyncStatus(s.id, outcome.id, s.plPrediction, s.canvasScore, plConfig);
        const oIdStr   = String(outcome.id);
        const sIdStr   = String(s.id);
        const syncBadgeHtml = `<span class="sync-badge ${syncInfo.cssClass}">${syncInfo.label}</span>`;
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

    const plColumnHeader = isCurrentScoreRow ? 'PL Avg' : 'PL Pred.';

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

// ─── Detail panel (tabs + content) ───────────────────────────────────────────

function buildOutcomeDetailPanel({
    outcome, cache, ctx, state, isCurrentScoreRow, isRegularOutcome,
    profColor, rerender,
}) {
    const panel = document.createElement('div');
    panel.className = 'od-detail-panel';

    const tabBar = document.createElement('div');
    tabBar.className = 'od-detail-tabs';

    const strugglingCount  = countStrugglingStudents(outcome, cache, ctx, isRegularOutcome, isCurrentScoreRow);
    const decliningCount   = countDecliningStudents(outcome, cache);
    const growingCount     = countGrowingStudents(outcome, cache);
    const exceptionsCount  = countExceptionStudents(outcome, cache);

    const tabs = [
        { id: 'students',   label: `All Students (${cache.students.length})` },
        { id: 'struggling', label: `Struggling (${strugglingCount})` },
        { id: 'declining',  label: `Declining (${decliningCount})` },
        { id: 'growing',    label: `Growing (${growingCount})` },
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
            rerender();
        });
        tabBar.appendChild(tabBtn);
    });

    panel.appendChild(tabBar);

    const content = document.createElement('div');
    content.className = 'od-detail-content';

    const renderTable = () => {
        if (state.activeTab === 'exceptions') {
            content.innerHTML = buildExceptionsTable(outcome, cache);
            return;
        }
        if (state.activeTab === 'students') {
            content.innerHTML = renderOutcomeStudentTable(outcome, cache);
            return;
        }
        content.innerHTML = buildStudentTable(
            outcome, state.activeTab, cache, ctx, isCurrentScoreRow, isRegularOutcome, profColor
        );
    };
    renderTable();

    // Legacy per-row actions (non-students tabs only) — students tab is owned
    // by wireOutcomeStudentTable below.
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

    // Student-table slice owns its document-level "click outside dot" listener;
    // teardown is captured so the parent can release it on rebuild.
    const detailTeardown = wireOutcomeStudentTable({
        contentEl: content,
        outcome,
        cache,
        courseId:  ctx.courseId,
        apiClient: ctx.apiClient,
        renderTable,
    });

    panel.appendChild(content);

    return { panel, detailTeardown };
}

// ─── Initialize flow (CHECKING_SETUP → CREATING_ASSIGNMENT → ...) ────────────

/**
 * After runPLSync writes a new pl_assignments entry to the cache file, mirror
 * the change into the in-memory cache so the next rerender shows the
 * initialized branch without needing a full data refresh.
 */
async function refreshCacheConfigInPlace(cache, ctx) {
    try {
        const fresh = await readMasteryOutlookCache(ctx.courseId, ctx.apiClient);
        if (!fresh) return;
        cache.pl_assignments = fresh.pl_assignments ?? cache.pl_assignments ?? {};
        cache.sync_state     = fresh.sync_state     ?? cache.sync_state     ?? {};
    } catch (e) {
        logger.warn('[MasteryOutlook] refreshCacheConfigInPlace failed', e);
    }
}

function wireInitFlow(rootEl, outcome, cache, ctx, rerender) {
    const setupBtn   = rootEl.querySelector('[data-init-action="setup"]');
    const cancelBtn  = rootEl.querySelector('[data-init-action="cancel"]');
    const runBtn     = rootEl.querySelector('[data-init-action="run"]');
    const panel      = rootEl.querySelector('[data-init-panel]');
    const progressEl = rootEl.querySelector('[data-init-progress]');

    if (setupBtn) {
        setupBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            panel?.classList.add('open');
        });
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            panel?.classList.remove('open');
        });
    }
    if (runBtn) {
        runBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (runBtn.disabled) return;
            runBtn.disabled = true;
            if (cancelBtn) cancelBtn.disabled = true;
            if (progressEl) {
                progressEl.style.display = '';
                progressEl.textContent = 'Starting…';
            }
            try {
                await runPLSync({
                    courseId:    ctx.courseId,
                    outcomeId:   outcome.id,
                    outcomeName: outcome.title || String(outcome.id),
                    apiClient:   ctx.apiClient,
                    onProgress:  (_state, _name, msg) => {
                        if (progressEl && msg) progressEl.textContent = msg;
                    },
                });
                await refreshCacheConfigInPlace(cache, ctx);
                rerender();
            } catch (err) {
                logger.error('[MasteryOutlook] Initialize failed', err);
                if (progressEl) progressEl.textContent = `Failed: ${err?.message || err}`;
                runBtn.disabled = false;
                if (cancelBtn) cancelBtn.disabled = false;
            }
        });
    }
}

// ─── Public: mount a single outcome row ──────────────────────────────────────

/**
 * Build and wire a single outcome's container (collapsed row + optional
 * init panel + optional expanded detail panel). Returns the root element
 * and a teardown that releases any document-level listeners owned by the
 * detail panel.
 *
 * @param {Object}   args
 * @param {Object}   args.outcome
 * @param {Object}   args.cache
 * @param {import('./viewRegistry.js').ViewContext} args.ctx
 * @param {Object}   args.state                 - shared per-mount state
 *                                                ({ expandedOutcomeId, activeTab })
 * @param {Object}   args.displayStats          - precomputed classStats (Current
 *                                                Score uses a derived object)
 * @param {string|number} args.displayNumber    - row number (blank for special)
 * @param {boolean}  args.isSpecial             - skip drag handlers
 * @param {boolean}  args.isCurrentScoreRow
 * @param {Function} args.isRegularOutcome      - predicate from host
 * @param {Function} args.rerender              - parent's renderRows()
 * @param {Function} [args.onReorderCommit]     - ({ outcomeContainerEl }) => void;
 *                                                fired on dragend so the host can
 *                                                read the new DOM order and persist
 * @returns {{ rootEl: HTMLElement, teardown: Function }}
 */
export function mountOutcomeRow({
    outcome, cache, ctx, state,
    displayStats, displayNumber, isSpecial, isCurrentScoreRow,
    isRegularOutcome, rerender, onReorderCommit,
}) {
    const { profColor, plAvgChip, spreadBar } = makeRenderers(ctx);

    const initialized = isOutcomeInitialized(outcome, cache, { isSpecial });
    const isExpanded  = state.expandedOutcomeId === outcome.id;

    const outcomeContainer = document.createElement('div');
    outcomeContainer.className = 'od-outcome-container';

    const row = document.createElement('div');
    row.className = `od-outcome-row${isExpanded ? ' expanded' : ''}`;

    const chevron   = isExpanded ? '▼' : '›';
    const belowFlag = displayStats.belowThresholdCount > 3 ? ' flag' : '';

    const rightSideHtml = initialized
        ? `<div class="row-cell-center">${plAvgChip(displayStats)}</div>
           <div>${spreadBar(displayStats)}</div>
           <div class="row-below${belowFlag}">${displayStats.belowThresholdCount}</div>`
        : `<div class="sync-inline" style="grid-column: 3 / span 4;">
              <span class="si si-setup">Not set up</span>
              <button class="btn btn-sm od-init-btn" data-init-action="setup">Initialize</button>
           </div>`;

    const syncChipHtml = `<div class="od-sync-cell">${buildSyncChip(outcome, cache, { isSpecial })}</div>`;

    row.innerHTML = `
        <div class="od-row-number row-num">${displayNumber}</div>
        <div>
            <div class="row-title">${escapeHtml(outcome.title)}</div>
        </div>
        ${rightSideHtml}
        ${initialized ? syncChipHtml : ''}
        <div class="row-chevron">${chevron}</div>
    `;

    row.addEventListener('click', (e) => {
        // Init-panel buttons live outside the row but the Initialize button is
        // inside the row's right column — guard so its click doesn't toggle.
        if (e.target.closest('[data-init-action]')) return;
        state.expandedOutcomeId = (state.expandedOutcomeId === outcome.id) ? null : outcome.id;
        state.activeTab = 'students';
        rerender();
    });

    outcomeContainer.appendChild(row);

    // Init panel sits between the row and the (empty) detail area when not initialized
    if (!initialized) {
        const initPanelWrap = document.createElement('div');
        initPanelWrap.innerHTML = renderInitPanel(outcome, false);
        outcomeContainer.appendChild(initPanelWrap.firstElementChild);
        wireInitFlow(outcomeContainer, outcome, cache, ctx, rerender);
    }

    let detailTeardown = null;
    if (isExpanded && initialized) {
        const built = buildOutcomeDetailPanel({
            outcome, cache, ctx, state, isCurrentScoreRow, isRegularOutcome,
            profColor, rerender,
        });
        outcomeContainer.appendChild(built.panel);
        detailTeardown = built.detailTeardown;
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
            onReorderCommit?.({ outcomeContainerEl: outcomeContainer });
        });
        outcomeContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
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
            if (draggedId === String(outcome.id)) return;

            const parent = outcomeContainer.parentElement;
            const draggedEl = parent?.querySelector(`[data-outcome-id="${draggedId}"]`);
            if (draggedEl) {
                const bounding = outcomeContainer.getBoundingClientRect();
                const offset = bounding.y + (bounding.height / 2);
                if (e.clientY - offset > 0) outcomeContainer.after(draggedEl);
                else                        outcomeContainer.before(draggedEl);
            }
        });
    }

    function teardown() {
        if (typeof detailTeardown === 'function') {
            try { detailTeardown(); } catch (err) { logger.warn('[MasteryOutlook] detail teardown failed', err); }
            detailTeardown = null;
        }
    }

    return { rootEl: outcomeContainer, teardown };
}