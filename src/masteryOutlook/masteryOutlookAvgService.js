// src/masteryOutlook/masteryOutlookAvgService.js
/**
 * Mastery Outlook → Current Score (Avg) Assignment Service
 *
 * After a teacher pushes Marzano scores for an outcome, updates the Current
 * Score assignment for affected students via one GraphQL call each covering:
 *   1. Rubric score on the avg assignment criterion
 *   2. Course grade override
 *   3. Submission comment (teacher note prefixed with outcome name, or
 *      default timestamp comment if no note)
 *
 * Then calls refreshMasteryForAssignment on the avg assignment.
 *
 * Avg assignment setup is read from the in-memory Mastery Outlook cache
 * (populated during runFullRefresh) — no REST setup calls at sync time.
 */

import { logger } from '../utils/logger.js';
import { calculateStudentAverages } from '../services/gradeCalculator.js';
import { submitRubricAssessment, submitRubricAssessmentBatch } from '../services/graphqlGradingService.js';
import { getAllEnrollmentIds, getEnrollmentIdForUser } from '../services/gradeOverride.js';
import { refreshMasteryForAssignment } from '../services/masteryRefreshService.js';
import { OVERRIDE_SCALE, AVG_OUTCOME_NAME, ENABLE_GRADE_OVERRIDE } from '../config.js';
import { writeMasteryOutlookCache, readSyncState, writeSyncState } from './masteryOutlookCacheService.js';
import { fetchCourseRollupsForVerify, clearCourseRollupReuse, verifyPollDelayMs, VERIFY_NO_PROGRESS_LIMIT_MS } from './masteryOutlookDataService.js';
import { rowsAwaitingOutcome, notifySaveStatus } from './masteryOutlookState.js';

/**
 * Replace one outcome's score in an outcome_rollups response with scores that
 * were just pushed to Canvas, so averages don't depend on Canvas having
 * finished recalculating the rollup. Mutates and returns `rollupResponse`.
 *
 * @param {Object} rollupResponse - { rollups: [{ links: { user }, scores: [{ score, links: { outcome } }] }] }
 * @param {string|number} outcomeId
 * @param {Object} pushedScores   - { [userId]: score }
 * @returns {Object} rollupResponse
 */
export function applyPushedScoresToRollups(rollupResponse, outcomeId, pushedScores = {}) {
    const oId = String(outcomeId);
    for (const rollup of (rollupResponse?.rollups ?? [])) {
        const pushed = pushedScores[String(rollup.links?.user)];
        if (pushed == null) continue;
        rollup.scores = rollup.scores ?? [];
        const existing = rollup.scores.find(s => String(s.links?.outcome) === oId);
        if (existing) existing.score = pushed;
        else rollup.scores.push({ score: pushed, links: { outcome: oId } });
    }
    return rollupResponse;
}

/**
 * Update the Current Score (avg) assignment for students whose Marzano score
 * was just pushed to Canvas via Mastery Outlook.
 *
 * Silent fail — never throws. The Marzano sync already succeeded; avg update
 * is best-effort.
 *
 * @param {Object}   opts
 * @param {string}   opts.courseId
 * @param {string}   opts.outcomeId    - The outcome that was just synced
 * @param {string}   opts.outcomeName  - Used to prefix the comment
 * @param {string[]} opts.studentIds   - Students whose scores were updated
 * @param {Object}   opts.notes        - Map of { [studentId]: noteText }
 * @param {Object}   [opts.pushedScores] - { [studentId]: score } just pushed for outcomeId; used in
 *                                         place of the (possibly not yet updated) Canvas rollup score
 * @param {Object}   opts.cache        - In-memory Mastery Outlook cache
 * @param {Object}   opts.apiClient
 * @returns {Promise<boolean>}
 */
