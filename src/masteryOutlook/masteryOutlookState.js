// src/masteryOutlook/masteryOutlookState.js
/**
 * Mastery Outlook Shared State
 *
 * Module-level state shared across Mastery Outlook files.
 * Import from here rather than re-defining in individual files.
 *
 * Current exports:
 *   fetchingStudentIds — tracks in-flight per-student refreshes so the
 *   lazy background fetch (outcomeRow.js) and per-student refresh button
 *   (studentSyncTable.js) don't race on the same student.
 *   syncingStudentIds / syncStudentPhase — track in-flight score pushes so
 *   each student row can show a live "Pushing…" / "Verifying…" spinner.
 *   runExclusive / queuedSyncKeys / queuedOutcomeIds — course-wide save queue
 *   so only one save runs at a time; waiting rows show "Queued…".
 */

/**
 * Set of in-flight fetch keys in format "outcomeId_studentId".
 * Written by both outcomeRow.js (lazy fetch) and studentSyncTable.js
 * (per-student refresh button). Shared to prevent race conditions.
 */
export const fetchingStudentIds = new Set();

/**
 * Set of in-flight sync keys in format "outcomeId_studentId".
 * Written by handleSyncStudents (plOutlookActions.js) for the duration of a
 * score push; read by buildOutcomeStudentRow (studentSyncTable.js) to show a
 * per-row spinner. Always cleared in a finally so a row can't get stuck.
 */
export const syncingStudentIds = new Set();

/**
 * Map of sync key → current phase ('pushing' | 'verifying') for keys present
 * in syncingStudentIds. Advances as the sync state machine progresses so the
 * row can distinguish the push from the Canvas verification step.
 */
export const syncStudentPhase = new Map();

/**
 * Set of in-flight sync keys for entire outcomes in format "outcomeId".
 * Used to show an outcome-level "Checking..." indicator before specific
 * students are marked as pushing.
 */
export const syncingOutcomeIds = new Set();

/**
 * Map of outcomeId → current outcome-level phase ('checking' | 'syncing') for
 * outcomes present in syncingOutcomeIds. Held for the ENTIRE run so the chip
 * reads "Checking…" → "Syncing…" → "✓ Synced" instead of flashing "N need"
 * between calculation and completion. Cleared alongside syncingOutcomeIds.
 */
export const syncingOutcomePhase = new Map();


/**
 * Sync keys ("outcomeId_studentId") for row saves waiting in the save queue.
 * Rendered as "Queued…" in the Save column; removed when the job starts.
 */
export const queuedSyncKeys = new Set();

/**
 * Outcome IDs with a queued "save all" (or other outcome-wide job) waiting
 * in the save queue. Rendered as a "Queued…" outcome chip.
 */
export const queuedOutcomeIds = new Set();

/** Tail of the course-wide save queue — see runExclusive(). */
let _saveQueueTail = Promise.resolve();

/** Number of jobs queued or running in the save queue. */
let _saveQueueDepth = 0;

/**
 * Run `fn` after every previously queued job has settled, so only one save
 * (push → verify → Current Score update) touches Canvas and the shared cache
 * file at a time. A rejected job does not block later jobs.
 *
 * Do not call runExclusive from inside a job — it would wait on itself.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>} settles with fn's result
 */
export function runExclusive(fn) {
    _saveQueueDepth++;
    // Decrement inside the returned chain so a caller's own .finally() already
    // sees the updated depth via isSaveQueueBusy().
    const run = _saveQueueTail.then(() => fn()).finally(() => { _saveQueueDepth--; });
    _saveQueueTail = run.catch(() => {});
    return run;
}

/**
 * True while any job is queued or running — e.g. to keep a "Leave site?"
 * prompt active.
 * @returns {boolean}
 */
export function isSaveQueueBusy() {
    return _saveQueueDepth > 0;
}
