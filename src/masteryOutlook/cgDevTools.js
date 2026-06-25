// src/masteryOutlook/cgDevTools.js
/**
 * CG Dev Tools
 *
 * Exposes diagnostic utilities on window.__CG_DEV when debug mode is active
 * (dev build OR ?debug=true / sessionStorage.setItem('cg_debug','true') in prod).
 *
 * Guard: logger.isDebugEnabled() — runtime check, works in any build.
 * This module is always present in the bundle (all referenced modules are already
 * bundled via masteryOutlookInit.js), but window.__CG_DEV is only populated when
 * debug mode is on.
 *
 * Activate in production:
 *   sessionStorage.setItem('cg_debug', 'true'); location.reload();
 *   // or navigate to any page with ?debug=true
 */

import { logger }          from '../utils/logger.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import { getCourseId }     from '../utils/canvas.js';
import {
    readMasteryOutlookCache,
    writeMasteryOutlookCache,
    readPLAssignments,
    writePLAssignments,
    readSyncState,
    writeSyncState,
} from './masteryOutlookCacheService.js';
import { submitRubricAssessmentBatch } from '../services/graphqlGradingService.js';
import { runPLSync, checkSyncNeeded } from './plOutlookSync.js';
import { powerLawPredict, computeStudentOutcome } from './powerLaw.js';
import { PL_STATES } from './plOutlookStateMachine.js';

/**
 * Expose CG developer tools on window.__CG_DEV.
 * No-op when debug mode is not active.
 *
 * Called from customGradebookInit.js after all modules are loaded.
 */
export function exposeCGDevTools() {
    if (!logger.isDebugEnabled()) return;

    const apiClient = new CanvasApiClient();
    const courseId  = getCourseId();

    window.__CG_DEV = {
        // Core
        apiClient,
        courseId,

        // Cache — pre-bound so calls need no arguments
        readCache:           ()       => readMasteryOutlookCache(courseId, apiClient),
        writeCache:          (cache)  => writeMasteryOutlookCache(courseId, apiClient, cache),

        // PL assignments (one-time Canvas setup: assignment, rubric, submission IDs)
        readPLAssignments:   ()       => readPLAssignments(courseId, apiClient),
        writePLAssignments:  (pl)     => writePLAssignments(courseId, pl, apiClient),

        // PL sync
        runPLSync: ({ outcome, onProgress, targetUserIds } = {}) => runPLSync({
            courseId,
            outcomeId:   String(outcome.id),
            outcomeName: outcome.title,
            apiClient,
            onProgress,
            targetUserIds
        }),
        checkSyncNeeded: (outcomeId) => checkSyncNeeded({ courseId, outcomeId: String(outcomeId), apiClient }),

        // Dev reset — zero out Canvas scores for one outcome without setting manual_override
        resetOutcomeScoresToZero: () => _resetOutcomeScoresToZero(courseId, apiClient),

        // Power Law — pure functions, no wrappers needed
        powerLawPredict,
        computeStudentOutcome,

        // State machine constants
        PL_STATES,

        // Runtime config reference
        config: window.CG_CONFIG
    };

    _printHelp(courseId);
}

/** Print the collapsed help group to the console */
function _printHelp(courseId) {
    const c = 'color:#4CAF50; font-weight:bold;';
    const d = 'color:#888; font-weight:normal;';

    console.groupCollapsed('%c🛠 CG Dev Tools%c  — window.__CG_DEV', c, d);
    console.log([
        '  ├── apiClient              CanvasApiClient instance (CSRF cached)',
        `  ├── courseId               ${courseId ?? '(null — not on a course page)'}`,
        '  │',
        '  ├── readCache()            Read mastery outlook cache from Canvas Files',
        '  ├── writeCache(cache)      Write mastery outlook cache to Canvas Files',
        '  │',
        '  ├── readPLAssignments()    Read pl_assignments section from cache',
        '  ├── writePLAssignments(pl) Write pl_assignments section to cache',
        '  │',
        '  ├── runPLSync({ outcome, onProgress, targetUserIds, setupOnly })',
        '  │       Run PL sync for one outcome',
        '  │       outcome: { id, title }  e.g. { id: "598", title: "Outcome 1" }',
        '  │       targetUserIds: optional array of student IDs to limit sync',
        '  │       setupOnly: true → create assignment only, skip score push',
        '  ├── checkSyncNeeded(outcomeId)  { hasSetup, predictionCount } for one outcome',
        '  │',
        '  ├── resetOutcomeScoresToZero()',
        '  │       Lists all outcomes, prompts for an ID, then resets every student\'s',
        '  │       Canvas rubric score to 0 for that outcome. Clears last_synced_score so',
        '  │       the next normal sync treats everyone as needs_sync. Does NOT set',
        '  │       manual_override — safe to re-sync immediately after.',
        '  │',
        '  ├── powerLawPredict(scores)       Predicted next score from score array',
        '  ├── computeStudentOutcome(scores) Full computed object (status, plPrediction, …)',
        '  │',
        '  ├── PL_STATES              State machine state constants',
        '  └── config                 Current window.CG_CONFIG',
    ].join('\n'));

    console.groupCollapsed('Example — run PL sync for one outcome');
    console.log(
        "await __CG_DEV.runPLSync({\n" +
        "  outcome: { id: '598', title: 'Outcome 1' },\n" +
        "  // Creates assignment: 'Outcome 1 — Projected Score'\n" +
        "  onProgress: (state, name, msg, d, t) => console.log(state, msg, d, t)\n" +
        "})"
    );
    console.groupEnd();

    console.groupCollapsed('Example — inspect the cache');
    console.log(
        "const cache = await __CG_DEV.readCache()\n" +
        "cache.students.find(s => s.id === '642')"
    );
    console.groupEnd();

    console.groupCollapsed('Deactivate debug mode');
    console.log("sessionStorage.removeItem('cg_debug'); location.reload();");
    console.groupEnd();

    console.groupEnd(); // close main group
}

