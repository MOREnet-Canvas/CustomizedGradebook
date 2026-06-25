// src/masteryOutlook/outcomeSyncView.js
/**
 * Mastery Outlook — Outcome Sync view (peer of the Heatmap view).
 *
 * Owns the outcome list orchestration: sort order, custom-order persistence,
 * the cross-outcome exceptions view (exported), and the default (no-cache)
 * state for outcome rows. Each outcome row (collapsed header, init flow, and
 * expanded detail panel) is delegated to ./outcomeRow.js.
 *
 * Conforms to the view-registry contract:
 *   mount(shell, cache, ctx) → { teardown, refresh }
 *
 * Per-mount state (expandedOutcomeIds, activeTabs, rowControllers) lives in a
 * closure created inside mountOutcomeSyncView so the host can teardown and
 * re-mount cleanly. rowControllers tracks per-row teardowns so document-level
 * listeners owned by detail panels are released on every rebuild.
 *
 * Threshold + color scheme are read from ctx (getThreshold/getColorScheme) on
 * every render so chrome controls trigger refresh() without re-mounting.
 */

import { logger } from '../utils/logger.js';
import { escapeHtml } from '../utils/html.js';
import { roundToHalf } from './powerLaw.js';
import { mountOutcomeRow, isOutcomeInitialized } from './outcomeRow.js';
import { scoresMatch } from './plOutlookSyncStatus.js';
import { fetchOutcomeNames, fetchOutcomeRollups } from './masteryOutlookDataService.js';
import { writeMasteryOutlookCache } from './masteryOutlookCacheService.js';
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
        <div id="od-course-sync" class="course-sync"></div>
        <div id="od-col-headers" class="od-col-headers">
            <div class="od-col-header">#</div>
            <div class="od-col-header">Outcome</div>
            <div class="od-col-header center">PL avg</div>
            <div class="od-col-header center">Spread</div>
            <div class="od-col-header center">Below threshold</div>
            <div class="od-col-header center">Canvas sync</div>
            <div></div>
        </div>
        <div id="od-outcomes-list"></div>`;
}

/**
 * Render the course-level sync strip above the outcome list. Aggregates
 * counts across initialized regular outcomes so the user sees overall
 * Canvas-sync health at a glance. Idempotent — safe to call on every
 * render.
 *
 * @param {Object} cache
 */
function renderCourseSyncStrip(cache) {
    const stripEl = document.getElementById('od-course-sync');
    if (!stripEl) return;

    const syncState   = cache.sync_state ?? {};
    const regular     = (cache.outcomes || []).filter(o => isRegularOutcome(o));
    const initialized = regular.filter(o => isOutcomeInitialized(o, cache));

    // Use the same scoresMatch-based logic as the per-outcome sync chip so
    // these strip totals always agree with what each chip displays.
    // (aggregateSyncStatus requires last_synced_score != null to classify
    // a student as 'synced', which diverges from the chip's needsCount logic.)
    const totals = { synced: 0, needsSync: 0, override: 0 };
    for (const o of initialized) {
        const oId = String(o.id);
        let needsCount = 0, overrideCount = 0, activeCount = 0;

        for (const student of cache.students || []) {
            const od = student.outcomes?.find(s => String(s.outcomeId) === oId);
            if (!od) continue;

            const syncEntry       = (syncState[oId] ?? {})[String(student.id)] ?? {};
            const marzano         = od.plPrediction;
            const canvas          = od.canvasScore;

            // Override priority (mirrors getSyncStatus order)
            if (syncEntry.manual_override) { overrideCount++; continue; }
            const lastSyncedScore = syncEntry.last_synced_score ?? null;
            if (lastSyncedScore !== null && canvas !== null
                && !scoresMatch(canvas, lastSyncedScore)) {
                overrideCount++;
                continue;
            }

            // Skip NE students and those without a Canvas score
            if (marzano === null || marzano === undefined) continue;
            if (canvas  === null) continue;

            activeCount++;
            const willPost      = syncEntry.will_post ?? null;
            const pendingNote   = syncEntry.will_post_note ?? null;
            const lastSubmitted = syncEntry.will_post_note_last_submitted ?? null;
            const noteIsPending = pendingNote !== null && pendingNote !== lastSubmitted;

            if (!scoresMatch(willPost ?? roundToHalf(marzano), canvas) || noteIsPending) {
                needsCount++;
            }
        }

        totals.needsSync += needsCount;
        totals.override  += overrideCount;
        totals.synced    += (activeCount - needsCount);  // active students that match
    }

    const setupX = initialized.length;
    const setupY = regular.length;

    stripEl.innerHTML = `
        <div class="cs-left">
            <span class="cs-stat">
                <span class="cs-dot" style="background:var(--green);"></span>
                <b>${totals.synced}</b> synced
            </span>
            <span class="cs-stat">
                <span class="cs-dot" style="background:var(--amber);"></span>
                <b>${totals.needsSync}</b> need sync
            </span>
            <span class="cs-stat">
                <span class="cs-dot" style="background:var(--red);"></span>
                <b>${totals.override}</b> override${totals.override === 1 ? '' : 's'}
            </span>
            <span class="cs-stat">
                <b>${setupX}</b> / ${setupY} outcomes set up
            </span>
        </div>
        <div class="cs-progress">
            <span class="spinner"></span>
            <span>Pushing scores to Canvas…</span>
            <div class="ps-bar"><div class="ps-bar-fill"></div></div>
        </div>
    `;
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
            <div class="od-sync-cell"><span class="od-sync-chip none">—</span></div>
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
                if (entry.will_post_lock === 'locked')  typeParts.push('Locked Override');

                rows.push({
                    outcomeName: outcome.title,
                    studentName: student.name || `Student ${studentId}`,
                    type:        typeParts.join(' + '),
                    typeClass:   'override',
                    canvas:      od?.canvasScore != null ? od.canvasScore.toFixed(2) : '—',
                    marzano:     od?.plPrediction != null ? roundToHalf(od.plPrediction).toFixed(2) : 'NE',
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
            <th class="od-center">Override</th>
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
    // expandedOutcomeIds / activeTabs are mutated by the row module's click
    // handlers; rowControllers tracks per-row teardowns so document-level
    // listeners owned by detail panels are released on every rebuild.
    // Multiple outcomes can be expanded simultaneously — each outcome's active
    // tab is tracked independently in activeTabs keyed by outcome ID.
    const state = {
        expandedOutcomeIds: new Set(),
        activeTabs:         {},
        rowControllers:     [],
    };

    // Aborts the background canvas-score refresh if the view is torn down
    // before the fetch completes (e.g. the teacher navigates away).
    let bgRefreshAborted = false;

    function renderRows(options = {}) {
        if (options.stripOnly) {
            renderCourseSyncStrip(cache);
            return;
        }

        // Tear down listeners owned by previous rows before their DOM is dropped,
        // so document-level handlers don't accumulate across renders.
        (state.rowControllers || []).forEach(c => {
            try { c.teardown(); } catch (err) { logger.warn('[MasteryOutlook] row teardown failed', err); }
        });
        state.rowControllers = [];

        const outcomesEl = shell.outcomesEl;
        outcomesEl.innerHTML = '';

        const threshold = ctx.getThreshold();

        // Sort outcomes: Current Score → Excluded → Regular
        const currentScore = cache.outcomes.find(o => isCurrentScoreOutcome(o.title));
        const excluded = cache.outcomes.filter(o => isExcludedOutcome(o.title) && !isCurrentScoreOutcome(o.title));
        const regular  = cache.outcomes.filter(o => isRegularOutcome(o));

        if (!currentScore) {
            const noCurrentScore = document.createElement('div');
            noCurrentScore.className = 'od-no-current-score';
            noCurrentScore.textContent = 'No Current Score found';
            outcomesEl.appendChild(noCurrentScore);
        }

        // Apply persisted custom regular-outcome order. Wiki page stores IDs as
        // strings; outcome.id from cache is a number — coerce to string.
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
            const isSpecial         = isSpecialOutcome(outcome.title);
            const displayNumber     = isSpecial ? '' : ++regularIndex;
            const isCurrentScoreRow = isCurrentScoreOutcome(outcome.title);
            const displayStats      = isCurrentScoreRow
                ? computeCurrentScoreClassStats(cache, threshold)
                : outcome.classStats;

            const controller = mountOutcomeRow({
                outcome, cache, ctx, state,
                displayStats, displayNumber, isSpecial, isCurrentScoreRow,
                isRegularOutcome,
                rerender: renderRows,
                onReorderCommit: () => {
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
                },
            });

            state.rowControllers.push(controller);
            outcomesEl.appendChild(controller.rootEl);

            // Divider between the last special outcome and the first regular one
            const isLastSpecial = isSpecial &&
                (i === sortedOutcomes.length - 1 || !isSpecialOutcome(sortedOutcomes[i + 1].title));
            if (isLastSpecial && regular.length > 0) {
                const divider = document.createElement('div');
                divider.className = 'od-outcome-divider';
                outcomesEl.appendChild(divider);
            }
        });

        renderCourseSyncStrip(cache);
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
        bgRefreshAborted = true;
        (state.rowControllers || []).forEach(c => {
            try { c.teardown(); } catch (err) { logger.warn('[MasteryOutlook] row teardown failed', err); }
        });
        state.rowControllers = [];
    }

    renderRows();

    // Background canvas score refresh — fires once on mount after the initial
    // render. Fetches live rollup scores for all outcomes in one API call,
    // updates canvasScore in memory, refreshes sync chips + strip, and persists
    // the cache so the next page load starts with correct values.
    (async () => {
        const stripEl = document.getElementById('od-course-sync');
        const loadingHint = document.createElement('span');
        loadingHint.style.cssText = 'font-size:.8em;color:#888;margin-left:.75em;';
        loadingHint.textContent = '⟳ Refreshing scores…';
        stripEl?.appendChild(loadingHint);

        try {
            const scoreMap = await fetchOutcomeRollups(ctx.courseId, ctx.apiClient);
            if (bgRefreshAborted) return;

            let updated = 0;
            for (const student of cache.students ?? []) {
                for (const od of student.outcomes ?? []) {
                    const key  = `${student.id}_${od.outcomeId}`;
                    const live = scoreMap[key];
                    if (live !== undefined && live !== od.canvasScore) {
                        od.canvasScore = live;
                        updated++;
                    }
                }
            }

            if (bgRefreshAborted) return;

            if (updated > 0) {
                logger.debug(`[MasteryOutlook] Background rollup: updated ${updated} canvasScore(s)`);
                // Refresh chips in-place (avoids full re-render) then strip
                for (const controller of state.rowControllers) {
                    controller.refreshChip?.();
                }
                renderCourseSyncStrip(cache);
                // Persist so the next page load skips this refresh step
                writeMasteryOutlookCache(ctx.courseId, ctx.apiClient, cache).catch(err => {
                    logger.warn('[MasteryOutlook] Background cache persist failed', err);
                });
            }
        } catch (err) {
            logger.warn('[MasteryOutlook] Background rollup refresh failed', err);
        } finally {
            loadingHint.remove();
        }
    })();

    return { teardown, refresh: renderRows };
}