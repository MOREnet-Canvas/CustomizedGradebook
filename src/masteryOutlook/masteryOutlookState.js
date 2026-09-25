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
 *   rowSavePhase / setRowPhase / clearRowPhase — the one per-row save status
 *   (queued → checking → pushing → verifying) read by rows, banner, and chip.
 *   runExclusive / queuedOutcomeIds — course-wide save queue so only one save
 *   runs at a time.
 */

/**
 * Set of in-flight fetch keys in format "outcomeId_studentId".
 * Written by both outcomeRow.js (lazy fetch) and studentSyncTable.js
 * (per-student refresh button). Shared to prevent race conditions.
 */
export const fetchingStudentIds = new Set();

/**
 * The one per-row save status: "outcomeId_studentId" → phase.
 *   'queued'    — save requested, waiting for an earlier save to finish
 *   'checking'  — save running, working out whether this row needs a push
 *   'pushing'   — score being written to Canvas
 *   'verifying' — waiting for Canvas to show the new score
 * Set by handleSyncStudents (plOutlookActions.js) the moment a save is requested
 * and cleared when that row is done; read by the student rows, the Save banner,
 * and the outcome chip so all three always agree. Rows without an entry are idle.
 */
export const rowSavePhase = new Map();

/**
 * Set the save phase for several rows.
 * @param {string[]} keys  - "outcomeId_studentId"
 * @param {'queued'|'checking'|'pushing'|'verifying'} phase
 * @returns {boolean} true if any row changed
 */
export function setRowPhase(keys, phase) {
    let changed = false;
    for (const k of keys) {
        if (rowSavePhase.get(k) !== phase) { rowSavePhase.set(k, phase); changed = true; }
    }
    return changed;
}

/**
 * Clear the save phase for several rows (row is idle again).
 * @param {string[]} keys - "outcomeId_studentId"
 */
export function clearRowPhase(keys) {
    for (const k of keys) rowSavePhase.delete(k);
}

/**
 * Save phases of the rows in one outcome that are currently not idle.
 * @param {string|number} outcomeId
 * @returns {string[]} phases for that outcome's rows (unordered)
 */
export function getOutcomeRowPhases(outcomeId) {
    const prefix = `${outcomeId}_`;
    const phases = [];
    for (const [k, v] of rowSavePhase) if (k.startsWith(prefix)) phases.push(v);
    return phases;
}

/**
 * Rows ("outcomeId_studentId") whose save is confirmed on the assignment but
 * whose outcome score Canvas hasn't recalculated yet. The background outcome
 * check (verifyOutcomeRollups) removes them. Rows show ⏳ beside the Canvas
 * pill and the chip counts them; the banner and save queue are not blocked.
 */
export const rowsAwaitingOutcome = new Set();

/**
 * Number of rows in one outcome still waiting for Canvas's outcome score.
 * @param {string|number} outcomeId
 * @returns {number}
 */
export function countRowsAwaitingOutcome(outcomeId) {
    const prefix = `${outcomeId}_`;
    let n = 0;
    for (const k of rowsAwaitingOutcome) if (k.startsWith(prefix)) n++;
    return n;
}

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
