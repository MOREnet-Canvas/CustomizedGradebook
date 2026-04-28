// src/masteryOutlook/plOutlookActions.js
/**
 * PL Outlook — teacher-initiated actions that mutate sync_state.
 *
 * Each exported function handles ONE discrete teacher action and runs the
 * full chain: write cache → (re-sync if needed) → call onRerender.
 *
 * Alignment ignore/unignore also trigger a local PL recalculation and a
 * follow-up sync push so Canvas stays current immediately.
 *
 * All functions share a common call signature:
 *   { courseId, outcomeId, studentId, apiClient, onRerender, ...actionSpecific }
 *
 * Where onRerender() is a zero-argument callback that the view passes in to
 * refresh just the affected student row without a full page reload.
 */

import { readSyncState, writeSyncState, readMasteryOutlookCache, writeMasteryOutlookCache } from './masteryOutlookCacheService.js';
import { runPLSync } from './plOutlookSync.js';
import { logger } from '../utils/logger.js';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Return the sync_state entry for one student × outcome, creating a default
 * skeleton if it doesn't exist yet.  Always returns a plain object — never null.
 *
 * @param {Object}       syncState  - full sync_state map (mutated in place)
 * @param {string}       outcomeId
 * @param {string}       studentId
 * @returns {Object}                - reference to the entry inside syncState
 */
function getOrInitEntry(syncState, outcomeId, studentId) {
    const oId = String(outcomeId);
    const sId = String(studentId);

    if (!syncState[oId])       syncState[oId] = {};
    if (!syncState[oId][sId])  syncState[oId][sId] = {
        last_synced_score: null,
        last_synced_at:    null,
        manual_override:   false,
        will_post:         null,
        will_post_lock:    'none',
        will_post_note:    null,
    };

    return syncState[oId][sId];
}

// ─── Confirm Override ─────────────────────────────────────────────────────────

/**
 * Teacher confirms that a Canvas score change was intentional — the Canvas
 * score should be kept and not overwritten by the next PL sync.
 *
 * Sets manual_override = true on the sync_state entry.
 * Does NOT push anything to Canvas.
 *
 * @param {Object}  opts
 * @param {string}  opts.courseId
 * @param {string}  opts.outcomeId
 * @param {string}  opts.studentId
 * @param {string}  [opts.note]      - Optional teacher note
 * @param {Object}  opts.apiClient
 * @param {Function} opts.onRerender
 */
export async function handleConfirmOverride({ courseId, outcomeId, studentId, note = null, apiClient, onRerender }) {
    logger.info(`[PLActions] Confirming override: outcome ${outcomeId}, student ${studentId}`);

    const syncState = await readSyncState(courseId, apiClient);
    const entry     = getOrInitEntry(syncState, outcomeId, studentId);

    entry.manual_override = true;
    if (note) entry.will_post_note = note;

    await writeSyncState(courseId, syncState, apiClient);
    logger.debug(`[PLActions] manual_override=true written for student ${studentId}`);

    onRerender?.();
}

// ─── Dismiss Override (treat Canvas score as PL) ──────────────────────────────

/**
 * Teacher dismisses the "possible override" warning and wants the PL
 * prediction to be re-pushed to Canvas, overwriting whatever the teacher
 * (or Canvas) set.
 *
 * Clears manual_override and last_synced_score so the next sync treats
 * this student as needing a fresh push.
 *
 * @param {Object}   opts
 * @param {string}   opts.courseId
 * @param {string}   opts.outcomeId
 * @param {string}   opts.studentId
 * @param {string}   opts.outcomeName  - For runPLSync logging
 * @param {Object}   opts.apiClient
 * @param {Function} opts.onRerender
 */
export async function handleDismissOverride({ courseId, outcomeId, studentId, outcomeName, apiClient, onRerender }) {
    logger.info(`[PLActions] Dismissing override: outcome ${outcomeId}, student ${studentId}`);

    const syncState = await readSyncState(courseId, apiClient);
    const entry     = getOrInitEntry(syncState, outcomeId, studentId);

    entry.manual_override   = false;
    entry.last_synced_score = null;   // force re-sync on next run
    entry.last_synced_at    = null;
    entry.will_post_note    = null;

    await writeSyncState(courseId, syncState, apiClient);

    // Re-push PL prediction to Canvas for this student only
    await runPLSync({ courseId, outcomeId, outcomeName, apiClient, targetUserIds: [studentId] });

    onRerender?.();
}