export async function updateAvgAssignmentForStudents({
    courseId, outcomeId, outcomeName, studentIds, notes = {}, pushedScores = {}, cache, apiClient
}) {
    if (!studentIds?.length) return false;

    logger.info(`[MOAvgService] Updating avg for ${studentIds.length} student(s) after outcome ${outcomeId} sync`);

    try {
        // Step 1: Read avg assignment setup from in-memory cache
        const avgSetup = cache?.avg_assignment;
        if (!avgSetup?.assignment_id || !avgSetup?.criterion_id || !avgSetup?.rubric_association_id) {
            logger.warn('[MOAvgService] Avg assignment not set up in cache — run Refresh Data first');
            return false;
        }

        const { assignment_id, criterion_id, rubric_association_id,
                submission_ids, avg_outcome_id } = avgSetup;

        if (!avg_outcome_id) {
            logger.warn('[MOAvgService] avg_outcome_id missing — run Refresh Data to rebuild');
            return false;
        }

        // Step 2: Fetch the course-wide rollup (shared with the override verify poll).
        // outcome_rollups does not support user_ids[] filtering (returns 400); the
        // averages are filtered to studentIds below. Cloned because the shared
        // result is read-only and the pushed scores are substituted in place.
        const rollupResponse = structuredClone(await fetchCourseRollupsForVerify(courseId, apiClient));

        if (!rollupResponse?.rollups?.length) {
            logger.warn('[MOAvgService] No rollup data for affected students');
            return false;
        }

        // Canvas may not have recalculated the rollup yet — use the scores we just pushed
        applyPushedScoresToRollups(rollupResponse, outcomeId, pushedScores);

        // Step 3: Calculate new averages — only students whose avg changed are returned.
        // Limited to the students just saved: other students' Current Scores are not
        // touched by this save (and may depend on scores still settling in Canvas).
        const savedIds = new Set(studentIds.map(String));
        const averages = (await calculateStudentAverages(
            rollupResponse, avg_outcome_id, courseId, apiClient
        )).filter(a => savedIds.has(String(a.userId)));

        if (!averages.length) {
            logger.info('[MOAvgService] No avg updates needed');
            return true;
        }

        // Step 4: Get enrollment IDs (memory-cached after first call)
        const enrollmentMap = await getAllEnrollmentIds(courseId, apiClient);

        // Step 5: Build batch params — one GraphQL call per student whose avg changed.
        // Always includes a comment; score + override included because avg changed.

        // Build Marzano plPrediction lookup for the synced outcome — used in comment
        const plScoreByUserId = new Map();
        (cache?.students ?? []).forEach(student => {
            const od = student.outcomes?.find(o => String(o.outcomeId) === String(outcomeId));
            if (od?.plPrediction != null) {
                plScoreByUserId.set(String(student.id), od.plPrediction);
            }
        });

        const students = [];
        // Teacher course-grade overrides set from the Current Score table: locked ones
        // are left alone; unlocked ones are replaced by the average and cleared below.
        const avgSync = (cache?.sync_state ?? {})[String(avg_outcome_id)] ?? {};
        const unlockedOverrideIds = [];

        for (const { userId, average } of averages) {
            const submissionId = submission_ids?.[String(userId)];
            if (!submissionId) {
                logger.warn(`[MOAvgService] No submission ID for student ${userId} — skipping`);
                continue;
            }

            const csOverride = activeOverrideEntry(avgSync[String(userId)]);
            // Locked: the override sets both the Current Score assignment and the course
            // grade, so writing either would undo it — leave the student alone.
            if (csOverride?.cs_override_lock === 'locked') continue;
            if (csOverride) unlockedOverrideIds.push(String(userId));

            const enrollmentId = enrollmentMap.get(String(userId));
            const noteText     = notes[String(userId)];
            // Prefer the score actually pushed, then will_post (teacher override), then plPrediction
            const syncEntry  = ((cache?.sync_state ?? {})[String(outcomeId)] ?? {})[String(userId)] ?? {};
            const plScore    = pushedScores[String(userId)] ?? syncEntry.will_post ?? plScoreByUserId.get(String(userId));
            const plScoreStr = plScore != null ? Number(plScore).toFixed(2) : '—';
            const avgStr       = Number(average).toFixed(2);

            const comment = noteText?.trim()
                ? `${outcomeName} Score updated: ${plScoreStr}, Note: ${noteText.trim()} | ${AVG_OUTCOME_NAME} updated: ${avgStr}`
                : `${outcomeName} Score updated: ${plScoreStr} | ${AVG_OUTCOME_NAME} updated: ${avgStr}`;

            students.push({
                submissionId,
                rubricAssociationId: rubric_association_id,
                rubricCriterionId:   criterion_id,
                points:              average,
                score:               average,
                comment,
                userId,
                ...(enrollmentId ? {
                    enrollmentId,
                    overrideScore:    OVERRIDE_SCALE(average),
                    overrideStatusId: null,
                } : {}),
                customStatusId: null,
            });
        }

        if (!students.length) {
            logger.info('[MOAvgService] Nothing to update (no submission IDs, or only students with locked overrides)');
            return true;
        }

        // Step 6: Submit via GraphQL batch
        const result = await submitRubricAssessmentBatch(students, apiClient, {
            concurrency:  3,
            maxAttempts:  2,
            retryDelayMs: 500,
        });

        logger.info(
            `[MOAvgService] Batch complete: ${result.successCount}/${students.length} succeeded, `
            + `${result.errors.length} error(s)`
        );

        // Step 7: Refresh mastery after successful updates
        if (result.successCount > 0) {
            // Mark notes as submitted in sync_state so the row clears to synced
            if (Object.keys(notes).length > 0) {
                const syncState   = cache?.sync_state ?? {};
                const outcomeSync = syncState[String(outcomeId)] ?? {};
                for (const [userId, noteText] of Object.entries(notes)) {
                    const entry = outcomeSync[String(userId)];
                    if (entry && noteText?.trim()) {
                        entry.will_post_note_last_submitted = noteText.trim();
                        logger.debug(`[MOAvgService] Note marked as submitted for student ${userId}`);
                    }
                }
            }

            // Post note-only comments for students with notes whose avg didn't change
            const averageByUserId = new Map(averages.map(a => [String(a.userId), a.average]));
            const noteOnlyStudents = {};
            for (const [sid, noteText] of Object.entries(notes)) {
                if (!averageByUserId.has(sid)) {
                    noteOnlyStudents[sid] = noteText;
                }
            }
            if (Object.keys(noteOnlyStudents).length > 0) {
                await postNoteToAvgAssignment({
                    courseId, outcomeId, outcomeName,
                    notes: noteOnlyStudents,
                    cache, apiClient
                }).catch(err => logger.warn('[MOAvgService] Note-only post failed:', err.message));
            }


            // Unlocked teacher overrides were just replaced by the average — clear them
            const failedOverrideIds = new Set((result.errors ?? []).map(e => String(e.userId)));
            for (const uid of unlockedOverrideIds) {
                if (!failedOverrideIds.has(uid)) clearOverrideFields(avgSync[uid]);
            }

            // Persist last_submitted to disk so it survives page reload
            try {
                await writeMasteryOutlookCache(courseId, apiClient, cache);
            } catch (err) {
                logger.warn('[MOAvgService] Failed to persist note submitted state:', err.message);
            }

            try {
                await refreshMasteryForAssignment(courseId, assignment_id);
                logger.info(`[MOAvgService] Mastery refreshed for avg assignment ${assignment_id}`);
            } catch (err) {
                logger.warn('[MOAvgService] Mastery refresh failed (non-critical):', err.message);
            }

            // Step 8: Verify avg scores were accepted by Canvas — in the background.
            // Not awaited: the save queue only waits for the push above. Step 8 reads
            // the shared rollups and records avg_verify_* via the merge-safe writer.
            // Current Score rows show ⏳ until Canvas's Current Score outcome matches.
            const failedIds = new Set((result.errors ?? []).map(e => String(e.userId)));
            const pushedAverages = averages.filter(a => !failedIds.has(String(a.userId)));
            const avgKey = uid => `${avg_outcome_id}_${uid}`;
            const expectedAvg = new Map(pushedAverages.map(a => [String(a.userId), a.average]));
            pushedAverages.forEach(a => rowsAwaitingOutcome.add(avgKey(a.userId)));
            notifySaveStatus(avg_outcome_id);

            verifyAvgScores({
                courseId, apiClient, avgOutcomeId: avg_outcome_id, averages: pushedAverages,
                onProgress: (confirmedIds) => {
                    for (const uid of confirmedIds) {
                        rowsAwaitingOutcome.delete(avgKey(uid));
                        setInMemoryCanvasScore(cache, avg_outcome_id, uid, expectedAvg.get(String(uid)));
                    }
                    notifySaveStatus(avg_outcome_id);
                },
            })
                .catch(err => logger.warn('[MOAvgService] Step 8 avg verify failed (non-critical):', err.message))
                .finally(() => {
                    pushedAverages.forEach(a => rowsAwaitingOutcome.delete(avgKey(a.userId)));
                    notifySaveStatus(avg_outcome_id);
                });
        }

        return result.errors.length === 0;

    } catch (err) {
        logger.error('[MOAvgService] Avg update failed (non-critical):', err.message);
        return false;
    }
}

