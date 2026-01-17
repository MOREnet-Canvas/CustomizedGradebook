// src/speedgrader/gradingDropdown.js
/**
 * SpeedGrader Grading Dropdown Auto-Activator
 * 
 * Automatically enables the grading dropdown in Canvas SpeedGrader by removing
 * disabled/readonly attributes that Canvas may apply.
 * 
 * Features:
 * - Detects and activates grading dropdown on page load
 * - Monitors DOM changes to re-activate dropdown when needed
 * - Handles Canvas SPA navigation and dynamic content updates
 * - Graceful error handling and logging
 */

import { logger } from '../utils/logger.js';
import { createPersistentObserver, OBSERVER_CONFIGS } from '../utils/observerHelpers.js';

/**
 * Track if initialization has been attempted
 */
let initialized = false;

/**
 * MutationObserver instance for watching grading dropdown changes
 */
let gradingDropdownObserver = null;

/**
 * ID of the grading dropdown element
 */
const GRADING_DROPDOWN_ID = 'grading-box-extended';

/**
 * Activate the grading dropdown by removing disabled/readonly attributes
 * This allows teachers to manually override grades even when Canvas disables the dropdown
 */
function activateGradingDropdown() {
    const gradingBox = document.getElementById(GRADING_DROPDOWN_ID);
    
    if (!gradingBox) {
        logger.trace(`Grading dropdown element #${GRADING_DROPDOWN_ID} not found`);
        return;
    }
    
    // Check if dropdown is already active
    if (!gradingBox.hasAttribute('disabled') && 
        !gradingBox.hasAttribute('readonly') &&
        !gradingBox.hasAttribute('aria-disabled')) {
        logger.trace('Grading dropdown already active');
        return;
    }
    
    // Remove all disabled/readonly attributes
    gradingBox.removeAttribute('disabled');
    gradingBox.removeAttribute('readonly');
    gradingBox.removeAttribute('aria-disabled');
    gradingBox.classList.remove('ui-state-disabled');
    
    logger.debug('Grading dropdown activated - removed disabled/readonly attributes');
}

/**
 * Setup MutationObserver to watch for grading dropdown changes
 * Handles both initial page load and dynamic content updates
 */
function setupGradingDropdownObserver() {
    // Clean up existing observer
    if (gradingDropdownObserver) {
        gradingDropdownObserver.disconnect();
    }

    // Create new observer with custom attribute filter
    const customConfig = {
        ...OBSERVER_CONFIGS.CHILD_LIST_AND_ATTRIBUTES,
        attributeFilter: ['disabled', 'readonly', 'aria-disabled', 'class']
    };

    gradingDropdownObserver = createPersistentObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Handle new nodes being added to the DOM
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    // Only process element nodes (not text nodes, comments, etc.)
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node is the grading dropdown
                        if (node.id === GRADING_DROPDOWN_ID) {
                            logger.trace('Grading dropdown added to DOM, activating');
                            activateGradingDropdown();
                        }
                        // Check if the added node contains the grading dropdown
                        else if (node.querySelector && node.querySelector(`#${GRADING_DROPDOWN_ID}`)) {
                            logger.trace('Grading dropdown found in added subtree, activating');
                            activateGradingDropdown();
                        }
                    }
                });
            }
            // Handle attribute changes on the grading dropdown
            else if (mutation.type === 'attributes' && mutation.target.id === GRADING_DROPDOWN_ID) {
                logger.trace(`Grading dropdown attribute changed: ${mutation.attributeName}`);
                activateGradingDropdown();
            }
        });
    }, {
        config: customConfig,
        target: document.body,
        name: 'GradingDropdownObserver'
    });
}

/**
 * Initialize SpeedGrader grading dropdown auto-activator
 * Main entry point called from main.js
 */
export function initSpeedGraderDropdown() {
    if (initialized) {
        logger.trace('SpeedGrader grading dropdown already initialized');
        return;
    }
    
    initialized = true;
    logger.info('Initializing SpeedGrader grading dropdown auto-activator');
    
    // Initial activation attempt
    activateGradingDropdown();
    
    // Setup observer for dynamic changes
    setupGradingDropdownObserver();
    
    logger.info('SpeedGrader grading dropdown auto-activator started');
}

/**
 * Cleanup function (useful for testing or if needed)
 */
export function cleanupSpeedGraderDropdown() {
    if (gradingDropdownObserver) {
        gradingDropdownObserver.disconnect();
        gradingDropdownObserver = null;
    }
    initialized = false;
    logger.trace('SpeedGrader grading dropdown auto-activator cleaned up');
}