// ─── Revert Override (reset to PL, clear manual flag) ────────────────────────

/**
 * Teacher explicitly reverts a previously confirmed manual override.
 * The PL prediction takes over again and is immediately pushed to Canvas.
 *
 * Identical to handleDismissOverride in effect — kept as a separate export
 * because the view shows a different label/button ("Revert to PL" vs "Use PL").
 *
 * @param {Object}   opts  - Same as handleDismissOverride
 */
export async function handleRevertOverride(opts) {
    logger.info(`[PLActions] Reverting override: outcome ${opts.outcomeId}, student ${opts.studentId}`);
    return handleDismissOverride(opts);
}

// ─── Will Post overrides ──────────────────────────────────────────────────────

/**
 * Teacher sets an explicit score to post to Canvas instead of plPrediction.
 * Writes will_post + will_post_lock + optional note to sync_state.
 * Does NOT push to Canvas immediately — happens on the next runPLSync call.
 *
 * @param {Object}  opts
 * @param {string}  opts.courseId
 * @param {string}  opts.outcomeId
 * @param {string}  opts.studentId
 * @param {number}  opts.score       - Score to post
 * @param {string}  [opts.lock]      - 'none' | 'unlocked' | 'locked' (default: 'unlocked')
 * @param {string}  [opts.note]      - Optional teacher note
 * @param {Object}  opts.apiClient
 * @param {Function} opts.onRerender
 */
export async function handleSetWillPost({ courseId, outcomeId, studentId, score, lock = 'unlocked', note = null, apiClient, onRerender }) {
    logger.info(`[PLActions] Set will_post=${score} (lock=${lock}): outcome ${outcomeId}, student ${studentId}`);

    const syncState = await readSyncState(courseId, apiClient);
    const entry     = getOrInitEntry(syncState, outcomeId, studentId);

    entry.will_post      = score;
    entry.will_post_lock = lock;
    if (note !== null) entry.will_post_note = note;

    await writeSyncState(courseId, syncState, apiClient);
    onRerender?.();
}

/**
 * Teacher clears the Will Post override — score reverts to plPrediction on
 * the next sync push.
 *
 * @param {Object}   opts
 * @param {string}   opts.courseId
 * @param {string}   opts.outcomeId
 * @param {string}   opts.studentId
 * @param {Object}   opts.apiClient
 * @param {Function} opts.onRerender
 */
export async function handleClearWillPost({ courseId, outcomeId, studentId, apiClient, onRerender }) {
    logger.info(`[PLActions] Clear will_post: outcome ${outcomeId}, student ${studentId}`);

    const syncState = await readSyncState(courseId, apiClient);
    const entry     = getOrInitEntry(syncState, outcomeId, studentId);

    entry.will_post      = null;
    entry.will_post_lock = 'none';
    entry.will_post_note = null;

    await writeSyncState(courseId, syncState, apiClient);
    onRerender?.();
}

// ─── Will Post: granular pill-click handlers (write timing table events 1–6) ──

/**
 * Event 1 — Teacher clicks the Marzano pill → revert will_post to auto-track.
 * Clears will_post + will_post_lock; preserves any note.
 *
 * @param {Object}   opts
 * @param {string}   opts.courseId
 * @param {string}   opts.outcomeId
 * @param {string}   opts.studentId
 * @param {Object}   opts.apiClient
 * @param {Function} opts.onRerender
 */
export async function handleMarzanoPillClick({ courseId, outcomeId, studentId, apiClient, onRerender }) {
    logger.debug(`[PLActions] Marzano pill click: outcome ${outcomeId}, student ${studentId}`);

    const syncState = await readSyncState(courseId, apiClient);
    const entry     = getOrInitEntry(syncState, outcomeId, studentId);

    entry.will_post      = null;
    entry.will_post_lock = 'none';
    // will_post_note intentionally preserved — teacher may have context notes

    await writeSyncState(courseId, syncState, apiClient);
    onRerender?.();
}

