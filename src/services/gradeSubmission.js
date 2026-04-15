// src/services/gradeSubmission.js
/**
 * Grade Submission Service
 *
 * This module handles all grade submission operations to Canvas.
 * Handles per-student grade submission (REST path) with retry logic
 * and a downloadable error summary CSV.
 *
 * Note: The bulk update path has been moved to bulkGradeSubmission.js
 * and is no longer wired into the state machine.
 *
 * Key responsibilities:
 * - Submit individual rubric scores (REST)
 * - Submit grades per-student with retry logic
 * - Download error summaries
 */

import { CanvasApiClient } from "../utils/canvasApiClient.js";
import {
    AVG_OUTCOME_NAME,
    ENABLE_OUTCOME_UPDATES,
    ENABLE_GRADE_OVERRIDE,
    OVERRIDE_SCALE
} from "../config.js";
import { getElapsedTimeSinceStart } from "../utils/uiHelpers.js";
import { queueOverride, getEnrollmentIdForUser, setOverrideScoreGQL } from "./gradeOverride.js";
import { logError } from "../utils/errorHandler.js";
import { logger } from "../utils/logger.js";

/**
 * Submit a rubric score for a single student
 * @param {string} courseId - Course ID
 * @param {string} assignmentId - Assignment ID
 * @param {string} userId - User ID
 * @param {string} rubricCriterionId - Rubric criterion ID
 * @param {number} score - Score to submit
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<void>}
 * @throws {Error} If submission fails
 */
export async function submitRubricScore(courseId, assignmentId, userId, rubricCriterionId, score, apiClient) {
    // Check if outcome updates are enabled
    if (!ENABLE_OUTCOME_UPDATES) {
        logger.trace(`Outcome updates disabled, skipping rubric score submission for user ${userId}`);
        return;
    }

    const timeStamp = new Date().toLocaleString();

    logger.trace("Submitting rubric score for student", userId);
    const payload = {
        rubric_assessment: {  // updates the rubric score.
            [rubricCriterionId.toString()]: {
                points: score,
            }
        },
        submission: { //updates assignment score to match rubric score.
            posted_grade: score.toString(),
            score: score
        },
        comment: {
            text_comment: "Score: " + score + "  Updated: " + timeStamp,
        }
    };

    logger.trace("Submitting rubric score for student", userId, payload);

    await apiClient.put(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
        payload,
        {},
        `submitRubricScore:${userId}`
    );

    logger.trace("Score submitted successfully for user", userId);
}


/**
 * Submit grades for students one-by-one (per-student update strategy)
 * Used for smaller courses (<500 students)
 * Includes retry logic and error tracking
 * @param {Array<{userId: string, average: number}>} averages - Array of student averages
 * @param {string} courseId - Course ID
 * @param {string} assignmentId - Assignment ID
 * @param {string} rubricCriterionId - Rubric criterion ID
 * @param {Object} box - Floating banner UI object
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @param {boolean} testing - If true, auto-download error summary without confirmation
 * @returns {Promise<number>} Elapsed time in seconds
 */
