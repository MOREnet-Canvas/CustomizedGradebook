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
    writePLAssignments
} from './masteryOutlookCacheService.js';
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
        '  ├── runPLSync({ outcome, onProgress, targetUserIds })',
        '  │       Run PL sync for one outcome',
        '  │       outcome: { id, title }  e.g. { id: "598", title: "Outcome 1" }',
        '  │       targetUserIds: optional array of student IDs to limit sync',
        '  ├── checkSyncNeeded(outcomeId)  { hasSetup, predictionCount } for one outcome',
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
        "  outcome: { id: '598', title: 'Algebra' },\n" +
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