// ─── Current Score (course grade) override ───────────────────────────────────

/**
 * sync_state[avgOutcomeId][studentId] fields for a teacher's Current Score
 * override set from the Current Score table. Cleared by setting them to null (a
 * merge-safe reset — mergeCacheForWrite would resurrect deleted keys from disk).
 * cs_override_at is when the override was set (kept until it's replaced or
 * cleared); cs_override_lock_at is when the padlock last changed.
 */
export const CS_OVERRIDE_FIELDS = Object.freeze([
    'cs_override_score', 'cs_override_note', 'cs_override_lock', 'cs_override_at',
    'cs_override_by', 'cs_override_lock_at',
]);

function activeOverrideEntry(entry) {
    return entry && entry.cs_override_score !== null && entry.cs_override_score !== undefined ? entry : null;
}

function clearOverrideFields(entry) {
    if (!entry) return;
    for (const f of CS_OVERRIDE_FIELDS) entry[f] = null;
}

function avgSyncEntry(cache, avgOutcomeId, studentId, create = false) {
    const oId = String(avgOutcomeId);
    const sId = String(studentId);
    if (create) {
        cache.sync_state = cache.sync_state ?? {};
        cache.sync_state[oId] = cache.sync_state[oId] ?? {};
        cache.sync_state[oId][sId] = cache.sync_state[oId][sId] ?? {};
    }
    return cache?.sync_state?.[oId]?.[sId] ?? null;
}

