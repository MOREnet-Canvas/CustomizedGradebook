// src/masteryOutlook/plOutlookActions.js
/**
 * PL Outlook — teacher-initiated actions that mutate sync_state.
 *
 * Each exported function handles ONE discrete teacher action. When called with
 * a `cache` argument the action mutates the in-memory cache, fires onRerender
 * immediately for instant UI feedback, and schedules a debounced background
 * write to Canvas Files. Without `cache` (e.g. dev tools), it falls back to
 * a synchronous read-modify-write.
 *
 * Alignment ignore/unignore additionally trigger a follow-up sync push so
 * Canvas stays current — those handlers await the cache flush before runPLSync.
 *
 * All functions share a common call signature:
 *   { courseId, outcomeId, studentId, cache, apiClient, onRerender, ...actionSpecific }
 */

import { readSyncState, writeSyncState, readMasteryOutlookCache, writeMasteryOutlookCache } from './masteryOutlookCacheService.js';
import { runPLSync } from './plOutlookSync.js';
import { PL_STATES } from './plOutlookStateMachine.js';
import { computeStudentOutcome, roundToHalf } from './powerLaw.js';
import { logger } from '../utils/logger.js';
import { updateAvgAssignmentForStudents, postNoteToAvgAssignment } from './masteryOutlookAvgService.js';
import { syncingStudentIds, syncStudentPhase, syncingOutcomeIds, syncingOutcomePhase } from './masteryOutlookState.js';

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

// ─── Debounced cache writer (optimistic UI + dedupe) ─────────────────────────

/** Trailing-edge debounce window for cache writes. */
const WRITE_DEBOUNCE_MS = 800;

let _writeTimer         = null;
let _writeInFlight      = false;
let _lastWrittenSnapshot = null;

/** Snapshot the persisted-state-bearing fields of the cache for dedupe. */
function snapshotCache(cache) {
    if (!cache) return null;
    return JSON.stringify({
        sync_state:              cache.sync_state              ?? {},
        ignored_alignments:      cache.ignored_alignments      ?? [],
        current_score_overrides: cache.current_score_overrides ?? {},
    });
}

/**
 * Seed the dedupe baseline with the cache as it was loaded from disk.
 * Idempotent — only sets the baseline if none has been recorded and no write is pending.
 * Call once after the cache is loaded by the view.
 */
export function initWriteScheduler(cache) {
    if (_writeTimer || _writeInFlight || _lastWrittenSnapshot !== null) return;
    _lastWrittenSnapshot = snapshotCache(cache);
}

/**
 * Schedule a background write of the in-memory cache. Coalesces rapid mutations
 * within WRITE_DEBOUNCE_MS into a single roundtrip. Skips the write entirely
 * if the cache snapshot matches the last-written snapshot (dedupe).
 */
function scheduleCacheWrite(courseId, cache, apiClient) {
    clearTimeout(_writeTimer);
    _writeTimer = setTimeout(() => {
        _writeTimer = null;
        flushCacheWrite(courseId, cache, apiClient).catch(err => {
            logger.error('[PLActions] Background cache write failed', err);
        });
    }, WRITE_DEBOUNCE_MS);
}

/**
 * Flush any pending cache write immediately. Used by handlers that need the
 * write persisted before a follow-up runPLSync (which reads from disk).
 * Safe to call when nothing is pending (no-op + dedupe).
 */
export async function flushCacheWrite(courseId, cache, apiClient) {
    if (_writeTimer) { clearTimeout(_writeTimer); _writeTimer = null; }
    if (_writeInFlight) {
        // Wait for the in-flight write to settle, then re-flush.
        await new Promise(resolve => {
            const tick = setInterval(() => {
                if (!_writeInFlight) { clearInterval(tick); resolve(); }
            }, 50);
        });
    }

    const snapshot = snapshotCache(cache);
    if (snapshot === _lastWrittenSnapshot) {
        logger.debug('[PLActions] Skip write — cache unchanged from disk');
        return null;
    }

    _writeInFlight = true;
    try {
        const result = await writeMasteryOutlookCache(courseId, apiClient, cache);
        _lastWrittenSnapshot = snapshot;
        return result;
    } catch (err) {
        _lastWrittenSnapshot = null;   // force retry on next click
        throw err;
    } finally {
        _writeInFlight = false;
    }
}