/**
 * Event 2 — Teacher clicks the Canvas pill → adopt Canvas score as will_post.
 *
 * @param {Object}  opts
 * @param {string}  opts.courseId
 * @param {string}  opts.outcomeId
 * @param {string}  opts.studentId
 * @param {number}  opts.canvasScore
 * @param {Object}  opts.apiClient
 * @param {Function} opts.onRerender
 */
export async function handleCanvasPillClick({ courseId, outcomeId, studentId, canvasScore, apiClient, onRerender }) {
    logger.debug(`[PLActions] Canvas pill click (${canvasScore}): outcome ${outcomeId}, student ${studentId}`);

    const syncState = await readSyncState(courseId, apiClient);
    const entry     = getOrInitEntry(syncState, outcomeId, studentId);

    entry.will_post      = canvasScore;
    entry.will_post_lock = 'unlocked';

    await writeSyncState(courseId, syncState, apiClient);
    onRerender?.();
}

/**
 * Event 3 — Teacher types a custom score into the Will Post input box.
 * Preserves an existing "locked" state; otherwise sets "unlocked".
 *
 * @param {Object}  opts
 * @param {string}  opts.courseId
 * @param {string}  opts.outcomeId
 * @param {string}  opts.studentId
 * @param {number}  opts.value      - Parsed numeric score
 * @param {Object}  opts.apiClient
 * @param {Function} opts.onRerender
 */
export async function handleCustomValueTyped({ courseId, outcomeId, studentId, value, apiClient, onRerender }) {
    logger.debug(`[PLActions] Custom value typed (${value}): outcome ${outcomeId}, student ${studentId}`);

    const syncState = await readSyncState(courseId, apiClient);
    const entry     = getOrInitEntry(syncState, outcomeId, studentId);

    entry.will_post = value;
    // Promote to unlocked if not already locked — typing doesn't downgrade a lock
    if (entry.will_post_lock !== 'locked') entry.will_post_lock = 'unlocked';

    await writeSyncState(courseId, syncState, apiClient);
    onRerender?.();
}

/**
 * Event 4 — Teacher clicks the padlock to lock the will_post value.
 *
 * @param {Object}   opts
 * @param {string}   opts.courseId
 * @param {string}   opts.outcomeId
 * @param {string}   opts.studentId
 * @param {Object}   opts.apiClient
 * @param {Function} opts.onRerender
 */
export async function handleLockWillPost({ courseId, outcomeId, studentId, apiClient, onRerender }) {
    logger.debug(`[PLActions] Lock will_post: outcome ${outcomeId}, student ${studentId}`);

    const syncState = await readSyncState(courseId, apiClient);
    const entry     = getOrInitEntry(syncState, outcomeId, studentId);

    entry.will_post_lock = 'locked';

    await writeSyncState(courseId, syncState, apiClient);
    onRerender?.();
}

/**
 * Event 5 — Teacher clicks the padlock again to unlock / revert.
 * Clears will_post and resets lock to "none".
 *
 * @param {Object}   opts  - Same as handleLockWillPost
 */
export async function handleUnlockWillPost({ courseId, outcomeId, studentId, apiClient, onRerender }) {
    logger.debug(`[PLActions] Unlock will_post: outcome ${outcomeId}, student ${studentId}`);

    const syncState = await readSyncState(courseId, apiClient);
    const entry     = getOrInitEntry(syncState, outcomeId, studentId);

    entry.will_post      = null;
    entry.will_post_lock = 'none';

    await writeSyncState(courseId, syncState, apiClient);
    onRerender?.();
}

// ─── Debounced note handler (event 6) ────────────────────────────────────────

/** @private Timer map for debouncing per-cell note saves. */
const _noteDebounceTimers = new Map();

/**
 * Event 6 — Teacher types in the will_post_note field.
 * Debounced 600 ms so we don't spam the cache on every keystroke.
 *
 * This function is synchronous (returns void, not a Promise) so callers can
 * call it directly from an input event handler without await.
 *
 * @param {Object}   opts
 * @param {string}   opts.courseId
 * @param {string}   opts.outcomeId
 * @param {string}   opts.studentId
 * @param {string}   opts.noteValue  - Current field value (empty string → null)
 * @param {Object}   opts.apiClient
 * @param {Function} [opts.onRerender]
 */