/**
 * Current Score assignment setup for one student, or a teacher-readable error.
 * @returns {{ avgOutcomeId, assignmentId, criterionId, rubricAssociationId, submissionId }}
 */
function requireAvgSetup(cache, studentId) {
    const a = cache?.avg_assignment;
    if (!a?.avg_outcome_id || !a.assignment_id || !a.criterion_id || !a.rubric_association_id) {
        throw new Error('Current Score is not set up yet — run Refresh Data first');
    }
    const submissionId = a.submission_ids?.[String(studentId)];
    if (!submissionId) throw new Error('No Current Score submission for this student — run Refresh Data first');
    return {
        avgOutcomeId:        a.avg_outcome_id,
        assignmentId:        a.assignment_id,
        criterionId:         a.criterion_id,
        rubricAssociationId: a.rubric_association_id,
        submissionId,
    };
}

/** "Oct 20, 2026" */
function formatOverrideDate(iso) {
    const d = iso ? new Date(iso) : new Date();
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * One GraphQL call: Current Score assignment rubric score, course grade override
 * (when enabled), and a comment — so nothing is half-written.
 */
async function writeCurrentScore({ courseId, studentId, setup, score, comment, apiClient }) {
    const enrollmentId = ENABLE_GRADE_OVERRIDE ? await getEnrollmentIdForUser(courseId, studentId, apiClient) : null;
    await submitRubricAssessment({
        submissionId:        setup.submissionId,
        rubricAssociationId: setup.rubricAssociationId,
        rubricCriterionId:   setup.criterionId,
        points:              score,
        ...(enrollmentId ? { enrollmentId, overrideScore: OVERRIDE_SCALE(score), overrideStatusId: null } : {}),
        customStatusId:      null,
        comment,
    }, apiClient);
    // Canvas mislabels points_possible = 0 assignments until mastery is refreshed — background.
    refreshMasteryForAssignment(courseId, setup.assignmentId)
        .catch(err => logger.warn('[MOAvgService] Mastery refresh after override failed (non-critical):', err.message));
}

/**
 * The teacher's Current Score override for one student, or null.
 *
 * @param {Object} cache
 * @param {string|number} avgOutcomeId - Current Score outcome ID
 * @param {string|number} studentId
 * @returns {{ score: number, note: string, locked: boolean, at: string|null, by: string|null, lockAt: string|null }|null}
 */
export function getCurrentScoreOverride(cache, avgOutcomeId, studentId) {
    const entry = activeOverrideEntry(avgSyncEntry(cache, avgOutcomeId, studentId));
    if (!entry) return null;
    return {
        score:  Number(entry.cs_override_score),
        note:   entry.cs_override_note ?? '',
        locked: entry.cs_override_lock === 'locked',
        at:     entry.cs_override_at ?? null,
        by:     entry.cs_override_by ?? null,
        lockAt: entry.cs_override_lock_at ?? null,
    };
}

/**
 * Override a student's Current Score from the Current Score table. Sets the
 * Current Score assignment to the override (so the Current Score outcome and the
 * LMGB show it) and the course grade override (0–4 → OVERRIDE_SCALE percent, as
 * "Update Current Score" does), with the date and note as a comment, then records
 * it in sync_state. Keeps the current lock (new overrides start unlocked).
 *
 * @param {Object} opts
 * @param {string|number} opts.courseId
 * @param {string|number} opts.studentId
 * @param {number} opts.score   - 0–4
 * @param {string} [opts.note]
 * @param {Object} opts.cache   - in-memory Mastery Outlook cache (mutated)
 * @param {Object} opts.apiClient
 * @returns {Promise<Object>} the updated sync_state entry
 * @throws {Error} on a bad score, missing Current Score setup, or a Canvas error
 */
export async function setCurrentScoreOverride({ courseId, studentId, score, note = '', cache, apiClient }) {
    const value = Number(score);
    if (!Number.isFinite(value) || value < 0 || value > 4) throw new Error('Override must be a number from 0 to 4');
    const setup = requireAvgSetup(cache, studentId);

    const at = new Date().toISOString();
    const noteText = String(note ?? '').trim();
    const pct = ENABLE_GRADE_OVERRIDE ? ` (${OVERRIDE_SCALE(value)}%)` : '';
    await writeCurrentScore({
        courseId, studentId, setup, score: value, apiClient,
        comment: `${AVG_OUTCOME_NAME} override: ${value.toFixed(2)}${pct} · ${formatOverrideDate(at)}${noteText ? ` · Note: ${noteText}` : ''}`,
    });

    const entry = avgSyncEntry(cache, setup.avgOutcomeId, studentId, true);
    const wasLocked = entry.cs_override_lock === 'locked';
    entry.cs_override_score   = value;
    entry.cs_override_note    = noteText || null;
    entry.cs_override_lock    = wasLocked ? 'locked' : 'unlocked';
    entry.cs_override_lock_at = entry.cs_override_lock_at ?? null;
    entry.cs_override_at      = at;
    entry.cs_override_by      = window.ENV?.current_user?.display_name ?? String(window.ENV?.current_user_id ?? '');
    setInMemoryCanvasScore(cache, setup.avgOutcomeId, studentId, value);
    await writeSyncState(courseId, cache.sync_state, apiClient);
    logger.info(`[MOAvgService] Current Score override set for student ${studentId}: ${value}`);
    return entry;
}

/**
 * Remove a student's Current Score override: recompute the student's real
 * average from fresh rollups and write it back to the Current Score assignment
 * and course grade, then clear the override fields.
 *
 * @param {Object} opts - { courseId, studentId, cache, apiClient }
 * @returns {Promise<number|null>} the restored Current Score
 * @throws {Error} when the average can't be computed or Canvas rejects the write
 */
export async function clearCurrentScoreOverride({ courseId, studentId, cache, apiClient }) {
    const setup = requireAvgSetup(cache, studentId);

    clearCourseRollupReuse();
    const rollups = structuredClone(await fetchCourseRollupsForVerify(courseId, apiClient));
    const mine = { ...rollups, rollups: (rollups?.rollups ?? []).filter(r => String(r.links?.user) === String(studentId)) };
    // Returns the student only when Canvas differs from the average (it does while overridden).
    const [result] = await calculateStudentAverages(mine, setup.avgOutcomeId, courseId, apiClient);
    const average = result?.average ?? null;

    if (average !== null) {
        await writeCurrentScore({
            courseId, studentId, setup, score: average, apiClient,
            comment: `${AVG_OUTCOME_NAME} override removed · ${formatOverrideDate()} · back to ${Number(average).toFixed(2)}`,
        });
        setInMemoryCanvasScore(cache, setup.avgOutcomeId, studentId, average);
    }

    clearOverrideFields(avgSyncEntry(cache, setup.avgOutcomeId, studentId, true));
    await writeSyncState(courseId, cache.sync_state, apiClient);
    logger.info(`[MOAvgService] Current Score override cleared for student ${studentId} (average ${average ?? 'unchanged'})`);
    return average;
}

/**
 * Lock or unlock a student's Current Score override. Locked overrides are left
 * alone by outcome saves and by the gradebook's Update Current Score. No Canvas call.
 *
 * @param {Object} opts - { courseId, studentId, locked, cache, apiClient }
 * @returns {Promise<boolean>} false when the student has no override
 */
export async function setCurrentScoreOverrideLock({ courseId, studentId, locked, cache, apiClient }) {
    const avgOutcomeId = cache?.avg_assignment?.avg_outcome_id;
    if (!avgOutcomeId) throw new Error('Current Score is not set up yet — run Refresh Data first');
    const entry = activeOverrideEntry(avgSyncEntry(cache, avgOutcomeId, studentId));
    if (!entry) return false;
    entry.cs_override_lock    = locked ? 'locked' : 'unlocked';
    entry.cs_override_lock_at = new Date().toISOString();
    await writeSyncState(courseId, cache.sync_state, apiClient);
    return true;
}

/**
 * Set one student's in-memory Canvas score for an outcome (e.g. the confirmed
 * Current Score) so the row shows the new value without a refresh.
 *
 * @param {Object} cache - in-memory Mastery Outlook cache
 * @param {string|number} outcomeId
 * @param {string|number} userId
 * @param {number|undefined} score
 */
function setInMemoryCanvasScore(cache, outcomeId, userId, score) {
    if (score == null) return;
    const od = cache?.students?.find(s => String(s.id) === String(userId))
        ?.outcomes?.find(o => String(o.outcomeId) === String(outcomeId));
    if (od) od.canvasScore = score;
}

/**
 * Step 8 of the Current Score update: poll the shared course-wide rollups until
 * Canvas shows the expected Current Score for each student, then record
 * avg_verify_at / avg_verify_mismatch in sync_state so the status survives reload.
 * Same poll timing as the override verify. Runs in the background after the push.
 *
 * @param {Object} opts
 * @param {string|number} opts.courseId
 * @param {Object}        opts.apiClient
 * @param {string|number} opts.avgOutcomeId - Current Score outcome ID
 * @param {Array<{userId: string|number, average: number}>} opts.averages - expected scores
 * @param {Function}      [opts.onProgress] - (confirmedUserIds: string[]) => void, as students confirm
 * @returns {Promise<string[]>} user IDs that still didn't match when polling stopped
 */
export async function verifyAvgScores({ courseId, apiClient, avgOutcomeId, averages, onProgress = null }) {
    const verifyUserIds   = averages.map(a => String(a.userId));
    const expectedByUser  = new Map(averages.map(a => [String(a.userId), a.average]));

    let avgMismatches     = [...verifyUserIds];
    let lastMismatchCount = Infinity;
    let lastProgressAt    = Date.now();
    let attempt           = 1;

    while (true) {
        logger.debug(`[MOAvgService] Step 8 avg verify poll ${attempt}`);
        const { rollups: verifyRollups } = await fetchCourseRollupsForVerify(courseId, apiClient);

        const actualAvg = new Map();
        verifyRollups.forEach(rollup => {
            const uid = String(rollup.links?.user);
            if (!verifyUserIds.includes(uid)) return;
            const score = rollup.scores?.find(
                s => String(s.links?.outcome) === String(avgOutcomeId)
            )?.score;
            if (score !== undefined) actualAvg.set(uid, score);
        });

        const before = avgMismatches;
        avgMismatches = verifyUserIds.filter(uid => {
            const actual   = actualAvg.get(uid);
            const expected = expectedByUser.get(uid);
            return actual === undefined || Math.abs(actual - expected) >= 0.005;
        });
        const newlyConfirmed = before.filter(uid => !avgMismatches.includes(uid));
        if (newlyConfirmed.length > 0) onProgress?.(newlyConfirmed);

        if (avgMismatches.length === 0) {
            logger.info(`[MOAvgService] Avg scores verified on poll ${attempt}`);
            break;
        }

        if (avgMismatches.length < lastMismatchCount) {
            lastMismatchCount = avgMismatches.length;
            lastProgressAt    = Date.now();
        } else if (Date.now() - lastProgressAt >= VERIFY_NO_PROGRESS_LIMIT_MS) {
            logger.warn(
                `[MOAvgService] ${avgMismatches.length} avg mismatch(es) — no progress for `
                + `${VERIFY_NO_PROGRESS_LIMIT_MS / 1000}s, giving up. `
                + 'There was an issue verifying all grades were updated. Try checking back in a few minutes — '
                + 'if grades show as synced, run the Current Score (avg) update from the Learning Mastery Gradebook '
                + 'to ensure averages are updated. If students still show as not synced after 15+ minutes, '
                + 're-run the Mastery Outlook sync.'
            );
            break;
        }

        const delayMs = verifyPollDelayMs(attempt);
        attempt++;
        await new Promise(r => setTimeout(r, delayMs));
    }

    // Persist avg_verify_at / avg_verify_mismatch so status survives reload
    const syncState = await readSyncState(courseId, apiClient);
    const oId       = String(avgOutcomeId);
    if (!syncState[oId]) syncState[oId] = {};
    const mismatchSet = new Set(avgMismatches);
    const verifyAt    = new Date().toISOString();
    for (const uid of verifyUserIds) {
        syncState[oId][uid] = {
            ...(syncState[oId][uid] ?? {}),
            avg_verify_at:       verifyAt,
            avg_verify_mismatch: mismatchSet.has(uid),
        };
    }
    await writeSyncState(courseId, syncState, apiClient);
    logger.debug(`[MOAvgService] avg verify results persisted for ${verifyUserIds.length} student(s)`);

    return avgMismatches;
}

/**
 * Post teacher notes as submission comments on the Current Score assignment
 * for students whose avg score did NOT change but who have a pending note.
 *
 * NOTE: Uses the Canvas REST submissions API (PUT /submissions/:userId) rather
 * than GraphQL. This is intentional — GraphQL rubric assessment mutations
 * always write criterion data and have no safe comment-only path. The REST
 * comment endpoint posts a submission comment without touching the rubric
 * score or grade override, which is exactly what note-only updates require.
 *
 * Silent fail — never throws. Comment failures are logged as warnings.
 *
 * @param {Object}   opts
 * @param {string}   opts.courseId
 * @param {string}   opts.outcomeName  - Used to prefix the comment
 * @param {Object}   opts.notes        - Map of { [studentId]: noteText }
 * @param {Object}   opts.cache        - In-memory Mastery Outlook cache
 * @param {Object}   opts.apiClient
 * @returns {Promise<boolean>} true if all comments posted, false if any failed
 */
export async function postNoteToAvgAssignment({
    courseId, outcomeId, outcomeName, notes, cache, apiClient
}) {
    const noteEntries = Object.entries(notes ?? {}).filter(([, text]) => text?.trim());
    if (!noteEntries.length) return true;

    const avgSetup = cache?.avg_assignment;
    if (!avgSetup?.assignment_id) {
        logger.warn('[MOAvgService] Avg assignment not in cache — note comments not posted');
        return false;
    }

    const { assignment_id } = avgSetup;
    let allSucceeded = true;

    for (const [userId, noteText] of noteEntries) {
        const plScore    = (cache?.students ?? [])
            .find(s => String(s.id) === String(userId))
            ?.outcomes?.find(o => String(o.outcomeId) === String(outcomeId))
            ?.plPrediction;
        const plScoreStr = plScore != null ? Number(plScore).toFixed(2) : '—';
        const comment    = `${outcomeName} Note: ${noteText.trim()}`;
        try {
            // REST comment endpoint — does not touch rubric score or grade override.
            // See function JSDoc for why REST is used instead of GraphQL here.
            await apiClient.put(
                `/api/v1/courses/${courseId}/assignments/${assignment_id}/submissions/${userId}`,
                { comment: { text_comment: comment } },
                {},
                'MOAvgService:postNoteComment'
            );
            logger.debug(`[MOAvgService] Note comment posted for student ${userId}`);

            // Mark note as submitted so the row clears to synced
            const syncState   = cache?.sync_state ?? {};
            const outcomeSync = syncState[String(outcomeId)] ?? {};
            const entry       = outcomeSync[String(userId)];
            if (entry) {
                entry.will_post_note_last_submitted = noteText.trim();
            }
        } catch (err) {
            logger.warn(`[MOAvgService] Failed to post note for student ${userId}: ${err.message}`);
            allSucceeded = false;
        }
    }

    // Write updated last_submitted values to disk
    try {
        await writeMasteryOutlookCache(courseId, apiClient, cache);
    } catch (err) {
        logger.warn('[MOAvgService] Failed to write cache after note post:', err.message);
    }



    return allSucceeded;
}