export async function postPerStudentGrades(averages, courseId, assignmentId, rubricCriterionId, box, apiClient, testing = false) {
    const updateInterval = 1;
    const numberOfUpdates = averages.length;

    // Log grading mode
    logger.debug(`Per-student grading mode: ENABLE_OUTCOME_UPDATES=${ENABLE_OUTCOME_UPDATES}, ENABLE_GRADE_OVERRIDE=${ENABLE_GRADE_OVERRIDE}`);

    // Set banner message based on grading mode
    const updateMessage = ENABLE_OUTCOME_UPDATES && ENABLE_GRADE_OVERRIDE
        ? `Updating "${AVG_OUTCOME_NAME}" and grade overrides for ${numberOfUpdates} students...`
        : ENABLE_OUTCOME_UPDATES
            ? `Updating "${AVG_OUTCOME_NAME}" scores for ${numberOfUpdates} students...`
            : `Updating grade overrides for ${numberOfUpdates} students...`;
    box.setText(updateMessage);

    const failedUpdates = [];
    const retryCounts = {};  // userId -> number of attempts
    const retriedStudents = new Set();  // tracks students who needed >1 attempt

    async function tryUpdateStudent(student, maxAttempts = 3) {
        const { userId, average } = student;
        let lastError = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await submitRubricScore(courseId, assignmentId, userId, rubricCriterionId, average, apiClient);
                // --- also set course override (non-blocking) ---
                if (ENABLE_GRADE_OVERRIDE) {
                    try {
                        const enrollmentId = await getEnrollmentIdForUser(courseId, userId, apiClient);
                        if (enrollmentId) {
                            const override = OVERRIDE_SCALE(average);
                            await setOverrideScoreGQL(enrollmentId, override, apiClient);
                            logger.debug(`[override] user ${userId} → enrollment ${enrollmentId}: ${override}`);
                        } else {
                            logger.warn(`[override] no enrollmentId for user ${userId}`);
                        }
                    } catch (e) {
                        logger.warn(`[override] failed for user ${userId}:`, e?.message || e);
                        // don't fail the grade update on override issues
                    }
                }
                // --- end override block ---

                retryCounts[userId] = attempt;
                if (attempt > 1) retriedStudents.add(userId);
                return true;
            } catch (err) {
                lastError = err;
                if (attempt === 1) retryCounts[userId] = 1;
                else retryCounts[userId]++;
                logger.warn(`Attempt ${attempt} failed for student ${userId}:`, err.message);
            }
        }

        return lastError;
    }

    // First pass
    const deferred = [];

    for (let i = 0; i < numberOfUpdates; i++) {
        const student = averages[i];
        const result = await tryUpdateStudent(student, 3);
        if (result !== true) {
            deferred.push({ ...student, error: result.message });
        }

        if (i % updateInterval === 0 || i === numberOfUpdates - 1) {
            box.setText(`Updating "${AVG_OUTCOME_NAME}"  ${i + 1} of ${numberOfUpdates} students processed`);
        }
    }

    logger.info(`Retrying ${deferred.length} students...`);

    // Retry failed students
    for (const student of deferred) {
        const retryResult = await tryUpdateStudent(student, 3);
        if (retryResult !== true) {
            failedUpdates.push({
                userId: student.userId,
                average: student.average,
                error: retryResult.message
            });
        }
    }

    const totalRetried = retriedStudents.size;
    const retrySummary = Object.entries(retryCounts)
        .filter(([_, count]) => count > 1)
        .map(([userId, count]) => ({ userId, attempts: count }));

    logger.info(`${totalRetried} students needed more than one attempt.`);
    console.table(retrySummary);

    let confirmSummaryDownload = false;

    if (testing) { confirmSummaryDownload = true; }

    if (failedUpdates.length > 0) {
        logger.warn("Scores of the following students failed to update:", failedUpdates);
    }

    if ((failedUpdates.length > 0 || retrySummary.length > 0) && !testing) {
        confirmSummaryDownload = confirm(`Export grade update attempt counts and failure logs to a file? \n\n
           Note: Your browser settings or extensions may block automatic file downloads.\n
           If nothing downloads, please check your pop-up or download permissions.`);
    }

    if (confirmSummaryDownload) {
        downloadErrorSummary(retrySummary, failedUpdates);
    }

    return getElapsedTimeSinceStart();
}

/**
 * Download a CSV summary of retry counts and failed updates
 * @param {Array<{userId: string, attempts: number}>} retryCounts - Array of retry counts
 * @param {Array<{userId: string, average: number, error: string}>} failedUpdates - Array of failed updates
 */
export function downloadErrorSummary(retryCounts, failedUpdates) {
    const note = 'Unless marked "UPDATE FAILED", the students score was successfully updated but took multiple attempts.\n';
    const headers = "User ID,Average Score,Attempts,Status,Error\n";

    const failedById = Object.fromEntries(
        failedUpdates.map(d => [d.userId, d])
    );

    const allUserIds = new Set([
        ...retryCounts.map(r => r.userId),
        ...Object.keys(failedById)
    ]);

    const retryCountsById = Object.fromEntries(
        retryCounts.map(r => [r.userId, r.attempts])
    );

    const rows = Array.from(allUserIds).map(userId => {
        const attempts = retryCountsById[userId] ?? "";
        const failed = failedById[userId];
        const average = failed?.average ?? "";
        const status = failed ? "UPDATE FAILED" : "";
        const error = failed?.error ? `"${failed.error.replace(/"/g, '""')}"` : "";
        return `${userId},${average},${attempts},${status},${error}`;
    });

    const content = note + headers + rows.join("\n");
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "canvas_upload_error_summary.csv";
    link.click();
    URL.revokeObjectURL(url);
}