import { getCourseId } from "./canvas.js";
import { showFloatingBanner } from "../ui/banner.js";
import { waitForBulkGrading } from "../services/gradeSubmission.js";
import { verifyUIScores } from "../services/verification.js";
import { renderLastUpdateNotice } from "./uiHelpers.js";
import { handleError } from "./errorHandler.js";
import { logger } from "./logger.js";

/**
 * Clean up all localStorage entries related to grade updates for a course.
 * 
 * This function removes all temporary state flags and data used during
 * the grade update process. Should be called after successful completion
 * or when resetting the update state.
 * 
 * Removes the following localStorage keys:
 * - `verificationPending_{courseId}` - Flag indicating verification is pending
 * - `expectedAverages_{courseId}` - JSON array of expected student averages
 * - `uploadFinishTime_{courseId}` - Timestamp when bulk upload finished
 * - `updateInProgress_{courseId}` - Flag indicating update is in progress
 * - `startTime_{courseId}` - Timestamp when update started
 * 
 * @returns {void}
 * 
 * @example
 * cleanUpLocalStorage(); // Cleans up state for current course
 */
export function cleanUpLocalStorage() {
    let courseId = getCourseId();
    localStorage.removeItem(`verificationPending_${courseId}`);
    localStorage.removeItem(`expectedAverages_${courseId}`);
    localStorage.removeItem(`uploadFinishTime_${courseId}`);
    localStorage.removeItem(`updateInProgress_${courseId}`);
    localStorage.removeItem(`startTime_${courseId}`);
}

/**
 * Resume interrupted grade update or verification processes.
 * 
 * This function checks localStorage for any interrupted processes and resumes them:
 * 1. If a bulk update is in progress, resumes polling the progress API
 * 2. If verification is pending, runs verification against outcome rollups
 * 3. Cleans up state and refreshes UI after completion
 * 
 * This is typically called on page load to handle cases where:
 * - User refreshed the page during a bulk update
 * - Browser crashed during verification
 * - User navigated away and came back
 * 
 * The function reads the following from localStorage:
 * - `updateInProgress_{courseId}` - Boolean flag
 * - `verificationPending_{courseId}` - Boolean flag
 * - `progressId_{courseId}` - Canvas progress API ID
 * - `outcomeId_{courseId}` - Outcome ID to verify
 * - `expectedAverages_{courseId}` - JSON array of expected averages
 * 
 * @returns {Promise<void>}
 * 
 * @example
 * // Called on page load
 * await resumeIfNeeded();
 */
export async function resumeIfNeeded() {
    const courseId = getCourseId();
    const inProgress = localStorage.getItem(`updateInProgress_${courseId}`) === "true";
    const verificationPending = localStorage.getItem(`verificationPending_${courseId}`) === "true";
    const progressId = localStorage.getItem(`progressId_${courseId}`);
    const outcomeId = localStorage.getItem(`outcomeId_${courseId}`);
    const expectedAverages = safeParse(localStorage.getItem(`expectedAverages_${courseId}`));

    logger.debug('Checking if resume is needed');
    
    // If a job is still running, re-show banner and resume polling
    if (inProgress && progressId) {
        const box = showFloatingBanner({ text: "Resuming: checking upload status" });
        await waitForBulkGrading(box); // this reads progressId from localStorage
        // after this returns, we may still need to verify (next block)
    }

    // If verification was never done, run it now
    if (verificationPending && courseId && outcomeId && Array.isArray(expectedAverages)) {
        logger.debug('verificationPending');
        const box = showFloatingBanner({ text: "Verifying updated scores" });
        try {
            await verifyUIScores(courseId, expectedAverages, outcomeId, box);
            box.setText(`All ${expectedAverages.length} scores verified!`);
        } catch (e) {
            handleError(e, "resumeIfNeeded:verification", { banner: box });
        } finally {
            // clear verification state regardless
            cleanUpLocalStorage();

            // refresh the header notice if present
            const toolbar = document.querySelector('.outcome-gradebook-container nav, [data-testid="gradebook-toolbar"]');
            if (toolbar && typeof renderLastUpdateNotice === "function") renderLastUpdateNotice(toolbar);
        }
    }
}

/**
 * Safely parse JSON string without throwing errors.
 * 
 * This is a utility function for parsing JSON that might be invalid or null.
 * Returns null instead of throwing an error if parsing fails.
 * 
 * @param {string|null} s - JSON string to parse
 * @returns {any|null} Parsed object or null if parsing fails
 * 
 * @example
 * const data = safeParse(localStorage.getItem('myData'));
 * if (data) {
 *   // Use data
 * }
 */
export function safeParse(s) {
    try { 
        return JSON.parse(s); 
    } catch { 
        return null; 
    }
}

