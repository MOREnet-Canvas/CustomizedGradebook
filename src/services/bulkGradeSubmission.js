// src/services/bulkGradeSubmission.js
/**
 * Bulk Grade Submission Service
 *
 * Contains the Canvas bulk grade update API path.
 * This path is preserved for reference but is no longer wired into the
 * state machine — the GraphQL per-student path (graphqlGradingService.js)
 * is used exclusively.
 *
 * Exports:
 * - beginBulkUpdate     — initiate a bulk grade update job, returns progress ID
 * - waitForBulkGrading  — poll Canvas progress API until job completes
 */

import { getCourseId } from "../utils/canvas.js";
import { ENABLE_OUTCOME_UPDATES } from "../config.js";
import { getElapsedTimeSinceStart, startElapsedTimer } from "../utils/uiHelpers.js";
import { TimeoutError } from "../utils/errorHandler.js";
import { logger } from "../utils/logger.js";

/**
 * Begin a bulk grade update operation.
 * Submits all grades in a single Canvas API call and returns a progress ID for polling.
 *
 * @param {string} courseId         - Course ID
 * @param {string} assignmentId     - Assignment ID
 * @param {string} rubricCriterionId - Rubric criterion ID
 * @param {Array<{userId: string, average: number}>} averages - Student averages
 * @param {CanvasApiClient} apiClient
 * @returns {Promise<string>} Progress ID for polling
 * @throws {Error} If bulk update fails
 */
export async function beginBulkUpdate(courseId, assignmentId, rubricCriterionId, averages, apiClient) {
    if (!ENABLE_OUTCOME_UPDATES) {
        logger.debug("Outcome updates disabled, skipping bulk update");
        return "SKIPPED_NO_OUTCOME_UPDATES";
    }

    const timeStamp = new Date().toLocaleString();
    const gradeData = {};

    logger.debug("averages:", averages);
    for (const { userId, average } of averages) {
        logger.trace("userId:", userId, "score:", average);
        gradeData[userId] = {
            posted_grade: average,
            text_comment: "Score: " + average + "  Updated: " + timeStamp,
            rubric_assessment: {
                [rubricCriterionId.toString()]: { points: average }
            }
        };
    }

    logger.debug("bulk gradeData payload:", gradeData);

    const result = await apiClient.post(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/update_grades`,
        { grade_data: gradeData },
        {},
        "beginBulkUpdate"
    );

    const progressId = result.id;
    localStorage.setItem(`progressId_${getCourseId()}`, progressId);

    logger.info("Waiting for grading to complete progress ID:", progressId);
    return progressId;
}

/**
 * Wait for a bulk grading operation to complete.
 * Polls the Canvas progress API until the job completes, fails, or times out.
 *
 * @param {Object} box                      - Floating banner UI object (setText/soft methods)
 * @param {CanvasApiClient} apiClient
 * @param {UpdateFlowStateMachine} stateMachine - State machine instance for elapsed time tracking
 * @param {number} [timeout=1200000]        - Max wait time in ms (default: 20 minutes)
 * @param {number} [interval=2000]          - Polling interval in ms (default: 2 seconds)
 * @returns {Promise<void>}
 * @throws {Error} If bulk update fails or times out
 */
export async function waitForBulkGrading(box, apiClient, stateMachine, timeout = 1200000, interval = 2000) {
    const loopStartTime = Date.now();
    const courseId = getCourseId();
    const progressId = localStorage.getItem(`progressId_${courseId}`);
    startElapsedTimer(stateMachine, box);

    while (Date.now() - loopStartTime < timeout) {
        const progress = await apiClient.get(`/api/v1/progress/${progressId}`, {}, "waitForBulkGrading");
        const elapsed = getElapsedTimeSinceStart(stateMachine);
        const state = progress.workflow_state;

        logger.debug(`Bulk Uploading Status: ${state} (elapsed: ${elapsed}s)`);

        if (state !== "completed") {
            box.soft(`Bulk uploading status: ${state.toUpperCase()}. (Elapsed time: ${elapsed}s)`);
        }

        switch (state) {
            case "queued":
            case "running":
                break;
            case "failed":
                logger.error("Bulk update job failed.");
                throw new Error("Bulk update failed.");
            case "completed":
                logger.info("Bulk upload completed: " + progress.updated_at);
                return;
            default:
                break;
        }

        await new Promise(r => setTimeout(r, interval));
    }

    throw new TimeoutError(
        "Bulk update is taking longer than expected. In a few minutes try updating again. If there are no changes to be made the update completed",
        timeout
    );
}
