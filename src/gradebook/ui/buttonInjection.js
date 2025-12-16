// src/gradebook/ui/buttonInjection.js
/**
 * Button Injection UI
 * 
 * Handles injecting the "Update Average" button into Canvas gradebook toolbar
 * and managing button state (normal vs resume)
 */

import { makeButton, createButtonColumnContainer } from "../../ui/buttons.js";
import { showFloatingBanner } from "../../ui/banner.js";
import { getCourseId } from "../../utils/canvas.js";
import { UPDATE_AVG_BUTTON_LABEL } from "../../config.js";
import { handleError } from "../../utils/errorHandler.js";
import { logger } from "../../utils/logger.js";
import { UpdateFlowStateMachine } from "../stateMachine.js";
import { startUpdateFlow } from "../updateFlowOrchestrator.js";

/**
 * Inject the "Update Average" button into Canvas gradebook toolbar
 */
export function injectButtons() {
    waitForGradebookAndToolbar((toolbar) => {
        const courseId = getCourseId();

        // Create a vertical container for the button and the notice
        const buttonWrapper = document.createElement("div");
        buttonWrapper.style.display = "flex";
        buttonWrapper.style.flexDirection = "column";
        buttonWrapper.style.alignItems = "flex-end"; // keep button right-aligned

        const updateAveragesButton = makeButton({
            label: UPDATE_AVG_BUTTON_LABEL,
            id: "update-scores-button",
            onClick: async () => {
                try {
                   await startUpdateFlow(updateAveragesButton);
                } catch (error) {
                    handleError(error, "updateScores", { showAlert: true });
                }
            },
            type: "primary"
        });

        buttonWrapper.appendChild(updateAveragesButton);

        // Add the wrapper into a column container so it stays on the right
        const buttonContainer = createButtonColumnContainer();
        buttonContainer.appendChild(buttonWrapper);
        toolbar.appendChild(buttonContainer);

        // Check for resumable state and update UI accordingly
        checkForResumableState(courseId, updateAveragesButton);
    });
}

/**
 * Reset button to normal state
 * @param {HTMLButtonElement} button - Button element to reset
 */
export function resetButtonToNormal(button) {
    if (!button) return;

    button.textContent = UPDATE_AVG_BUTTON_LABEL;
    button.title = '';
    button.disabled = false; // Ensure button is enabled
    button.style.cursor = 'pointer'; // Ensure cursor is pointer
    button.style.opacity = '1'; // Ensure full opacity

    // Restore the original primary button color from Canvas theme
    const rootStyles = getComputedStyle(document.documentElement);
    const primaryButtonColor = rootStyles.getPropertyValue("--ic-brand-button--primary-bgd").trim() || "#0c7d9d";
    button.style.backgroundColor = primaryButtonColor;

    logger.debug('Button reset to normal state');
}

/**
 * Check if there's a resumable state in localStorage and update UI accordingly
 * @param {string} courseId - Canvas course ID
 * @param {HTMLButtonElement} button - Button element to update
 */
function checkForResumableState(courseId, button) {
    const stateMachine = new UpdateFlowStateMachine();
    const restored = stateMachine.loadFromLocalStorage(courseId);

    if (restored) {
        const currentState = stateMachine.getCurrentState();
        const stateTimestamp = stateMachine.getContext().timestamp || new Date().toISOString();
        const minutesAgo = Math.round((Date.now() - new Date(stateTimestamp).getTime()) / 60000);

        // Update button text to indicate resumable state
        button.textContent = `Resume Update`;
        button.style.backgroundColor = '#ff9800'; // Orange color to indicate resume
        button.title = `Resume from ${currentState} (${minutesAgo} min ago)`;

        // Show a banner notification
        const banner = showFloatingBanner({
            text: `Previous update interrupted at ${currentState} (${minutesAgo} min ago). Click "Resume Update" to continue.`
        });

        // Auto-dismiss banner after 10 seconds
        setTimeout(() => {
            banner.remove();
        }, 10000);

        logger.info(`Resumable state found: ${currentState} from ${minutesAgo} minutes ago`);
    }
}

/**
 * Wait for Canvas gradebook page and toolbar to be ready
 * @param {Function} callback - Callback to execute when toolbar is found
 */
function waitForGradebookAndToolbar(callback) {
    let attempts = 0;
    const intervalId = setInterval(() => {
        const onGradebookPage = window.location.pathname.includes('/gradebook');
        const documentReady = document.readyState === 'complete';
        const toolbar = document.querySelector(
            '.outcome-gradebook-container nav, [data-testid="gradebook-toolbar"]'
        );

        if (onGradebookPage && documentReady && toolbar) {
            clearInterval(intervalId);
            logger.debug("Gradebook page and toolbar found.");
            callback(toolbar);
        } else if (attempts++ > 33) {
            clearInterval(intervalId);
            logger.warn("Gradebook toolbar not found after 10 seconds, UI not injected.");
        }
    }, 300);
}

