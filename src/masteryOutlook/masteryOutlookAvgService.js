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
import { OVERRIDE_SCALE } from '../config.js';

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

        // Step 3: Calculate new averages — only students whose avg changed need
        // a score update. All synced students always get a comment.
        const averages = await calculateStudentAverages(
            rollupResponse, avg_outcome_id, courseId, apiClient
        );

        // Map of userId → new average for students whose score actually changed
        const averageByUserId = new Map(averages.map(a => [String(a.userId), a.average]));

        // Map of userId → current avg rollup score for comment-only students
        const rollupScoreByUserId = new Map();
        (rollupResponse.rollups ?? []).forEach(rollup => {
            const userId   = String(rollup.links?.user);
            const avgScore = (rollup.scores ?? []).find(
                s => String(s.links?.outcome) === String(avg_outcome_id)
            );
            if (avgScore?.score != null) rollupScoreByUserId.set(userId, avgScore.score);
        });

        // Step 4: Get enrollment IDs (memory-cached after first call)
        const enrollmentMap = await getAllEnrollmentIds(courseId, apiClient);

        // Step 5: Build batch params for ALL synced students.
        // Students whose avg changed → rubric score + override + comment.
        // Students whose avg didn't change → comment only (clearPoints: true keeps existing score).
        const timestamp = new Date().toLocaleString();
        const students  = [];

        for (const userId of studentIds.map(String)) {
            const submissionId = submission_ids?.[userId];
            if (!submissionId) {
                logger.warn(`[MOAvgService] No submission ID for student ${userId} — skipping`);
                continue;
            }

            const newAverage   = averageByUserId.get(userId);   // undefined if unchanged
            const currentScore = newAverage ?? rollupScoreByUserId.get(userId);
            const enrollmentId = enrollmentMap.get(userId);
            const noteText     = notes[userId];
            const scoreStr     = currentScore != null ? Number(currentScore).toFixed(2) : '—';

            const comment = noteText?.trim()
                ? `[${outcomeName}] score updated | Note: ${noteText.trim()} | Score: ${scoreStr}  Updated: ${timestamp}`
                : `[${outcomeName}] score updated | Score: ${scoreStr}  Updated: ${timestamp}`;

            const params = {
                submissionId,
                rubricAssociationId: rubric_association_id,
                rubricCriterionId:   criterion_id,
                comment,
                userId,
                customStatusId: null,
            };

            if (newAverage != null) {
                // Avg changed — include rubric score and grade override
                params.points = newAverage;
                params.score  = newAverage;
                if (enrollmentId) {
                    params.enrollmentId    = enrollmentId;
                    params.overrideScore   = OVERRIDE_SCALE(newAverage);
                    params.overrideStatusId = null;
                }
            } else {
                // Avg unchanged — comment only; clearPoints preserves existing Canvas score
                params.clearPoints = true;
            }

            students.push(params);
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
            try {
                await refreshMasteryForAssignment(courseId, assignment_id);
                logger.info(`[MOAvgService] Mastery refreshed for avg assignment ${assignment_id}`);
            } catch (err) {
                logger.warn('[MOAvgService] Mastery refresh failed (non-critical):', err.message);
            }
        }

        return result.errors.length === 0;

    } catch (err) {
        logger.error('[MOAvgService] Avg update failed (non-critical):', err.message);
        return false;
    }
}