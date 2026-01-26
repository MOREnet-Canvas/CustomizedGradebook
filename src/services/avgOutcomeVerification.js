import { getCourseId } from "../utils/canvas.js";
import { CanvasApiClient } from "../utils/canvasApiClient.js";
import { getElapsedTimeSinceStart, startElapsedTimer } from "../utils/uiHelpers.js";
import { logger } from "../utils/logger.js";

/**
 * Verify that updated scores match the backend outcome rollups.
 *
 * This function polls the Canvas outcome rollups API to verify that the scores
 * we submitted have been successfully recorded in the backend. It compares the
 * expected averages against the actual scores in the outcome rollups.
 *
 * The verification process:
 * 1. Fetches current outcome rollups from Canvas API
 * 2. Compares each student's expected average against their actual score
 * 3. If all scores match (within 0.001 tolerance), verification succeeds
 * 4. If mismatches found, waits and retries up to maxRetries times
 * 5. Records successful verification timestamp in localStorage
 *
 * @param {string} courseId - The Canvas course ID
 * @param {Array<{userId: string, average: number}>} averages - Expected averages for each student
 * @param {string} outcomeId - The outcome ID to verify against
 * @param {Object} box - Floating banner UI object with soft() and setText() methods
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @param {UpdateFlowStateMachine} stateMachine - State machine instance for elapsed time tracking
 * @param {number} [waitTimeMs=5000] - Milliseconds to wait between retry attempts
 * @param {number} [maxRetries=50] - Maximum number of verification attempts
 *
 * @returns {Promise<void>} Resolves when all scores are verified
 * @throws {Error} If verification fails after maxRetries attempts (implicitly - no explicit throw)
 *
 * @example
 * const averages = [
 *   { userId: "12345", average: 3.5 },
 *   { userId: "67890", average: 2.8 }
 * ];
 * await verifyUIScores(courseId, averages, outcomeId, bannerBox, apiClient, stateMachine);
 */
export async function verifyUIScores(courseId, averages, outcomeId, box, apiClient, stateMachine, waitTimeMs = 5000, maxRetries = 50) {
    let state = "verifying";

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let elapsed = getElapsedTimeSinceStart(stateMachine);
        box.soft(`Status ${state.toUpperCase()}. (Elapsed time: ${elapsed}s)`);
        startElapsedTimer(stateMachine, box);

        // Fetch current outcome rollups from Canvas
        const newRollupData = await apiClient.get(
            `/api/v1/courses/${courseId}/outcome_rollups?outcome_ids[]=${outcomeId}&include[]=outcomes&include[]=users&per_page=100`,
            {},
            "verifyUIScores"
        );
        logger.debug('newRollupData: ', newRollupData);

        const mismatches = [];

        // Compare expected vs actual scores for each student
        for (const { userId, average } of averages) {
            const matchingRollup = newRollupData.rollups.find(
                r => r.links.user.toString() === userId.toString()
            );

            if (!matchingRollup) {
                mismatches.push({ userId, reason: "No rollup found." });
                continue;
            }

            const scoreObj = matchingRollup.scores[0];

            if (!scoreObj) {
                mismatches.push({ userId, reason: "No score found." });
                continue;
            }

            const score = scoreObj.score;
            const matches = Math.abs(score - average) < 0.001;

            if (!matches) {
                mismatches.push({ userId, expected: average, actual: score });
            }
        }

        // If all scores match, verification successful
        if (mismatches.length === 0) {
            logger.info("All averages match backend scores.");
            localStorage.setItem(`lastUpdateAt_${getCourseId()}`, new Date().toISOString());
            const durationSeconds = getElapsedTimeSinceStart(stateMachine);
            localStorage.setItem(`duration_${getCourseId()}`, durationSeconds);
            return;
        } else {
            // Mismatches found - wait and retry
            logger.warn("Mismatches found:", mismatches);
            logger.info(`Waiting ${waitTimeMs / 1000} seconds before retrying...`);
            await new Promise(resolve => setTimeout(resolve, waitTimeMs));
        }
    }

    // If we exit the loop without returning, verification failed after maxRetries
    // The function will implicitly return undefined, and the caller should handle this
}

