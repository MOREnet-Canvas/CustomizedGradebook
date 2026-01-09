// src/services/gradeSubmission.js
/**
 * Grade Submission Service
 *
 * This module handles all grade submission operations to Canvas.
 * It supports two update strategies:
 * - Bulk update: For large courses (>500 students) - uses Canvas bulk API
 * - Per-student update: For smaller courses - updates students one-by-one
 *
 * Key responsibilities:
 * - Submit individual rubric scores
 * - Initiate bulk grade updates
 * - Poll bulk update progress
 * - Submit grades per-student with retry logic
 * - Download error summaries
 */

import { getCourseId } from "../utils/canvas.js";
import { CanvasApiClient } from "../utils/canvasApiClient.js";
import {
    AVG_OUTCOME_NAME,
    ENABLE_OUTCOME_UPDATES,
    ENABLE_GRADE_OVERRIDE,
    OVERRIDE_SCALE
} from "../config.js";
import { getElapsedTimeSinceStart, startElapsedTimer } from "../utils/uiHelpers.js";
import { queueOverride, getEnrollmentIdForUser, setOverrideScoreGQL } from "./gradeOverride.js";
import { logError, TimeoutError } from "../utils/errorHandler.js";
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
 * Begin a bulk grade update operation
 * Submits all grades at once and returns a progress ID for polling
 * @param {string} courseId - Course ID
 * @param {string} assignmentId - Assignment ID
 * @param {string} rubricCriterionId - Rubric criterion ID
 * @param {Array<{userId: string, average: number}>} averages - Array of student averages
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<string>} Progress ID for polling
 * @throws {Error} If bulk update fails
 */
export async function beginBulkUpdate(courseId, assignmentId, rubricCriterionId, averages, apiClient) {
    // Check if outcome updates are enabled
    if (!ENABLE_OUTCOME_UPDATES) {
        logger.debug('Outcome updates disabled, skipping bulk update');
        // Return a fake progress ID that will be handled gracefully
        return 'SKIPPED_NO_OUTCOME_UPDATES';
    }

    const timeStamp = new Date().toLocaleString();

    // Build grade_data object
    const gradeData = {};
    logger.debug("averages:", averages);
    for (const { userId, average } of averages) {
        logger.trace("userId:", userId, "score:", average);
        gradeData[userId] = {
            posted_grade: average,
            text_comment: "Score: " + average + "  Updated: " + timeStamp,
            rubric_assessment: {
                [rubricCriterionId.toString()]: {
                    points: average,
                }
            }
        };
    }
    logger.debug("bulk gradeData payload:", gradeData);

    const result = await apiClient.post(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/update_grades`,
        {
            grade_data: gradeData
        },
        {},
        "beginBulkUpdate"
    );

    const progressId = result.id;
    localStorage.setItem(`progressId_${getCourseId()}`, progressId);

    logger.info("Waiting for grading to complete progress ID:", progressId);
    return progressId;
}




/**
 * Wait for bulk grading operation to complete
 * Polls the Canvas progress API until the operation completes, fails, or times out
 * @param {Object} box - Floating banner UI object with setText/soft methods
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @param {UpdateFlowStateMachine} stateMachine - State machine instance for elapsed time tracking
 * @param {number} timeout - Maximum time to wait in milliseconds (default: 20 minutes)
 * @param {number} interval - Polling interval in milliseconds (default: 2 seconds)
 * @returns {Promise<void>}
 * @throws {Error} If bulk update fails or times out
 */
export async function waitForBulkGrading(box, apiClient, stateMachine, timeout = 1200000, interval = 2000) {
    const loopStartTime = Date.now();
    let state = "beginning upload";
    const courseId = getCourseId();
    const progressId = localStorage.getItem(`progressId_${courseId}`);
    startElapsedTimer(stateMachine, box); // makes elapsed time tick each second

    while (Date.now() - loopStartTime < timeout) {
        const progress = await apiClient.get(`/api/v1/progress/${progressId}`, {}, "waitForBulkGrading");
        let elapsed = getElapsedTimeSinceStart(stateMachine);

        state = progress.workflow_state;

        logger.debug(`Bulk Uploading Status: ${state} (elapsed: ${elapsed}s)`);

        // Don't show "COMPLETED" status to avoid user confusion
        if (state !== "completed") {
            box.soft(`Bulk uploading status: ${state.toUpperCase()}. (Elapsed time: ${elapsed}s)`);
        }

        switch (state) {
            case "queued":
                break;

            case "running":
                break;

            case "failed":
                logger.error("Bulk update job failed.");
                throw new Error("Bulk update failed.");

            case "completed":
                logger.info("Bulk upload completed: " + progress.updated_at);
                // Note: uploadFinishTime was removed as dead code (never read)
                // Note: updateInProgress was removed - state machine tracks progress instead
                return;

            default:
                break;
        }

        await new Promise(r => setTimeout(r, interval));
    }

    throw new TimeoutError(
        `Bulk update is taking longer than expected. In a few minutes try updating again. If there are no changes to be made the update completed`,
        timeout
    );
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