export function handleNoteChanged({ courseId, outcomeId, studentId, noteValue, apiClient, onRerender }) {
    const key = `${outcomeId}:${studentId}`;
    clearTimeout(_noteDebounceTimers.get(key));

    _noteDebounceTimers.set(key, setTimeout(async () => {
        _noteDebounceTimers.delete(key);

        const syncState = await readSyncState(courseId, apiClient);
        const entry     = getOrInitEntry(syncState, outcomeId, studentId);
        entry.will_post_note = noteValue.trim() || null;

        await writeSyncState(courseId, syncState, apiClient);
        onRerender?.();
    }, 600));
}

// ─── Per-student sync ─────────────────────────────────────────────────────────

/**
 * Push the PL prediction for one student × outcome to Canvas immediately.
 * Thin wrapper around runPLSync with targetUserIds.
 *
 * @param {Object}   opts
 * @param {string}   opts.courseId
 * @param {string}   opts.outcomeId
 * @param {string}   opts.outcomeName
 * @param {string}   opts.studentId
 * @param {Object}   opts.apiClient
 * @param {Function} [opts.onProgress]
 * @param {Function} opts.onRerender
 */
export async function handleSyncOneStudent({ courseId, outcomeId, outcomeName, studentId, apiClient, onProgress, onRerender }) {
    logger.info(`[PLActions] Per-student sync: outcome ${outcomeId}, student ${studentId}`);

    await runPLSync({
        courseId, outcomeId, outcomeName, apiClient,
        targetUserIds: [studentId],
        onProgress,
    });

    onRerender?.();
}

// ─── Alignment ignore / un-ignore (Section 9 automatic chain) ────────────────

/**
 * Ignore a specific alignment for one student × outcome.
 *
 * Automatic chain (spec Section 9):
 *  1. Writes to cache.ignored_alignments
 *  2. runPLSync for this student — pushes re-computed PL to Canvas outcome rollup
 *     and writes last_synced_score + last_synced_at
 *  3. Re-renders student row
 *
 * Steps 4-6 (Current Score update + comment posting) require Current Score
 * assignment infrastructure not yet fully wired — those are left as TODOs.
 *
 * @param {Object}  opts
 * @param {string}  opts.courseId
 * @param {string}  opts.outcomeId
 * @param {string}  opts.outcomeName
 * @param {string}  opts.studentId
 * @param {string}  opts.alignmentId  - e.g. "assignment_3475"
 * @param {string}  [opts.reason]     - Teacher-provided reason text
 * @param {Object}  opts.apiClient
 * @param {Function} [opts.onProgress]
 * @param {Function} opts.onRerender
 */
export async function handleIgnoreAlignment({ courseId, outcomeId, outcomeName, studentId, alignmentId, reason = null, apiClient, onProgress, onRerender }) {
    logger.info(`[PLActions] Ignore alignment ${alignmentId}: outcome ${outcomeId}, student ${studentId}`);

    // Step 1 — write to cache.ignored_alignments
    const rawCache = await readMasteryOutlookCache(courseId, apiClient) ?? {};
    rawCache.ignored_alignments = rawCache.ignored_alignments ?? [];

    // Idempotent — do not add a duplicate entry
    const alreadyIgnored = rawCache.ignored_alignments.some(
        ia => ia.student_id   === String(studentId) &&
              ia.outcome_id   === String(outcomeId)  &&
              ia.alignment_id === alignmentId
    );

    if (!alreadyIgnored) {
        rawCache.ignored_alignments.push({
            student_id:      String(studentId),
            outcome_id:      String(outcomeId),
            alignment_id:    alignmentId,
            reason:          reason || null,
            ignored_by:      String(window.ENV?.current_user_id ?? 'unknown'),
            ignored_at:      new Date().toISOString(),
            comment_posted:  false,
        });
        await writeMasteryOutlookCache(courseId, apiClient, rawCache);
        logger.debug(`[PLActions] ignored_alignments updated (${rawCache.ignored_alignments.length} total)`);
    }

    // Step 2 — runPLSync re-computes PL without this alignment and pushes to Canvas
    // TODO step 4-6: update Current Score + post comment to assignment
    await runPLSync({ courseId, outcomeId, outcomeName, apiClient, targetUserIds: [studentId], onProgress });

    onRerender?.();
}