/**
 * Interactive dev utility: list all outcomes, prompt for one, then reset every
 * student's Canvas PL rubric score to 0 for that outcome.
 *
 * - Does NOT set manual_override (sync will treat students as needs_sync)
 * - Clears last_synced_score / last_synced_at so sync status reflects the reset
 * - Requires pl_assignments to be set up for the chosen outcome (run sync first)
 *
 * @param {string} courseId
 * @param {CanvasApiClient} apiClient
 */
async function _resetOutcomeScoresToZero(courseId, apiClient) {
    // 1. Load cache
    const cache = await readMasteryOutlookCache(courseId, apiClient);
    if (!cache?.outcomes?.length) {
        console.error('[CG Dev] No outcomes found in cache — run Refresh Data first.');
        return;
    }

    // 2. Print outcome list
    console.log('[CG Dev] Outcomes in this course:');
    console.table(
        cache.outcomes.map(o => ({ id: String(o.id), title: o.title }))
    );

    // 3. Prompt for outcome ID
    const input = prompt('[CG Dev] Enter the outcome ID to reset to 0:');
    if (!input?.trim()) {
        console.log('[CG Dev] Cancelled.');
        return;
    }
    const outcomeId = input.trim();

    // 4. Validate outcome exists in cache
    const outcome = cache.outcomes.find(o => String(o.id) === outcomeId);
    if (!outcome) {
        console.error(`[CG Dev] Outcome ID "${outcomeId}" not found in cache.`);
        return;
    }

    // 5. Validate pl_assignments entry exists (sync must have been run)
    const plEntry = cache.pl_assignments?.[outcomeId];
    if (!plEntry?.rubric_association_id || !plEntry?.criterion_id || !plEntry?.submission_ids) {
        console.error(`[CG Dev] No PL assignment setup found for outcome "${outcome.title}" (${outcomeId}). Run sync for this outcome first.`);
        return;
    }

    const { rubric_association_id, criterion_id, submission_ids } = plEntry;
    const studentEntries = Object.entries(submission_ids);

    // 6. Confirm before writing
    const confirmed = confirm(
        `[CG Dev] Reset ${studentEntries.length} student(s) to score 0 for:\n"${outcome.title}" (ID: ${outcomeId})\n\nThis writes to Canvas. Continue?`
    );
    if (!confirmed) {
        console.log('[CG Dev] Cancelled.');
        return;
    }

    // 7. Build batch params — score 0, no comment, no manual_override
    const batchParams = studentEntries.map(([userId, submissionId]) => ({
        userId,
        submissionId,
        rubricAssociationId: rubric_association_id,
        rubricCriterionId:   criterion_id,
        points:              0,
        score:               0,
    }));

    console.log(`[CG Dev] Pushing score 0 to ${batchParams.length} student(s)…`);
    const { successCount, errors } = await submitRubricAssessmentBatch(batchParams, apiClient, {
        concurrency:  5,
        maxAttempts:  3,
        retryDelayMs: 500,
    });

    // 8. Clear last_synced_score / last_synced_at — do NOT touch manual_override
    const syncState    = await readSyncState(courseId, apiClient);
    const outcomeSync  = syncState[outcomeId] ?? {};
    for (const [userId] of studentEntries) {
        if (outcomeSync[userId]) {
            outcomeSync[userId].last_synced_score = null;
            outcomeSync[userId].last_synced_at    = null;
        }
    }
    syncState[outcomeId] = outcomeSync;
    await writeSyncState(courseId, syncState, apiClient);

    // 9. Report
    if (errors.length > 0) {
        console.warn(`[CG Dev] Reset complete with errors: ${successCount}/${batchParams.length} succeeded.`);
        console.table(errors.map(e => ({ userId: e.userId, error: e.error })));
    } else {
        console.log(`[CG Dev] Reset complete: ${successCount}/${batchParams.length} students zeroed for "${outcome.title}". Run sync to push PL predictions back.`);
    }
}