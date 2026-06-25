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
import { submitRubricAssessmentBatch } from '../services/graphqlGradingService.js';
import { getAllEnrollmentIds } from '../services/gradeOverride.js';
import { refreshMasteryForAssignment } from '../services/masteryRefreshService.js';
import { OVERRIDE_SCALE, AVG_OUTCOME_NAME } from '../config.js';
import { writeMasteryOutlookCache, readSyncState, writeSyncState } from './masteryOutlookCacheService.js';

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
 * @param {Object}   opts.cache        - In-memory Mastery Outlook cache
 * @param {Object}   opts.apiClient
 * @returns {Promise<boolean>}
 */
export async function updateAvgAssignmentForStudents({
    courseId, outcomeId, outcomeName, studentIds, notes = {}, cache, apiClient
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

        // Step 2: Fetch fresh rollup for only the affected students
        const userIdParams   = studentIds.map(id => `user_ids[]=${id}`).join('&');
        const rollupResponse = await apiClient.get(
            `/api/v1/courses/${courseId}/outcome_rollups`
                + `?include[]=outcomes&include[]=users&per_page=100&${userIdParams}`,
            {},
            'MOAvgService:fetchRollup'
        );

        if (!rollupResponse?.rollups?.length) {
            logger.warn('[MOAvgService] No rollup data for affected students');
            return false;
        }

        // Step 3: Calculate new averages — only students whose avg changed are returned.
        // Students with no avg change get no call; notes-only handling is a future prompt.
        const averages = await calculateStudentAverages(
            rollupResponse, avg_outcome_id, courseId, apiClient
        );

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

        for (const { userId, average } of averages) {
            const submissionId = submission_ids?.[String(userId)];
            if (!submissionId) {
                logger.warn(`[MOAvgService] No submission ID for student ${userId} — skipping`);
                continue;
            }

            const enrollmentId = enrollmentMap.get(String(userId));
            const noteText     = notes[String(userId)];
            // Use will_post if set (teacher override) otherwise fall back to plPrediction
            const syncEntry  = ((cache?.sync_state ?? {})[String(outcomeId)] ?? {})[String(userId)] ?? {};
            const plScore    = syncEntry.will_post ?? plScoreByUserId.get(userId);
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
            logger.warn('[MOAvgService] No students with submission IDs — skipping');
            return false;
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

            // Step 8: Verify avg scores were accepted by Canvas — no-progress-in-10-polls loop.
            // Never throws; a failure here does not block COMPLETE.
            try {
                const noProgressLimit = 10;
                const retryDelayMs    = 2000;
                const verifyUserIds   = averages.map(a => String(a.userId));
                const userIdParams    = verifyUserIds.map(id => `user_ids[]=${id}`).join('&');
                const expectedByUser  = new Map(averages.map(a => [String(a.userId), a.average]));

                let avgMismatches    = [];
                let lastMismatchCount = Infinity;
                let noProgressCount  = 0;
                let attempt          = 1;

                while (true) {
                    const verifyResponse = await apiClient.get(
                        `/api/v1/courses/${courseId}/outcome_rollups`
                            + `?outcome_ids[]=${avg_outcome_id}&include[]=outcomes&include[]=users`
                            + `&per_page=100&${userIdParams}`,
                        {},
                        'MOAvgService:verifyAvgRollup'
                    );
                    const verifyRollups = verifyResponse?.rollups || [];

                    const actualAvg = new Map();
                    verifyRollups.forEach(rollup => {
                        const uid = String(rollup.links?.user);
                        if (!verifyUserIds.includes(uid)) return;
                        const score = rollup.scores?.find(
                            s => String(s.links?.outcome) === String(avg_outcome_id)
                        )?.score;
                        if (score !== undefined) actualAvg.set(uid, score);
                    });

                    avgMismatches = verifyUserIds.filter(uid => {
                        const actual   = actualAvg.get(uid);
                        const expected = expectedByUser.get(uid);
                        return actual === undefined || Math.abs(actual - expected) >= 0.005;
                    });

                    if (avgMismatches.length === 0) {
                        logger.info(`[MOAvgService] Avg scores verified on poll ${attempt}`);
                        break;
                    }

                    if (avgMismatches.length < lastMismatchCount) {
                        lastMismatchCount = avgMismatches.length;
                        noProgressCount   = 0;
                    } else {
                        noProgressCount++;
                    }

                    if (noProgressCount >= noProgressLimit) {
                        logger.warn(
                            `[MOAvgService] ${avgMismatches.length} avg mismatch(es) — no progress for `
                            + `${noProgressLimit} polls, giving up. `
                            + 'There was an issue verifying all grades were updated. Try checking back in a few minutes — '
                            + 'if grades show as synced, run the Current Score (avg) update from the Learning Mastery Gradebook '
                            + 'to ensure averages are updated. If students still show as not synced after 15+ minutes, '
                            + 're-run the Mastery Outlook sync.'
                        );
                        break;
                    }

                    attempt++;
                    await new Promise(r => setTimeout(r, retryDelayMs));
                }

                // Persist avg_verify_at / avg_verify_mismatch so status survives reload
                const syncState = await readSyncState(courseId, apiClient);
                const oId       = String(avg_outcome_id);
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
            } catch (err) {
                logger.warn('[MOAvgService] Step 8 avg verify failed (non-critical):', err.message);
            }
        }

        return result.errors.length === 0;

    } catch (err) {
        logger.error('[MOAvgService] Avg update failed (non-critical):', err.message);
        return false;
    }
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