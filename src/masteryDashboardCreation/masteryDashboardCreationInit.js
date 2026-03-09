// src/masteryDashboardCreation/masteryDashboardCreationInit.js
/**
 * Mastery Dashboard Creation Module - Main Entry Point
 * 
 * Provides a button in course settings to create:
 * 1. A "Mastery Dashboard" page with parent-mastery-root div
 * 2. A button on the course front page linking to the dashboard
 * 
 * This module is for teachers to set up the mastery dashboard for mobile parent access.
 */

import { logger } from '../utils/logger.js';
import { injectMasteryDashboardButton } from './buttonInjection.js';

let initialized = false;

/**
 * Initialize mastery dashboard creation module
 * Main entry point called from customGradebookInit.js
 */
export function initMasteryDashboardCreation() {
    if (initialized) {
        logger.trace('[MasteryDashboard] Already initialized');
        return;
    }

    initialized = true;
    logger.info('[MasteryDashboard] Initializing mastery dashboard creation module');

    // Inject button into settings sidebar
    injectMasteryDashboardButton();
}

