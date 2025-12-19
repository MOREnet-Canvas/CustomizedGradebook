import { getCourseId } from "./canvas.js";
import { showFloatingBanner } from "../ui/banner.js";
import { waitForBulkGrading } from "../services/gradeSubmission.js";
import { verifyUIScores } from "../services/verification.js";
import { renderLastUpdateNotice } from "./uiHelpers.js";
import { handleError } from "./errorHandler.js";
import { logger } from "./logger.js";
import { UpdateFlowStateMachine } from "../gradebook/stateMachine.js";
import { STATES } from "../gradebook/stateMachine.js";

/**
 * Clean up all localStorage entries related to grade updates for a course.
 *
 * This function clears the state machine data from localStorage.
 * All temporary state is now stored in the state machine context as a single source of truth.
 *
 * Note: This does NOT remove persistent keys like lastUpdateAt and duration,
 * which are used for the "last update" message display.
 *
 * @returns {void}
 *
 * @example
 * cleanUpLocalStorage(); // Clears state machine data for current course
 */
export function cleanUpLocalStorage() {
    const courseId = getCourseId();
    const stateMachine = new UpdateFlowStateMachine();
    stateMachine.clearLocalStorage(courseId);
}

/**
 * Resume interrupted grade update or verification processes.
 *
 * This function checks the state machine for any interrupted processes and resumes them:
 * 1. If a bulk update is in progress (POLLING_PROGRESS state), resumes polling the progress API
 * 2. If verification is pending (VERIFYING state), runs verification against outcome rollups
 * 3. Cleans up state and refreshes UI after completion
 *
 * This is typically called on page load to handle cases where:
 * - User refreshed the page during a bulk update
 * - Browser crashed during verification
 * - User navigated away and came back
 *
 * The function reads all data from the state machine context (single source of truth):
 * - currentState - Current state of the update flow
 * - context.progressId - Canvas progress API ID
 * - context.outcomeId - Outcome ID to verify
 * - context.averages - Array of expected student averages
 *
 * @returns {Promise<void>}
 *
 * @example
 * // Called on page load
 * await resumeIfNeeded();
 */
export async function resumeIfNeeded() {
    const courseId = getCourseId();

    // Load state machine data (single source of truth)
    const stateMachine = new UpdateFlowStateMachine();
    const restored = stateMachine.loadFromLocalStorage(courseId);

    if (!restored) {
        logger.debug('No resumable state found');
        return;
    }

    const context = stateMachine.getContext();
    const currentState = stateMachine.getCurrentState();

    logger.debug(`Resumable state found: ${currentState}`);

    // If bulk update is in progress, resume polling
    if (currentState === STATES.POLLING_PROGRESS && context.progressId) {
        logger.debug('Resuming bulk upload polling');
        const box = showFloatingBanner({ text: "Resuming: checking upload status" });
        await waitForBulkGrading(box);
        // After polling completes, state machine will transition to VERIFYING
        // We don't need to explicitly verify here - the state machine handles it
    }

    // If verification is pending, run it now
    if (currentState === STATES.VERIFYING && context.averages && context.outcomeId) {
        logger.debug('Resuming verification');
        const box = showFloatingBanner({ text: "Verifying updated scores" });
        try {
            await verifyUIScores(courseId, context.averages, context.outcomeId, box);
            box.setText(`All ${context.averages.length} scores verified!`);
        } catch (e) {
            handleError(e, "resumeIfNeeded:verification", { banner: box });
        } finally {
            // Clear state machine data
            cleanUpLocalStorage();

            // Refresh the header notice if present
            const buttonWrapper = document.querySelector('#update-scores-button')?.parentElement;
            if (buttonWrapper && typeof renderLastUpdateNotice === "function") {
                renderLastUpdateNotice(buttonWrapper, courseId);
            }
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

