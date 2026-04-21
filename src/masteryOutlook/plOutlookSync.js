// src/masteryOutlook/plOutlookSync.js
/**
 * PL Outlook Sync — Orchestrator
 *
 * Public API for the PL sync feature. Wires the PLOutlookStateMachine to its
 * state handlers and drives the run loop.
 *
 * Usage:
 *   const result = await runPLSync({
 *     courseId, outcomeId, outcomeName, apiClient,
 *     onProgress: (state, outcomeName, msg, done, total) => { ... }
 *   });
 *
 *   // Single-student variant:
 *   const result = await runPLSync({ ..., targetUserIds: ['642'] });
 *
 *   // Pre-flight check (no writes):
 *   const info = await checkSyncNeeded({ courseId, outcomeId, apiClient });
 *   // → { hasSetup, needsSyncCount, predictionCount }
 */

import { PLOutlookStateMachine, PL_STATES } from './plOutlookStateMachine.js';
import { PL_STATE_HANDLERS }                from './plOutlookStateHandlers.js';
import { readMasteryOutlookCache, readPLAssignments } from './masteryOutlookCacheService.js';
import { logger } from '../utils/logger.js';

// ─── Run a full sync for one outcome ─────────────────────────────────────────

/**
 * Run the PL sync flow for a single outcome.
 *
 * @param {Object}   opts
 * @param {string}   opts.courseId
 * @param {string}   opts.outcomeId         - Canvas outcome ID
 * @param {string}   opts.outcomeName       - Human-readable name for UI / logging
 * @param {Object}   opts.apiClient         - CanvasApiClient instance
 * @param {Function} [opts.onProgress]      - (state, outcomeName, message, done, total) => void
 * @param {string[]} [opts.targetUserIds]   - Limit sync to specific students (null = all)
 * @returns {Promise<{ success: boolean, successCount: number, errors: Array, stateHistory: string[] }>}
 */
export async function runPLSync({ courseId, outcomeId, outcomeName, apiClient, onProgress = null, targetUserIds = null }) {
    logger.info(`[PLSync] Starting sync — course ${courseId}, outcome ${outcomeId} (${outcomeName})`);

    const sm = new PLOutlookStateMachine({
        courseId, outcomeId, outcomeName, apiClient, onProgress, targetUserIds
    });

    // ── Run loop ──
    sm.transition(PL_STATES.CHECKING_SETUP);

    while (!isTerminal(sm.getCurrentState())) {
        const currentState = sm.getCurrentState();
        const handler      = PL_STATE_HANDLERS[currentState];

        if (!handler) {
            logger.error(`[PLSync] No handler for state: ${currentState}`);
            sm.transition(PL_STATES.ERROR, { error: new Error(`No handler for state: ${currentState}`) });
            break;
        }

        try {
            const nextState = await handler(sm);
            if (nextState && nextState !== currentState) {
                sm.transition(nextState);
            }
        } catch (err) {
            logger.error(`[PLSync] Error in handler for ${currentState}:`, err);
            if (sm.canTransition(PL_STATES.ERROR)) {
                sm.transition(PL_STATES.ERROR, { error: err });
            } else {
                // Already in ERROR or COMPLETE — log and stop
                logger.error('[PLSync] Could not transition to ERROR from current state:', currentState);
                break;
            }
        }
    }

    const ctx          = sm.getContext();
    const stateHistory = sm.getStateHistory();   // capture before reset wipes it
    const hadError     = stateHistory.includes(PL_STATES.ERROR);
    const success      = !hadError;

    logger.info(
        `[PLSync] Finished — outcome ${outcomeId}, success: ${success}, ` +
        `${ctx.successCount || 0} synced, ${ctx.errors?.length || 0} error(s)`
    );

    sm.reset();

    return {
        success,
        successCount: ctx.successCount || 0,
        errors:       ctx.errors       || [],
        stateHistory
    };
}

// ─── Pre-flight check (read-only) ─────────────────────────────────────────────

/**
 * Check whether a sync is needed for a given outcome without writing anything.
 *
 * Reads from the mastery outlook cache only — no Canvas API calls beyond what
 * readMasteryOutlookCache already does.
 *
 * @param {Object} opts
 * @param {string} opts.courseId
 * @param {string} opts.outcomeId
 * @param {Object} opts.apiClient
 * @returns {Promise<{ hasSetup: boolean, predictionCount: number }>}
 */
export async function checkSyncNeeded({ courseId, outcomeId, apiClient }) {
    const [cache, plAssignments] = await Promise.all([
        readMasteryOutlookCache(courseId, apiClient),
        readPLAssignments(courseId, apiClient)
    ]);

    const hasSetup = !!(plAssignments[outcomeId]?.assignment_id);

    let predictionCount = 0;
    if (cache?.students) {
        predictionCount = cache.students.filter(student => {
            const od = student.outcomes?.find(o => String(o.outcomeId) === String(outcomeId));
            return od?.plPrediction !== null && od?.plPrediction !== undefined && od?.status !== 'NE';
        }).length;
    }

    return { hasSetup, predictionCount };
}

// ─── Sync all outcomes in a course ────────────────────────────────────────────

/**
 * Run the PL sync for every outcome in the mastery outlook cache.
 *
 * @param {Object}   opts
 * @param {string}   opts.courseId
 * @param {Object}   opts.apiClient
 * @param {Function} [opts.onProgress]  - Called per outcome — same signature as runPLSync
 * @param {Function} [opts.onOutcomeDone] - (outcomeId, result) => void after each outcome
 * @returns {Promise<Object[]>} Array of per-outcome results
 */
export async function runPLSyncForAllOutcomes({ courseId, apiClient, onProgress = null, onOutcomeDone = null }) {
    const cache = await readMasteryOutlookCache(courseId, apiClient);
    if (!cache?.outcomes?.length) {
        logger.warn('[PLSync] No outcomes in cache — run Refresh Data first');
        return [];
    }

    const results = [];
    for (const outcome of cache.outcomes) {
        const result = await runPLSync({
            courseId,
            outcomeId:    String(outcome.id),
            outcomeName:  outcome.name || String(outcome.id),
            apiClient,
            onProgress
        });
        results.push({ outcomeId: String(outcome.id), outcomeName: outcome.name, ...result });
        if (onOutcomeDone) onOutcomeDone(String(outcome.id), result);
    }

    return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isTerminal(state) {
    return state === PL_STATES.IDLE || state === PL_STATES.ERROR;
}