/**
 * Un-ignore a previously ignored alignment for one student × outcome.
 *
 * Removes the entry from cache.ignored_alignments and triggers the same
 * automatic chain as handleIgnoreAlignment (runPLSync re-includes the
 * alignment in the PL calculation, then pushes the updated score to Canvas).
 *
 * @param {Object}  opts  - Same as handleIgnoreAlignment (reason not applicable)
 */
export async function handleUnignoreAlignment({ courseId, outcomeId, outcomeName, studentId, alignmentId, apiClient, onProgress, onRerender }) {
    logger.info(`[PLActions] Un-ignore alignment ${alignmentId}: outcome ${outcomeId}, student ${studentId}`);

    const rawCache = await readMasteryOutlookCache(courseId, apiClient) ?? {};
    rawCache.ignored_alignments = (rawCache.ignored_alignments ?? []).filter(
        ia => !(ia.student_id   === String(studentId) &&
                ia.outcome_id   === String(outcomeId)  &&
                ia.alignment_id === alignmentId)
    );

    await writeMasteryOutlookCache(courseId, apiClient, rawCache);
    logger.debug(`[PLActions] Alignment un-ignored (${rawCache.ignored_alignments.length} remaining)`);

    // TODO step 4-6: update Current Score + post comment
    await runPLSync({ courseId, outcomeId, outcomeName, apiClient, targetUserIds: [studentId], onProgress });

    onRerender?.();
}

// ─── Current Score overrides (spec Sections 5F and 5G) ───────────────────────

/**
 * Override the Current Score for one student.
 *
 * Writes to cache.current_score_overrides[studentId].
 * On next Update Current Score run, students with an active override are
 * skipped — Canvas keeps the manually set score.
 *
 * TODO: Push override score to Canvas via the Current Score assignment rubric.
 *       Post comment to Current Score assignment if reason is provided.
 *
 * @param {Object}  opts
 * @param {string}  opts.courseId
 * @param {string}  opts.studentId
 * @param {number}  opts.overrideScore  - Numeric score to set
 * @param {string}  [opts.reason]       - Teacher-provided reason
 * @param {Object}  opts.apiClient
 * @param {Function} opts.onRerender
 */
export async function handleOverrideCurrentScore({ courseId, studentId, overrideScore, reason = null, apiClient, onRerender }) {
    logger.info(`[PLActions] Override Current Score: student ${studentId}, score ${overrideScore}`);

    const rawCache = await readMasteryOutlookCache(courseId, apiClient) ?? {};
    rawCache.current_score_overrides = rawCache.current_score_overrides ?? {};

    rawCache.current_score_overrides[String(studentId)] = {
        score:          overrideScore,
        reason:         reason || null,
        override_by:    String(window.ENV?.current_user_id ?? 'unknown'),
        override_at:    new Date().toISOString(),
        comment_posted: false,
    };

    await writeMasteryOutlookCache(courseId, apiClient, rawCache);
    logger.debug(`[PLActions] current_score_overrides written for student ${studentId}`);

    // TODO: Push overrideScore to Canvas Current Score assignment rubric
    // TODO: Post comment to Current Score assignment if reason is provided

    onRerender?.();
}

/**
 * Clear the Current Score override for one student, reverting to the
 * Power Law average.
 *
 * Removes cache.current_score_overrides[studentId].
 *
 * TODO: Push recalculated Current Score to Canvas avg_assignment.
 *
 * @param {Object}  opts
 * @param {string}  opts.courseId
 * @param {string}  opts.studentId
 * @param {Object}  opts.apiClient
 * @param {Function} opts.onRerender
 */
export async function handleClearCurrentScoreOverride({ courseId, studentId, apiClient, onRerender }) {
    logger.info(`[PLActions] Clear Current Score override: student ${studentId}`);

    const rawCache = await readMasteryOutlookCache(courseId, apiClient) ?? {};
    rawCache.current_score_overrides = rawCache.current_score_overrides ?? {};
    delete rawCache.current_score_overrides[String(studentId)];

    await writeMasteryOutlookCache(courseId, apiClient, rawCache);
    logger.debug(`[PLActions] current_score_overrides cleared for student ${studentId}`);

    // TODO: Push recalculated (non-overridden) Current Score to Canvas

    onRerender?.();
}