/**
 * Apply a mutation to the sync_state entry for one student × outcome.
 * With `cache`: mutates in memory, fires onRerender immediately, schedules
 * a debounced background write. Without `cache`: synchronous read-modify-write.
 */
async function mutateSyncEntry({ courseId, outcomeId, studentId, cache, apiClient, onRerender }, mutate) {
    if (cache) {
        if (!cache.sync_state) cache.sync_state = {};
        const entry = getOrInitEntry(cache.sync_state, outcomeId, studentId);
        mutate(entry);
        onRerender?.();
        scheduleCacheWrite(courseId, cache, apiClient);
        return;
    }
    const syncState = await readSyncState(courseId, apiClient);
    const entry = getOrInitEntry(syncState, outcomeId, studentId);
    mutate(entry);
    await writeSyncState(courseId, syncState, apiClient);
    onRerender?.();
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
export async function handleConfirmOverride({ courseId, outcomeId, studentId, note = null, cache, apiClient, onRerender }) {
    logger.info(`[PLActions] Confirming override: outcome ${outcomeId}, student ${studentId}`);

    return mutateSyncEntry(
        { courseId, outcomeId, studentId, cache, apiClient, onRerender },
        (entry) => {
            entry.manual_override = true;
            if (note) entry.will_post_note = note;
        }
    );
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
export async function handleDismissOverride({ courseId, outcomeId, studentId, outcomeName, cache, apiClient, onRerender }) {
    logger.info(`[PLActions] Dismissing override: outcome ${outcomeId}, student ${studentId}`);

    await mutateSyncEntry(
        { courseId, outcomeId, studentId, cache, apiClient, onRerender },
        (entry) => {
            entry.manual_override   = false;
            entry.last_synced_score = null;   // force re-sync on next run
            entry.last_synced_at    = null;
            entry.will_post_note    = null;
        }
    );

    // Ensure the cache mutation is on disk before runPLSync (which reads from disk)
    await flushCacheWrite(courseId, cache, apiClient);

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
export async function handleSetWillPost({ courseId, outcomeId, studentId, score, lock = 'unlocked', note = null, cache, apiClient, onRerender }) {
    logger.info(`[PLActions] Set will_post=${score} (lock=${lock}): outcome ${outcomeId}, student ${studentId}`);

    return mutateSyncEntry(
        { courseId, outcomeId, studentId, cache, apiClient, onRerender },
        (entry) => {
            entry.will_post      = score;
            entry.will_post_lock = lock;
            if (note !== null) entry.will_post_note = note;
        }
    );
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
export async function handleClearWillPost({ courseId, outcomeId, studentId, cache, apiClient, onRerender }) {
    logger.info(`[PLActions] Clear will_post: outcome ${outcomeId}, student ${studentId}`);

    return mutateSyncEntry(
        { courseId, outcomeId, studentId, cache, apiClient, onRerender },
        (entry) => {
            entry.will_post      = null;
            entry.will_post_lock = 'none';
            entry.will_post_note = null;
        }
    );
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
export async function handleMarzanoPillClick({ courseId, outcomeId, studentId, cache, apiClient, onRerender }) {
    logger.debug(`[PLActions] Marzano pill click: outcome ${outcomeId}, student ${studentId}`);

    return mutateSyncEntry(
        { courseId, outcomeId, studentId, cache, apiClient, onRerender },
        (entry) => {
            entry.will_post      = null;
            entry.will_post_lock = 'none';
            // will_post_note intentionally preserved — teacher may have context notes
        }
    );
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
export async function handleCanvasPillClick({ courseId, outcomeId, studentId, canvasScore, cache, apiClient, onRerender }) {
    logger.debug(`[PLActions] Canvas pill click (${canvasScore}): outcome ${outcomeId}, student ${studentId}`);

    return mutateSyncEntry(
        { courseId, outcomeId, studentId, cache, apiClient, onRerender },
        (entry) => {
            entry.will_post      = canvasScore;
            entry.will_post_lock = 'unlocked';
        }
    );
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
export async function handleCustomValueTyped({ courseId, outcomeId, studentId, value, cache, apiClient, onRerender }) {
    logger.debug(`[PLActions] Custom value typed (${value}): outcome ${outcomeId}, student ${studentId}`);

    return mutateSyncEntry(
        { courseId, outcomeId, studentId, cache, apiClient, onRerender },
        (entry) => {
            entry.will_post = value;
            // Promote to unlocked if not already locked — typing doesn't downgrade a lock
            if (entry.will_post_lock !== 'locked') entry.will_post_lock = 'unlocked';
        }
    );
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
export async function handleLockWillPost({ courseId, outcomeId, studentId, cache, apiClient, onRerender }) {
    logger.debug(`[PLActions] Lock will_post: outcome ${outcomeId}, student ${studentId}`);

    return mutateSyncEntry(
        { courseId, outcomeId, studentId, cache, apiClient, onRerender },
        (entry) => { entry.will_post_lock = 'locked'; }
    );
}

/**
 * Event 5 — Teacher clicks the padlock again to downgrade to unlocked.
 * Preserves will_post; only changes lock state.
 *
 * @param {Object}   opts  - Same as handleLockWillPost
 */
export async function handleUnlockWillPost({ courseId, outcomeId, studentId, cache, apiClient, onRerender }) {
    logger.debug(`[PLActions] Unlock will_post: outcome ${outcomeId}, student ${studentId}`);

    return mutateSyncEntry(
        { courseId, outcomeId, studentId, cache, apiClient, onRerender },
        (entry) => { entry.will_post_lock = 'unlocked'; }
    );
}

// ─── Note handler (event 6) ──────────────────────────────────────────────────

/**
 * Event 6 — Teacher types in the will_post_note field.
 *
 * Mutates the in-memory cache immediately and lets scheduleCacheWrite coalesce
 * keystrokes into a single trailing-edge background write. No per-cell debounce
 * needed — the cache writer already debounces.
 *
 * Synchronous (returns void) so callers can call from an input event handler
 * without await.
 *
 * @param {Object}   opts
 * @param {string}   opts.courseId
 * @param {string}   opts.outcomeId
 * @param {string}   opts.studentId
 * @param {string}   opts.noteValue  - Current field value (empty string → null)
 * @param {Object}   [opts.cache]
 * @param {Object}   opts.apiClient
 */
export function handleNoteChanged({ courseId, outcomeId, studentId, noteValue, cache, apiClient, onRerender }) {
    if (!cache) {
        // Fallback for callers without an in-memory cache: do a direct read-modify-write.
        readSyncState(courseId, apiClient).then(async (syncState) => {
            const entry = getOrInitEntry(syncState, outcomeId, studentId);
            entry.will_post_note = noteValue.trim() || null;
            await writeSyncState(courseId, syncState, apiClient);
        }).catch(err => logger.error('[PLActions] handleNoteChanged write failed', err));
        return;
    }

    if (!cache.sync_state) cache.sync_state = {};
    const entry = getOrInitEntry(cache.sync_state, outcomeId, studentId);
    entry.will_post_note = noteValue.trim() || null;
    scheduleCacheWrite(courseId, cache, apiClient);
    // Re-render so the amber os-needs-row highlight and save button update
    // immediately when a note is added, changed, or cleared.
    onRerender?.();
}

// ─── Unified student sync ─────────────────────────────────────────────────────

/**
 * Sync one or more students for a single outcome.
 *
 * Handles all sync modes scoped to one outcome:
 *   - One student:  handleSyncStudents({ studentIds: [stuId], ... })
 *   - All students: handleSyncStudents({ studentIds: null, ... })
 *   - Specific set: handleSyncStudents({ studentIds: ['a','b','c'], ... })
 *
 * Post-sync (on success with successCount > 0):
 *   1. Updates canvasScore in-memory for each synced student
 *   2. Writes the full cache to disk once (persists ignored_alignments and
 *      any other pending in-memory mutations)
 *   3. Calls onRerender
 *
 * Guards:
 *   - cachedPLEntry prevents a Canvas Files race condition after Initialize
 *   - plScoreOverrides ensures handleCalculatingChanges uses the current
 *     in-memory plPrediction rather than a stale disk value after ignore/recompute
 *   - successCount > 0 prevents a false "synced" UI state when Canvas was
 *     never touched (zeroUpdates path)
 *
 * @param {Object}        opts
 * @param {string}        opts.courseId
 * @param {string}        opts.outcomeId
 * @param {string}        opts.outcomeName
 * @param {string[]|null} opts.studentIds    - null = all students (runPLSync decides)
 * @param {Object}        opts.apiClient
 * @param {Object}        opts.cache         - In-memory cache (required)
 * @param {Function}      [opts.onProgress]
 * @param {Function}      [opts.onRerender]
 * @returns {Promise<{ success: boolean, successCount: number, errors: Array, stateHistory: string[] }>}
 */
export async function handleSyncStudents({
    courseId, outcomeId, outcomeName,
    studentIds, apiClient, cache, onProgress, onRerender
}) {
    logger.info(`[PLActions] handleSyncStudents — outcome ${outcomeId}, ` +
        `students: ${studentIds ? studentIds.join(',') : 'all'}`);

    // In-memory pl_assignments entry — prevents Canvas Files race condition
    const cachedPLEntry = cache?.pl_assignments?.[outcomeId]
                       ?? cache?.pl_assignments?.[String(outcomeId)]
                       ?? null;

    // Build plScoreOverrides for all target students from in-memory plPrediction.
    // Handles the case where an ignore/recompute changed plPrediction without a
    // disk write — ensures handleCalculatingChanges uses the current value.
    const effectiveIds = studentIds
        ?? (cache?.students ?? []).map(s => String(s.id));

    // Capture the score that will actually be pushed to Canvas for each student.
    // BEFORE runPLSync clears will_post from sync_state.
    // Mirrors handleCalculatingChanges: use will_post when set, otherwise
    // roundToHalf(plPrediction) — the value Canvas actually receives.
    // Using the raw plPrediction here would cause canvasScore to be written
    // with an unrounded value, making the chip/row show "needs sync" forever.
    const pushedScores = {};
    for (const sid of effectiveIds) {
        const entry = ((cache?.sync_state ?? {})[String(outcomeId)] ?? {})[String(sid)] ?? {};
        const od    = cache?.students?.find(s => String(s.id) === String(sid))
            ?.outcomes?.find(o => String(o.outcomeId) === String(outcomeId));
        pushedScores[String(sid)] = entry.will_post
            ?? (od?.plPrediction != null ? roundToHalf(od.plPrediction) : null);
    }

    const plScoreOverrides = {};
    for (const sid of effectiveIds) {
        const student = cache?.students?.find(s => String(s.id) === String(sid));
        const od      = student?.outcomes?.find(o => String(o.outcomeId) === String(outcomeId));
        if (od?.plPrediction != null) {
            plScoreOverrides[String(sid)] = od.plPrediction;
        }
    }

    // F7 (#54) fast-path: feed CALCULATING_CHANGES the canvasScore values already
    // held in memory (refreshed on outcome expansion + load) so it can skip the
    // redundant /outcome_rollups re-fetch. Only the in-memory cache is used — the
    // file cache is NOT authoritative for canvasScore (expansion doesn't persist
    // it). Students without an in-memory canvasScore are omitted so the engine
    // treats them as needing a push, exactly as the network path would for a
    // missing rollup. VERIFYING re-fetches rollups post-push as the backstop.
    const canvasScoreOverrides = {};
    for (const sid of effectiveIds) {
        const student = cache?.students?.find(s => String(s.id) === String(sid));
        const od      = student?.outcomes?.find(o => String(o.outcomeId) === String(outcomeId));
        if (od?.canvasScore != null) {
            canvasScoreOverrides[String(sid)] = od.canvasScore;
        }
    }

    // Capture notes BEFORE runPLSync clears will_post_note from sync_state
    const notes = {};
    for (const sid of effectiveIds) {
        const entry = ((cache?.sync_state ?? {})[String(outcomeId)] ?? {})[String(sid)] ?? {};
        if (entry.will_post_note?.trim()) notes[String(sid)] = entry.will_post_note.trim();
    }

    // F6 Option 2: Mark the outcome as "Checking..." instead of spinning all rows
    // up front. Students will only show spinners after CALCULATING_CHANGES
    // resolves which rows actually need a push.
    const syncKeys = effectiveIds.map(sid => `${outcomeId}_${String(sid)}`);
    syncingOutcomeIds.add(String(outcomeId));
    syncingOutcomePhase.set(String(outcomeId), 'checking');
    onRerender?.();

    // Wrap onProgress to flip the row phase when the state machine enters
    // SYNCING (pushing) and VERIFYING (verifying), re-rendering only on change.
    const phaseProgress = (state, oName, message, done, total) => {
        const phase = state === PL_STATES.SYNCING   ? 'pushing'
                    : state === PL_STATES.VERIFYING ? 'verifying'
                    : null;
        if (phase) {
            let changed = false;
            for (const k of syncKeys) {
                if (syncStudentPhase.get(k) !== phase) { syncStudentPhase.set(k, phase); changed = true; }
            }
            if (changed) onRerender?.();
        }
        onProgress?.(state, oName, message, done, total);
    };

    // Clear in-flight markers for every targeted row. Defined as a helper so the
    // error path and the normal path share identical cleanup.
    const clearSyncKeys = () => {
        syncingOutcomeIds.delete(String(outcomeId));
        syncingOutcomePhase.delete(String(outcomeId));
        for (const k of syncKeys) {
            syncingStudentIds.delete(k);
            syncStudentPhase.delete(k);
        }
    };

    // After CALCULATING_CHANGES resolves the final sync list:
    //   1. Advance the outcome chip from "Checking…" to "Syncing…" (#55) and add
    //      per-row spinners ONLY for students actually being pushed.
    //   2. Capture the resolved IDs for the post-sync canvasScore update below —
    //      we must only update students who were actually synced, not all effectiveIds.
    let resolvedStudentIds = null;
    const onStudentsResolved = (resolvedUserIds) => {
        resolvedStudentIds = new Set(resolvedUserIds);
        const resolvedKeys = new Set(resolvedUserIds.map(id => `${outcomeId}_${id}`));

        // #55: keep the outcome in an active state for the whole run. Advance the
        // chip from "Checking…" to "Syncing…" instead of clearing it here — if we
        // dropped syncingOutcomeIds now, buildSyncChip would briefly fall back to
        // "N need" (canvasScore hasn't been updated until the push completes).
        // Cleared in clearSyncKeys on completion/error, so the chip then jumps
        // straight to "✓ Synced".
        syncingOutcomePhase.set(String(outcomeId), 'syncing');
        for (const k of syncKeys) {
            if (resolvedKeys.has(k)) {
                syncingStudentIds.add(k);
                syncStudentPhase.set(k, 'pushing');
            }
        }
        onRerender?.();
    };

    let result;
    try {
        result = await runPLSync({
            courseId,
            outcomeId,
            outcomeName,
            apiClient,
            targetUserIds:    studentIds ?? null,
            cachedPLEntry,
            plScoreOverrides:     Object.keys(plScoreOverrides).length     > 0 ? plScoreOverrides     : null,
            canvasScoreOverrides: Object.keys(canvasScoreOverrides).length > 0 ? canvasScoreOverrides : null,
            onProgress:         phaseProgress,
            onStudentsResolved,
        });
    } catch (err) {
        // On a thrown error there's no cache write below, so repaint here to
        // clear the spinners and avoid a row stuck showing "Pushing…".
        clearSyncKeys();
        onRerender?.();
        throw err;
    }

    // Normal path: clear the in-flight markers but defer the re-render until
    // after the cache write below, so the row repaints straight to its new
    // canvasScore instead of flickering through the stale value first.
    clearSyncKeys();

    // Update canvasScore in-memory and write cache to disk once after the batch.
    if (result.success && result.successCount > 0) {
        const syncState   = cache?.sync_state ?? {};
        const outcomeSync = syncState[String(outcomeId)] ?? {};

        // Only update students that were actually resolved by handleCalculatingChanges
        // (i.e. had a real score delta). Students skipped for no-change, no submission,
        // no prediction, or manual_override are NOT in resolvedStudentIds and must not
        // have their canvasScore overwritten.
        // Also exclude students whose push failed (present in result.errors).
        const failedIds = new Set((result.errors ?? []).map(e => String(e.userId)));
        const idsToUpdate = resolvedStudentIds
            ? [...resolvedStudentIds].filter(id => !failedIds.has(String(id)))
            : effectiveIds.filter(id => !failedIds.has(String(id)));

        for (const sid of idsToUpdate) {
            const student = cache?.students?.find(s => String(s.id) === String(sid));
            const od      = student?.outcomes?.find(o => String(o.outcomeId) === String(outcomeId));
            if (od != null) {
                od.canvasScore = pushedScores[String(sid)] ?? od.plPrediction;
            }
        }

        try {
            await writeMasteryOutlookCache(courseId, apiClient, cache);
        } catch (err) {
            logger.error('[PLActions] handleSyncStudents — cache write failed', err);
        }
    }

    if (result.success) {
        const syncedIds = effectiveIds.filter(Boolean);

        if (result.successCount > 0) {
            // Scores were pushed — update avg score + post comment via GraphQL
            updateAvgAssignmentForStudents({
                courseId,
                outcomeId,
                outcomeName,
                studentIds: syncedIds,
                notes,
                cache,
                apiClient,
            })
                .then(() => onRerender?.())
                .catch(err => logger.warn('[PLActions] Avg update failed:', err.message));
        } else if (Object.keys(notes).length > 0) {
            // No score change but notes exist — post comment-only via REST.
            // Awaited so onRerender fires after will_post_note_last_submitted
            // is written to cache, letting buildOutcomeStudentRow clear the row.
            // Post note to PL (Projected Score) assignment submissions
            const plSetup = cache?.pl_assignments?.[String(outcomeId)];
            if (plSetup?.assignment_id && plSetup?.submission_ids) {
                for (const [sid, noteText] of Object.entries(notes)) {
                    const submissionId = plSetup.submission_ids?.[String(sid)];
                    if (!submissionId) continue;
                    await apiClient.put(
                        `/api/v1/courses/${courseId}/assignments/${plSetup.assignment_id}/submissions/${submissionId}`,
                        { comment: { text_comment: `${outcomeName} Note: ${noteText.trim()}` } },
                        {},
                        'PLActions:postNoteComment'
                    ).catch(err => logger.warn(`[PLActions] PL note post failed for ${sid}:`, err.message));
                }
            }
            // Post note to Current Score assignment
            await postNoteToAvgAssignment({
                courseId,
                outcomeId,
                outcomeName,
                notes,
                cache,
                apiClient,
            }).catch(err => logger.warn('[PLActions] Note post failed:', err.message));
            onRerender?.();
            return result;
        }
    }

    onRerender?.();
    return result;
}

// ─── Local PL recompute (ignore/unignore path) ───────────────────────────────

/**
 * Recompute plPrediction for one student × outcome from their non-ignored attempts.
 * Mutates cache.students[…].outcomes[…] in place via Object.assign.
 *
 * Attempts in the cache are already chronologically sorted (oldest first) per
 * DATA_STRUCTURES.md, so no sort is needed here.
 *
 * After this runs, the next onRerender() will pick up the new plPrediction from
 * the in-memory cache. buildOutcomeStudentRow derives willPost and row status from
 * it automatically — row highlights and status badges update with no extra wiring.
 *
 * @param {Object} cache      - In-memory cache (mutated)
 * @param {string} outcomeId
 * @param {string} studentId
 */
function recomputeStudentProjection(cache, outcomeId, studentId) {
    const oidStr = String(outcomeId);
    const sidStr = String(studentId);

    const student = (cache.students ?? []).find(s => String(s.id) === sidStr);
    if (!student) { logger.warn(`[PLActions] recompute: student ${sidStr} not in cache`); return; }

    const outcomeData = (student.outcomes ?? []).find(o => String(o.outcomeId) === oidStr);
    if (!outcomeData) { logger.warn(`[PLActions] recompute: outcome ${oidStr} not on student ${sidStr}`); return; }

    const activeScores = (outcomeData.attempts ?? [])
        .filter(a => !(cache.ignored_alignments ?? []).some(ig =>
            ig.student_id  === sidStr &&
            ig.outcome_id  === oidStr &&
            ig.alignment_id === a.assignmentId
        ))
        .map(a => a.score)
        .filter(s => s !== null && s !== undefined);

    const recomputed = computeStudentOutcome(activeScores);
    Object.assign(outcomeData, recomputed);

    logger.debug(
        `[PLActions] Recomputed outcome ${oidStr} for student ${sidStr}: ` +
        `plPrediction=${recomputed.plPrediction}, status=${recomputed.status}, ` +
        `from ${activeScores.length} active attempt(s)`
    );
}

// ─── Alignment ignore / un-ignore (Section 9 automatic chain) ────────────────

/**
 * Ignore a specific alignment for one student × outcome.
 *
 * Automatic chain (spec Section 9):
 *  1. Writes to cache.ignored_alignments
 *  2. Recomputes PL prediction locally from remaining non-ignored attempts
 *  3. Re-renders student row (dot fades, Marzano pill updates, row highlights if needed)
 *
 * No Canvas API call and no cache file write occur on toggle — this is a pure
 * in-memory + re-render operation. The teacher can push the new prediction via
 * the existing "Save grades to Canvas" / per-row save flow.
 *
 * @param {Object}  opts
 * @param {string}  opts.outcomeId
 * @param {string}  opts.studentId
 * @param {string}  opts.alignmentId  - e.g. "assignment_3475"
 * @param {string}  [opts.reason]     - Optional teacher reason (stored in ignored record)
 * @param {Object}  opts.cache        - In-memory cache (required)
 * @param {Function} opts.onRerender
 */
export function handleIgnoreAlignment({ outcomeId, studentId, alignmentId, reason = null, cache, onRerender }) {
    logger.info(`[PLActions] Ignore alignment ${alignmentId}: outcome ${outcomeId}, student ${studentId}`);

    if (!cache) { logger.warn('[PLActions] handleIgnoreAlignment called without cache — no-op'); return; }

    cache.ignored_alignments = cache.ignored_alignments ?? [];

    // Idempotent — do not add a duplicate entry
    const alreadyIgnored = cache.ignored_alignments.some(
        ia => ia.student_id  === String(studentId) &&
              ia.outcome_id  === String(outcomeId)  &&
              ia.alignment_id === alignmentId
    );

    if (!alreadyIgnored) {
        cache.ignored_alignments.push({
            student_id:     String(studentId),
            outcome_id:     String(outcomeId),
            alignment_id:   alignmentId,
            reason:         reason || null,
            ignored_by:     String(window.ENV?.current_user_id ?? 'unknown'),
            ignored_at:     new Date().toISOString(),
            comment_posted: false,
        });
        logger.debug(`[PLActions] ignored_alignments updated (${cache.ignored_alignments.length} total)`);
    }

    recomputeStudentProjection(cache, outcomeId, studentId);
    onRerender?.();
}

/**
 * Un-ignore a previously ignored alignment for one student × outcome.
 *
 * Mirror of handleIgnoreAlignment — removes the entry from cache.ignored_alignments,
 * recomputes PL prediction from the now-larger active set, and re-renders.
 * No Canvas API call or cache file write.
 *
 * @param {Object}  opts
 * @param {string}  opts.outcomeId
 * @param {string}  opts.studentId
 * @param {string}  opts.alignmentId
 * @param {Object}  opts.cache        - In-memory cache (required)
 * @param {Function} opts.onRerender
 */
export function handleUnignoreAlignment({ outcomeId, studentId, alignmentId, cache, onRerender }) {
    logger.info(`[PLActions] Un-ignore alignment ${alignmentId}: outcome ${outcomeId}, student ${studentId}`);

    if (!cache) { logger.warn('[PLActions] handleUnignoreAlignment called without cache — no-op'); return; }

    cache.ignored_alignments = (cache.ignored_alignments ?? []).filter(
        ia => !(ia.student_id  === String(studentId) &&
                ia.outcome_id  === String(outcomeId)  &&
                ia.alignment_id === alignmentId)
    );
    logger.debug(`[PLActions] Alignment un-ignored (${cache.ignored_alignments.length} remaining)`);

    recomputeStudentProjection(cache, outcomeId, studentId);
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