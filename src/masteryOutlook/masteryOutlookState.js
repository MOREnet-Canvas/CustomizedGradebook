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
