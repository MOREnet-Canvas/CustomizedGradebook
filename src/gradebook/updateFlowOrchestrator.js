// src/gradebook/updateFlowOrchestrator.js
/**
 * Update Flow Orchestrator
 * 
 * Orchestrates the state machine execution for the grade update flow.
 * This is the main entry point that runs the state machine loop.
 */

import { UpdateFlowStateMachine, STATES } from "./stateMachine.js";
import { STATE_HANDLERS } from "./stateHandlers.js";
import { showFloatingBanner } from "../ui/banner.js";
import { updateDebugUI, removeDebugUI } from "./ui/debugPanel.js";
import { resetButtonToNormal } from "./ui/buttonInjection.js";
import { 
    handleError, 
    getUserFriendlyMessage, 
    UserCancelledError, 
    ValidationError 
} from "../utils/errorHandler.js";
import { getCourseId } from "../utils/canvas.js";
import { cleanUpLocalStorage } from "../utils/stateManagement.js";
import { renderLastUpdateNotice } from "../utils/uiHelpers.js";
import { AVG_OUTCOME_NAME } from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Start the update flow
 * @param {HTMLButtonElement} button - Optional button reference for UI updates
 */
export async function startUpdateFlow(button = null) {
    const courseId = getCourseId();
    if (!courseId) throw new ValidationError("Course ID not found", "courseId");

    // Try to restore previous state
    const stateMachine = new UpdateFlowStateMachine();
    const restored = stateMachine.loadFromLocalStorage(courseId);

    if (restored) {
        logger.info('Resuming update flow from saved state:', stateMachine.getCurrentState());
    }

    // Create banner
    const banner = showFloatingBanner({
        text: `Preparing to update "${AVG_OUTCOME_NAME}": checking setup...`
    });

    // Initialize context (include button reference for debug UI)
    stateMachine.updateContext({ courseId, banner, button });

    // Alert user
    alert("You may minimize this browser or switch to another tab, but please keep this tab open until the process is fully complete.");

    try {
        // Start from IDLE if not restored, otherwise continue from saved state
        if (!restored) {
            stateMachine.transition(STATES.CHECKING_SETUP);
        }

        // Run state machine loop
        while (stateMachine.getCurrentState() !== STATES.IDLE) {
            const currentState = stateMachine.getCurrentState();

            // Skip IDLE and ERROR states in the loop
            if (currentState === STATES.IDLE || currentState === STATES.ERROR) {
                break;
            }

            logger.debug(`Executing state: ${currentState}`);

            // Get handler for current state
            const handler = STATE_HANDLERS[currentState];

            if (!handler) {
                throw new Error(`No handler found for state: ${currentState}`);
            }

            // Execute handler and get next state
            const nextState = await handler(stateMachine);

            // Transition to next state
            if (nextState !== currentState) {
                stateMachine.transition(nextState);
            }

            // Save state AFTER transitioning to ensure we save the new state
            stateMachine.saveToLocalStorage(courseId);
            logger.debug(`State saved to localStorage: ${stateMachine.getCurrentState()}`);

            // Update debug UI if in debug mode
            updateDebugUI(stateMachine);
        }

        // Update UI after completion - find the buttonWrapper that contains the button
        const buttonWrapper = document.querySelector('#update-scores-button')?.parentElement;
        if (buttonWrapper) renderLastUpdateNotice(buttonWrapper, courseId);

        // Reset button to normal state after successful completion
        resetButtonToNormal(button);

        // Remove debug UI after completion
        removeDebugUI();

    } catch (error) {
        // Transition to ERROR state
        stateMachine.updateContext({ error });
        stateMachine.transition(STATES.ERROR);
        stateMachine.saveToLocalStorage(courseId);

        // Handle error display
        if (error instanceof UserCancelledError) {
            const userMessage = getUserFriendlyMessage(error);
            alert(`Update cancelled: ${userMessage}`);
            banner.remove();
        } else {
            const userMessage = handleError(error, "startUpdateFlow", { banner });
            setTimeout(() => {
                banner.remove();
            }, 3000);
        }

        cleanUpLocalStorage();

        // Reset button even on error
        resetButtonToNormal(button);

        // Remove debug UI on error
        removeDebugUI();
    } finally {
        // Clear state machine from localStorage
        stateMachine.clearLocalStorage(courseId);
        cleanUpLocalStorage();
    }
}

