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
 */

/**
 * Set of in-flight fetch keys in format "outcomeId_studentId".
 * Written by both outcomeRow.js (lazy fetch) and studentSyncTable.js
 * (per-student refresh button). Shared to prevent race conditions.
 */
export const fetchingStudentIds = new Set();
